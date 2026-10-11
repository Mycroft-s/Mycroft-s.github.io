import { readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { readGalleryCollections } from './gallery-lib.mjs';
import { readHomeData } from './home-data.mjs';
import { readProjectCollections } from './project-data.mjs';
import { readSiteMetadata, metadataTranslations, injectMetadata, scriptJson, siteAuxiliaryFiles } from './site-metadata.mjs';

const normalize = (text) => text.replace(/\r\n/g, '\n');
const has = (object, key) => Object.hasOwn(object, key);

export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function inside(directory, name) {
  const path = resolve(directory, name);
  const rel = relative(directory, path);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) {
    throw new Error(`Path must stay inside ${directory}: ${name}`);
  }
  return path;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read JSON ${path}: ${error.message}`);
  }
}

async function loadTranslations(root) {
  const languages = ['en', 'cn'];
  const translations = {};
  for (const language of languages) {
    const dictionary = await readJson(join(root, `assets/i18n/i18n_${language}.json`));
    if (!dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) {
      throw new Error(`The ${language} translation dictionary must be an object.`);
    }
    for (const [key, value] of Object.entries(dictionary)) {
      if (typeof value !== 'string') throw new Error(`Translation ${language}:${key} must be a string.`);
    }
    translations[language] = dictionary;
  }
  const allKeys = new Set(languages.flatMap((language) => Object.keys(translations[language])));
  for (const key of allKeys) {
    for (const language of languages) {
      if (!has(translations[language], key)) throw new Error(`Missing ${language} translation: ${key}`);
    }
  }
  return translations;
}

/**
 * Deliberately small template vocabulary:
 * include:path, each:collection:path, t:translationKey,
 * i18n:itemFieldContainingKey, text:itemField, html:itemField.
 * Only authored HTML/translation values use raw markup; text fields are escaped.
 */
export function createRenderer(sourceDir, translations, extraCollections = {}) {
  const files = new Map();
  const collections = new Map();
  function translate(key, source) {
    if (!has(translations.en, key)) throw new Error(`Unknown translation ${key} in ${source}`);
    return translations.en[key];
  }
  function field(item, key, source) {
    if (!has(item, key) || typeof item[key] !== 'string') {
      throw new Error(`Missing string field ${key} in ${source}`);
    }
    return item[key];
  }
  async function render(file, item = {}, stack = []) {
    const path = inside(sourceDir, file);
    if (stack.includes(path)) throw new Error(`Circular template include: ${[...stack, path].join(' -> ')}`);
    if (!files.has(path)) {
      try {
        files.set(path, normalize(await readFile(path, 'utf8')).trimEnd());
      } catch (error) {
        throw new Error(`Cannot read template ${file}: ${error.message}`);
      }
    }
    const template = files.get(path);
    let rendered = '';
    let cursor = 0;
    for (const token of template.matchAll(/\{\{([\s\S]*?)\}\}/g)) {
      const expression = token[1].trim();
      const [kind, name, component, ...extra] = expression.split(':');
      if (extra.length || !name) throw new Error(`Invalid template token {{ ${expression} }} in ${file}`);
      let value;
      if (kind === 'include' && !component) {
        value = await render(name, item, [...stack, path]);
      } else if (kind === 'each' && component && /^[a-z][a-z0-9-]*$/.test(name)) {
        if (!collections.has(name)) {
          const additional = extraCollections[name];
          const entries = has(extraCollections, name)
            ? await (typeof additional === 'function' ? additional() : additional)
            : await readJson(inside(sourceDir, `data/${name}.json`));
          if (!Array.isArray(entries) || entries.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
            throw new Error(`Collection ${name} must be an array of objects.`);
          }
          collections.set(name, entries);
        }
        const fragments = [];
        for (const entry of collections.get(name)) fragments.push(await render(component, entry, [...stack, path]));
        value = fragments.join('\n');
      } else if (kind === 't' && !component) {
        value = translate(name, file);
      } else if (kind === 'i18n' && !component) {
        value = translate(field(item, name, file), file);
      } else if (kind === 'text' && !component) {
        value = escapeHtml(field(item, name, file));
      } else if (kind === 'html' && !component) {
        value = field(item, name, file);
      } else {
        throw new Error(`Unknown template token {{ ${expression} }} in ${file}`);
      }
      // Align included blocks with their placeholder without changing inline text.
      const lineStart = template.lastIndexOf('\n', token.index - 1) + 1;
      const prefix = template.slice(lineStart, token.index);
      if (/^\s*$/.test(prefix)) value = value.replace(/\n/g, `\n${prefix}`);
      rendered += template.slice(cursor, token.index) + value;
      cursor = token.index + token[0].length;
    }
    rendered += template.slice(cursor);
    if (/\{\{|\}\}/.test(rendered)) throw new Error(`Unresolved template token in ${file}`);
    return rendered;
  }
  return render;
}

async function validateLocalFile(root, url) {
  const decoded = decodeURIComponent(url.split(/[?#]/)[0]);
  if (!decoded) return;
  const path = inside(root, decoded.replace(/^\//, ''));
  // GitHub Pages is case sensitive, including when this check runs on Windows.
  const segments = relative(root, path).split(sep);
  let directory = root;
  for (const segment of segments) {
    const names = await readdir(directory);
    if (!names.includes(segment)) throw new Error(`Missing local asset (check spelling/case): ${url}`);
    directory = join(directory, segment);
  }
  if (!(await stat(path)).isFile()) throw new Error(`Local asset is not a file: ${url}`);
}

export async function validateHtml(html, root, translations, generatedPages = {}) {
  const markup = html.replace(/<!--[\s\S]*?-->/g, '');
  const keys = new Set([...markup.matchAll(/\bi18n="([^"]+)"/g)].map((match) => match[1]));
  for (const key of keys) {
    for (const language of ['en', 'cn']) {
      if (!has(translations[language], key)) throw new Error(`Missing ${language} translation: ${key}`);
    }
  }
  const ids = new Set();
  for (const match of markup.matchAll(/(?:^|\s)id="([^"]+)"/g)) {
    if (ids.has(match[1])) throw new Error(`Duplicate HTML id: ${match[1]}`);
    ids.add(match[1]);
  }
  const assets = new Set();
  for (const tag of markup.matchAll(/<[a-z][^>]*>/gi)) {
    for (const match of tag[0].matchAll(/(?:^|\s)(?:src|href|xlink:href|data-preview|data-original)="([^"]*)"/g)) {
      const url = match[1].replace(/&amp;/g, '&');
      if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) continue;
      if (url.startsWith('#')) {
        // SVG symbols are injected by the existing iconfont script at runtime.
        if (/^<a\b/i.test(tag[0]) && url.length > 1 && !ids.has(url.slice(1))) {
          throw new Error(`Missing anchor target: ${url}`);
        }
      } else {
        assets.add(url);
      }
    }
  }
  for (const asset of assets) {
    const name = decodeURIComponent(asset.split(/[?#]/)[0]).replace(/^\//, '');
    if (has(generatedPages, name)) {
      const fragment = asset.includes('#') ? decodeURIComponent(asset.slice(asset.indexOf('#') + 1)) : '';
      const target = generatedPages[name].replace(/<!--[\s\S]*?-->/g, '');
      if (fragment && ![...target.matchAll(/(?:^|\s)id="([^"]+)"/g)].some((match) => match[1] === fragment)) {
        throw new Error(`Missing generated-page anchor target: ${asset}`);
      }
    } else {
      await validateLocalFile(root, asset);
    }
  }
  return { translations: keys.size, assets: assets.size };
}

export async function renderSite(root) {
  root = resolve(root);
  const translations = await loadTranslations(root);
  const exists = async name => {
    try { return (await stat(join(root, name))).isFile(); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  };
  const home = await exists('src/data/experience.json') ? await readHomeData(root) : { collections: {}, translations: { en: {}, cn: {} } };
  const site = await readSiteMetadata(root);
  const metaTranslations = metadataTranslations(site);
  const extraTranslations = {en: {}, cn: {}};
  for (const language of ['en', 'cn']) {
    Object.assign(extraTranslations[language], home.translations[language], metaTranslations[language]);
    Object.assign(translations[language], extraTranslations[language]);
  }
  const projects = await exists('src/data/project-details.json') ? await readProjectCollections(root, translations) : {};
  let gallery;
  const galleryCollection = (name) => async () => {
    gallery ??= readGalleryCollections(root);
    return (await gallery)[name];
  };
  const render = createRenderer(join(root, 'src'), translations, {
    ...home.collections,
    ...projects,
    'gallery-years': galleryCollection('gallery-years'),
    'gallery-featured': galleryCollection('gallery-featured'),
  });
  // Root-level source pages are published; includes stay in nested directories.
  const names = ['index.html', ...(await readdir(join(root, 'src'))).filter(name => name !== 'index.html' && /^[a-z][a-z0-9-]*\.html$/.test(name)).sort()];
  const generated = {};
  for (const name of names) {
    let html = injectMetadata(await render(name), name, site);
    const usedKeys = new Set([...html.matchAll(/\bi18n="([^"]+)"/g)].map(match => match[1]));
    const embedded = Object.fromEntries(['en', 'cn'].map(language => [language,
      Object.fromEntries(Object.entries(extraTranslations[language]).filter(([key]) => usedKeys.has(key))),
    ]));
    if (Object.keys(embedded.en).length) {
      const script = `<script type="application/json" id="content-translations">${scriptJson(embedded)}</script>`;
      html = html.includes('</body>') ? html.replace('</body>', `${script}\n  </body>`) : `${html}\n${script}`;
    }
    generated[name] = `${html.replace(/[ \t]+$/gm, '').trimEnd()}\n`;
  }
  const pages = {};
  for (const name of names) {
    pages[name] = { html: generated[name], stats: await validateHtml(generated[name], root, translations, generated) };
  }
  // Keep the original single-page API available to callers and existing checks.
  return { ...pages['index.html'], pages, files: siteAuxiliaryFiles(site, names) };
}
