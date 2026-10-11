const waitingForPhotos = new WeakSet();

function controls(container, photography = false) {
  const next = container.querySelector('.swiper-button-next, .publication-button-next');
  const previous = container.querySelector('.swiper-button-prev, .publication-button-prev');
  const pagination = container.querySelector('.swiper-pagination, .publication-pagination');
  return {
    navigation: next && previous ? { nextEl: next, prevEl: previous } : false,
    pagination: pagination ? {
      el: pagination,
      clickable: true,
      ...(photography ? {
        dynamicBullets: true,
        renderBullet: (index, className) => `<button type="button" class="${className}" aria-label="${index + 1}"></button>`,
      } : {}),
    } : false,
  };
}

export function initSliders(root = document, SwiperClass = globalThis.Swiper, ObserverClass = globalThis.IntersectionObserver) {
  if (typeof SwiperClass !== 'function') return;

  // Publications currently share the portfolio classes and layout. Bind each
  // instance to its own DOM controls so arrows never target another section.
  for (const container of root.querySelectorAll('.portfolio__container, .publication__container')) {
    if (container.swiper) continue;
    new SwiperClass(container, {
      cssMode: true,
      loop: true,
      ...controls(container),
    });
  }

  for (const container of root.querySelectorAll('.photography__container')) {
    if (container.swiper || waitingForPhotos.has(container)) continue;
    waitingForPhotos.add(container);
    const reducedMotion = root.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    let visible = false;
    let slider;
    const updatePlayback = () => {
      if (!slider) return;
      if (visible && !root.hidden && !reducedMotion?.matches) slider.autoplay?.start();
      else slider.autoplay?.stop();
    };
    const start = () => {
      if (slider) return;
      slider = new SwiperClass(container, {
        effect: 'coverflow',
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 'auto',
        loop: true,
        speed: reducedMotion?.matches ? 0 : 700,
        coverflowEffect: {
          rotate: 25,
          stretch: 0,
          depth: 120,
          modifier: 1,
          slideShadows: true,
        },
        autoplay: {
          delay: 3500,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        },
        preloadImages: false,
        ...controls(container, true),
      });
      updatePlayback();
    };
    // Only twelve WebP thumbnails exist in the static strip. Delay Swiper's
    // duplicated slides and coverflow setup until the visitor approaches it.
    if (typeof ObserverClass === 'function') {
      const near = new ObserverClass(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        start();
        near.disconnect();
      }, { rootMargin: '400px 0px' });
      near.observe(container);
      const visibility = new ObserverClass(entries => {
        visible = entries.some(entry => entry.isIntersecting);
        updatePlayback();
      });
      visibility.observe(container);
    } else {
      visible = true;
      start();
    }
    root.addEventListener('visibilitychange', updatePlayback);
    reducedMotion?.addEventListener?.('change', () => {
      if (slider) slider.params.speed = reducedMotion.matches ? 0 : 700;
      updatePlayback();
    });
  }
}
