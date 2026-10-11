import test from 'node:test';
import assert from 'node:assert/strict';
import { readArchiveState, buildPhotoUrl, chooseRandomPhoto } from '../assets/js/modules/gallery-state.js';

const photos = [
  { id: 'sony-old', year: '2021', device: 'sony' },
  { id: 'leica', year: '2022', device: 'leica' },
  { id: 'sony-new', year: '2023', device: 'sony' },
  { id: 'nikon', year: '2024', device: 'nikon' },
];

test('a camera from an older year remains reachable, even with newest-year filters', () => {
  const result = readArchiveState(photos, '?year=2024&device=leica');
  assert.equal(result.year, 'all');
  assert.equal(result.device, 'leica');
});

test('photo links reopen the exact image and resolve incompatible filters', () => {
  for (const query of ['?photo=leica', '?year=2024&device=nikon&photo=leica&view=contact']) {
    const result = readArchiveState(photos, query);
    assert.equal(result.photo.id, 'leica');
    assert.equal(result.year, '2022');
    assert.equal(result.device, 'all');
  }
  const compatible = readArchiveState(photos, '?year=all&device=sony&photo=sony-old');
  assert.equal(compatible.year, 'all');
  assert.equal(compatible.device, 'sony');
  assert.equal(readArchiveState(photos, '?view=contact').view, 'contact');
});

test('invalid links degrade to the archive without inventing photos or devices', () => {
  assert.deepEqual(readArchiveState(photos, '?year=1900&device=missing&photo=missing&view=missing'), {
    year: '2024', device: 'all', photo: null, view: 'gallery',
  });
  assert.deepEqual(readArchiveState([], '?photo=missing'), { year: 'all', device: 'all', photo: null, view: 'gallery' });
});

test('shared URLs contain a stable photo identity without stale filters', () => {
  const result = new URL(buildPhotoUrl('https://example.com/sub/photography.html?year=2024&device=nikon&view=contact#old', 'sony-old'));
  assert.equal(result.pathname, '/sub/photography.html');
  assert.equal(result.search, '?photo=sony-old');
  assert.equal(result.hash, '#gallery-archive-heading');
  assert.equal(readArchiveState(photos, result.search).photo.id, 'sony-old');
});

test('random discovery crosses years and cameras and handles small archives', () => {
  assert.equal(chooseRandomPhoto([], null), null);
  assert.equal(chooseRandomPhoto([photos[0]], photos[0].id), photos[0]);
  for (const sample of [0, 0.4, 0.99]) {
    const choice = chooseRandomPhoto(photos, 'sony-old', () => sample);
    assert.notEqual(choice.id, 'sony-old');
    assert.notEqual(choice.year, '2021');
    assert.notEqual(choice.device, 'sony');
  }
  assert.equal(chooseRandomPhoto([photos[0], photos[2]], 'sony-old', () => 0).id, 'sony-new');
});
