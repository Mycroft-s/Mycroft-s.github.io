import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRenderer } from '../scripts/build-lib.mjs';
import { homeCollections, readHomeData } from '../scripts/home-data.mjs';
import { initSliders } from '../assets/js/modules/sliders.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async name => JSON.parse(await readFile(join(root, `src/data/${name}.json`), 'utf8'));
async function sourceData() {
  const [news, experience, photos] = await Promise.all(['news', 'experience', 'photography'].map(read));
  return { news, experience, photos };
}

test('home photography uses at most twelve lightweight thumbnails, preserving every archive photo', async () => {
  const before = await read('photography');
  const { collections, translations } = await readHomeData(root);
  const selection = collections['home-photos'];
  assert.ok(selection.length > 0 && selection.length <= 12);
  assert.ok(before.length >= selection.length);
  assert.deepEqual(await read('photography'), before);
  assert.equal(new Set(selection.map(photo => photo.href)).size, selection.length);
  const sizes = await Promise.all(selection.map(async photo => {
    assert.match(photo.thumbnail, /^assets\/img\/gallery\/.+-thumb\.webp$/);
    assert.match(photo.href, /^photography\.html\?photo=photo-/);
    assert.ok(translations.en[photo.titleKey]);
    assert.ok(translations.cn[photo.titleKey]);
    return (await stat(join(root, photo.thumbnail))).size;
  }));
  assert.ok(sizes.reduce((sum, size) => sum + size, 0) < 2 * 1024 * 1024, 'Homepage photography must stay below its 2 MiB thumbnail budget.');
  const render = createRenderer(join(root, 'src'), translations, collections);
  const card = await render('components/photo.html', selection[0]);
  assert.match(card, /loading="lazy" decoding="async"/);
  assert.doesNotMatch(card, /assets\/img\/202\d\//);
});

test('news is newest-first, shows three recent updates, and retains single-language archive copy', async () => {
  const { collections, translations } = await readHomeData(root);
  const recent = collections['news-recent'];
  const archive = collections['news-archive'];
  assert.equal(recent.length, 3);
  assert.equal(recent.length + archive.length, (await read('news')).length);
  const dates = [...recent, ...archive].map(item => item.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.doesNotMatch(translations.en[recent[0].descriptionKey], /我加入|<br>/);
  assert.match(translations.cn[recent[0].descriptionKey], /我加入/);
  assert.doesNotMatch(translations.cn[recent[0].descriptionKey], /I joined|<br>/);
});

test('experience dates and links come from one source, including corrected C2SMARTER end date', async () => {
  const { collections, translations } = await readHomeData(root);
  assert.equal(collections['experience-work'].length, 7);
  assert.equal(collections['experience-education'].length, 3);
  assert.doesNotMatch(translations.en.qualification7__subtitle, /Present|2025/);
  assert.equal(translations.en.qualification7__date, 'Feb 2025 – Dec 2025');
  assert.equal(translations.cn.qualification7__date, '2025年2月 至 2025年12月');
  assert.match(translations.en.qualification10__date, /Jul 13, 2026.*Present/);
  const badges = [...collections['experience-work'], ...collections['experience-education']].map(item => item.badgeHtml);
  assert.equal(badges.filter(html => html.includes('href="https://www.linkedin.com/')).length, 9);
  assert.equal(badges.filter(html => html.includes('qualification__badge--symbol')).length, 1);
});

test('bad dates, unknown organizations and unsafe external links fail before publishing', async () => {
  const data = await sourceData();
  const invalidNews = structuredClone(data);
  invalidNews.news[0].date = '2026-02-30';
  assert.throws(() => homeCollections(invalidNews), /invalid calendar date/);
  const invalidPeriod = structuredClone(data);
  invalidPeriod.experience.work[0].periods[0] = { start: '2026-07', end: '2025-07' };
  assert.throws(() => homeCollections(invalidPeriod), /ends before/);
  const invalidOrganization = structuredClone(data);
  invalidOrganization.experience.work[0].organization = 'missing';
  assert.throws(() => homeCollections(invalidOrganization), /Unknown organization/);
  const invalidLink = structuredClone(data);
  invalidLink.experience.organizations.tiktok.linkedin = 'javascript:alert(1)';
  assert.throws(() => homeCollections(invalidLink), /HTTPS/);
});

test('coverflow initializes near the viewport and pauses away from it, in background tabs or with reduced motion', () => {
  const callbacks = [];
  const listeners = new Map();
  const mediaListeners = new Map();
  const motion = { matches: false, addEventListener: (name, callback) => mediaListeners.set(name, callback) };
  const container = { querySelector: () => null };
  const root = {
    hidden: false,
    defaultView: { matchMedia: () => motion },
    querySelectorAll: selector => selector === '.photography__container' ? [container] : [],
    addEventListener: (name, callback) => listeners.set(name, callback),
  };
  class Observer {
    constructor(callback) { callbacks.push(callback); }
    observe() {}
    disconnect() {}
  }
  const instances = [];
  class Swiper {
    constructor(element, params) {
      this.params = params;
      this.playing = true;
      this.autoplay = { start: () => { this.playing = true; }, stop: () => { this.playing = false; } };
      instances.push(this);
    }
  }
  initSliders(root, Swiper, Observer);
  assert.equal(instances.length, 0);
  callbacks[0]([{ isIntersecting: true }]);
  assert.equal(instances.length, 1);
  callbacks[1]([{ isIntersecting: true }]);
  assert.equal(instances[0].playing, true);
  callbacks[1]([{ isIntersecting: false }]);
  assert.equal(instances[0].playing, false);
  callbacks[1]([{ isIntersecting: true }]);
  root.hidden = true;
  listeners.get('visibilitychange')();
  assert.equal(instances[0].playing, false);
  root.hidden = false;
  listeners.get('visibilitychange')();
  assert.equal(instances[0].playing, true);
  motion.matches = true;
  mediaListeners.get('change')();
  assert.equal(instances[0].playing, false);
  assert.equal(instances[0].params.speed, 0);
  initSliders(root, Swiper, Observer);
  assert.equal(instances.length, 1, 'Reinitialization must not create duplicate observers or slides.');
});
