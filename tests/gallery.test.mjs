import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { galleryCollections, groupPhotos, normalizePhotos } from '../scripts/gallery-lib.mjs';

function photo(id, overrides = {}) {
  return {
    id, src: `assets/img/${id}.jpg`, thumbnail: `assets/img/thumb-${id}.webp`, preview: `assets/img/preview-${id}.webp`,
    year: '2024', capturedAt: '', yearSource: 'folder', cameraMake: '', cameraModel: '', deviceType: 'unknown',
    width: 1600, height: 1200, altEn: `Photograph ${id}`, altCn: `照片 ${id}`, featured: false, ...overrides,
  };
}

test('years descend, devices retain their order, dated photographs sort inside each device', () => {
  const photos = normalizePhotos([
    photo('unknown-first', { year: '2023' }),
    photo('sony-earlier', { year: '2023', cameraMake: 'SONY', cameraModel: 'ILCE-6400', deviceType: 'camera', yearSource: 'exif', capturedAt: '2023-02-20T12:00:00+08:00' }),
    photo('latest-year'),
    photo('sony-later', { year: '2023', cameraMake: 'SONY', cameraModel: 'ILCE-6400', deviceType: 'camera', yearSource: 'exif', capturedAt: '2023-11-20T12:00:00+08:00' }),
    photo('unknown-last', { year: '2023' }),
    photo('sony-no-date', { year: '2023', cameraMake: 'SONY', cameraModel: 'ILCE-6400', deviceType: 'camera' }),
  ]);
  const years = groupPhotos(photos);
  assert.deepEqual(years.map((year) => year.year), ['2024', '2023']);
  assert.deepEqual(years[1].groups.map((group) => group.deviceKey), ['unknown', 'sony-ilce-6400']);
  assert.deepEqual(years[1].groups[0].photos.map((entry) => entry.id), ['unknown-first', 'unknown-last']);
  assert.deepEqual(years[1].groups[1].photos.map((entry) => entry.id), ['sony-later', 'sony-earlier', 'sony-no-date']);
});

test('EXIF dates retain their recorded day and folder names do not override metadata', () => {
  const [entry] = normalizePhotos([photo('actual-date', {
    src: 'assets/img/2022/202209.jpg', year: '2021', yearSource: 'exif', capturedAt: '2021-09-16T00:12:00+08:00',
  })]);
  assert.equal(entry.year, '2021');
  assert.equal(entry.dateLabelEn, 'Sep 16, 2021');
  assert.equal(entry.dateLabelCn, '2021年9月16日');
  assert.equal(entry.deviceLabelEn, 'Device not recorded');
  assert.equal(entry.deviceType, 'unknown');
});

test('scanner labels are explicit and processing software never becomes a camera', () => {
  const [scan, unknown] = normalizePhotos([
    photo('scan', { cameraMake: 'FUJI', cameraModel: 'SP-3000', deviceType: 'film', deviceLabelEn: 'Film · FUJI SP-3000 scan', deviceLabelCn: '胶片 · FUJI SP-3000 扫描' }),
    photo('software-only', { sourceSoftware: 'NORITSU EZ Controller' }),
  ]);
  assert.equal(scan.deviceKey, 'fuji-sp-3000');
  assert.equal(scan.deviceLabelEn, 'Film · FUJI SP-3000 scan');
  assert.equal(unknown.deviceKey, 'unknown');
  assert.equal(unknown.cameraModel, '');
  assert.equal(unknown.deviceLabelCn, '设备未记录');
});

test('a recorded camera brand is retained even when its model is unknown', () => {
  const [leica] = normalizePhotos([photo('leica', { cameraMake: 'Leica', deviceType: 'camera' })]);
  assert.equal(leica.deviceKey, 'leica');
  assert.equal(leica.deviceLabelEn, 'Leica');
  assert.equal(leica.deviceLabelCn, 'Leica');
  assert.equal(leica.cameraModel, '');
});

test('film cameras are not labeled as scanners without explicit metadata', () => {
  const entries = normalizePhotos([
    photo('rollei', { cameraMake: 'Rollei', cameraModel: '35 SE', deviceType: 'film' }),
    photo('nikon', { cameraMake: 'Nikon', cameraModel: 'FE2', deviceType: 'film' }),
    photo('film-unknown', { deviceType: 'film' }),
  ]);
  assert.equal(entries[0].deviceLabelEn, 'Film · Rollei 35 SE');
  assert.equal(entries[0].deviceLabelCn, '胶片 · Rollei 35 SE');
  assert.equal(entries[1].deviceLabelEn, 'Film · Nikon FE2');
  assert.equal(entries[2].deviceLabelEn, 'Film camera');
  assert.equal(entries[2].deviceLabelCn, '胶片相机');
  for (const entry of entries) assert.doesNotMatch(`${entry.deviceLabelEn} ${entry.deviceLabelCn}`, /scan|扫描/);
});

