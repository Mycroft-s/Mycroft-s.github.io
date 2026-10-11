import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEVICE_LABELS = {
  camera: ['Camera', '相机'],
  phone: ['Phone', '手机'],
  film: ['Film camera', '胶片相机'],
  unknown: ['Device not recorded', '设备未记录'],
};

function escape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function string(photo, key, optional = false) {
  const value = photo[key];
  if (optional && (value === null || value === undefined)) return '';
  if (typeof value !== 'string' || (!optional && !value.trim())) {
    throw new Error(`Photo ${photo.id || '(no id)'} needs a ${key} string.`);
  }
  return value.trim();
}

function captureDate(value, id) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(`Photo ${id} has an invalid capturedAt date.`);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
  if (!match) throw new Error(`Photo ${id} capturedAt must be an ISO date or date/time.`);
  const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
  // EXIF often has no timezone. Sort using its recorded local calendar values,
  // without pretending that the camera's clock is UTC or the viewer's timezone.
  const stamp = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const date = new Date(stamp);
  if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1
      || date.getUTCDate() !== +day || +hour > 23 || +minute > 59 || +second > 59) {
    throw new Error(`Photo ${id} has an invalid capturedAt calendar date.`);
  }
  return { value, stamp, year: +year, date };
}

function deviceDetails(make, model, type) {
  if (!make && !model) return { key: type, labels: DEVICE_LABELS[type] };
  const label = model
    ? (make && !model.toLowerCase().startsWith(make.toLowerCase()) ? `${make} ${model}` : model)
    : make;
  const key = `${make} ${model}`.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!key) throw new Error(`Cannot create a device key for camera ${label}.`);
  const labels = type === 'film' ? [`Film · ${label}`, `胶片 · ${label}`] : [label, label];
  return { key, labels };
}

/** Validate metadata without inferring dates or equipment from filenames. */
export function normalizePhotos(photos) {
  if (!Array.isArray(photos)) throw new Error('Photography data must be an array.');
  const ids = new Set();
  return photos.map((photo, sourceIndex) => {
    if (!photo || typeof photo !== 'object' || Array.isArray(photo)) throw new Error('Each photo must be an object.');
    const id = string(photo, 'id');
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id) || ids.has(id)) throw new Error(`Invalid or duplicate photo id: ${id}`);
    ids.add(id);
    const year = Number(photo.year);
    if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error(`Photo ${id} needs a four-digit year.`);
    if (!['exif', 'folder'].includes(photo.yearSource)) throw new Error(`Photo ${id} needs yearSource exif or folder.`);
    const date = captureDate(photo.capturedAt, id);
    if (photo.yearSource === 'exif' && (!date || date.year !== year)) {
      throw new Error(`Photo ${id} EXIF year must match its recorded capturedAt date.`);
    }
    if (photo.yearSource === 'folder' && date) {
      throw new Error(`Photo ${id} must use yearSource exif when a capturedAt date is recorded.`);
    }
    if (!Object.hasOwn(DEVICE_LABELS, photo.deviceType)) throw new Error(`Photo ${id} has an unknown deviceType.`);
    for (const key of ['width', 'height']) {
      if (!Number.isInteger(photo[key]) || photo[key] < 1) throw new Error(`Photo ${id} needs a positive integer ${key}.`);
    }
    if (typeof photo.featured !== 'boolean') throw new Error(`Photo ${id} needs a boolean featured value.`);
    const cameraMake = string(photo, 'cameraMake', true);
    const cameraModel = string(photo, 'cameraModel', true);
    const device = deviceDetails(cameraMake, cameraModel, photo.deviceType);
    // Reviewed metadata may clarify a scanner model without calling it a camera.
    if (photo.deviceLabelEn || photo.deviceLabelCn) {
      device.labels = [string(photo, 'deviceLabelEn'), string(photo, 'deviceLabelCn')];
    }
    const dateLabelEn = date ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date.date) : String(year);
    const dateLabelCn = date ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date.date) : String(year);
    const altEn = string(photo, 'altEn');
    const altCn = string(photo, 'altCn');
    return {
      id, src: string(photo, 'src'), thumbnail: string(photo, 'thumbnail'), preview: string(photo, 'preview'),
      altEn, altCn,
      descriptionEn: string(photo, 'descriptionEn', true) || altEn,
      descriptionCn: string(photo, 'descriptionCn', true) || altCn,
      year: String(year), capturedAt: date?.value || '', yearSource: photo.yearSource,
      cameraMake, cameraModel, deviceType: photo.deviceType, deviceKey: device.key,
      deviceLabelEn: device.labels[0], deviceLabelCn: device.labels[1], dateLabelEn, dateLabelCn,
      width: String(photo.width), height: String(photo.height), aspectRatio: `${photo.width} / ${photo.height}`,
      featured: photo.featured, sourceIndex, captureOrder: date?.stamp ?? null,
    };
  });
}

