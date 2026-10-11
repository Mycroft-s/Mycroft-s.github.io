const initialized = new WeakSet();

function animateBars(container) {
  for (const bar of container.querySelectorAll('.skills__percentage')) {
    bar.style.removeProperty('width');
  }
}

export function initSkills(root = document) {
  const section = root.querySelector('#skills');
  if (!section || initialized.has(section)) return;
  initialized.add(section);

  const contents = [...section.querySelectorAll('.skills__content')];
  const setOpen = (content, open) => {
    content.classList.toggle('skills__open', open);
    content.classList.toggle('skills__close', !open);
    content.querySelector('.skills__header')?.setAttribute('aria-expanded', String(open));
    const list = content.querySelector('.skills__list');
    if (list) list.hidden = !open;
  };

  for (const content of contents) {
    setOpen(content, content.classList.contains('skills__open'));
    content.querySelector('.skills__header')?.addEventListener('click', () => {
      const shouldOpen = !content.classList.contains('skills__open');
      for (const item of contents) setOpen(item, item === content && shouldOpen);
      if (shouldOpen) animateBars(content);
    });
  }

  if (typeof IntersectionObserver !== 'function') return;
  for (const bar of section.querySelectorAll('.skills__percentage')) {
    bar.style.width = '0';
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      contents.filter(content => content.classList.contains('skills__open')).forEach(animateBars);
      observer.disconnect();
    }
  }, { threshold: 0.1 });
  observer.observe(section);
}