test('archive HTML contains every photograph as a native link with escaped metadata', () => {
  const result = galleryCollections([
    photo('one', { altEn: 'Sea <script> & "sky"', descriptionEn: 'Light & shadow <across> "water".', descriptionCn: '光与影 <映在> "水面"。', featured: true }),
    photo('two', { year: '2021' }),
  ]);
  assert.deepEqual(result['gallery-years'].map((year) => [year.year, year.count]), [['2024', '1'], ['2021', '1']]);
  assert.deepEqual(result['gallery-featured'].map((entry) => entry.id), ['one']);
  const cards = result['gallery-years'].map((year) => year.cardsHtml).join('\n');
  for (const id of ['one', 'two']) {
    assert.ok(cards.includes(`href="assets/img/preview-${id}.webp"`));
    assert.ok(cards.includes(`src="assets/img/thumb-${id}.webp"`));
    assert.ok(cards.includes(`data-original="assets/img/${id}.jpg"`));
  }
  assert.match(cards, /Sea &lt;script&gt; &amp; &quot;sky&quot;/);
  assert.ok(cards.includes('data-description-en="Light &amp; shadow &lt;across&gt; &quot;water&quot;."'));
  assert.ok(cards.includes('data-description-cn="光与影 &lt;映在&gt; &quot;水面&quot;。"'));
  assert.ok(cards.includes('>Light &amp; shadow &lt;across&gt; &quot;water&quot;.</p>'));
  assert.ok(cards.includes('data-description-en="Photograph two"'));
  assert.doesNotMatch(cards, /<script>|<button/);
  assert.equal([...cards.matchAll(/<figure class="gallery-card"/g)].length, 2);
  assert.equal([...cards.matchAll(/<p class="gallery-card__description"/g)].length, 2);
});

test('every photograph in the real archive supplies and renders both descriptions', async () => {
  const photos = JSON.parse(await readFile(new URL('../src/data/photography.json', import.meta.url), 'utf8'));
  assert.ok(photos.length >= 45, 'The existing archive must retain all 45 photographs.');
  for (const entry of photos) {
    assert.ok(typeof entry.descriptionEn === 'string' && entry.descriptionEn.trim(), `${entry.id}: missing English description`);
    assert.ok(typeof entry.descriptionCn === 'string' && entry.descriptionCn.trim(), `${entry.id}: missing Chinese description`);
  }
  const html = galleryCollections(photos)['gallery-years'].map((year) => year.cardsHtml).join('\n');
  const captions = [...html.matchAll(/<p class="gallery-card__description" data-en="([^"]*)" data-cn="([^"]*)">([^<]*)<\/p>/g)];
  assert.equal(captions.length, photos.length);
  const decode = (value) => value.replace(/&(amp|lt|gt|quot|#39);/g, (entity) => ({
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  })[entity]);
  assert.deepEqual(captions.map((match) => decode(match[3])).sort(), photos.map((entry) => entry.descriptionEn.trim()).sort());
  assert.deepEqual(captions.map((match) => decode(match[2])).sort(), photos.map((entry) => entry.descriptionCn.trim()).sort());
  assert.equal([...html.matchAll(/data-description-en="/g)].length, photos.length);
  assert.equal([...html.matchAll(/data-description-cn="/g)].length, photos.length);
});

test('invalid dates, contradictory metadata and duplicate identifiers fail clearly', () => {
  assert.throws(() => normalizePhotos([photo('same'), photo('same')]), /duplicate photo id/);
  assert.throws(() => normalizePhotos([photo('bad', { yearSource: 'exif', capturedAt: '2024-02-30T12:00:00' })]), /invalid capturedAt calendar date/);
  assert.throws(() => normalizePhotos([photo('bad', { yearSource: 'exif', capturedAt: '2023-12-01' })]), /EXIF year must match/);
  assert.throws(() => normalizePhotos([photo('bad', { capturedAt: '2024-12-01' })]), /must use yearSource exif/);
  assert.throws(() => normalizePhotos([photo('bad', { deviceType: 'guessed' })]), /unknown deviceType/);
  assert.throws(() => normalizePhotos([photo('bad', { width: 0 })]), /positive integer width/);
});
