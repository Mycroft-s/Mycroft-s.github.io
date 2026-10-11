import { readPreference, writePreference } from './modules/storage.js';

const controllers = new WeakMap();
const supportedLanguages = new Set(['en', 'cn']);

/**
 * Translate the existing static page using the repository's trusted JSON files.
 * Keep HTML values (links and line breaks) intact; missing keys retain the
 * original static content, including when switching between partial locales.
 */
export function initLanguage(root = document, fetcher = globalThis.fetch) {
  if (controllers.has(root)) return controllers.get(root);

  const button = root.getElementById('translate');
  const label = root.getElementById('nav__translate');
  const fallback = new WeakMap();
  const cache = new Map();
  // Built from structured content; these keys have a single authored source.
  let contentTranslations = {};
  const contentElement = root.getElementById('content-translations');
  if (contentElement) {
    try {
      const embedded = JSON.parse(contentElement.textContent);
      if (!embedded || typeof embedded !== 'object' || Array.isArray(embedded)) throw new Error('Invalid content translations.');
      for (const language of ['en', 'cn']) {
        const values = embedded[language];
        if (!values || typeof values !== 'object' || Array.isArray(values) || Object.values(values).some(value => typeof value !== 'string')) {
          throw new Error('Invalid content translation dictionary.');
        }
      }
      contentTranslations = embedded;
    } catch {
      console.warn('Structured translations unavailable; preserving static content.');
    }
  }
  let currentLanguage = root.documentElement.lang.startsWith('zh') ? 'cn' : 'en';
  let requestedLanguage = currentLanguage;
  let requestVersion = 0;

  const rememberFallback = element => {
    if (!fallback.has(element)) {
      fallback.set(element, {
        html: element.innerHTML,
        value: element.value,
        placeholder: element.getAttribute('placeholder'),
        content: element.getAttribute('content'),
      });
    }
    return fallback.get(element);
  };
  root.querySelectorAll('[i18n]').forEach(rememberFallback);

  const updateLabel = () => {
    if (label) label.textContent = currentLanguage === 'cn' ? '中/En' : 'En/中';
    button?.setAttribute('value', currentLanguage);
  };
  updateLabel();

  const loadTranslations = language => {
    if (!cache.has(language)) {
      const request = Promise.resolve()
        .then(() => fetcher(`assets/i18n/i18n_${language}.json`))
        .then(async response => {
          if (!response.ok) throw new Error(`Translation request failed (${response.status}).`);
          const translations = await response.json();
          if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
            throw new Error('Translation file must contain a JSON object.');
          }
          return { ...translations, ...contentTranslations[language] };
        })
        .catch(error => {
          cache.delete(language); // A later click can retry a transient failure.
          throw error;
        });
      cache.set(language, request);
    }
    return cache.get(language);
  };

  const applyTranslations = translations => {
    for (const element of root.querySelectorAll('[i18n]')) {
      const original = rememberFallback(element);
      const key = element.getAttribute('i18n');
      const mode = element.getAttribute('i18n-only');
      const translated = Object.hasOwn(translations, key) && typeof translations[key] === 'string';
      const value = translated ? translations[key] : undefined;

      if (!mode || mode === 'html') element.innerHTML = value ?? original.html;
      if ((mode === 'value' || !mode) && original.value !== undefined) {
        element.value = value ?? original.value;
      }
      if ((mode === 'placeholder' || !mode) && original.placeholder !== null) {
        element.setAttribute('placeholder', value ?? original.placeholder);
      }
      if (mode === 'content' && original.content !== null) {
        element.setAttribute('content', value ?? original.content);
      }
    }
  };

  const setLanguage = async language => {
    if (!supportedLanguages.has(language)) return false;
    requestedLanguage = language;
    const version = ++requestVersion;
    button?.setAttribute('aria-busy', 'true');
    try {
      const translations = await loadTranslations(language);
      // Fast repeated clicks may complete in a different order than requested.
      if (version !== requestVersion) return false;
      applyTranslations(translations);
      currentLanguage = language;
      root.documentElement.lang = language === 'cn' ? 'zh-CN' : 'en';
      writePreference('lang', language);
      updateLabel();
      return true;
    } catch (error) {
      if (version === requestVersion) {
        requestedLanguage = currentLanguage;
        console.warn('Language change unavailable; keeping the current page content.', error);
      }
      return false;
    } finally {
      if (version === requestVersion) button?.setAttribute('aria-busy', 'false');
    }
  };

  const controller = {
    setLanguage,
    get language() { return currentLanguage; },
    ready: null,
  };
  controllers.set(root, controller);
  button?.addEventListener('click', () => {
    void setLanguage(requestedLanguage === 'cn' ? 'en' : 'cn');
  });
  const preference = readPreference('lang');
  controller.ready = setLanguage(supportedLanguages.has(preference) ? preference : 'en');
  return controller;
}
