import assert from 'node:assert/strict';
import test, { beforeEach, afterEach } from 'node:test';
import { initLanguage } from '../assets/js/cn-en-translate.js';

// A small DOM boundary fixture keeps the regression checks dependency-free.
// Browser/layout behavior is verified separately against the actual page.
function element(attributes = {}, html = '') {
  const listeners = new Map();
  return {
    innerHTML: html,
    textContent: '',
    getAttribute(name) { return attributes[name] ?? null; },
    setAttribute(name, value) { attributes[name] = value; },
    addEventListener(name, callback) {
      listeners.set(name, [...(listeners.get(name) ?? []), callback]);
    },
    click() { for (const callback of listeners.get('click') ?? []) callback(); },
  };
}

function page(elements = [element({ i18n: 'title' }, 'Static title')]) {
  const button = element();
  const label = element();
  return {
    elements, button, label,
    documentElement: { lang: 'en' },
    getElementById(id) { return id === 'translate' ? button : id === 'nav__translate' ? label : null; },
    querySelectorAll() { return elements; },
  };
}

function response(data, ok = true) {
  return { ok, status: ok ? 200 : 503, json: async () => data };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let preferences;
beforeEach(() => {
  preferences = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => preferences.get(key) ?? null,
      setItem: (key, value) => preferences.set(key, value),
    },
  });
});
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

test('saved Chinese preference loads trusted markup, updates lang, and persists', async () => {
  preferences.set('lang', 'cn');
  const root = page();
  const requests = [];
  const controller = initLanguage(root, async url => {
    requests.push(url);
    return response({ title: '<a href="/work">作品</a><br>简介' });
  });
  assert.equal(await controller.ready, true);
  assert.deepEqual(requests, ['assets/i18n/i18n_cn.json']);
  assert.equal(root.elements[0].innerHTML, '<a href="/work">作品</a><br>简介');
  assert.equal(root.documentElement.lang, 'zh-CN');
  assert.equal(root.label.textContent, '中/En');
  assert.equal(preferences.get('lang'), 'cn');
});

test('missing translations restore the static fallback without deleting content', async () => {
  const root = page();
  const controller = initLanguage(root, async url => response(url.includes('_en') ? {} : { title: '中文' }));
  await controller.ready;
  assert.equal(root.elements[0].innerHTML, 'Static title');
  await controller.setLanguage('cn');
  assert.equal(root.elements[0].innerHTML, '中文');
  await controller.setLanguage('en');
  assert.equal(root.elements[0].innerHTML, 'Static title');
});

test('latest requested language wins even when an older response arrives last', async () => {
  const pending = deferred();
  const root = page();
  const controller = initLanguage(root, async url => url.includes('_cn') ? pending.promise : response({ title: 'English' }));
  await controller.ready;
  const chinese = controller.setLanguage('cn');
  const english = controller.setLanguage('en');
  assert.equal(await english, true);
  pending.resolve(response({ title: '中文' }));
  assert.equal(await chinese, false);
  assert.equal(root.elements[0].innerHTML, 'English');
  assert.equal(root.documentElement.lang, 'en');
  assert.equal(preferences.get('lang'), 'en');
});

test('failed translation keeps current content and the next attempt can retry', async t => {
  t.mock.method(console, 'warn', () => {});
  const root = page();
  let chineseRequests = 0;
  const controller = initLanguage(root, async url => {
    if (url.includes('_en')) return response({ title: 'English' });
    return ++chineseRequests === 1 ? response(null, false) : response({ title: '中文' });
  });
  await controller.ready;
  assert.equal(await controller.setLanguage('cn'), false);
  assert.equal(root.elements[0].innerHTML, 'English');
  assert.equal(root.label.textContent, 'En/中');
  assert.equal(root.button.getAttribute('aria-busy'), 'false');
  assert.equal(preferences.get('lang'), 'en');
  assert.equal(await controller.setLanguage('cn'), true);
  assert.equal(chineseRequests, 2);
});

test('invalid saved language and malformed translation files preserve the static page', async t => {
  t.mock.method(console, 'warn', () => {});
  preferences.set('lang', '../../other');
  const root = page();
  const requests = [];
  const controller = initLanguage(root, async url => { requests.push(url); return response([]); });
  assert.equal(await controller.ready, false);
  assert.deepEqual(requests, ['assets/i18n/i18n_en.json']);
  assert.equal(root.elements[0].innerHTML, 'Static title');
  assert.equal(await controller.setLanguage('unsupported'), false);
  assert.equal(requests.length, 1);
});

test('reinitialization does not duplicate toggle listeners or fetches', async () => {
  const root = page();
  const requests = [];
  const fetcher = async url => { requests.push(url); return response({ title: url }); };
  const controller = initLanguage(root, fetcher);
  await controller.ready;
  assert.equal(initLanguage(root, fetcher), controller);
  root.button.click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(controller.language, 'cn');
  assert.equal(requests.length, 2);
});

test('storage access errors do not prevent translation or language toggling', async () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('Storage is disabled'); },
  });
  const root = page();
  const controller = initLanguage(root, async () => response({ title: 'Visible' }));
  assert.equal(await controller.ready, true);
  assert.equal(await controller.setLanguage('cn'), true);
  assert.equal(root.elements[0].innerHTML, 'Visible');
  assert.equal(root.documentElement.lang, 'zh-CN');
});

test('i18n-only values and placeholders do not replace unrelated markup', async () => {
  const input = element({ i18n: 'name', 'i18n-only': 'placeholder', placeholder: 'Name' }, 'Preserve');
  input.value = 'User entered text';
  const root = page([input]);
  const controller = initLanguage(root, async () => response({ name: '姓名' }));
  await controller.ready;
  assert.equal(input.getAttribute('placeholder'), '姓名');
  assert.equal(input.value, 'User entered text');
  assert.equal(input.innerHTML, 'Preserve');
});

test('structured content and metadata translate together without duplicate authored dictionaries', async () => {
  const news = element({ i18n: 'news_one' }, 'English news');
  const meta = element({ i18n: 'description', 'i18n-only': 'content', content: 'English description' });
  const root = page([news, meta]);
  const get = root.getElementById;
  root.getElementById = id => id === 'content-translations' ? { textContent: JSON.stringify({
    en: {news_one: 'English news', description: 'English description'},
    cn: {news_one: '最新动态', description: '中文简介'},
  }) } : get(id);
  const controller = initLanguage(root, async () => response({news_one: 'Outdated duplicate'}));
  await controller.ready;
  assert.equal(news.innerHTML, 'English news');
  assert.equal(await controller.setLanguage('cn'), true);
  assert.equal(news.innerHTML, '最新动态');
  assert.equal(meta.getAttribute('content'), '中文简介');
  assert.equal(meta.innerHTML, '');
  await controller.setLanguage('en');
  assert.equal(meta.getAttribute('content'), 'English description');
});

test('invalid embedded content leaves static fallback and normal language controls available', async t => {
  t.mock.method(console, 'warn', () => {});
  const root = page();
  const get = root.getElementById;
  root.getElementById = id => id === 'content-translations' ? {textContent: '{not json'} : get(id);
  const controller = initLanguage(root, async () => response({}));
  assert.equal(await controller.ready, true);
  assert.equal(root.elements[0].innerHTML, 'Static title');
});
