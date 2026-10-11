function controls(container, photography = false) {
  const next = container.querySelector('.swiper-button-next, .publication-button-next');
  const previous = container.querySelector('.swiper-button-prev, .publication-button-prev');
  const pagination = container.querySelector('.swiper-pagination, .publication-pagination');
  return {
    navigation: next && previous ? { nextEl: next, prevEl: previous } : false,
    pagination: pagination ? {
      el: pagination,
      clickable: true,
      ...(photography ? { dynamicBullets: true } : {}),
    } : false,
  };
}

export function initSliders(root = document, SwiperClass = globalThis.Swiper) {
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
    if (container.swiper) continue;
    new SwiperClass(container, {
      effect: 'coverflow',
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      loop: true,
      speed: 700,
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
      lazy: { loadPrevNext: true, loadPrevNextAmount: 2 },
      ...controls(container, true),
    });
  }
}
