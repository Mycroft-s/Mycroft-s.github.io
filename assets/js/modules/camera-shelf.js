const SVG_NS = 'http://www.w3.org/2000/svg';

// These line drawings suggest camera families; they do not imply an unknown model.
const CAMERA_ART = {
  all: `
    <rect x="22" y="22" width="62" height="49" rx="5" opacity=".35"/>
    <rect x="38" y="16" width="62" height="49" rx="5" opacity=".6"/>
    <rect x="54" y="28" width="80" height="54" rx="5" fill="var(--body-color, #fbfbfe)"/>
    <circle cx="78" cy="43" r="5"/>
    <path d="m58 74 22-20 15 12 14-16 21 24"/>
  `,
  'sony-ilce-7cm2': `
    <path d="M25 31h16v-7h25v7h58a9 9 0 0 1 9 9v34a8 8 0 0 1-8 8H25a8 8 0 0 1-8-8V39a8 8 0 0 1 8-8Z"/>
    <path d="M18 46h23m64 0h27M119 32v48M32 24h8m74 2h11"/>
    <rect x="24" y="36" width="16" height="8" rx="2"/>
    <circle cx="78" cy="57" r="26"/>
    <circle cx="78" cy="57" r="20"/>
    <circle cx="78" cy="57" r="11" opacity=".45"/>
    <path d="M67 48a15 15 0 0 1 12-6" opacity=".55"/>
  `,
  'sony-ilce-6400': `
    <path d="M24 34h94a10 10 0 0 1 10 10v31a7 7 0 0 1-7 7H24a7 7 0 0 1-7-7V41a7 7 0 0 1 7-7Z"/>
    <path d="M32 34v-7h20v7m48 0v-6h16v6M113 42v39M18 49h28m55 0h12"/>
    <rect x="24" y="40" width="15" height="8" rx="1"/>
    <circle cx="75" cy="59" r="24"/>
    <circle cx="75" cy="59" r="18"/>
    <circle cx="75" cy="59" r="10" opacity=".45"/>
    <path d="M65 50a13 13 0 0 1 10-5" opacity=".55"/>
  `,
  'nikon-fe2': `
    <path d="M23 35h33l9-15h26l9 15h29v46H23Z"/>
    <path d="M24 48h25m53 0h26M32 35v-8h17v8m58 0v-8h15v8M65 20l5 15h16l5-15"/>
    <circle cx="77" cy="60" r="27"/>
    <circle cx="77" cy="60" r="21"/>
    <circle cx="77" cy="60" r="12" opacity=".5"/>
    <path d="M65 51a16 16 0 0 1 13-6" opacity=".55"/>
    <circle cx="116" cy="58" r="3"/>
    <path d="M18 39h5m106 0h5"/>
  `,
  leica: `
    <rect x="20" y="32" width="118" height="49" rx="9"/>
    <path d="M21 48h116M33 32v-7h18v7m60 0v-7h15v7"/>
    <rect x="28" y="37" width="18" height="8" rx="1"/>
    <rect x="58" y="38" width="9" height="6" rx="1"/>
    <circle cx="85" cy="62" r="22"/>
    <circle cx="85" cy="62" r="16"/>
    <circle cx="85" cy="62" r="8" opacity=".5"/>
    <circle cx="119" cy="41" r="3" fill="currentColor" stroke="none"/>
    <path d="M32 54v20m-6-20v20" opacity=".3"/>
  `,
  'rollei-35-se': `
    <rect x="38" y="28" width="85" height="55" rx="5"/>
    <path d="M39 45h83M48 28v-5h17v5m35 0v-5h13v5"/>
    <rect x="48" y="34" width="14" height="7" rx="1"/>
    <rect x="98" y="34" width="14" height="7" rx="1"/>
    <circle cx="79" cy="62" r="20"/>
    <circle cx="79" cy="62" r="14"/>
    <circle cx="79" cy="62" r="7" opacity=".5"/>
    <circle cx="47" cy="57" r="5"/>
    <circle cx="113" cy="57" r="5"/>
    <path d="M107 73h9"/>
  `,
  film: `
    <path d="M51 25h31v48H51Z"/>
    <ellipse cx="66.5" cy="25" rx="15.5" ry="5"/>
    <path d="M51 73c0 7 31 7 31 0M61 20v-6h11v6M58 39h17m-17 5h17"/>
    <path d="M82 34h37v43H86a4 4 0 0 1-4-4"/>
    <rect x="91" y="46" width="19" height="18" rx="1"/>
    <path d="M89 39h4m6 0h4m6 0h4M89 71h4m6 0h4m6 0h4" stroke-width="3"/>
  `,
};

