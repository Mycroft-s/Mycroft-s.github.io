import { initLanguage } from './cn-en-translate.js';
import { initTheme } from './modules/theme.js';

initTheme();
initLanguage();
const currentPage = window.location.pathname.split('/').pop();
for (const link of document.querySelectorAll('[data-case-link]')) {
  if (link.getAttribute('href') === currentPage) link.setAttribute('aria-current', 'page');
}
