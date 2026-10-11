import assert from 'node:assert/strict';
import test from 'node:test';
import { initPhotoViewer } from '../assets/js/modules/photo-viewer.js';

// Minimal browser boundaries let us check races and timers without a DOM package.
// Native dialog layout and real fullscreen behavior are verified in a browser.
function node() {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  return {
    open: false, hidden: false, complete: false, naturalWidth: 0,
    textContent: '', value: '', isConnected: true, label: { textContent: '' },
    classList: {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle(name, value) { if (value) classes.add(name); else classes.delete(name); },
    },
    setAttribute: (name, value) => attributes.set(name, value),
    getAttribute: name => attributes.get(name),
    hasAttribute: name => attributes.has(name),
    removeAttribute: name => attributes.delete(name),
    set src(value) { attributes.set('src', value); },
    get src() { return attributes.get('src'); },
    querySelector() { return this.label; },
    closest() { return null; },
    focus() { this.focused = true; },
    select() { this.selected = true; },
    showModal() { this.open = true; },
    close() { this.open = false; this.emit('close'); },
    addEventListener(name, fn) {
      listeners.set(name, [...(listeners.get(name) || []), fn]);
    },
    emit(name, properties = {}) {
      const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...properties };
      const promises = (listeners.get(name) || []).map(fn => fn(event));
      return Promise.all(promises).then(() => event);
    },
  };
}

function fixture(t, { reducedMotion = false } = {}) {
  const ids = new Map();
  const get = id => {
    if (!ids.has(id)) ids.set(id, node());
    return ids.get(id);
  };
  const document = Object.assign(node(), {
    documentElement: node(), body: node(), activeElement: node(), hidden: false,
    fullscreenElement: null, getElementById: get,
  });
  let counter = 0;
  const timers = new Map();
  const window = {
    setTimeout(fn, delay) { const id = ++counter; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    matchMedia: () => ({ matches: reducedMotion }),
  };
  const navigator = { clipboard: { writeText: async () => {} } };
  for (const [name, value] of Object.entries({ document, window, navigator })) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; });
  }
  const photos = [1, 2, 3].map(number => ({
    id: `photo-${number}`, year: '2024',
    data: { altEn: `Photo ${number}`, altCn: `照片${number}`, descriptionEn: `Scene ${number}`, preview: `${number}.webp` },
    link: { href: `${number}.jpg`, querySelector: () => null },
  }));
  const changes = [];
  let closed = 0;
  let chinese = false;
  const controller = initPhotoViewer({
    photos, getVisiblePhotos: () => photos, copy: key => key,
    isChinese: () => chinese,
    onPhotoChange: photo => changes.push(photo.id), onClose: () => { closed++; },
    getShareUrl: photo => `https://example.com/photography.html?photo=${photo.id}`,
  });
  return {
    get, photos, controller, changes, timers, document, navigator,
    get closed() { return closed; },
    setChinese() { chinese = true; controller.refreshText(); },
    tick() {
      const [id, timer] = timers.entries().next().value;
      assert.equal(timer.delay, 5000);
      timers.delete(id); timer.fn();
    },
  };
}

test('playback waits for images, resets after stepping, and stays paused after hiding', async t => {
  const f = fixture(t);
  f.controller.open(f.photos[0]);
  await f.get('viewer-play').emit('click');
  assert.equal(f.timers.size, 0, 'never advance while an image is loading');
  await f.get('viewer-image').emit('load');
  assert.equal(f.timers.size, 1);
  await f.get('viewer-next').emit('click');
  assert.equal(f.controller.current.id, 'photo-2');
  assert.equal(f.timers.size, 0, 'manual navigation removes the previous image timer');
  await f.get('viewer-image').emit('load');
  f.tick();
  assert.equal(f.controller.current.id, 'photo-3');
  await f.get('viewer-image').emit('load');
  f.document.hidden = true;
  await f.document.emit('visibilitychange');
  assert.equal(f.timers.size, 0);
  f.document.hidden = false;
  await f.document.emit('visibilitychange');
  assert.equal(f.get('viewer-play').getAttribute('aria-pressed'), 'false');
  assert.equal(f.timers.size, 0, 'returning to the page must not restart playback');
});

test('closing clears playback and returns focus exactly once', async t => {
  const f = fixture(t);
  const trigger = node();
  f.controller.open(f.photos[0], { trigger, screening: true });
  await f.get('viewer-image').emit('load');
  assert.equal(f.timers.size, 1);
  f.controller.close();
  await f.get('photo-viewer').emit('close');
  assert.equal(f.controller.current, null);
  assert.equal(f.controller.isOpen, false);
  assert.equal(f.timers.size, 0);
  assert.equal(f.closed, 1);
  assert.equal(trigger.focused, true);
  assert.equal(f.get('viewer-image').hasAttribute('src'), false);
});

