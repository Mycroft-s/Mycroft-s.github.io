/*==================== MENU SHOW Y HIDDEN ====================*/
const navMenu = document.getElementById('nav-menu'),
    navToggle = document.getElementById('nav-toggle'),
    navClose = document.getElementById('nav-close');

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if(navToggle){
    navToggle.addEventListener('click',()=>{
        navMenu.classList.add('show-menu')
    })
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if(navClose){
    navClose.addEventListener('click',()=>{
        navMenu.classList.remove('show-menu')
    })
}

/*==================== REMOVE MENU MOBILE ====================*/
const navLink = document.querySelectorAll('.nav__link')

function linkAction(){
    const navMenu = document.getElementById('nav-menu')
    // 点击每个菜单链接后收起菜单栏
    navMenu.classList.remove('show-menu')
}
navLink.forEach(n => n.addEventListener('click', linkAction))

/*==================== ACCORDION SKILLS ====================*/
const skillsContent = document.getElementsByClassName('skills__content'),
      skillsHeader = document.querySelectorAll('.skills__header')

      function toggleSkills() {
        let itemClass = this.parentNode.className

        for(i = 0; i < skillsContent.length; i++) {
          skillsContent[i].className = 'skills__content skills__close'
        }
        if(itemClass === 'skills__content skills__close'){
          this.parentNode.className = 'skills__content skills__open'
        }
      }
      
      skillsHeader.forEach((el) => {
        el.addEventListener('click', toggleSkills)
      })

/*==================== QUALIFICATION TABS ====================*/
const tabs = document.querySelectorAll('[data-target]'),
      tabContents = document.querySelectorAll('[data-content]');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    console.log('Tab clicked:', tab.dataset.target);

    const target = document.querySelector(tab.dataset.target);
    if (!target) {
      console.error('Target not found for:', tab.dataset.target);
      return;
    }

    // 1. 先移除所有 qualification__active 类，确保其他内容隐藏
    tabContents.forEach(tc => {
      tc.classList.remove('qualification__active');
      tc.style.display = "none"; // 关键：隐藏其他内容
    });

    // 2. 显示当前选中的内容
    target.classList.add('qualification__active');
    target.style.display = "block"; // 关键：让选中的内容显示

    // 3. 移除所有 tab 按钮的激活状态
    tabs.forEach(t => {
      t.classList.remove('qualification__active');
    });

    // 4. 让当前点击的按钮变为激活状态
    tab.classList.add('qualification__active');
  });
});


/*==================== PORTFOLIO SWIPER ====================*/
let swiperPortfolio = new Swiper('.portfolio__container', {
    cssMode: true,
    loop: true,
  navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
  },
  pagination: {
      el: '.swiper-pagination',
      clickable: true,
  },
});

/*==================== PUBLICATION SWIPER ====================*/
let swiperPublication = new Swiper('.publication__container', {
  cssMode: true,
  loop: true,
  navigation: {
      nextEl: '.publication-button-next',
      prevEl: '.publication-button-prev',
  },
  pagination: {
      el: '.publication-pagination',
      clickable: true,
  },
});

/*==================== PHOTOGRAPHY SWIPER ====================*/
let swiperPhotography = new Swiper('.photography__container', {
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
  navigation: {
    nextEl: '.photography-button-next',
    prevEl: '.photography-button-prev',
  },
  pagination: {
    el: '.photography-pagination',
    clickable: true,
    dynamicBullets: true,
  },
});






/*==================== SCROLL SECTIONS ACTIVE LINK ====================*/
const sections = document.querySelectorAll('section[id]')

function scrollActive(){
    sections.forEach(current =>{
        const sectionHeight = current.clientHeight
        const sectionTop = current.getBoundingClientRect().top;
        const sectionId = current.getAttribute('id')
        // section 位于视口中间时添加样式 active-link
        if(sectionTop <= window.innerHeight / 2 && sectionTop + sectionHeight >= window.innerHeight / 2){
            document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.add('active-link')
        }else{
            document.querySelector('.nav__menu a[href*=' + sectionId + ']').classList.remove('active-link')
        }
    })
}
window.addEventListener('scroll', scrollActive)