/** Year descending; device groups keep source order; recorded dates sort within each group. */
export function groupPhotos(photos) {
  const years = new Map();
  for (const photo of photos) {
    if (!years.has(photo.year)) years.set(photo.year, new Map());
    const devices = years.get(photo.year);
    if (!devices.has(photo.deviceKey)) devices.set(photo.deviceKey, []);
    devices.get(photo.deviceKey).push(photo);
  }
  return [...years].sort(([left], [right]) => Number(right) - Number(left)).map(([year, devices]) => ({
    year,
    groups: [...devices].map(([deviceKey, items]) => ({
      deviceKey,
      photos: items.toSorted((left, right) => {
        if (left.captureOrder === null && right.captureOrder === null) return left.sourceIndex - right.sourceIndex;
        if (left.captureOrder === null) return 1;
        if (right.captureOrder === null) return -1;
        return right.captureOrder - left.captureOrder || left.sourceIndex - right.sourceIndex;
      }),
    })),
  }));
}

function renderPhoto(photo) {
  const attributes = {
    'photo-id': photo.id, preview: photo.preview, original: photo.src,
    'alt-en': photo.altEn, 'alt-cn': photo.altCn, 'captured-at': photo.capturedAt,
    'description-en': photo.descriptionEn, 'description-cn': photo.descriptionCn,
    'year-source': photo.yearSource, 'device-label-en': photo.deviceLabelEn,
    'device-label-cn': photo.deviceLabelCn, 'date-label-en': photo.dateLabelEn,
    'date-label-cn': photo.dateLabelCn, 'camera-make': photo.cameraMake,
    'camera-model': photo.cameraModel, width: photo.width, height: photo.height,
  };
  const data = Object.entries(attributes).map(([key, value]) => `data-${key}="${escape(value)}"`).join(' ');
  return `<figure class="gallery-card" data-year="${escape(photo.year)}" data-device="${escape(photo.deviceKey)}" data-device-type="${escape(photo.deviceType)}">
  <a class="gallery-card__link" href="${escape(photo.preview)}" data-gallery-open ${data} aria-label="${escape(photo.altEn)} · ${escape(photo.year)}">
    <img class="gallery-card__image" src="${escape(photo.thumbnail)}" alt="${escape(photo.altEn)}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async">
  </a>
  <figcaption class="gallery-card__caption">
    <p class="gallery-card__description" data-en="${escape(photo.descriptionEn)}" data-cn="${escape(photo.descriptionCn)}">${escape(photo.descriptionEn)}</p>
    <span class="gallery-card__date" data-en="${escape(photo.dateLabelEn)}" data-cn="${escape(photo.dateLabelCn)}">${escape(photo.dateLabelEn)}</span>
    <span class="gallery-card__device" data-en="${escape(photo.deviceLabelEn)}" data-cn="${escape(photo.deviceLabelCn)}">${escape(photo.deviceLabelEn)}</span>
  </figcaption>
</figure>`;
}

export function galleryCollections(photos) {
  const normalized = normalizePhotos(photos);
  const years = groupPhotos(normalized).map(({ year, groups }) => ({
    year, count: String(groups.reduce((count, group) => count + group.photos.length, 0)),
    cardsHtml: groups.map(({ deviceKey, photos: items }) => {
      const photo = items[0];
      return `<section class="gallery-device-group" data-device-group="${escape(deviceKey)}">
  <h3 class="gallery-device-title" data-en="${escape(photo.deviceLabelEn)}" data-cn="${escape(photo.deviceLabelCn)}">${escape(photo.deviceLabelEn)}</h3>
  <div class="gallery-grid">
${items.map(renderPhoto).join('\n')}
  </div>
</section>`;
    }).join('\n'),
  }));
  return {
    'gallery-years': years,
    'gallery-featured': normalized.filter((photo) => photo.featured),
  };
}

export async function readGalleryCollections(root) {
  let photos;
  try {
    photos = JSON.parse(await readFile(join(root, 'src/data/photography.json'), 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read photography data: ${error.message}`);
  }
  return galleryCollections(photos);
}
