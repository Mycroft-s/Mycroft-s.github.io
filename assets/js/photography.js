import { initLanguage } from './cn-en-translate.js';
import { initTheme } from './modules/theme.js';

// The archive is rendered at build time. These controls progressively enhance
// the same links and images, so every photograph remains available without JS.
const archive = document.getElementById('gallery-archive');
const yearControls = document.getElementById('gallery-year-filters');
const yearRange = document.getElementById('gallery-year-range');
const yearTicks = document.getElementById('gallery-year-ticks');
const yearReadout = document.getElementById('gallery-year-readout');
const allYearsButton = document.getElementById('gallery-all-years');
const deviceControl = document.getElementById('gallery-device-filter');
const resultCount = document.getElementById('gallery-result-count');
const emptyState = document.getElementById('gallery-empty');
const viewer = document.getElementById('photo-viewer');
const viewerImage = document.getElementById('viewer-image');
const viewerCaption = document.getElementById('viewer-caption');
const viewerDescription = document.getElementById('viewer-description');
const viewerMeta = document.getElementById('viewer-meta');
const viewerPosition = document.getElementById('viewer-position');
const viewerStatus = document.getElementById('viewer-status');
const viewerOriginal = document.getElementById('viewer-original');
const previousButton = document.getElementById('viewer-prev');
const nextButton = document.getElementById('viewer-next');

initTheme();
const language = initLanguage();
const isChinese = () => document.documentElement.lang.startsWith('zh');
const copy = key => (document.querySelector(`#gallery-copy [i18n="gallery__${key}"]`)
  || document.querySelector(`[i18n="gallery__${key}"]`))?.textContent.trim() || '';
const interpolate = (value, variables) => value.replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match);

const photos = [...archive.querySelectorAll('.gallery-card [data-gallery-open]')].map(link => {
  const card = link.closest('.gallery-card');
  return {
    id: link.dataset.photoId,
    year: card.dataset.year || link.closest('.gallery-year').dataset.year,
    device: card.dataset.device || 'unknown',
    card,
    link,
    data: link.dataset,
  };
});
const photoById = new Map(photos.map(photo => [photo.id, photo]));
const years = [...new Set(photos.map(photo => photo.year))].sort((a, b) => Number(a) - Number(b));
const latestYear = years.at(-1) || 'all';
const devices = new Map();
for (const photo of photos) {
  if (!devices.has(photo.device)) devices.set(photo.device, photo);
}

let selectedYear = latestYear;
let rangeYear = latestYear;
let selectedDevice = 'all';
let visiblePhotos = photos;
let viewing = null;
let viewerPhotos = [];
let returnFocus = null;
let imageFailed = false;
let touchStart = null;

function photoTitle(photo) {
  return (isChinese() ? photo.data.altCn : photo.data.altEn) || photo.link.querySelector('img')?.alt || photo.id;
}

function deviceLabel(photo) {
  return (isChinese() ? photo.data.deviceLabelCn : photo.data.deviceLabelEn) || copy('unknown_device');
}

function deviceMatchesYear() {
  return selectedYear === 'all' || selectedDevice === 'all'
    || photos.some(photo => photo.year === selectedYear && photo.device === selectedDevice);
}

function updateLocation() {
  const url = new URL(location.href);
  // Keep overview explicit: an absent year always means the newest archive.
  url.searchParams.set('year', selectedYear);
  if (selectedDevice === 'all') url.searchParams.delete('device');
  else url.searchParams.set('device', selectedDevice);
  history.replaceState(null, '', url);
}

function readLocation() {
  const query = new URLSearchParams(location.search);
  selectedYear = query.get('year') === 'all' || years.includes(query.get('year')) ? query.get('year') : latestYear;
  rangeYear = selectedYear === 'all' ? latestYear : selectedYear;
  selectedDevice = devices.has(query.get('device')) ? query.get('device') : 'all';
  // A camera link must remain useful even when its photos are from older years.
  if (!deviceMatchesYear()) {
    selectedYear = 'all';
    updateLocation();
  }
}

function initYearRange() {
  yearRange.max = String(Math.max(years.length - 1, 0));
  yearRange.disabled = years.length < 2;
  yearTicks.replaceChildren(...years.map((year, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.year = year;
    button.textContent = year;
    button.style.setProperty('--tick-position', `${years.length > 1 ? index / (years.length - 1) * 100 : 50}%`);
    return button;
  }));
}

