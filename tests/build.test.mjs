import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSite } from '../scripts/build-lib.mjs';
import { groupPhotos, normalizePhotos } from '../scripts/gallery-lib.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);

async function fixture(t, template = '<h1 i18n="title">{{ t:title }}</h1>') {
  const directory = await mkdtemp(join(tmpdir(), 'menghongdao-build-test-'));
  t.after(async () => {
    // Only remove the exact temporary workspace allocated for this test.
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(directory.startsWith(join(tmpdir(), 'menghongdao-build-test-')));
    await rm(directory, { recursive: true, force: true });
  });
  async function write(path, content) {
    const target = join(directory, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  await write('src/index.html', template);
  await write('assets/i18n/i18n_en.json', JSON.stringify({ title: 'Hello <br>world' }));
  await write('assets/i18n/i18n_cn.json', JSON.stringify({ title: '你好<br>世界' }));
  return { directory, write };
}

test('generated homepage contains complete static content and is current', async () => {
  const { html, pages } = await renderSite(root);
  for (const [name, page] of Object.entries(pages)) {
    assert.equal(page.html, (await readFile(join(root, name), 'utf8')).replace(/\r\n/g, '\n'));
  }
  const english = JSON.parse(await readFile(join(root, 'assets/i18n/i18n_en.json'), 'utf8'));
  assert.ok(html.includes(english.home__description));
  assert.ok(html.includes(english.publication1__title));
  const photos = JSON.parse(await readFile(join(root, 'src/data/photography.json'), 'utf8'));
  if (pages['photography.html']) {
    const gallery = pages['photography.html'].html;
    const photoIds = [...gallery.matchAll(/<a class="gallery-card__link"[^>]*data-photo-id="([^"]+)"/g)].map((match) => match[1]);
    const expected = groupPhotos(normalizePhotos(photos)).flatMap((year) => year.groups.flatMap((group) => group.photos.map((photo) => photo.id)));
    assert.deepEqual(photoIds, expected);
  } else {
    const photoPaths = [...html.matchAll(/<img src="([^"]+)"[^>]*class="photography__img"/g)].map((match) => match[1]);
    assert.deepEqual(photoPaths, photos.map((photo) => photo.src));
  }
  const news = JSON.parse(await readFile(join(root, 'src/data/news.json'), 'utf8'));
  const compact = (value) => value.replace(/\s+/g, ' ').trim();
  for (const entry of news) assert.ok(compact(html).includes(compact(entry.descriptionHtml)));
  assert.match(html, /<script type="module" src="assets\/js\/main\.js"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]*jquery|\{\{|\}\}/);
});

test('authored markup is preserved, and plain data fields are HTML-escaped', async (t) => {
  const { directory, write } = await fixture(t, '{{ t:title }}\n{{ each:entries:item.html }}');
  await write('src/item.html', '<p>{{ text:label }}</p><p>{{ html:descriptionHtml }}</p>');
  await write('src/data/entries.json', JSON.stringify([{ label: '<img>&"', descriptionHtml: 'English<br>中文' }]));
  const { html } = await renderSite(directory);
  assert.match(html, /Hello <br>world/);
  assert.match(html, /&lt;img&gt;&amp;&quot;/);
  assert.match(html, /English<br>中文/);
});

test('translation mistakes fail the build instead of creating blank content', async (t) => {
  const { directory, write } = await fixture(t, '<h1 i18n="missing">{{ t:missing }}</h1>');
  await assert.rejects(renderSite(directory), /Unknown translation missing/);
  await write('src/index.html', '<h1 i18n="missing">fallback</h1>');
  await assert.rejects(renderSite(directory), /Missing en translation: missing/);
  await write('assets/i18n/i18n_cn.json', '{}');
  await assert.rejects(renderSite(directory), /Missing cn translation: title/);
});

test('broken template references, include cycles and missing fields fail clearly', async (t) => {
  const { directory, write } = await fixture(t, '{{ include:missing.html }}');
  await assert.rejects(renderSite(directory), /Cannot read template missing\.html/);
  await write('src/index.html', '{{ include:index.html }}');
  await assert.rejects(renderSite(directory), /Circular template include/);
  await write('src/index.html', '{{ typo:title }}');
  await assert.rejects(renderSite(directory), /Unknown template token/);
  await write('src/index.html', '{{ text:missing }}');
  await assert.rejects(renderSite(directory), /Missing string field missing/);
  await write('src/index.html', '{{ include:../package.json }}');
  await assert.rejects(renderSite(directory), /Path must stay inside/);
});

test('asset checks catch missing files and letter case errors on Windows too', async (t) => {
  const { directory, write } = await fixture(t, '<img src="assets/photo.jpg" alt="">');
  await assert.rejects(renderSite(directory), /Missing local asset/);
  await write('assets/photo.JPG', 'fixture');
  await assert.rejects(renderSite(directory), /Missing local asset/);
  await write('src/index.html', '<img src="assets/photo.JPG" alt="">');
  assert.equal((await renderSite(directory)).stats.assets, 1);
});

test('new generated pages can link to each other before their output files exist', async (t) => {
  const { directory, write } = await fixture(t, '<main id="home"><a href="photography.html#archive">Archive</a></main>');
  await write('src/photography.html', '<main id="archive"><a href="index.html#home">Home</a></main>');
  const { html, pages } = await renderSite(directory);
  assert.deepEqual(Object.keys(pages), ['index.html', 'photography.html']);
  assert.equal(html, pages['index.html'].html);
  assert.match(pages['photography.html'].html, /id="archive"/);
  await write('src/index.html', '<a href="photography.html#missing">Archive</a>');
  await assert.rejects(renderSite(directory), /Missing generated-page anchor target/);
  await write('src/index.html', '<a href="Photography.html">Archive</a>');
  await assert.rejects(renderSite(directory), /Missing local asset/);
  await write('src/index.html', '<img src="assets/missing.webp">');
  await assert.rejects(renderSite(directory), /Missing local asset/);
});

test('repeated photo data identifiers are allowed, while duplicate HTML ids are rejected', async (t) => {
  const { directory, write } = await fixture(t, '<a data-photo-id="photo-one"></a><a data-photo-id="photo-one"></a>');
  await renderSite(directory);
  await write('src/index.html', '<div id="one"></div><div id="one"></div>');
  await assert.rejects(renderSite(directory), /Duplicate HTML id: one/);
});

test('--check detects stale generated HTML without overwriting it', async (t) => {
  const { directory, write } = await fixture(t);
  await write('src/photography.html', '<h1>Photography archive</h1>');
  await mkdir(join(directory, 'scripts'));
  for (const filename of ['build.mjs', 'build-lib.mjs', 'gallery-lib.mjs']) {
    await copyFile(join(root, 'scripts', filename), join(directory, 'scripts', filename));
  }
  const script = join(directory, 'scripts/build.mjs');
  await run(process.execPath, [script]);
  await run(process.execPath, [script, '--check']);
  const index = await readFile(join(directory, 'index.html'), 'utf8');
  await write('photography.html', 'stale result\n');
  await assert.rejects(run(process.execPath, [script, '--check']), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /photography.html is out of date/);
    return true;
  });
  assert.equal(await readFile(join(directory, 'photography.html'), 'utf8'), 'stale result\n');
  assert.equal(await readFile(join(directory, 'index.html'), 'utf8'), index);
});
