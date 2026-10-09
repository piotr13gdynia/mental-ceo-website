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
      lenis.scrollTo(target, Object.assign({ duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 3) }, opts || {}));
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
      scrollToTarget(el);
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
    // Intro heading: chars blur-in when section hits center
    $$('[data-heading="blur"]').forEach((heading) => {
      const split = new SplitText(heading, { type: 'words,chars', wordsClass: 'split-word', charsClass: 'split-char' });
      splits.push(split);
      gsap.fromTo(split.chars,
        { autoAlpha: 0, y: 6, filter: 'blur(4px)' },
        {
          autoAlpha: 1, y: 0, filter: 'blur(0px)', stagger: 0.04, duration: 0.5, ease: 'power2.out',
          scrollTrigger: { trigger: heading.closest('.section_intro') || heading, start: 'top center', toggleActions: 'play none none none' },
        });
    });
    // Scrub heading: chars opacity .3 -> 1 driven by scroll
    $$('[data-heading="scrub"]').forEach((heading) => {
      const split = new SplitText(heading, { type: 'words,chars', wordsClass: 'split-word', charsClass: 'split-char' });
      splits.push(split);
      gsap.fromTo(split.chars, { autoAlpha: 0.3 }, {
        autoAlpha: 1, stagger: 0.04, ease: 'none',
        scrollTrigger: {
          trigger: '.scroll_comp',
          endTrigger: '.scroll_wrapper',
          start: 'bottom bottom',
          end: 'bottom bottom+=200',
          scrub: true,
        },
      });
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
     Hero card: appear, "typing", then message reveals when intro hits center
     ------------------------------------------------------------------ */
  function initHeroCard() {
    const card = $('[data-hero-card]');
    if (!card) return;
    const typing = $('[data-hero-typing]', card);
    const text = $('[data-hero-text]', card);
    const split = new SplitText(text, { type: 'words,chars', wordsClass: 'split-word', charsClass: 'split-char' });
    splits.push(split);
    gsap.set(text, { autoAlpha: 0 });
    gsap.set(split.chars, { autoAlpha: 0 });

    gsap.fromTo(card, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1, delay: 1.1, ease: 'power3.out' });

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      gsap.timeline()
        .to(typing, { autoAlpha: 0, duration: 0.25 })
        .set(text, { autoAlpha: 1 })
        .to(split.chars, { autoAlpha: 1, duration: 0.02, stagger: 0.012, ease: 'none' });
    };

    ScrollTrigger.create({
      trigger: '.section_intro',
      start: 'top center',
      onEnter: reveal,
    });
    // Also reveal after a while if the user never scrolls
    gsap.delayedCall(6, reveal);
  }

  /* ------------------------------------------------------------------
     Move the hero card between wrappers on scroll (hero -> intro)
     ------------------------------------------------------------------ */
  let flipTl = null;
  function initMoveOnScroll() {
    const wrappers = $$("[data-flip-element='wrapper']");
    const target = $("[data-flip-element='target']");
    if (!wrappers.length || !target) return;

    if (flipTl) {
      flipTl.scrollTrigger && flipTl.scrollTrigger.kill();
      flipTl.kill();
      gsap.set(target, { clearProps: 'y' });
    }

    flipTl = gsap.timeline({
      scrollTrigger: {
        trigger: wrappers[0],
        start: 'center center',
        endTrigger: wrappers[wrappers.length - 1],
        end: 'center center',
        scrub: 0.25,
      },
    });

    let currentY = 0;
    wrappers.forEach((el, i) => {
      const next = wrappers[i + 1];
      if (!next) return;
      const thisRect = el.getBoundingClientRect();
      const nextRect = next.getBoundingClientRect();
      const thisCenter = thisRect.top + window.pageYOffset + el.offsetHeight / 2;
      const nextCenter = nextRect.top + window.pageYOffset + next.offsetHeight / 2;
      currentY += nextCenter - thisCenter;
      flipTl.to(target, { y: currentY, ease: 'none' });
    });
  }

  /* ------------------------------------------------------------------
     Sticky cards: 3 headings + 3 cards, scrubbed
     ------------------------------------------------------------------ */
  function initStickyCards() {
    const comp = $('[data-benefits-animation="wrapper"]');
    if (!comp) return;
    const headings = $$('[data-benefits-animation="heading"]', comp);
    const cards = $$('[data-benefits-animation="card"]', comp);
    const note = $('.sticky-cards_note', comp);

    const wordSplits = headings.map((h) => {
      const s = new SplitText(h.querySelector('h2'), { type: 'words', wordsClass: 'split-word' });
      splits.push(s);
      return s;
    });

    gsap.set(headings[0], { autoAlpha: 1 });
    gsap.set(headings.slice(1), { autoAlpha: 0 });
    gsap.set(cards[0], { autoAlpha: 1, y: 0 });
    gsap.set(cards.slice(1), { autoAlpha: 0, y: 40 });
    const reply = $('[data-benefits-reply]', comp);
    const second = $('[data-benefits-second]', comp);
    const rows = $$('[data-benefits-row]', comp);
    const chart = $('[data-benefits-chart]', comp);
    gsap.set([reply, second], { autoAlpha: 0, y: 10 });
    gsap.set(rows, { autoAlpha: 0, x: -10 });
    if (note) gsap.set(note, { autoAlpha: 0 });

    const mm = gsap.matchMedia();

    const build = (stackCards) => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: comp, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
      });

      const showHeading = (i, at) => {
        tl.set(headings[i], { autoAlpha: 1 }, at);
        tl.fromTo(wordSplits[i].words, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, stagger: 0.04, duration: 0.35, ease: 'power3.out' }, at);
      };
      const hideHeading = (i, at) => {
        tl.to(wordSplits[i].words, { autoAlpha: 0, y: -20, stagger: 0.02, duration: 0.25, ease: 'power2.in' }, at);
        tl.set(headings[i], { autoAlpha: 0 }, at + 0.3);
      };
      const showCard = (i, at) => {
        tl.to(cards[i], { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, at);
      };
      const hideCard = (i, at) => {
        tl.to(cards[i], { autoAlpha: 0, y: -30, duration: 0.3, ease: 'power2.in' }, at);
      };

      // Segment 1 (heading + card already visible when the section scrolls in)
      tl.to({}, { duration: 0.1 }, 0);
      tl.to(reply, { autoAlpha: 1, y: 0, duration: 0.2 }, 0.3);
      tl.to(second, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.5);

      // Segment 2
      hideHeading(0, 1.0);
      showHeading(1, 1.2);
      if (!stackCards) hideCard(0, 1.0);
      showCard(1, stackCards ? 1.3 : 1.15);
      tl.to(rows, { autoAlpha: 1, x: 0, duration: 0.15, stagger: 0.08 }, 1.6);
      rows.forEach((row, idx) => tl.call(() => row.classList.toggle('is-checked', !tl.scrollTrigger || tl.scrollTrigger.direction >= 0), null, 1.7 + idx * 0.08));

      // Segment 3
      hideHeading(1, 2.0);
      showHeading(2, 2.2);
      if (!stackCards) hideCard(1, 2.0);
      showCard(2, stackCards ? 2.3 : 2.15);
      if (chart) tl.to(chart, { strokeDashoffset: 0, duration: 0.5, ease: 'power1.inOut' }, 2.55);
      if (note) tl.to(note, { autoAlpha: 1, duration: 0.3 }, 2.75);

      tl.to({}, { duration: 0.25 }); // hold at the end
      return tl;
    };

    mm.add('(min-width: 992px)', () => {
      const tl = build(true);
      return () => { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); };
    });
    mm.add('(max-width: 991px)', () => {
      const tl = build(false);
      return () => { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); };
    });
  }

  /* ------------------------------------------------------------------
     Program: sticky split with 7 modules (desktop) / stacked (mobile)
     ------------------------------------------------------------------ */
  const toolTimelines = new WeakMap();

  function playTool(step) {
    let tl = toolTimelines.get(step);
    if (tl) { tl.restart(); return; }
    tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    const rows = $$('[data-tool-row]', step);
    const bars = $$('[data-tool-bar]', step);
    const toggles = $$('[data-tool-toggle]', step);
    const typed = $('[data-tool-typed]', step);
    const weekBars = $$('.ui-week_col i', step);

    if (rows.length) {
      tl.fromTo(rows, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.12 }, 0.2);
      rows.forEach((row, i) => {
        if (row.classList.contains('ui-list_item') || row.tagName === 'LI') {
          tl.call(() => row.classList.add('is-checked'), null, 0.7 + i * 0.25);
        }
      });
    }
    if (bars.length) {
      bars.forEach((bar, i) => tl.to(bar, { width: bar.style.getPropertyValue('--w') || '60%', duration: 0.9, ease: 'power2.out' }, 0.5 + i * 0.15));
    }
    if (toggles.length) {
      toggles.forEach((t, i) => tl.call(() => t.classList.add('is-on'), null, 0.8 + i * 0.3));
    }
    if (weekBars.length) {
      tl.to(weekBars, { scaleY: 1, duration: 0.7, stagger: 0.04, ease: 'power2.out' }, 0.4);
    }
    if (typed) {
      const full = typed.dataset.text || '';
      const caret = typed.querySelector('.ui-caret');
      const node = document.createTextNode('');
      typed.insertBefore(node, caret);
      const proxy = { n: 0 };
      tl.to(proxy, { n: full.length, duration: full.length * 0.035, ease: 'none', onUpdate: () => { node.textContent = full.slice(0, Math.round(proxy.n)); } }, 0.5);
    }
    toolTimelines.set(step, tl);
    tl.restart();
  }

  function resetTool(step) {
    const tl = toolTimelines.get(step);
    if (tl) tl.pause(0);
    $$('[data-tool-row]', step).forEach((r) => r.classList.remove('is-checked'));
    $$('[data-tool-toggle]', step).forEach((t) => t.classList.remove('is-on'));
  }

  function initSplit() {
    const track = $('[data-split-track]');
    if (!track) return null;
    const steps = $$('[data-split-step]', track);
    const n = steps.length;
    const railSteps = $$('[data-split-timeline] .split_timeline-step');
    const circle = $('[data-split-circle]');
    const mobileLabels = $$('[data-split-m-label]');
    const mobileLine = $('[data-split-m-line]');
    const mobileCircle = $('[data-split-m-circle]');

    const headingSplits = steps.map((step) => {
      const h = $('[data-split-heading]', step);
      return new SplitText(h, { type: 'lines,words', linesClass: 'line', wordsClass: 'word', mask: 'lines' });
    });

    const mm = gsap.matchMedia();

    /* ---------- Desktop: pinned, scrubbed ---------- */
    mm.add('(min-width: 992px)', () => {
      const stepParts = steps.map((step) => ({
        step,
        bg: $('[data-split-bg]', step),
        inner: $('[data-split-inner]', step),
        label: $('.split_label-wrap', step),
        para: $('[data-split-paragraph]', step),
        tools: $('[data-split-tools]', step),
      }));

      gsap.set(steps, { autoAlpha: 0 });
      gsap.set(steps[0], { autoAlpha: 1 });
      steps.forEach((s, i) => gsap.set(s, { zIndex: 10 + i }));
      railSteps.forEach((r, i) => r.classList.toggle('is-active', i === 0));

      const pointedH = () => (circle ? circle.parentElement.clientHeight : 0);
      const circleY = (i) => (n > 1 ? (pointedH() * i) / (n - 1) : 0);

      // Intro for first step (not scrubbed): plays when the sticky block enters.
      const p0 = stepParts[0];
      const intro0 = gsap.timeline({
        scrollTrigger: { trigger: track, start: 'top 75%', toggleActions: 'play none none none' },
      });
      intro0
        .fromTo(p0.label, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 0)
        .from(headingSplits[0].lines, { yPercent: 115, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.05)
        .fromTo(p0.para, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.35)
        .fromTo(p0.inner, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.2)
        .call(() => playTool(steps[0]), null, 0.5);
      if (p0.tools) intro0.fromTo(p0.tools, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.45);

      const tl = gsap.timeline({
        scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
      });

      // Hold on the first step
      tl.to({}, { duration: 1 });

      for (let i = 1; i < n; i++) {
        const prev = stepParts[i - 1];
        const cur = stepParts[i];
        const at = i; // transition starts at integer positions
        // previous text + card out
        tl.to([prev.label, prev.para, prev.tools].filter(Boolean), { autoAlpha: 0, y: -24, duration: 0.3, ease: 'power2.in', stagger: 0.02 }, at);
        tl.to(headingSplits[i - 1].lines, { yPercent: -115, duration: 0.3, stagger: 0.04, ease: 'power2.in' }, at);
        tl.to(prev.inner, { autoAlpha: 0, y: -40, duration: 0.3, ease: 'power2.in' }, at);
        // current step visible + bg wipes in from the right
        tl.set(cur.step, { autoAlpha: 1 }, at + 0.05);
        tl.fromTo(cur.bg, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.5, ease: 'power3.inOut' }, at + 0.05);
        tl.set(prev.step, { autoAlpha: 0 }, at + 0.6);
        // current text + card in
        tl.fromTo(cur.label, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.3 }, at + 0.3);
        tl.fromTo(headingSplits[i].lines, { yPercent: 115 }, { yPercent: 0, duration: 0.45, stagger: 0.06, ease: 'power3.out' }, at + 0.32);
        tl.fromTo(cur.para, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35 }, at + 0.45);
        if (cur.tools) tl.fromTo(cur.tools, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35 }, at + 0.5);
        tl.fromTo(cur.inner, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.45 }, at + 0.35);
        // rail
        tl.to(circle, { y: () => circleY(i), duration: 0.5, ease: 'power2.inOut' }, at + 0.05);
        tl.call(() => {
          const forward = tl.scrollTrigger ? tl.scrollTrigger.direction >= 0 : true;
          const active = forward ? i : i - 1;
          railSteps.forEach((r, idx) => r.classList.toggle('is-active', idx === active));
          if (forward) { resetTool(steps[i]); playTool(steps[i]); } else { resetTool(steps[i - 1]); playTool(steps[i - 1]); }
        }, null, at + 0.3);
        // hold
        tl.to({}, { duration: 0.4 }, at + 0.6);
      }

      return () => {
        intro0.scrollTrigger && intro0.scrollTrigger.kill();
        intro0.kill();
        tl.scrollTrigger && tl.scrollTrigger.kill();
        tl.kill();
        gsap.set(steps, { clearProps: 'all' });
        stepParts.forEach((p) => gsap.set([p.bg, p.inner, p.label, p.para, p.tools].filter(Boolean), { clearProps: 'all' }));
        headingSplits.forEach((s) => gsap.set(s.lines, { clearProps: 'all' }));
        if (circle) gsap.set(circle, { clearProps: 'all' });
      };
    });

    /* ---------- Mobile / tablet: stacked with sticky progress ---------- */
    mm.add('(max-width: 991px)', () => {
      const triggers = [];
      const current = $('[data-split-m-current]');
      const setActive = (i) => {
        if (current) current.textContent = 'Moduł ' + i;
        mobileLabels.forEach((l, idx) => l.classList.toggle('is-active', idx === i));
        const pct = n > 1 ? (i / (n - 1)) * 100 : 0;
        if (mobileLine) gsap.to(mobileLine, { width: pct + '%', duration: 0.6, ease: 'power2.out' });
        if (mobileCircle) gsap.to(mobileCircle, { left: pct + '%', duration: 0.6, ease: 'power2.out' });
      };
      steps.forEach((step, i) => {
        const reveal = gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 80%', toggleActions: 'play none none none' } });
        reveal
          .from(headingSplits[i].lines, { yPercent: 115, duration: 0.8, stagger: 0.08, ease: 'power3.out' }, 0)
          .from([$('.split_label-wrap', step), $('[data-split-paragraph]', step), $('[data-split-tools]', step)].filter(Boolean), { autoAlpha: 0, y: 16, duration: 0.6, stagger: 0.08 }, 0.1)
          .from($('[data-split-inner]', step), { autoAlpha: 0, y: 40, duration: 0.8 }, 0.2)
          .call(() => playTool(step), null, 0.5);
        triggers.push(reveal);
        triggers.push(gsap.timeline({
          scrollTrigger: {
            trigger: step,
            start: 'top center',
            end: 'bottom center',
            onToggle: (self) => { if (self.isActive) setActive(i); },
          },
        }));
      });
      setActive(0);
      const progress = $('[data-split-mobile-progress]');
      const showProgress = ScrollTrigger.create({
        trigger: track,
        start: 'top 60%',
        end: 'bottom 40%',
        onToggle: (self) => { if (progress) gsap.to(progress, { autoAlpha: self.isActive ? 1 : 0, duration: 0.3 }); },
      });
      if (progress) gsap.set(progress, { autoAlpha: 0 });
      return () => {
        triggers.forEach((t) => { t.scrollTrigger && t.scrollTrigger.kill(); t.kill(); });
        showProgress.kill();
        if (progress) gsap.set(progress, { clearProps: 'all' });
      };
    });

    // cleanup used when the layout has to be rebuilt after a resize
    return () => {
      mm.revert();
      headingSplits.forEach((s) => s.revert());
      steps.forEach((step) => {
        const tl = toolTimelines.get(step);
        if (tl) { tl.kill(); toolTimelines.delete(step); }
        resetTool(step);
      });
    };
  }

  /* ------------------------------------------------------------------
     Table spacing: package columns hang below the table group
     ------------------------------------------------------------------ */
  function fixTableSpacing() {
    const form = $('.form_table');
    const group = $('.table_group');
    if (!form || !group || !desktopQuery.matches) { if (form) form.style.marginBottom = ''; return; }
    const cols = $$('.get_blue-col', group);
    // Each column hangs above the group by exactly its own header height,
    // so the first feature cell lines up with the first table row.
    cols.forEach((col) => {
      const head = $('.is-display', col);
      const pt = parseFloat(getComputedStyle(col).paddingTop) || 0;
      col.style.marginTop = head ? -(head.offsetHeight + pt) + 'px' : '';
    });
    const groupBottom = group.getBoundingClientRect().bottom;
    const colsBottom = Math.max(...cols.map((c) => c.getBoundingClientRect().bottom));
    const overflow = Math.max(0, colsBottom - groupBottom);
    form.style.marginBottom = Math.round(overflow + 56) + 'px';
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
     Table: column toggles (desktop) + dropdown (mobile)
     ------------------------------------------------------------------ */
  function initTable() {
    const inputs = $$('[data-table-toggle]');
    const cols = $$('[data-table-col]');
    const pairs = inputs.map((input) => ({
      input,
      column: cols.find((c) => c.dataset.tableCol === input.dataset.tableToggle),
      checkedAt: input.checked ? Date.now() : null,
    }));

    const updateTableVisibility = () => {
      pairs.forEach((p) => {
        if (!p.column) return;
        if (desktopQuery.matches) p.column.classList.toggle('is-hidden', !p.input.checked);
        else p.column.classList.remove('is-hidden');
      });
    };

    pairs.forEach((p) => {
      p.input.addEventListener('click', function (e) {
        if (!desktopQuery.matches) return;
        const checkedPairs = pairs.filter((item) => item.input.checked);
        if (!this.checked && checkedPairs.length === 0) {
          e.preventDefault();
          this.checked = true;
          return;
        }
        if (this.checked && checkedPairs.length > 2) {
          const oldest = checkedPairs.reduce((a, b) => ((a.checkedAt ?? Infinity) < (b.checkedAt ?? Infinity) ? a : b));
          oldest.input.checked = false;
          oldest.checkedAt = null;
        }
        p.checkedAt = this.checked ? Date.now() : null;
        setTimeout(updateTableVisibility, 30);
      });
    });
    updateTableVisibility();
    desktopQuery.addEventListener('change', updateTableVisibility);

    // Mobile dropdown
    const dropdown = $('[data-dropdown]');
    if (!dropdown) return;
    const toggle = $('[data-dropdown-toggle]', dropdown);
    const label = $('[data-dropdown-label]', dropdown);
    const options = $$('[data-dropdown-option]', dropdown);
    const views = $$('[data-mobile-view]');

    const switchMobileView = (key) => {
      const target = views.find((v) => v.dataset.mobileView === key);
      if (!target) return;
      views.forEach((el) => el.classList.add('mobile-fading'));
      setTimeout(() => {
        views.forEach((el) => el.classList.toggle('mobile-display-none', el !== target));
        setTimeout(() => target.classList.remove('mobile-fading'), 30);
        ScrollTrigger.refresh();
      }, 250);
    };

    toggle.addEventListener('click', () => {
      const open = dropdown.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    options.forEach((opt) => opt.addEventListener('click', () => {
      label.textContent = opt.textContent;
      dropdown.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      switchMobileView(opt.dataset.dropdownOption);
    }));
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) dropdown.classList.remove('is-open');
    });

    const initMobileLayout = () => {
      if (desktopQuery.matches) {
        views.forEach((el) => el.classList.remove('mobile-display-none', 'mobile-fading'));
      } else {
        const current = 'extended';
        views.forEach((el) => {
          const active = el.dataset.mobileView === current;
          el.classList.toggle('mobile-display-none', !active);
          el.classList.toggle('mobile-fading', !active);
        });
      }
    };
    initMobileLayout();
    desktopQuery.addEventListener('change', initMobileLayout);
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
    initTable();
    initTilt();

    document.fonts.ready.then(() => {
      try {
      runSplitText();
      initBlurHeadings();
      initHeroCard();
      initFades();
      initBackgroundLines();
      initStickyCards();
      let splitCleanup = initSplit();
      initFooterParallax();
      fixTableSpacing();
      gsap.set('.page-wrapper', { opacity: 1 });
      ScrollTrigger.refresh();
      initMoveOnScroll();

      let windowWidth = window.innerWidth;
      let resizeTimer;
      window.addEventListener('resize', () => {
        if (windowWidth === window.innerWidth) return;
        windowWidth = window.innerWidth;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (splitCleanup) splitCleanup();
          splitCleanup = initSplit();
          fixTableSpacing();
          ScrollTrigger.refresh();
          initMoveOnScroll();
        }, 250);
      });
      window.addEventListener('load', () => { fixTableSpacing(); ScrollTrigger.refresh(); initMoveOnScroll(); });
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
