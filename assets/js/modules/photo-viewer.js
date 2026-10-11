const SLIDE_DELAY = 5000;
const interpolate = (value, variables) => value.replace(/\{(\w+)\}/g, (match, key) => variables[key] ?? match);

// The archive owns filters and URLs; this module owns the modal and its lifecycle.
export function initPhotoViewer({ photos, getVisiblePhotos, copy, isChinese, onPhotoChange, onClose, getShareUrl }) {
  const viewer = document.getElementById('photo-viewer');
  const image = document.getElementById('viewer-image');
  const caption = document.getElementById('viewer-caption');
  const description = document.getElementById('viewer-description');
  const meta = document.getElementById('viewer-meta');
  const position = document.getElementById('viewer-position');
  const status = document.getElementById('viewer-status');
  const original = document.getElementById('viewer-original');
  const previous = document.getElementById('viewer-prev');
  const next = document.getElementById('viewer-next');
  const play = document.getElementById('viewer-play');
  const screeningButton = document.getElementById('viewer-screening');
  const shareButton = document.getElementById('viewer-share');
  const shareStatus = document.getElementById('viewer-share-status');
  const shareFallback = document.getElementById('viewer-share-fallback');
  const shareInput = document.getElementById('viewer-share-url');
  const screeningHint = document.getElementById('viewer-screening-hint');

  let current = null;
  let collection = [];
  let returnFocus = null;
  let active = false;
  let loading = false;
  let failed = false;
  let playing = false;
  let screening = false;
  let timer = null;
  let touchStart = null;
  let shareState = '';
  let shareRequest = 0;
  let ownsFullscreen = false;
  let fullscreenPending = false;

  const title = photo => (isChinese() ? photo.data.altCn : photo.data.altEn)
    || photo.link.querySelector('img')?.alt || photo.id;
  const shortDescription = photo => (isChinese() ? photo.data.descriptionCn : photo.data.descriptionEn) || '';
  const device = photo => (isChinese() ? photo.data.deviceLabelCn : photo.data.deviceLabelEn) || copy('unknown_device');

  function buttonLabel(button, label) {
    const node = button.querySelector('.photo-viewer__action-label, [data-viewer-label], span[i18n]');
    (node || button).textContent = label;
    button.setAttribute('aria-label', label);
  }

  function clearTimer() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }

  function schedule() {
    clearTimer();
    if (!playing || !viewer.open || loading || document.hidden || collection.length < 2) return;
    timer = window.setTimeout(() => {
      timer = null;
      step(1);
    }, SLIDE_DELAY);
  }

  function updateControls() {
    previous.disabled = next.disabled = collection.length < 2;
    play.disabled = collection.length < 2;
    play.setAttribute('aria-pressed', String(playing));
    screeningButton.setAttribute('aria-pressed', String(screening));
    buttonLabel(play, copy(playing ? 'pause' : 'play'));
    buttonLabel(screeningButton, copy(screening ? 'exit_screening' : 'screening'));
    buttonLabel(shareButton, copy('share'));
  }

  function setPlaying(value) {
    playing = Boolean(value && viewer.open && collection.length > 1 && !document.hidden);
    updateControls();
    schedule();
  }

  function refreshText() {
    updateControls();
    if (screeningHint) screeningHint.textContent = copy('screening_hint');
    shareStatus.textContent = shareState ? copy(shareState) : '';
    const fallbackLabel = shareFallback.querySelector('label');
    if (fallbackLabel) fallbackLabel.textContent = copy('share_url');
    if (!current) return;
    const photoTitle = title(current);
    const short = shortDescription(current);
    image.alt = photoTitle;
    caption.textContent = screening && short.trim() ? short : photoTitle;
    description.textContent = short;
    description.hidden = !short.trim() || short.trim().toLowerCase() === photoTitle.trim().toLowerCase();
    const date = (isChinese() ? current.data.dateLabelCn : current.data.dateLabelEn) || current.year;
    meta.textContent = `${copy(current.data.capturedAt ? 'taken' : 'archive_year')} ${date} · ${device(current)}`;
    position.textContent = interpolate(copy('viewer_position'), {
      current: collection.findIndex(photo => photo.id === current.id) + 1,
      total: collection.length,
    });
    if (failed) status.textContent = copy('image_error');
    else if (loading) status.textContent = copy('loading');
  }

  function resetShare() {
    shareRequest += 1;
    shareState = '';
    shareStatus.textContent = '';
    shareFallback.hidden = true;
    shareInput.value = '';
  }

  function show(photo) {
    clearTimer();
    resetShare();
    current = photo;
    failed = false;
    loading = true;
    status.hidden = false;
    status.textContent = copy('loading');
    image.alt = title(photo);
    image.src = photo.data.preview || photo.link.href;
    original.href = photo.data.original || photo.link.href;
    if (image.complete && image.naturalWidth > 0) {
      loading = false;
      status.hidden = true;
    }
    refreshText();
    onPhotoChange?.(photo);
    schedule();
  }

  function step(direction) {
    if (!viewer.open || !current || collection.length < 2) return;
    const index = collection.findIndex(photo => photo.id === current.id);
    show(collection[(index + direction + collection.length) % collection.length]);
  }

  function releaseFullscreen() {
    // Never exit a fullscreen session that was already active before this viewer.
    if (!ownsFullscreen || document.fullscreenElement !== document.documentElement) return;
    ownsFullscreen = false;
    try {
      Promise.resolve(document.exitFullscreen()).catch(() => {
        ownsFullscreen = document.fullscreenElement === document.documentElement;
      });
    } catch {
      ownsFullscreen = document.fullscreenElement === document.documentElement;
    }
  }

  function enterFullscreen() {
    if (document.fullscreenElement || fullscreenPending || !document.documentElement.requestFullscreen) return;
    fullscreenPending = true;
    // The CSS mode is complete on its own when the API is unavailable or denied.
    try {
      Promise.resolve(document.documentElement.requestFullscreen()).then(() => {
        ownsFullscreen = document.fullscreenElement === document.documentElement;
        if (!viewer.open || !screening) releaseFullscreen();
      }).catch(() => {}).finally(() => { fullscreenPending = false; });
    } catch {
      fullscreenPending = false;
    }
  }

  function setScreening(value) {
    screening = Boolean(value && viewer.open);
    viewer.classList.toggle('is-screening', screening);
    if (screening) enterFullscreen();
    else {
      setPlaying(false);
      releaseFullscreen();
    }
    refreshText();
  }

  function finishClose() {
    if (!active) return;
    active = false;
    setPlaying(false);
    screening = false;
    viewer.classList.remove('is-screening');
    releaseFullscreen();
    document.body.classList.remove('gallery-viewer-open');
    current = null;
    collection = [];
    touchStart = null;
    loading = false;
    failed = false;
    image.removeAttribute('src');
    resetShare();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
    onClose?.();
  }

  function close() {
    if (viewer.open) viewer.close();
    finishClose();
  }

  function open(photo, { trigger = null, collection: requestedCollection = null, screening: requestedScreening = false } = {}) {
    if (!photo || typeof viewer.showModal !== 'function') return false;
    const wasOpen = viewer.open;
    const initialFocus = document.activeElement;
    if (!wasOpen) {
      try { viewer.showModal(); } catch { return false; }
    }
    const candidates = requestedCollection || getVisiblePhotos?.() || photos;
    collection = [...(candidates.some(item => item.id === photo.id) ? candidates : photos)];
    if (!collection.some(item => item.id === photo.id)) collection = [photo];
    if (!wasOpen || trigger) returnFocus = trigger || initialFocus;
    active = true;
    document.body.classList.add('gallery-viewer-open');
    setPlaying(false);
    show(photo);
    setScreening(requestedScreening);
    if (requestedScreening && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true);
    // Focus only after collection-dependent controls have their final state.
    if (!wasOpen) (play.disabled ? document.getElementById('viewer-close') : play).focus({ preventScroll: true });
    return true;
  }

  async function share() {
    if (!viewer.open || !current) return;
    // Give manual copying time to finish without advancing to another photo.
    setPlaying(false);
    const photoId = current.id;
    const request = ++shareRequest;
    const url = getShareUrl(current);
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // Manual copying also works on file URLs and browsers without clipboard access.
    }
    if (!viewer.open || current?.id !== photoId || request !== shareRequest) return;
    shareState = copied ? 'copied' : 'copy_fallback';
    shareStatus.textContent = copy(shareState);
    shareFallback.hidden = copied;
    if (!copied) {
      shareInput.value = url;
      shareInput.focus();
      shareInput.select();
    }
  }

  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  play.addEventListener('click', () => setPlaying(!playing));
  screeningButton.addEventListener('click', () => setScreening(!screening));
  shareButton.addEventListener('click', share);
  document.getElementById('viewer-close').addEventListener('click', close);
  viewer.addEventListener('close', () => { if (!viewer.open) finishClose(); });
  viewer.addEventListener('cancel', event => {
    event.preventDefault();
    if (screening) setScreening(false);
    else close();
  });
  viewer.addEventListener('click', event => {
    if (event.target !== viewer) return;
    const box = viewer.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  viewer.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.isContentEditable
      || event.target.closest('input, select, textarea, [contenteditable], [role="textbox"]')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      step(event.key === 'ArrowLeft' ? -1 : 1);
    } else if ((event.key === ' ' || event.key === 'Spacebar') && !event.target.closest('button, a')) {
      event.preventDefault();
      setPlaying(!playing);
    }
  });
  image.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  image.addEventListener('touchend', event => {
    const start = touchStart;
    touchStart = null;
    if (!start || event.changedTouches.length !== 1 || event.touches.length) return;
    const deltaX = event.changedTouches[0].clientX - start.x;
    const deltaY = event.changedTouches[0].clientY - start.y;
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) step(deltaX < 0 ? 1 : -1);
  }, { passive: true });
  image.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  image.addEventListener('load', () => {
    if (!viewer.open || !image.hasAttribute('src')) return;
    loading = false;
    failed = false;
    status.hidden = true;
    schedule();
  });
  image.addEventListener('error', () => {
    if (!viewer.open || !image.hasAttribute('src')) return;
    loading = false;
    failed = true;
    status.textContent = copy('image_error');
    status.hidden = false;
    schedule();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setPlaying(false);
  });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === document.documentElement) return;
    const lostOwnedFullscreen = ownsFullscreen;
    ownsFullscreen = false;
    if (viewer.open && screening && lostOwnedFullscreen) {
      screening = false;
      viewer.classList.remove('is-screening');
      setPlaying(false);
      refreshText();
    }
  });
  refreshText();

  return { open, close, refreshText, get current() { return current; }, get isOpen() { return viewer.open; } };
}
