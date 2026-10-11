const initialized = new WeakSet();
const selectors = [
  '.about__img',
  '.about__data',
  '.news__content',
  '.qualification__sections',
  '.contact__container > div',
];

export function initReveal(root = document) {
  if (initialized.has(root)) return;
  initialized.add(root);

  for (const selector of selectors) {
    root.querySelectorAll(selector).forEach((element, index) => {
      element.classList.add('reveal');
      if (index === 1) element.classList.add('reveal-delay-1');
      if (index === 2) element.classList.add('reveal-delay-2');
    });
  }
  root.querySelector('.about__data')?.classList.add('reveal-delay-1');

  const elements = root.querySelectorAll('.reveal');
  if (typeof IntersectionObserver !== 'function') {
    elements.forEach(element => element.classList.add('visible'));
    return;
  }

  // One shared observer replaces an observer for every individual element.
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12 });
  elements.forEach(element => observer.observe(element));
}
