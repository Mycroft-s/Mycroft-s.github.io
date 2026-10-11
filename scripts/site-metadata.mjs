import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const scriptJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

export async function readSiteMetadata(root) {
  let site;
  try { site = JSON.parse(await readFile(join(root, 'src/data/site.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const origin = new URL(site.origin);
  if (origin.protocol !== 'https:' || origin.origin !== site.origin) throw new Error('Site origin must be an HTTPS origin without a trailing slash.');
  if (!/^assets\/[\w/.-]+\.png$/.test(site.image) || site.image.includes('..')) throw new Error('Invalid social card path.');
  if (!(await stat(join(root, site.image))).isFile()) throw new Error('Missing social card.');
  for (const [name, page] of Object.entries(site.pages)) {
    if (!/^[\w-]+\.html$/.test(name) || !/^\/[\w./-]*$/.test(page.path)) throw new Error('Invalid page metadata path.');
    for (const language of ['en', 'cn']) {
      if (!page.title?.[language] || !page.description?.[language]) throw new Error(`Missing ${language} metadata for ${name}.`);
    }
  }
  return site;
}

export function metadataTranslations(site) {
  const result = {en: {}, cn: {}};
  if (!site) return result;
  for (const [name, page] of Object.entries(site.pages)) {
    const prefix = `seo__${name.replace('.html', '').replaceAll('-', '_')}`;
    for (const language of ['en', 'cn']) {
      result[language][`${prefix}_title`] = page.title[language];
      result[language][`${prefix}_description`] = page.description[language];
    }
  }
  result.en.seo__locale = 'en_US'; result.cn.seo__locale = 'zh_CN';
  return result;
}

export function injectMetadata(html, name, site) {
  const page = site?.pages[name];
  if (!page) return html;
  const prefix = `seo__${name.replace('.html', '').replaceAll('-', '_')}`;
  const url = site.origin + page.path;
  const image = `${site.origin}/${site.image}`;
  const translatedMeta = (attribute, property, value, key) => `<meta ${attribute}="${property}" content="${escape(value)}" i18n="${key}" i18n-only="content" />`;
  const tags = [
    `<title i18n="${prefix}_title">${escape(page.title.en)}</title>`,
    translatedMeta('name', 'description', page.description.en, `${prefix}_description`),
    `<link rel="canonical" href="${escape(url)}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escape(site.name)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    translatedMeta('property', 'og:title', page.title.en, `${prefix}_title`),
    translatedMeta('property', 'og:description', page.description.en, `${prefix}_description`),
    translatedMeta('property', 'og:locale', 'en_US', 'seo__locale'),
    `<meta property="og:image" content="${escape(image)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="Hongdao Meng — AI Engineer. Agents, knowledge systems, and photography." />',
    '<meta name="twitter:card" content="summary_large_image" />',
    translatedMeta('name', 'twitter:title', page.title.en, `${prefix}_title`),
    translatedMeta('name', 'twitter:description', page.description.en, `${prefix}_description`),
    `<meta name="twitter:image" content="${escape(image)}" />`,
  ];
  if (name === 'index.html') tags.push(`<script type="application/ld+json">${scriptJson({
    '@context':'https://schema.org','@type':'Person','@id':`${site.origin}/#person`,name:'Hongdao Meng',alternateName:'Mycroft',url:site.origin+'/',jobTitle:'AI Engineer',
    sameAs:['https://github.com/Mycroft-s','https://www.linkedin.com/in/hongdao-meng-70222b306/'],
  })}</script>`);
  return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i,'')
    .replace(/<meta\b[^>]*name="description"[^>]*>\s*/gi,'')
    .replace(/<link\b[^>]*rel="canonical"[^>]*>\s*/gi,'')
    .replace(/<meta\b[^>]*(?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\s*/gi,'')
    .replace('</head>',`    ${tags.join('\n    ')}\n  </head>`);
}

export function siteAuxiliaryFiles(site, names) {
  if (!site) return {};
  const urls = names.filter(name => site.pages[name]).map(name => `  <url><loc>${escape(site.origin + site.pages[name].path)}</loc></url>`);
  return {
    'sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    'robots.txt': `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`,
  };
}
