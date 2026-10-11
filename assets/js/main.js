import { initLanguage } from './cn-en-translate.js';
import { initNavigation } from './modules/navigation.js';
import { initReveal } from './modules/reveal.js';
import { initSkills } from './modules/skills.js';
import { initSliders } from './modules/sliders.js';
import { initTabs } from './modules/tabs.js';
import { initTheme } from './modules/theme.js';

// Module scripts are deferred: the static page is already available here.
initNavigation();
initTheme();
initSkills();
initTabs();
initSliders();
initReveal();
initLanguage();
