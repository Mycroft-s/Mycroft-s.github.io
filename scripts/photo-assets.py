#!/usr/bin/env python3
"""Rebuild photography metadata and web-sized copies without changing originals.

Requires Python 3.10+ and Pillow (``python -m pip install Pillow``).
Run ``python scripts/photo-assets.py inspect`` for a read-only inventory, or
``python scripts/photo-assets.py build`` after adding a photo and its altEn/altCn
descriptions to src/data/photography.json. Authored text, ordering and featured
selections are preserved. Metadata and derived image fields are regenerated.
For confirmed equipment absent from EXIF, use a ``deviceOverride`` object with
cameraMake, cameraModel and/or deviceType (camera/phone/film/unknown); optional
deviceLabelEn/deviceLabelCn are supported. These explicit author corrections
survive regeneration and are marked deviceSource="user". Do not edit generated
camera fields directly: place manual corrections in deviceOverride instead.

Only DateTimeOriginal is accepted as a capture timestamp. File modification,
Photoshop export, PNG creation and film-scanning dates are NOT capture dates.
Unknown device models remain unknown until a documented mapping is added below.
"""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime
from io import BytesIO
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

try:
    from PIL import Image, ImageCms, ImageOps, features
except ImportError as error:
    raise SystemExit("Pillow is required: python -m pip install Pillow") from error


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/data/photography.json"
OUTPUT = ROOT / "assets/img/gallery"
SRGB = ImageCms.createProfile("sRGB")
TIFF_NS = "http://ns.adobe.com/tiff/1.0/"
EXIF_NS = "http://ns.adobe.com/exif/1.0/"

# Explicit, metadata-based mappings; never infer a device from the image style.
# ILCE-6400 is a Sony interchangeable-lens camera.
# Fujifilm lists SP-3000 as a film scanner in its official Frontier brochure:
# https://www.fujifilm.com.hk/products/photofinishing/products/digital_minilabs/pdf/index/LB0790E.pdf
DEVICE_TYPES = {
    ("SONY", "ILCE-6400"): "camera",
    ("SONY", "ILCE-7CM2"): "camera",
}
# Scanning hardware is retained separately from the camera used for capture.
FILM_SCANNERS = {("FUJI PHOTO FILM CO., LTD.", "SP-3000")}
# EZ Controller is lab workflow software with film AND digital-image inputs:
# https://noritsu.com.au/ezcontroller.html
# Its EXIF manufacturer/model cannot identify the original capture device.
SOFTWARE_MODELS = {("NORITSU KOKI", "EZ Controller")}


def text(value: object) -> str:
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    return str(value).strip("\0 ") if value is not None else ""


def xmp_fields(image: Image.Image) -> dict[str, str]:
    data = image.info.get("xmp") or image.info.get("XML:com.adobe.xmp")
    if not data:
        return {}
    try:
        xml = ET.fromstring(data)
    except ET.ParseError:
        return {}
    fields = {}
    for node in xml.iter():
        fields.update(node.attrib)
        if node.text and node.text.strip():
            fields[node.tag] = node.text.strip()
    return fields


def capture_timestamp(value: object, offset: object = "") -> str:
    source = text(value)
    if not source:
        return ""
    # EXIF uses YYYY:MM:DD HH:MM:SS; XMP uses ISO 8601.
    if re.match(r"^\d{4}:\d{2}:\d{2} ", source):
        source = source[:10].replace(":", "-") + "T" + source[11:]
    try:
        captured = datetime.fromisoformat(source.replace("Z", "+00:00"))
        if captured.tzinfo is None and re.fullmatch(r"[+-]\d{2}:\d{2}", text(offset)):
            captured = datetime.fromisoformat(captured.isoformat() + text(offset))
    except ValueError:
        return ""
    return captured.isoformat(timespec="seconds")


def source_path(photo: dict) -> Path:
    path = (ROOT / photo["src"]).resolve()
    if not path.is_relative_to(ROOT / "assets/img") or path.is_relative_to(OUTPUT):
        raise ValueError(f"Original photo must be inside assets/img, outside gallery: {photo['src']}")
    if not path.is_file():
        raise ValueError(f"Missing original photo: {photo['src']}")
    return path


