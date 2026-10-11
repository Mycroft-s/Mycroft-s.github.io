import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizePhotos } from './gallery-lib.mjs';

const LANGUAGES = ['en', 'cn'];
const escape = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function bilingual(value, label) {
  if (!value || LANGUAGES.some(language => typeof value[language] !== 'string' || !value[language].trim())) {
    throw new Error(`${label} needs nonempty en and cn strings.`);
  }
  return value;
}

function dateParts(value, label, dayRequired = false) {
  const pattern = dayRequired ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}(?:-\d{2})?$/;
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`${label} needs an ISO date.`);
  const [year, month, day = 1] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${label} has an invalid calendar date.`);
  }
  return { date, precision: value.length === 10 ? 'day' : 'month' };
}

function dateLabel(value, language) {
  const { date, precision } = dateParts(value, 'Experience date');
  return new Intl.DateTimeFormat(language === 'cn' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: language === 'cn' ? 'long' : 'short',
    ...(precision === 'day' ? { day: 'numeric' } : {}), timeZone: 'UTC',
  }).format(date);
}

function secureLink(value, label, linkedin = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} needs an absolute URL.`); }
  if (url.protocol !== 'https:' || (linkedin && url.hostname !== 'www.linkedin.com')) {
    throw new Error(`${label} must use ${linkedin ? 'LinkedIn over ' : ''}HTTPS.`);
  }
  return value;
}

function addTranslation(translations, key, values, html = false) {
  bilingual(values, key);
  for (const language of LANGUAGES) translations[language][key] = html ? values[language] : escape(values[language]);
  return key;
}

/** Use three images per year, with editorial favorites first; never copy originals to the home carousel. */
export function selectHomePhotos(photos) {
  const normalized = normalizePhotos(photos);
  const years = [...new Set(normalized.map(photo => photo.year))].sort((a, b) => Number(b) - Number(a));
  return years.flatMap(year => normalized.filter(photo => photo.year === year)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.sourceIndex - b.sourceIndex)
    .slice(0, 3)).slice(0, 12);
}

