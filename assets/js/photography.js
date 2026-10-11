import { initLanguage } from './cn-en-translate.js';
import { initTheme } from './modules/theme.js';
import { initCameraShelf } from './modules/camera-shelf.js';
import { initPhotoViewer } from './modules/photo-viewer.js';
import { readArchiveState, buildPhotoUrl, chooseRandomPhoto } from './modules/gallery-state.js';

// Static photo links remain usable without JavaScript; these controls enhance them.
const archive = document.getElementById('gallery-archive');
const yearControls = document.getElementById('gallery-year-filters');
const yearRange = document.getElementById('gallery-year-range');
const yearTicks = document.getElementById('gallery-year-ticks');
const yearReadout = document.getElementById('gallery-year-readout');
const allYearsButton = document.getElementById('gallery-all-years');
const resultCount = document.getElementById('gallery-result-count');
const emptyState = document.getElementById('gallery-empty');
const galleryView = document.getElementById('gallery-view-gallery');
const contactView = document.getElementById('gallery-view-contact');
const randomButton = document.getElementById('gallery-random');
const screeningButton = document.getElementById('gallery-screening');

initTheme();
const language = initLanguage();
const isChinese = () => document.documentElement.lang.startsWith('zh');
const copy = key => (document.querySelector(`#gallery-copy [i18n="gallery__${key}"]`)
  || document.querySelector(`[i18n="gallery__${key}"]`))?.textContent.trim() || '';
const interpolate = (value, variables) => value.replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match);

const photos = [...archive.querySelectorAll('.gallery-card [data-gallery-open]')].map((link, index) => {
  const card = link.closest('.gallery-card');
  card.dataset.frame = String(index + 1).padStart(2, '0');
  return {
    id: link.dataset.photoId, year: card.dataset.year || link.closest('.gallery-year').dataset.year,
    device: card.dataset.device || 'unknown', card, link, data: link.dataset,
  };
});
const photoById = new Map(photos.map(photo => [photo.id, photo]));
const years = [...new Set(photos.map(photo => photo.year))].sort((a, b) => Number(a) - Number(b));
const latestYear = years.at(-1) || 'all';
const devices = new Set(photos.map(photo => photo.device));
let selectedYear = latestYear;
let rangeYear = latestYear;
let selectedDevice = 'all';
let selectedView = 'gallery';
let visiblePhotos = photos;
let activePhotoId = null;
let lastRandomId = null;

const cameraShelf = initCameraShelf({
  element: document.getElementById('gallery-device-shelf'), photos, copy, isChinese, onSelect: selectDevice,
});
const photoViewer = initPhotoViewer({
  photos, getVisiblePhotos: () => visiblePhotos, copy, isChinese,
  onPhotoChange(photo) { activePhotoId = photo.id; updateLocation(); },
  onClose() { activePhotoId = null; updateLocation(); },
  getShareUrl: photo => buildPhotoUrl(location.href, photo.id),
});

function photoTitle(photo) {
  return (isChinese() ? photo.data.altCn : photo.data.altEn) || photo.link.querySelector('img')?.alt || photo.id;
}

function deviceMatchesYear() {
  return selectedYear === 'all' || selectedDevice === 'all'
    || photos.some(photo => photo.year === selectedYear && photo.device === selectedDevice);
}

function updateLocation() {
  const url = new URL(location.href);
  url.searchParams.set('year', selectedYear);
  if (selectedDevice === 'all') url.searchParams.delete('device');
  else url.searchParams.set('device', selectedDevice);
  if (selectedView === 'contact') url.searchParams.set('view', 'contact');
  else url.searchParams.delete('view');
  if (activePhotoId) url.searchParams.set('photo', activePhotoId);
  else url.searchParams.delete('photo');
  history.replaceState(null, '', url);
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

function updateView() {
  document.body.classList.toggle('gallery-contact-sheet', selectedView === 'contact');
  galleryView.setAttribute('aria-pressed', String(selectedView === 'gallery'));
  contactView.setAttribute('aria-pressed', String(selectedView === 'contact'));
}

function filterPhotos() {
  cameraShelf.update(selectedDevice);
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
  updateView();
  resultCount.textContent = interpolate(copy(visiblePhotos.length === 1 ? 'count_one' : 'count_template'), { count: visiblePhotos.length });
  emptyState.hidden = visiblePhotos.length > 0;
  randomButton.disabled = photos.length === 0;
  screeningButton.disabled = visiblePhotos.length === 0;
}

function updateLanguage() {
  for (const node of document.querySelectorAll('[data-en][data-cn]')) {
    node.textContent = isChinese() ? node.dataset.cn : node.dataset.en;
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
  photoViewer.refreshText();
}

function selectYear(year) {
  selectedYear = year;
  if (year !== 'all') rangeYear = year;
  if (!deviceMatchesYear()) selectedDevice = 'all';
  filterPhotos();
  updateLocation();
}

function selectDevice(device) {
  selectedDevice = devices.has(device) ? device : 'all';
  if (!deviceMatchesYear()) selectedYear = 'all';
  filterPhotos();
  updateLocation();
}

function restoreLocation() {
  const state = readArchiveState(photos, location.search);
  selectedYear = state.year;
  rangeYear = selectedYear === 'all' ? latestYear : selectedYear;
  selectedDevice = state.device;
  selectedView = state.view;
  activePhotoId = state.photo?.id || null;
  filterPhotos();
  if (state.photo) photoViewer.open(state.photo, { trigger: state.photo.link });
  else if (photoViewer.isOpen) photoViewer.close();
  updateLocation();
}

yearTicks.addEventListener('click', event => {
  const button = event.target.closest('[data-year]');
  if (button && years.includes(button.dataset.year)) selectYear(button.dataset.year);
});
allYearsButton.addEventListener('click', () => { selectedDevice = 'all'; selectYear('all'); });
yearRange.addEventListener('input', () => {
  const year = years[Number(yearRange.value)];
  if (year) selectYear(year);
});
yearRange.addEventListener('pointerdown', () => { if (selectedYear === 'all') selectYear(rangeYear); });
yearRange.addEventListener('keydown', event => {
  if (selectedYear === 'all' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) selectYear(rangeYear);
});
for (const [button, view] of [[galleryView, 'gallery'], [contactView, 'contact']]) {
  button.addEventListener('click', () => { selectedView = view; updateView(); updateLocation(); });
}
randomButton.addEventListener('click', () => {
  const photo = chooseRandomPhoto(photos, lastRandomId);
  if (!photo) return;
  lastRandomId = photo.id;
  selectedDevice = 'all';
  selectYear(photo.year);
  photoViewer.open(photo, { trigger: randomButton, collection: photos });
});
screeningButton.addEventListener('click', () => {
  if (visiblePhotos.length) photoViewer.open(visiblePhotos[0], { trigger: screeningButton, screening: true });
});
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-gallery-open]');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (photoViewer.open(photoById.get(link.dataset.photoId), { trigger: link })) event.preventDefault();
});
window.addEventListener('popstate', restoreLocation);

initYearRange();
await language.ready;
restoreLocation();
updateLanguage();
document.querySelectorAll('[data-gallery-controls]').forEach(element => { element.hidden = false; });
new MutationObserver(updateLanguage).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
