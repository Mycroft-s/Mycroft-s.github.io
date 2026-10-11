import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createPreviewServer } from '../scripts/serve.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

async function preview(t) {
  const server = await createPreviewServer(root);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const { port } = server.address();
  // Use raw HTTP paths: fetch/URL would normalize traversal attempts before sending them.
  return (path, method = 'GET') => new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path, method, agent: false }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('preview serves every configured page including the three project detail pages', async t => {
  const request = await preview(t);
  const site = JSON.parse(await readFile(join(root, 'src/data/site.json'), 'utf8'));
  assert.equal(Object.keys(site.pages).length, 5);
  for (const name of Object.keys(site.pages)) {
    const response = await request(`/${name}?preview=1`);
    assert.equal(response.status, 200, name);
    assert.match(response.headers['content-type'], /^text\/html/);
    assert.equal(response.body.toString(), await readFile(join(root, name), 'utf8'));
  }
  const home = await request('/');
  assert.equal(home.status, 200);
  assert.match(home.body.toString(), /id="home"/);
});

test('preview serves published assets and crawler files with correct types and HEAD behavior', async t => {
  const request = await preview(t);
  for (const [path, mime] of [
    ['/assets/css/styles.css', 'text/css'],
    ['/assets/js/main.js', 'text/javascript'],
    ['/assets/i18n/i18n_cn.json', 'application/json'],
    ['/favicon.ico', 'image/x-icon'],
    ['/sitemap.xml', 'application/xml'],
    ['/robots.txt', 'text/plain'],
  ]) {
    const response = await request(path);
    assert.equal(response.status, 200, path);
    assert.ok(response.headers['content-type'].startsWith(mime), path);
    assert.ok(response.body.length > 0, path);
  }
  const head = await request('/project-rag.html', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers['cache-control'], 'no-store');
});

test('preview denies source files, hidden files, directories and decoded traversal paths', async t => {
  const request = await preview(t);
  for (const path of [
    '/src/data/site.json', '/scripts/serve.mjs', '/tests/preview-server.test.mjs', '/package.json',
    '/.git/config', '/assets/.env', '/assets/../src/data/site.json',
    '/assets/%2e%2e/src/data/site.json', '/assets/%2e%2e%2fsrc/data/site.json',
    '/assets/%2e%2e%5csrc%5cdata%5csite.json', '/assets/../../Windows/win.ini',
    '/assets/%00styles.css', '/assets/', '/not-a-page.html', '/README.md',
  ]) {
    assert.equal((await request(path)).status, 404, path);
  }
  assert.equal((await request('/assets/%E0%A4%A')).status, 400);
  const post = await request('/index.html', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
});
