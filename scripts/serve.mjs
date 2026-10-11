import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Only generated pages and published assets belong to the preview surface. */
export async function createPreviewServer(directory = root) {
  const publicRoot = await realpath(directory);
  const site = JSON.parse(await readFile(path.join(publicRoot, 'src/data/site.json'), 'utf8'));
  if (!site.pages || typeof site.pages !== 'object' || Array.isArray(site.pages)) {
    throw new Error('Site configuration needs a pages object.');
  }
  const pageNames = Object.keys(site.pages);
  if (pageNames.some(name => !/^[a-z][a-z0-9-]*\.html$/.test(name))) {
    throw new Error('Preview page names must be root-level HTML files.');
  }
  const publicFiles = new Set([...pageNames, 'favicon.ico', 'sitemap.xml', 'robots.txt']);
  const isPublicFile = filename => {
    const relative = path.relative(publicRoot, filename);
    const segments = relative.split(path.sep);
    if (!relative || path.isAbsolute(relative) || segments.some(segment => segment.startsWith('.'))) return false;
    const normalized = segments.join('/');
    return publicFiles.has(normalized) || normalized.startsWith('assets/');
  };

  return http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  try {
    if (!request.url.startsWith('/') || request.url.startsWith('//')) {
      response.writeHead(400).end('Bad request');
      return;
    }
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    if (/[\\\0:]/.test(pathname) || pathname.split('/').some(segment => segment.startsWith('.'))) {
      response.writeHead(404).end('Not found');
      return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filename = path.resolve(publicRoot, relative);

    // Check both the request and its real target so asset symlinks cannot expose source files.
    if (!isPublicFile(filename) || !isPublicFile(await realpath(filename)) || !(await stat(filename)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = createReadStream(filename);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch (error) {
    const status = error instanceof URIError ? 400 : 404;
    response.writeHead(status).end(status === 400 ? 'Bad request' : 'Not found');
  }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const server = await createPreviewServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
      ? `Port ${port} is in use. Set PORT to another port and try again.`
      : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Preview: http://127.0.0.1:${port}`);
    console.log('After editing source files, run npm run build and refresh. Ctrl+C stops the server.');
  });
}
