/* ==========================================================================
   Mental CEO — interactions & animations
   Lenis smooth scroll + GSAP (ScrollTrigger, SplitText, CustomEase)
   ========================================================================== */
(function () {
  'use strict';

  const html = document.documentElement;
  html.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktopQuery = window.matchMedia('(min-width: 992px)');
  const mobileQuery = window.matchMedia('(max-width: 767px)');
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || typeof SplitText === 'undefined' || typeof CustomEase === 'undefined') {
    html.classList.remove('js');
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  ScrollTrigger.config({ ignoreMobileResize: true });
  CustomEase.create('main', '0.65, 0.01, 0.05, 0.99');
  gsap.defaults({ ease: 'main', duration: 0.7 });

  /* ------------------------------------------------------------------
     Lenis smooth scroll
     ------------------------------------------------------------------ */
  let lenis = null;
  if (!reduceMotion && typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      lerp: 0.15,
      wheelMultiplier: 1,
      gestureOrientation: 'vertical',
      smoothTouch: false,
    });
    window.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(target, opts) {
    if (lenis) {
      lenis.scrollTo(target, Object.assign({ force: true, duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 3) }, opts || {}));
    } else if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      // From the side menu: wait until it has closed and unlocked scrolling
      if (html.classList.contains('is-nav-open')) setTimeout(() => scrollToTarget(el), 0);
      else scrollToTarget(el);
    });
  });

  /* ------------------------------------------------------------------
     Nav: bar -> pill on scroll
     ------------------------------------------------------------------ */
  function initNav() {
    const nav = $('.nav');
    if (!nav) return;
    const THRESHOLD = 80;
    let ticking = false;
    const update = () => {
      ticking = false;
      nav.classList.toggle('is-scrolled', window.scrollY > THRESHOLD);
    };
    const request = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    window.addEventListener('load', request);
    update();
  }

  /* ------------------------------------------------------------------
     Side navigation (wipe effect)
     ------------------------------------------------------------------ */
  function initSideNav() {
    const navWrap = $('[data-sidenav-wrap]');
    if (!navWrap) return;
    const overlay = $('[data-sidenav-overlay]', navWrap);
    const menu = $('[data-sidenav-menu]', navWrap);
    const bgPanels = $$('[data-sidenav-panel]', navWrap);
    const menuLinks = $$('[data-sidenav-link]', navWrap);
    const fadeTargets = $$('[data-sidenav-fade]', navWrap);
    const menuToggles = $$('[data-sidenav-toggle]');
    const menuButton = $('[data-sidenav-button]');
    const menuButtonTexts = $$('[data-sidenav-label]', menuButton);
    const menuButtonIcon = $('[data-sidenav-icon]', menuButton);
    const tl = gsap.timeline();

    const lockScroll = () => { html.classList.add('is-nav-open'); if (lenis) lenis.stop(); };
    const unlockScroll = () => { html.classList.remove('is-nav-open'); if (lenis) lenis.start(); };
    const isOpen = () => navWrap.getAttribute('data-nav-state') === 'open';

    const openNav = () => {
      navWrap.setAttribute('data-nav-state', 'open');
      menuButton.setAttribute('aria-expanded', 'true');
      lockScroll();
      tl.clear()
        .set(navWrap, { display: 'block' })
        .set(menu, { xPercent: 0 }, '<')
        .fromTo(menuButtonTexts, { yPercent: 0 }, { yPercent: -100, stagger: 0.2 })
        .fromTo(menuButtonIcon, { rotate: 0 }, { rotate: 315 }, '<')
        .fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1 }, '<')
        .fromTo(bgPanels, { xPercent: 101 }, { xPercent: 0, stagger: 0.12, duration: 0.575 }, '<')
        .fromTo(menuLinks, { yPercent: 140, rotate: 10 }, { yPercent: 0, rotate: 0, stagger: 0.05 }, '<+=0.35')
        .fromTo(fadeTargets, { autoAlpha: 0, yPercent: 50 }, { autoAlpha: 1, yPercent: 0, stagger: 0.04 }, '<+=0.2');
    };

    const closeNav = () => {
      navWrap.setAttribute('data-nav-state', 'closed');
      menuButton.setAttribute('aria-expanded', 'false');
      unlockScroll();
      tl.clear()
        .to(overlay, { autoAlpha: 0 })
        .to(menu, { xPercent: 120 }, '<')
        .to(menuButtonTexts, { yPercent: 0 }, '<')
        .to(menuButtonIcon, { rotate: 0 }, '<')
        .set(navWrap, { display: 'none' });
    };

    menuToggles.forEach((toggle) => toggle.addEventListener('click', () => (isOpen() ? closeNav() : openNav())));
    menuLinks.forEach((link) => link.addEventListener('click', () => { if (isOpen()) closeNav(); }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) closeNav(); });
  }

  /* ------------------------------------------------------------------
     Text splitting + scroll reveals
     ------------------------------------------------------------------ */
  let splits = [];

  // Lines / words slide-up reveals. autoSplit re-splits (and rebuilds the tween)
  // whenever the element width changes, so line breaks always stay correct.
  function runSplitText() {
    $$('[text-animate]').forEach((el) => {
      const type = el.getAttribute('text-animate');
      const split = SplitText.create(el, {
        type: 'lines,words',
        linesClass: 'line',
        wordsClass: 'word',
        mask: 'lines',
        autoSplit: true,
        onSplit(self) {
          return gsap.timeline({
            scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom bottom' },
          }).from(type === 'words' ? self.words : self.lines, {
            yPercent: 115,
            duration: 1,
            ease: 'power3.out',
            stagger: type === 'words' ? 0.02 : 0.01,
            delay: 0.3,
          });
        },
      });
      splits.push(split);
    });
  }

  function initFades() {
    $$('[fade-in]').forEach((el) => {
      gsap.timeline({ scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom bottom' } })
        .from(el.children, { opacity: 0, y: '1.5rem', duration: 0.8, ease: 'power3.out', stagger: 0.04, delay: 0.3 });
    });
    $$('[fade-in-self]').forEach((el) => {
      gsap.timeline({ scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom bottom' } })
        .from(el, { opacity: 0, y: '1.5rem', duration: 0.8, ease: 'power3.out', delay: 0.3 });
    });
    $$('[parallax-image]').forEach((el) => {
      gsap.timeline({ scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1 } })
        .from(el, { yPercent: -10, ease: 'none' });
    });
  }

  function initBlurHeadings() {
    // Hero heading: chars blur-in on load
    $$('[data-heading="hero-blur"]').forEach((heading) => {
      const split = new SplitText(heading, { type: 'words,chars', wordsClass: 'split-word', charsClass: 'split-char' });
      splits.push(split);
      gsap.fromTo(split.chars,
        { autoAlpha: 0, y: 6, filter: 'blur(4px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', stagger: 0.04, duration: 1, delay: 0.5, ease: 'power2.out' });
    });
  }

  /* ------------------------------------------------------------------
     Background lines draw-in
     ------------------------------------------------------------------ */
  function initBackgroundLines() {
    $$('[data-background-lines="wrapper"]').forEach((wrapper) => {
      const lines = $$('[data-background-lines="line"]', wrapper);
      gsap.from(lines, {
        scaleY: 0,
        transformOrigin: 'top center',
        duration: 1.8,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: { trigger: wrapper, start: 'top bottom' },
      });
    });
  }

  /* ------------------------------------------------------------------
     Hero video (desktop / mobile source)
     ------------------------------------------------------------------ */
  function initHeroVideo() {
    const video = $('[data-hero-video]');
    if (!video) return;
    const desktopPoster = video.getAttribute('poster');
    const tryPlay = () => {
      if (reduceMotion) return;
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    };
    const markLoaded = () => { video.classList.add('is-loaded'); if (video.paused) tryPlay(); };
    video.addEventListener('canplay', markLoaded);
    video.addEventListener('loadeddata', markLoaded);

    const applySource = () => {
      const useMobile = mobileQuery.matches && !!video.dataset.srcMobile;
      const src = useMobile ? video.dataset.srcMobile : video.dataset.srcDesktop;
      if (video.dataset.currentSource === src) return;
      video.dataset.currentSource = src;
      video.setAttribute('poster', useMobile && video.dataset.posterMobile ? video.dataset.posterMobile : desktopPoster);
      video.classList.remove('is-loaded');
      if (reduceMotion) {
        video.removeAttribute('autoplay');
        video.classList.add('is-loaded');
        return;
      }
      video.src = src;
      video.load();
      tryPlay();
    };
    applySource();
    mobileQuery.addEventListener('change', applySource);
    if (video.readyState >= 3) markLoaded();
  }

  /* ------------------------------------------------------------------
     3D tilt + mouse glow
     ------------------------------------------------------------------ */
  function initTilt() {
    const MAX_TILT = 3.5;
    const tiltEls = $$('[data-tilt]');
    const glowEls = $$('.glow-border');
    const all = Array.from(new Set(tiltEls.concat(glowEls)));

    all.forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mx', Math.round((x / rect.width) * 100) + '%');
        el.style.setProperty('--my', Math.round((y / rect.height) * 100) + '%');
        if (!desktopQuery.matches || !el.hasAttribute('data-tilt') || reduceMotion) return;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotateY = ((x - cx) / cx) * MAX_TILT;
        const rotateX = -((y - cy) / cy) * MAX_TILT;
        el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        el.style.boxShadow = `${-rotateY * 0.8}px ${rotateX * 0.8}px 18px rgba(0,0,0,0.3)`;
      });
      el.addEventListener('mouseleave', () => {
        if (!el.hasAttribute('data-tilt')) return;
        el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
        el.style.boxShadow = 'none';
      });
    });
  }

  /* ------------------------------------------------------------------
     Dla kogo: zaznaczanie sytuacji, które pasują
     ------------------------------------------------------------------ */
  function initSituations() {
    const wrap = $('[data-situations]');
    if (!wrap) return;
    const items = $$('[data-situation]', wrap);
    const count = $('[data-situations-count]', wrap);
    items.forEach((item) => item.addEventListener('click', () => {
      const on = item.getAttribute('aria-pressed') !== 'true';
      item.setAttribute('aria-pressed', String(on));
      item.classList.toggle('is-checked', on);
      if (count) count.textContent = items.filter((i) => i.getAttribute('aria-pressed') === 'true').length;
    }));
  }

  /* ------------------------------------------------------------------
     Accordion
     ------------------------------------------------------------------ */
  function initAccordions() {
    const items = $$('[data-accordion]');
    items.forEach((item) => {
      const toggle = $('[data-accordion-toggle]', item);
      toggle.addEventListener('click', () => {
        const open = item.getAttribute('data-accordion-state') === 'open';
        items.forEach((other) => {
          other.setAttribute('data-accordion-state', 'close');
          $('[data-accordion-toggle]', other).setAttribute('aria-expanded', 'false');
        });
        if (!open) {
          item.setAttribute('data-accordion-state', 'open');
          toggle.setAttribute('aria-expanded', 'true');
        }
        setTimeout(() => ScrollTrigger.refresh(), 650);
      });
    });
  }

  /* ------------------------------------------------------------------
     Footer parallax
     ------------------------------------------------------------------ */
  function initFooterParallax() {
    if (window.innerWidth <= 767 || reduceMotion) return;
    $$('[data-footer-parallax]').forEach((el) => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: 'clamp(top bottom)', end: 'clamp(top top)', scrub: true },
      });
      const inner = $('[data-footer-parallax-inner]', el);
      const dark = $('[data-footer-parallax-dark]', el);
      if (inner) tl.from(inner, { yPercent: -25, ease: 'none' });
      if (dark) tl.from(dark, { opacity: 0.7, ease: 'none' }, '<');
    });
  }

  /* ------------------------------------------------------------------
     Lazy videos
     ------------------------------------------------------------------ */
  function initLazyVideos() {
    const lazyVideos = $$('video.lazy');
    if (!('IntersectionObserver' in window)) {
      lazyVideos.forEach((v) => { $$('source', v).forEach((s) => { s.src = s.dataset.src; }); v.load(); });
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const video = entry.target;
        $$('source', video).forEach((s) => { s.src = s.dataset.src; });
        video.load();
        if (!reduceMotion) { const p = video.play(); if (p && p.catch) p.catch(() => {}); }
        video.classList.remove('lazy');
        observer.unobserve(video);
      });
    }, { rootMargin: '200px 0px' });
    lazyVideos.forEach((v) => observer.observe(v));
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  function init() {
    initNav();
    initSideNav();
    initHeroVideo();
    initLazyVideos();
    initAccordions();
    initSituations();
    initTilt();

    document.fonts.ready.then(() => {
      try {
      runSplitText();
      initBlurHeadings();
      initFades();
      initBackgroundLines();
      initFooterParallax();
      gsap.set('.page-wrapper', { opacity: 1 });
      ScrollTrigger.refresh();

      let windowWidth = window.innerWidth;
      let resizeTimer;
      window.addEventListener('resize', () => {
        if (windowWidth === window.innerWidth) return;
        windowWidth = window.innerWidth;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 250);
      });
      window.addEventListener('load', () => ScrollTrigger.refresh());
      } catch (err) {
        console.error(err);
        gsap.set('.page-wrapper', { opacity: 1 });
      }
    });
  }

  const safeInit = () => {
    try { init(); } catch (err) { console.error(err); gsap.set('.page-wrapper', { opacity: 1 }); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit);
  else safeInit();
})();