/*==================== CHANGE BACKGROUND HEADER ====================*/ 
function scrollHeader(){
    const nav = document.getElementById('header')
    if(this.scrollY >= 80) nav.classList.add('scroll-header'); else nav.classList.remove('scroll-header')
  }
  window.addEventListener('scroll', scrollHeader)

/*==================== SHOW SCROLL UP ====================*/ 
function scrollUp(){
    const scrollUp = document.getElementById('scroll-up');
    if(this.scrollY >= 560) scrollUp.classList.add('show-scroll'); else scrollUp.classList.remove('show-scroll')
  }
  window.addEventListener('scroll', scrollUp)

/*==================== DARK LIGHT THEME & LANGUAGE====================*/ 

const themeButton = document.getElementById('theme-button')
const darkTheme = 'dark-theme'
const iconTheme = 'uil-sun'
const language = 'cn'

// Previously selected topic (if user selected)
const selectedTheme = localStorage.getItem('selected-theme')
const selectedIcon = localStorage.getItem('selected-icon')

// We obtain the current theme that the interface has by validating the dark-theme class
const getCurrentTheme = () => document.body.classList.contains(darkTheme) ? 'dark' : 'light'
const getCurrentIcon = () => themeButton.classList.contains(iconTheme) ? 'uil-moon' : 'uil-sun'

// We validate if the user previously chose a topic
if (selectedTheme) {
  // If the validation is fulfilled, we ask what the issue was to know if we activated or deactivated the dark
  document.body.classList[selectedTheme === 'dark' ? 'add' : 'remove'](darkTheme)
  themeButton.classList[selectedIcon === 'uil-moon' ? 'add' : 'remove'](iconTheme)
}

// Activate / deactivate the theme manually with the button
themeButton.addEventListener('click', () => {
    // Add or remove the dark / icon theme
    document.body.classList.toggle(darkTheme)
    themeButton.classList.toggle(iconTheme)
    // We save the theme and the current icon that the user chose
    localStorage.setItem('selected-theme', getCurrentTheme())
    localStorage.setItem('selected-icon', getCurrentIcon())
})

/*==================== SKILL BAR ANIMATION ====================*/
// Set all bars to 0 on load, then animate when visible
document.querySelectorAll('.skills__percentage').forEach(bar => {
  bar.style.width = '0';
});

function animateSkillBars(container) {
  container.querySelectorAll('.skills__percentage').forEach(bar => {
    bar.style.removeProperty('width');
  });
}

// Animate open section when skills enters viewport
const skillsSectionEl = document.querySelector('#skills');
if (skillsSectionEl) {
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      document.querySelectorAll('.skills__content.skills__open')
        .forEach(animateSkillBars);
    }
  }, { threshold: 0.1 }).observe(skillsSectionEl);
}

// Animate bars when a section accordion is opened
skillsHeader.forEach(header => {
  header.addEventListener('click', function() {
    const content = this.parentNode;
    setTimeout(() => {
      if (content.classList.contains('skills__open')) {
        animateSkillBars(content);
      }
    }, 50);
  });
});

/*==================== SCROLL REVEAL ====================*/
const revealSelectors = [
  '.about__img',
  '.about__data',
  '.news__content',
  '.qualification__sections',
  '.contact__container > div',
];

revealSelectors.forEach((sel, i) => {
  document.querySelectorAll(sel).forEach((el, j) => {
    el.classList.add('reveal');
    // Stagger siblings within the same parent
    if (j === 1) el.classList.add('reveal-delay-1');
    if (j === 2) el.classList.add('reveal-delay-2');
  });
});

// about__data gets a slight delay relative to about__img
const aboutData = document.querySelector('.about__data');
if (aboutData) aboutData.classList.add('reveal-delay-1');

document.querySelectorAll('.reveal').forEach(el => {
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      entries[0].target.classList.add('visible');
    }
  }, { threshold: 0.12 }).observe(el);
});