function cameraArt(device) {
  const art = document.createElementNS(SVG_NS, 'svg');
  art.classList.add('camera-card__art');
  art.setAttribute('viewBox', '0 0 160 96');
  art.setAttribute('aria-hidden', 'true');
  art.setAttribute('focusable', 'false');
  art.setAttribute('fill', 'none');
  art.setAttribute('stroke', 'currentColor');
  art.setAttribute('stroke-width', '1.7');
  art.setAttribute('stroke-linecap', 'round');
  art.setAttribute('stroke-linejoin', 'round');
  // Artwork is a fixed, local SVG vocabulary; metadata is assigned as text only.
  art.innerHTML = CAMERA_ART[device] || CAMERA_ART['sony-ilce-6400'];
  return art;
}

function textNode(className) {
  const node = document.createElement('span');
  node.className = className;
  return node;
}

function cameraName(photo, chinese) {
  const label = (chinese ? photo.data.deviceLabelCn : photo.data.deviceLabelEn)
    || photo.data.deviceLabelEn || photo.data.deviceLabelCn || '';
  const name = label.replace(/^(?:Film|胶片)\s*[·•|—-]\s*/i, '');
  const brand = photo.data.cameraMake?.trim() || '';
  // Keep make-only labels (e.g. Leica) intact instead of inventing a model.
  return brand && name.toLowerCase().startsWith(`${brand.toLowerCase()} `)
    ? name.slice(brand.length).trim()
    : name;
}

export function initCameraShelf({ element, photos, copy, isChinese, onSelect }) {
  if (!element) return { update() {} };

  const devices = new Map();
  for (const photo of photos) {
    const entry = devices.get(photo.device);
    if (entry) entry.count += 1;
    else devices.set(photo.device, { photo, count: 1 });
  }

  const entries = [{ device: 'all', count: photos.length },
    ...[...devices].map(([device, entry]) => ({ device, ...entry }))];

  const cards = entries.map(entry => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'camera-card';
    button.dataset.device = entry.device;
    const brand = textNode('camera-card__brand');
    const name = textNode('camera-card__name');
    const count = textNode('camera-card__count');
    const badge = textNode('camera-card__badge');
    button.append(cameraArt(entry.device), brand, name, count, badge);
    button.addEventListener('click', () => onSelect(entry.device));
    return { ...entry, button, brand, name, countNode: count, badge };
  });
  element.replaceChildren(...cards.map(card => card.button));

  function update(selectedDevice = 'all') {
    const chinese = isChinese();
    for (const card of cards) {
      const selected = card.device === selectedDevice;
      card.button.setAttribute('aria-pressed', String(selected));
      card.button.classList.toggle('is-active', selected);
      // Counts describe the complete camera archive, independent of the year.
      card.countNode.textContent = copy(card.count === 1 ? 'count_one' : 'count_template')
        .replace(/\{count\}/g, String(card.count));

      if (!card.photo) {
        card.name.textContent = copy('all_cameras');
        card.brand.hidden = card.badge.hidden = true;
        continue;
      }

      card.name.textContent = cameraName(card.photo, chinese);
      card.brand.textContent = card.photo.data.cameraMake?.toUpperCase() || '';
      card.brand.hidden = !card.brand.textContent
        || card.brand.textContent.toLowerCase() === card.name.textContent.toLowerCase();
      const film = card.photo.card.dataset.deviceType === 'film';
      card.badge.textContent = copy(film ? 'film' : 'digital');
      card.badge.hidden = card.device === 'film';
    }
  }

  update();
  return { update };
}
