const initialized = new WeakSet();

export function initNavigation(root = document, view = window) {
  if (initialized.has(root)) return;
  initialized.add(root);

  const menu = root.getElementById('nav-menu');
  const toggle = root.getElementById('nav-toggle');
  const close = root.getElementById('nav-close');
  const setMenuOpen = open => {
    menu?.classList.toggle('show-menu', open);
    toggle?.setAttribute('aria-expanded', String(open));
  };

  if (menu) {
    toggle?.setAttribute('aria-controls', menu.id);
    setMenuOpen(menu.classList.contains('show-menu'));
    toggle?.addEventListener('click', () => setMenuOpen(true));
    close?.addEventListener('click', () => setMenuOpen(false));
    menu.addEventListener('click', event => {
      if (event.target.closest('.nav__link')) setMenuOpen(false);
    });
  }

  const header = root.getElementById('header');
  const scrollUp = root.getElementById('scroll-up');
  const navLinks = [...root.querySelectorAll('.nav__menu a[href^="#"]')];
  const sections = [...root.querySelectorAll('section[id]')].map(section => ({
    section,
    links: navLinks.filter(link => link.getAttribute('href') === `#${section.id}`),
  }));

  const updateScroll = () => {
    const midpoint = view.innerHeight / 2;
    for (const { section, links } of sections) {
      const top = section.getBoundingClientRect().top;
      const active = top <= midpoint && top + section.clientHeight >= midpoint;
      for (const link of links) link.classList.toggle('active-link', active);
    }
    header?.classList.toggle('scroll-header', view.scrollY >= 80);
    scrollUp?.classList.toggle('show-scroll', view.scrollY >= 560);
  };

  // Collapse the three former scroll handlers into one update per animation frame.
  let pendingFrame = false;
  const scheduleUpdate = () => {
    if (pendingFrame) return;
    pendingFrame = true;
    view.requestAnimationFrame(() => {
      pendingFrame = false;
      updateScroll();
    });
  };
  view.addEventListener('scroll', scheduleUpdate, { passive: true });
  view.addEventListener('resize', scheduleUpdate, { passive: true });
  updateScroll();
}