export function homeCollections({ news, experience, photos }) {
  const translations = { en: {}, cn: {} };
  if (!Array.isArray(news)) throw new Error('News must be an array.');
  const newsDates = new Set();
  const newsItems = news.map(item => {
    dateParts(item.date, 'News date', true);
    if (newsDates.has(item.date)) throw new Error(`Duplicate news date: ${item.date}`);
    newsDates.add(item.date);
    const descriptionKey = addTranslation(translations, `news__item_${item.date.replaceAll('-', '_')}`, item.description);
    return { date: item.date, dateLabel: item.date.replaceAll('-', '.'), descriptionKey };
  }).sort((a, b) => b.date.localeCompare(a.date));

  if (!experience?.organizations || !Array.isArray(experience.work) || !Array.isArray(experience.education)) {
    throw new Error('Experience needs organizations, work and education collections.');
  }
  const organizations = experience.organizations;
  for (const [id, organization] of Object.entries(organizations)) {
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Invalid organization id: ${id}`);
    bilingual(organization.name, `${id} organization name`);
    if (organization.linkedin) secureLink(organization.linkedin, `${id} LinkedIn`, true);
    if (organization.website) secureLink(organization.website, `${id} website`);
    if (organization.linkedin && !/^assets\/img\/organizations\/[a-z0-9-]+\.(?:png|svg|webp)$/.test(organization.logo || '')) {
      throw new Error(`${id} needs a local organization logo.`);
    }
    addTranslation(translations, `organization__${id}`, organization.name);
  }
  const experienceIds = new Set();
  function timeline(items, category) {
    return items.map((item, index) => {
      if (!/^qualification\d+$/.test(item.id) || experienceIds.has(item.id)) throw new Error(`Invalid or duplicate experience id: ${item.id}`);
      experienceIds.add(item.id);
      const organization = organizations[item.organization];
      if (!organization) throw new Error(`Unknown organization for ${item.id}: ${item.organization}`);
      const titleKey = addTranslation(translations, `${item.id}__title`, item.title);
      if (item.team) bilingual(item.team, `${item.id} team`);
      if (item.location) bilingual(item.location, `${item.id} location`);
      if (item.subtitle) bilingual(item.subtitle, `${item.id} subtitle`);
      const subtitle = Object.fromEntries(LANGUAGES.map(language => {
        const name = escape(item.subtitle?.[language] || organization.name[language]);
        const organizationHtml = organization.website && !item.subtitle
          ? `<a href="${escape(organization.website)}" target="_blank" rel="noopener noreferrer">${name}</a>` : name;
        return [language, organizationHtml
          + (item.team ? ` · ${escape(item.team[language])}` : '')
          + (item.location ? `${language === 'cn' ? '，' : ', '}${escape(item.location[language])}` : '')];
      }));
      const subtitleKey = addTranslation(translations, `${item.id}__subtitle`, subtitle, true);
      if (!Array.isArray(item.periods) || item.periods.length === 0) throw new Error(`${item.id} needs at least one date period.`);
      for (const period of item.periods) {
        const start = dateParts(period.start, `${item.id} start`).date;
        if (period.end !== null && dateParts(period.end, `${item.id} end`).date < start) throw new Error(`${item.id} ends before it starts.`);
      }
      const date = Object.fromEntries(LANGUAGES.map(language => [language, item.periods.map(period =>
        `${dateLabel(period.start, language)} ${language === 'cn' ? '至' : '–'} ${period.end === null ? (language === 'cn' ? '今' : 'Present') : dateLabel(period.end, language)}`
      ).join(language === 'cn' ? '；' : '; ')]));
      const dateKey = addTranslation(translations, `${item.id}__date`, date);
      const organizationKey = `organization__${item.organization}`;
      const badgeHtml = organization.linkedin
        ? `<a class="qualification__badge qualification__badge--link" href="${escape(organization.linkedin)}" target="_blank" rel="noopener noreferrer">
  <img class="qualification__logo" src="${escape(organization.logo)}" alt="" width="48" height="48" loading="lazy" decoding="async">
  <span class="qualification__link-indicator" aria-hidden="true">in</span>
  <span class="qualification__link-label"><span i18n="${organizationKey}">${translations.en[organizationKey]}</span> · <span i18n="qualification__linkedin">View on LinkedIn</span><span aria-hidden="true"> ↗</span><span class="qualification__link-note" i18n="qualification__new_tab">Opens in a new tab</span></span>
</a>`
        : `<span class="qualification__badge qualification__badge--symbol" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4 5 7 8 9 3-2 8-5 8-9V6z"/><path d="m8 12 3 3 5-6"/></svg></span>`;
      return { titleKey, subtitleKey, dateKey, badgeHtml,
        side: (index + (category === 'work' ? 1 : 0)) % 2 ? 'right' : 'left',
        lineHtml: index === items.length - 1 ? '' : '<span class="qualification__line" aria-hidden="true"></span>',
      };
    });
  }
  const homePhotos = selectHomePhotos(photos).map(photo => ({
    thumbnail: photo.thumbnail, width: photo.width, height: photo.height,
    alt: photo.altEn, href: `photography.html?photo=${encodeURIComponent(photo.id)}`,
    titleKey: addTranslation(translations, `home__${photo.id}__title`, { en: photo.descriptionEn, cn: photo.descriptionCn }),
    descriptionKey: addTranslation(translations, `home__${photo.id}__description`, {
      en: `${photo.year} · ${photo.deviceLabelEn}`, cn: `${photo.year} · ${photo.deviceLabelCn}`,
    }),
  }));
  return { translations, collections: {
    'home-photos': homePhotos, 'news-recent': newsItems.slice(0, 3), 'news-archive': newsItems.slice(3),
    'experience-work': timeline(experience.work, 'work'), 'experience-education': timeline(experience.education, 'education'),
  } };
}

export async function readHomeData(root) {
  const read = async name => JSON.parse(await readFile(join(root, `src/data/${name}.json`), 'utf8'));
  const [news, experience, photos] = await Promise.all(['news', 'experience', 'photography'].map(read));
  return homeCollections({ news, experience, photos });
}
