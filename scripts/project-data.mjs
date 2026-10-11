import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function safeLink(url) {
  if (typeof url !== 'string' || !/^(?:https:\/\/|[a-z][a-z0-9-]*\.html(?:#[a-z0-9-]+)?$|#[a-z0-9-]+$)/.test(url)) {
    throw new Error(`Invalid project URL: ${url}`);
  }
  return escape(url);
}

const labels = {
  details: ['project__details', 'Details'],
  code: ['project__code', 'Code'],
  paper: ['project__paper', 'Paper'],
  patent: ['project__patent', 'Patent'],
  video: ['project__video', 'Video'],
  experience: ['project__experience', 'Related experience'],
};

function actionLink(link, primary = false) {
  if (!labels[link.kind]) throw new Error(`Unknown project link kind: ${link.kind}`);
  const [key, label] = labels[link.kind];
  const external = link.url.startsWith('https://');
  return `<a class="project-link${primary ? ' project-link--primary' : ''}" href="${safeLink(link.url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}><span i18n="${key}">${label}</span><span aria-hidden="true">${external ? '↗' : '→'}</span></a>`;
}

/** Keep link labels, targets, and detail-page collections in one build adapter. */
export async function readProjectCollections(root, translations) {
  const read = async name => JSON.parse(await readFile(join(root, 'src/data', `${name}.json`), 'utf8'));
  const [projects, publications, details] = await Promise.all([
    read('projects'), read('publications'), read('project-details'),
  ]);
  const t = key => {
    const value = translations.en[key];
    if (typeof value !== 'string') throw new Error(`Missing project translation: ${key}`);
    return value;
  };
  const translated = (tag, key, attributes = '') => `<${tag}${attributes} i18n="${escape(key)}">${t(key)}</${tag}>`;
  const cards = entries => entries.map(entry => {
    if (!Array.isArray(entry.links) || !entry.links.length) throw new Error(`Project ${entry.titleKey} needs a link.`);
    return { ...entry, actionsHtml: entry.links.map((link, index) => actionLink(link, index === 0)).join('\n') };
  });
  const collections = { projects: cards(projects), publications: cards(publications) };
  for (const entry of details) {
    const prefix = `case_${entry.id}`;
    const page = {
      ...entry,
      titleKey: `${prefix}__title`,
      introKey: `${prefix}__intro`,
      categoryKey: `${prefix}__category`,
      problemKey: `${prefix}__problem`,
      outcomeKey: `${prefix}__outcome`,
      scopeKey: `${prefix}__scope`,
      documentTitleKey: `${prefix}__document_title`,
      description: t(`${prefix}__meta`),
      actionsHtml: actionLink({kind: 'code', url: entry.repo}, true),
      stackHtml: entry.stack.map(technology => `<li>${escape(technology)}</li>`).join(''),
      contributionsHtml: [1, 2, 3].map(number => translated('li', `${prefix}__contribution${number}`)).join('\n'),
      flowHtml: [1, 2, 3, 4].map(number => `<li><span class="case-flow__number" aria-hidden="true">0${number}</span>${translated('h3', `${prefix}__step${number}`)}${translated('p', `${prefix}__step${number}_detail`)}</li>`).join('\n'),
      sourcesHtml: entry.sources.map(source => `<a class="case-source" href="${safeLink(source.url)}" target="_blank" rel="noopener noreferrer">${translated('span', source.labelKey)}<span aria-hidden="true">↗</span></a>`).join('\n'),
    };
    collections[`case-${entry.id}`] = [page];
  }
  return collections;
}