function updateYearControls() {
  const index = Math.max(years.indexOf(rangeYear), 0);
  const overview = selectedYear === 'all';
  yearRange.value = String(index);
  yearRange.setAttribute('aria-valuetext', rangeYear);
  yearRange.style.setProperty('--year-progress', `${years.length > 1 ? index / (years.length - 1) * 100 : 100}%`);
  yearReadout.textContent = overview ? copy('all_years') : selectedYear;
  yearControls.classList.toggle('is-overview', overview);
  allYearsButton.setAttribute('aria-pressed', String(overview));
  for (const button of yearTicks.querySelectorAll('[data-year]')) {
    const active = button.dataset.year === selectedYear;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-active', active);
  }
}

function updateDeviceOptions() {
  // Keep every camera discoverable, including cameras used in earlier years.
  deviceControl.replaceChildren(new Option(copy('all_devices'), 'all'),
    ...[...devices].map(([value, photo]) => new Option(deviceLabel(photo), value)));
  deviceControl.value = selectedDevice;
}

function filterPhotos() {
  updateDeviceOptions();
  visiblePhotos = photos.filter(photo => (selectedYear === 'all' || photo.year === selectedYear)
    && (selectedDevice === 'all' || photo.device === selectedDevice));
  const visible = new Set(visiblePhotos.map(photo => photo.id));
  for (const photo of photos) photo.card.hidden = !visible.has(photo.id);
  for (const group of archive.querySelectorAll('.gallery-device-group')) {
    group.hidden = ![...group.querySelectorAll('.gallery-card')].some(card => !card.hidden);
  }
  for (const section of archive.querySelectorAll('.gallery-year')) {
    const count = [...section.querySelectorAll('.gallery-card')].filter(card => !card.hidden).length;
    section.hidden = count === 0;
    section.querySelector('[data-year-count]').textContent = String(count);
    section.querySelector('[i18n="gallery__photos"]').textContent = copy(count === 1 ? 'photo' : 'photos');
  }
  updateYearControls();
  resultCount.textContent = interpolate(copy(visiblePhotos.length === 1 ? 'count_one' : 'count_template'), { count: visiblePhotos.length });
  emptyState.hidden = visiblePhotos.length > 0;
}

function updateViewerText() {
  if (!viewing) return;
  viewerImage.alt = photoTitle(viewing);
  viewerCaption.textContent = photoTitle(viewing);
  const description = (isChinese() ? viewing.data.descriptionCn : viewing.data.descriptionEn) || '';
  viewerDescription.textContent = description;
  viewerDescription.hidden = !description.trim() || description.trim().toLowerCase() === photoTitle(viewing).trim().toLowerCase();
  const date = (isChinese() ? viewing.data.dateLabelCn : viewing.data.dateLabelEn) || viewing.year;
  const dateKind = viewing.data.capturedAt ? copy('taken') : copy('archive_year');
  viewerMeta.textContent = `${dateKind} ${date} · ${deviceLabel(viewing)}`;
  viewerPosition.textContent = interpolate(copy('viewer_position'), {
    current: viewerPhotos.findIndex(photo => photo.id === viewing.id) + 1,
    total: viewerPhotos.length,
  });
  if (imageFailed) viewerStatus.textContent = copy('image_error');
  else if (!viewerImage.complete) viewerStatus.textContent = copy('loading');
}

function showPhoto(photo) {
  viewing = photo;
  imageFailed = false;
  viewerStatus.hidden = false;
  viewerStatus.textContent = copy('loading');
  viewerImage.alt = photoTitle(photo);
  viewerImage.src = photo.data.preview || photo.link.href;
  viewerOriginal.href = photo.data.original || photo.link.href;
  previousButton.disabled = nextButton.disabled = viewerPhotos.length < 2;
  updateViewerText();
  if (viewerImage.complete && viewerImage.naturalWidth > 0) viewerStatus.hidden = true;
}

function openViewer(photo, trigger) {
  if (!photo || typeof viewer.showModal !== 'function') return false;
  // A featured image stays reachable even when the archive is filtered.
  viewerPhotos = visiblePhotos.some(item => item.id === photo.id) ? visiblePhotos : photos;
  returnFocus = trigger;
  showPhoto(photo);
  if (!viewer.open) viewer.showModal();
  document.body.classList.add('gallery-viewer-open');
  return true;
}