test('reduced motion and single-photo collections do not autoplay', async t => {
  const f = fixture(t, { reducedMotion: true });
  f.controller.open(f.photos[0], { screening: true });
  await f.get('viewer-image').emit('load');
  assert.equal(f.timers.size, 0);
  assert.equal(f.get('viewer-caption').textContent, 'Scene 1');
  await f.get('viewer-play').emit('click');
  assert.equal(f.timers.size, 1, 'explicit playback remains available');
  f.controller.open(f.photos[0], { collection: [f.photos[0]], screening: true });
  await f.get('viewer-image').emit('load');
  assert.equal(f.get('viewer-play').disabled, true);
  assert.equal(f.timers.size, 0);
});

test('clipboard failures expose the current URL; stale clipboard requests never change a later photo', async t => {
  const f = fixture(t);
  f.controller.open(f.photos[0], { screening: true });
  await f.get('viewer-image').emit('load');
  assert.equal(f.timers.size, 1);
  f.navigator.clipboard.writeText = async () => { throw Error('unavailable'); };
  await f.get('viewer-share').emit('click');
  assert.equal(f.timers.size, 0, 'copying must pause playback while the fallback input is used');
  assert.equal(f.get('viewer-play').getAttribute('aria-pressed'), 'false');
  assert.equal(f.get('viewer-share-fallback').hidden, false);
  assert.equal(f.get('viewer-share-url').value, 'https://example.com/photography.html?photo=photo-1');
  assert.equal(f.get('viewer-share-url').selected, true);
  let resolve;
  f.navigator.clipboard.writeText = () => new Promise(done => { resolve = done; });
  const pending = f.get('viewer-share').emit('click');
  await f.get('viewer-next').emit('click');
  resolve();
  await pending;
  assert.equal(f.get('viewer-share-status').textContent, '');
  assert.equal(f.get('viewer-share-fallback').hidden, true);
});

test('first opening focuses playback or close, without moving focus on an already-open photo change', t => {
  const f = fixture(t);
  f.controller.open(f.photos[0]);
  assert.equal(f.get('viewer-play').focused, true);
  f.get('viewer-play').focused = false;
  f.controller.open(f.photos[1]);
  assert.equal(f.get('viewer-play').focused, false, 'preserve focus during an already-open navigation');
  f.controller.close();
  f.controller.open(f.photos[0], { collection: [f.photos[0]] });
  assert.equal(f.get('viewer-close').focused, true);
});

test('fullscreen is released after a late success but an existing session is never exited', async t => {
  const f = fixture(t);
  let resolve;
  let exits = 0;
  f.document.documentElement.requestFullscreen = () => new Promise(done => { resolve = done; });
  f.document.exitFullscreen = async () => { exits++; f.document.fullscreenElement = null; };
  f.controller.open(f.photos[0], { screening: true });
  f.controller.close();
  f.document.fullscreenElement = f.document.documentElement;
  resolve();
  await new Promise(done => setImmediate(done));
  assert.equal(exits, 1);
  assert.equal(f.controller.isOpen, false);
  f.document.fullscreenElement = f.document.documentElement;
  f.controller.open(f.photos[0], { screening: true });
  f.controller.close();
  assert.equal(exits, 1, 'do not exit a fullscreen session owned by the user');
});

test('escaping CSS screening returns to the normal viewer and input keys are preserved', async t => {
  const f = fixture(t);
  f.controller.open(f.photos[0], { screening: true });
  const cancel = await f.get('photo-viewer').emit('cancel');
  assert.equal(cancel.defaultPrevented, true);
  assert.equal(f.controller.isOpen, true);
  assert.equal(f.get('photo-viewer').classList.contains('is-screening'), false);
  const input = node();
  input.closest = () => input;
  await f.get('photo-viewer').emit('keydown', { key: 'ArrowRight', target: input });
  assert.equal(f.controller.current.id, 'photo-1');
  await f.get('photo-viewer').emit('keydown', { key: 'ArrowRight' });
  assert.equal(f.controller.current.id, 'photo-2');
  f.setChinese();
  assert.equal(f.get('viewer-caption').textContent, '照片2');
  await f.get('photo-viewer').emit('cancel');
  assert.equal(f.controller.isOpen, false);
});