def metadata(photo: dict) -> dict:
    path = source_path(photo)
    with Image.open(path) as image:
        exif = image.getexif()
        nested = exif.get_ifd(34665) if 34665 in exif else {}
        xmp = xmp_fields(image)
        make = text(exif.get(271)) or xmp.get(f"{{{TIFF_NS}}}Make", "")
        model = text(exif.get(272)) or xmp.get(f"{{{TIFF_NS}}}Model", "")
        original_time = exif.get(36867) or nested.get(36867) or xmp.get(f"{{{EXIF_NS}}}DateTimeOriginal")
        original_offset = exif.get(36881) or nested.get(36881) or ""
        captured = capture_timestamp(original_time, original_offset)
        width, height = image.size
        if exif.get(274) in (5, 6, 7, 8):
            width, height = height, width

    folder = next((part for part in reversed(path.parent.parts) if re.fullmatch(r"(?:19|20)\d{2}", part)), "")
    if not captured and not folder:
        raise ValueError(f"No capture date or year folder for {photo['src']}")
    identifier = photo.get("id") or f"photo-{path.stem.lower()}"
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", identifier):
        raise ValueError(f"Invalid photo id: {identifier}")

    software = ""
    scanner = None
    if (make.upper(), model) in SOFTWARE_MODELS:
        software = f"{make} {model}"
        make = model = ""
    if (make.upper(), model) in FILM_SCANNERS:
        scanner = {"make": make, "model": model}
        make = model = ""
    device_type = "film" if scanner else DEVICE_TYPES.get((make.upper(), model), "unknown")
    result = {
        "id": identifier,
        "year": captured[:4] if captured else folder,
        "capturedAt": captured,
        "yearSource": "exif" if captured else "folder",
        "cameraMake": make,
        "cameraModel": model,
        "deviceType": device_type,
        "width": width,
        "height": height,
        "thumbnail": f"assets/img/gallery/{identifier}-thumb.webp",
        "preview": f"assets/img/gallery/{identifier}-preview.webp",
    }
    if software:
        result["sourceSoftware"] = software
    if scanner:
        result["scanner"] = scanner
    if device_type == "film":
        result["deviceLabelEn"] = "Film"
        result["deviceLabelCn"] = "胶片"
    result["deviceSource"] = "metadata" if device_type != "unknown" else "unknown"
    override = photo.get("deviceOverride")
    if override is not None:
        allowed = {"cameraMake", "cameraModel", "deviceType", "deviceLabelEn", "deviceLabelCn"}
        if not isinstance(override, dict) or set(override) - allowed:
            raise ValueError(f"Invalid deviceOverride fields for {identifier}; allowed: {', '.join(sorted(allowed))}")
        if any(not isinstance(value, str) for value in override.values()):
            raise ValueError(f"deviceOverride values must be strings for {identifier}")
        if "deviceType" in override and override["deviceType"] not in ("camera", "phone", "film", "unknown"):
            raise ValueError(f"Invalid deviceOverride deviceType for {identifier}")
        if override:
            # Do not keep a generated scanner label after a user changes device.
            result.pop("deviceLabelEn", None)
            result.pop("deviceLabelCn", None)
            result.update(override)
            result["deviceSource"] = "user"
    return result


def srgb_image(path: Path) -> Image.Image:
    with Image.open(path) as original:
        oriented = ImageOps.exif_transpose(original)
        profile = original.info.get("icc_profile")
        alpha = oriented.getchannel("A") if "A" in oriented.getbands() else None
        image = oriented.convert("RGB") if oriented.mode not in ("RGB", "CMYK") else oriented.copy()
        if profile:
            try:
                image = ImageCms.profileToProfile(
                    image, ImageCms.ImageCmsProfile(BytesIO(profile)), SRGB, outputMode="RGB"
                )
            except (ImageCms.PyCMSError, OSError) as error:
                raise ValueError(f"Cannot safely convert embedded color profile: {path.name}") from error
        else:
            image = image.convert("RGB")
        if alpha is not None:
            image.putalpha(alpha)
        return image


def save_webp(image: Image.Image, path: Path, quality: int) -> int:
    output = BytesIO()
    # The pixels are normalized to sRGB. Omit original EXIF/XMP/GPS and dynamic
    # ICC-profile timestamps so identical source files produce identical bytes.
    image.save(output, format="WEBP", quality=quality, method=6, exact=True)
    contents = output.getvalue()
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_bytes() != contents:
        path.write_bytes(contents)
    return len(contents)


def build_images(photo: dict) -> tuple[int, int]:
    image = srgb_image(source_path(photo))
    thumbnail = image.copy()
    thumb_width = min(720, image.width)
    thumb_height = max(1, round(image.height * thumb_width / image.width))
    thumbnail = thumbnail.resize((thumb_width, thumb_height), Image.Resampling.LANCZOS)
    preview = image.copy()
    preview.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
    return (
        save_webp(thumbnail, ROOT / photo["thumbnail"], quality=82),
        save_webp(preview, ROOT / photo["preview"], quality=88),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("inspect", "build"))
    args = parser.parse_args()
    photos = json.loads(DATA.read_text(encoding="utf-8"))
    enriched = []
    ids = set()
    for photo in photos:
        fields = metadata(photo)
        if fields["id"] in ids:
            raise ValueError(f"Duplicate photo id: {fields['id']}")
        ids.add(fields["id"])
        updated = {**photo, **fields}
        # Remove obsolete generated classification, retaining all authored fields.
        for key in ("sourceSoftware", "scanner", "deviceLabelEn", "deviceLabelCn"):
            if key not in fields:
                updated.pop(key, None)
        enriched.append(updated)

    summary = {
        "photos": len(enriched),
        "sourceBytes": sum(source_path(photo).stat().st_size for photo in enriched),
        "devices": dict(Counter(photo["deviceType"] for photo in enriched)),
        "years": dict(Counter(photo["year"] for photo in enriched)),
        "yearSources": dict(Counter(photo["yearSource"] for photo in enriched)),
        "cameraModels": dict(Counter(photo["cameraModel"] for photo in enriched if photo["cameraModel"])),
    }
    if args.command == "build":
        if not features.check("webp"):
            raise ValueError("This Pillow installation lacks WebP support.")
        for photo in enriched:
            for key in ("altEn", "altCn"):
                if not isinstance(photo.get(key), str) or not photo[key].strip():
                    raise ValueError(f"Write a visible-image description for {photo['id']}:{key} before building.")
            photo.setdefault("featured", False)
            if not isinstance(photo["featured"], bool):
                raise ValueError(f"featured must be a boolean for {photo['id']}")
        # Publish metadata before the slow encoding stage so future builds can
        # inspect the enriched list. The command fails if any derivative fails.
        DATA.write_text(json.dumps(enriched, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        sizes = [build_images(photo) for photo in enriched]
        summary["thumbnailBytes"] = sum(size[0] for size in sizes)
        summary["previewBytes"] = sum(size[1] for size in sizes)
        summary["derivedBytes"] = summary["thumbnailBytes"] + summary["previewBytes"]
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        print(f"Photo assets failed: {error}", file=sys.stderr)
        sys.exit(1)