function stepPhoto(direction) {
  if (!viewing || viewerPhotos.length < 2) return;
  const index = viewerPhotos.findIndex(photo => photo.id === viewing.id);
  showPhoto(viewerPhotos[(index + direction + viewerPhotos.length) % viewerPhotos.length]);
}

function updateLanguage() {
  for (const node of document.querySelectorAll('[data-en][data-cn]')) {
    node.textContent = isChinese() ? node.dataset.cn : node.dataset.en;
  }
  for (const photo of photos) {
    const image = photo.link.querySelector('img');
    if (image) image.alt = photoTitle(photo);
  }
  for (const link of document.querySelectorAll('[data-gallery-open]')) {
    const photo = photoById.get(link.dataset.photoId);
    if (!photo) continue;
    link.setAttribute('aria-label', `${photoTitle(photo)} · ${photo.year}`);
    const image = link.querySelector('img');
    if (image) image.alt = photoTitle(photo);
  }
  document.getElementById('theme-button').setAttribute('aria-label', copy('theme'));
  document.getElementById('translate').setAttribute('aria-label', copy('language'));
  filterPhotos();
  updateViewerText();
}

function selectYear(year) {
  selectedYear = year;
  if (year !== 'all') rangeYear = year;
  // An explicit year choice takes priority over a previous camera selection.
  if (!deviceMatchesYear()) selectedDevice = 'all';
  filterPhotos();
  updateLocation();
}

yearTicks.addEventListener('click', event => {
  const button = event.target.closest('[data-year]');
  if (button && years.includes(button.dataset.year)) selectYear(button.dataset.year);
});
allYearsButton.addEventListener('click', () => {
  selectedDevice = 'all';
  selectYear('all');
});
yearRange.addEventListener('input', () => {
  const year = years[Number(yearRange.value)];
  if (year) selectYear(year);
});
// Re-engaging the thumb must also leave overview when its value stays the same.
yearRange.addEventListener('pointerdown', () => {
  if (selectedYear === 'all') selectYear(rangeYear);
});
yearRange.addEventListener('keydown', event => {
  if (selectedYear === 'all' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) selectYear(rangeYear);
});
deviceControl.addEventListener('change', () => {
  selectedDevice = devices.has(deviceControl.value) ? deviceControl.value : 'all';
  // An explicit camera choice opens its archive rather than an empty year.
  if (!deviceMatchesYear()) selectedYear = 'all';
  filterPhotos();
  updateLocation();
});
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-gallery-open]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (openViewer(photoById.get(link.dataset.photoId), link)) event.preventDefault();
});
previousButton.addEventListener('click', () => stepPhoto(-1));
nextButton.addEventListener('click', () => stepPhoto(1));
document.getElementById('viewer-close').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', event => {
  if (event.target !== viewer) return;
  const box = viewer.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) viewer.close();
});
viewer.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    stepPhoto(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
viewerImage.addEventListener('touchstart', event => {
  touchStart = event.touches.length === 1
    ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
    : null;
}, { passive: true });
viewerImage.addEventListener('touchend', event => {
  if (!touchStart || event.changedTouches.length !== 1 || event.touches.length) return;
  const deltaX = event.changedTouches[0].clientX - touchStart.x;
  const deltaY = event.changedTouches[0].clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) stepPhoto(deltaX < 0 ? 1 : -1);
}, { passive: true });
viewerImage.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
viewer.addEventListener('close', () => {
  document.body.classList.remove('gallery-viewer-open');
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  viewing = null;
  viewerImage.removeAttribute('src');
});
viewerImage.addEventListener('load', () => { viewerStatus.hidden = true; });
viewerImage.addEventListener('error', () => {
  if (!viewerImage.hasAttribute('src')) return;
  imageFailed = true;
  viewerStatus.textContent = copy('image_error');
  viewerStatus.hidden = false;
});
window.addEventListener('popstate', () => { readLocation(); filterPhotos(); });

initYearRange();
readLocation();
await language.ready;
updateLanguage();
document.querySelectorAll('[data-gallery-controls]').forEach(element => { element.hidden = false; });
new MutationObserver(updateLanguage).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
