/** Resolve a shared photograph before rendering filters, so it stays visible. */
export function readArchiveState(photos, search) {
  const query = new URLSearchParams(search);
  const years = [...new Set(photos.map(photo => photo.year))].sort((a, b) => Number(a) - Number(b));
  const devices = new Set(photos.map(photo => photo.device));
  let year = query.get('year') === 'all' || years.includes(query.get('year'))
    ? query.get('year') : years.at(-1) || 'all';
  let device = devices.has(query.get('device')) ? query.get('device') : 'all';
  const photo = photos.find(item => item.id === query.get('photo')) || null;
  if (photo && ((year !== 'all' && photo.year !== year) || (device !== 'all' && photo.device !== device))) {
    year = photo.year;
    device = 'all';
  } else if (year !== 'all' && device !== 'all' && !photos.some(item => item.year === year && item.device === device)) {
    year = 'all';
  }
  return { year, device, view: query.get('view') === 'contact' ? 'contact' : 'gallery', photo };
}

/** Share the image itself, independent of the sender's filters or view mode. */
export function buildPhotoUrl(href, photoId) {
  const url = new URL(href);
  url.search = '';
  url.searchParams.set('photo', photoId);
  url.hash = 'gallery-archive-heading';
  return url.href;
}

/** Prefer another year and camera, without immediately repeating a frame. */
export function chooseRandomPhoto(photos, previousId, random = Math.random) {
  if (!photos.length) return null;
  const previous = photos.find(photo => photo.id === previousId);
  const others = photos.filter(photo => photo.id !== previousId);
  let candidates = others.length ? others : photos;
  if (previous) {
    const different = candidates.filter(photo => photo.year !== previous.year && photo.device !== previous.device);
    const related = candidates.filter(photo => photo.year !== previous.year || photo.device !== previous.device);
    if (different.length) candidates = different;
    else if (related.length) candidates = related;
  }
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)));
  return candidates[index];
}
