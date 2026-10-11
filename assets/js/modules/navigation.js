const initialized = new WeakSet();

export function initNavigation(root = document, view = window) {
  if (initialized.has(root)) return;
  initialized.add(root);

  const menu = root.getElementById('nav-menu');
  const toggle = root.getElementById('nav-toggle');
  const close = root.getElementById('nav-close');
  const mobile = view.matchMedia('(max-width: 767px)');
  let menuOpen = false;
  const setMenuOpen = (open, restoreFocus = false) => {
    menuOpen = open && mobile.matches;
    open = menuOpen;
    menu?.classList.toggle('show-menu', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (menu) {
      // Off-screen mobile links must not remain in the keyboard tab order.
      menu.inert = mobile.matches && !open;
      if (mobile.matches && !open) menu.setAttribute('aria-hidden', 'true');
      else menu.removeAttribute('aria-hidden');
    }
    if (restoreFocus) toggle?.focus();
  };

  if (menu) {
    toggle?.setAttribute('aria-controls', menu.id);
    setMenuOpen(menu.classList.contains('show-menu'));
    toggle?.addEventListener('click', () => {
      setMenuOpen(!menuOpen);
      if (menuOpen) menu.querySelector('a.nav__link')?.focus();
    });
    close?.addEventListener('click', () => setMenuOpen(false, true));
    menu.addEventListener('click', event => {
      const link = event.target.closest('a.nav__link');
      if (!link || !menuOpen) return;
      const href = link.getAttribute('href');
      setMenuOpen(false);
      if (href?.startsWith('#')) {
        const target = root.getElementById(href.slice(1));
        if (target) {
          target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      }
    });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menuOpen) {
        event.preventDefault();
        setMenuOpen(false, true);
      }
    });
    mobile.addEventListener('change', () => setMenuOpen(false));
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
