const FORM_ENDPOINT = '';

// Pure helpers also keep the mailto and future JSON submission consistent.
function enquiryMessage(fields, retreat) {
  const brand = document.body.dataset.brand || 'The Long Exhale';
  const subject = `${brand} ${retreat} - enquiry from ${fields.name}`;
  const body = [
    `${brand} - ${retreat}`,
    '',
    `Your name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Phone: ${fields.phone || 'Not provided'}`,
    ...(fields.stay ? [`Which stay?: ${fields.stay}`] : []),
    ...(fields.interest ? [`I'm interested in: ${fields.interest}`] : []),
    '',
    "Anything you'd like to ask?",
    fields.message || 'No questions yet.'
  ].join('\r\n');
  return {
    subject,
    body,
    mailto: `mailto:kimlvelardi@outlook.com.au?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  };
}

function breathAt(elapsed) {
  if (elapsed >= 22000) return { scale: .72, phase: 'complete' };
  const time = elapsed % 11000;
  // A smooth 4-second inhale, 1-second hold, 6-second exhale.
  const ease = t => (1 - Math.cos(Math.PI * t)) / 2;
  if (time < 4000) return { scale: .72 + .28 * ease(time / 4000), phase: 'inhale' };
  if (time < 5000) return { scale: 1, phase: 'inhale' };
  return { scale: 1 - .28 * ease((time - 5000) / 6000), phase: 'exhale' };
}

(() => {
  'use strict';
  const root = document.documentElement;
  const body = document.body;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 901px)');
  const mobile = window.matchMedia('(max-width: 600px)');
  const videos = [...document.querySelectorAll('video[data-src]')];
  const inView = new WeakMap();
  let userPaused = false;
  let framePending = false;
  const motionAllowed = () => !reduced.matches && !userPaused;
  const motionActive = () => motionAllowed() && !document.hidden;

  const hero = document.querySelector('.hero');
  const mobileBar = document.querySelector('.mobile-bar');
  const chapters = [...document.querySelectorAll('[data-day]')];
  const dayFrames = [...document.querySelectorAll('[data-frame]')];
  const parallaxPhotos = [...document.querySelectorAll('[data-parallax]')];
  const accordionAnimations = new Set();
  const arrival = document.querySelector('.arrival');
  const arrivalLines = [...document.querySelectorAll('.arrival-line')];
  const clamp = value => Math.max(0, Math.min(1, value));
  let activeDay = 0;

  function videoIsVisible(video) {
    if (!inView.get(video) || !video.getClientRects().length) return false;
    const frame = video.closest('.day-frame');
    return !frame || frame.classList.contains('is-active');
  }

  function updateVideo(video) {
    if (!motionActive() || !videoIsVisible(video)) {
      video.pause();
      return;
    }
    // src is deliberately absent from HTML: reduced motion never fetches a film.
    // Phones get the lighter 960px encode (same clip, -m suffix).
    if (!video.hasAttribute('src')) video.src = desktop.matches ? video.dataset.src : video.dataset.src.replace(/\.mp4$/, '-m.mp4');
    video.muted = true;
    if (video.paused) {
      const playing = video.play();
      if (playing) playing.catch(() => { /* The supplied poster remains visible. */ });
    }
  }

  function updateVideos() { videos.forEach(updateVideo); }

  // Days: on desktop the visuals crossfade in one sticky frame; on smaller screens each visual sits inside its own chapter.
  const daysSticky = document.querySelector('.days-sticky');
  function placeDayFrames() {
    if (!daysSticky) return;
    dayFrames.forEach((frame, index) => {
      if (desktop.matches) {
        if (frame.parentElement !== daysSticky) daysSticky.appendChild(frame);
        frame.classList.toggle('is-active', index === activeDay);
      } else {
        const chapter = chapters[index];
        if (chapter && frame.parentElement !== chapter) chapter.insertBefore(frame, chapter.firstChild);
        frame.classList.add('is-active');
      }
    });
  }
  placeDayFrames();
  desktop.addEventListener('change', () => { placeDayFrames(); updateVideos(); });

  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        inView.set(entry.target, entry.isIntersecting && entry.intersectionRatio > 0);
        updateVideo(entry.target);
      });
    }, { threshold: [0, .05, .25] });
    videos.forEach(video => videoObserver.observe(video));

    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        (entry.target._wipeTargets || [entry.target]).forEach(t => t.classList.add('is-visible'));
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .06 });
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    // A fully clipped .wipe has no visible area, so observe its (unclipped) parent instead.
    document.querySelectorAll('.wipe').forEach(el => {
      const host = el.parentElement || el;
      (host._wipeTargets = host._wipeTargets || []).push(el);
      revealObserver.observe(host);
    });
    arrivalLines.forEach((line, index) => {
      line.style.setProperty('--arrival-delay', `${index * 65}ms`);
      revealObserver.observe(line);
    });
    root.classList.add('reveal-ready', 'arrival-ready');
  }

  function updateScroll() {
    framePending = false;
    if (hero) {
      const past = hero.getBoundingClientRect().bottom <= 0;
      body.classList.toggle('past-hero', past);
      if (mobileBar) mobileBar.inert = !past || !mobile.matches;
    }

    if (desktop.matches && chapters.length) {
      const target = window.innerHeight * .53;
      let closest = 0;
      let distance = Infinity;
      chapters.forEach((chapter, index) => {
        const rect = chapter.getBoundingClientRect();
        const delta = Math.abs(rect.top + rect.height / 2 - target);
        if (delta < distance) { closest = index; distance = delta; }
      });
      if (closest !== activeDay) {
        activeDay = closest;
        dayFrames.forEach((frame, index) => frame.classList.toggle('is-active', index === closest));
        updateVideos();
      }
    }

    if (arrival && motionAllowed()) {
      const rect = arrival.getBoundingClientRect();
      const height = window.innerHeight;
      const progress = clamp(-rect.top / Math.max(1, rect.height - height));
      arrival.style.setProperty('--arrival-lead', clamp((height - rect.top) / height).toFixed(3));
      const position = progress * 8.3 - .6;
      arrivalLines.forEach((line, index) => {
        // Each line owns its own slot (fade in over the first quarter, out over the last), so two lines never overlap.
        const fadeIn = clamp((position - index) * 4);
        const fadeOut = index === arrivalLines.length - 1 ? 1 : clamp((index + 1 - position) * 4);
        const opacity = Math.min(fadeIn, fadeOut);
        line.style.setProperty('--arrival-opacity', opacity.toFixed(3));
      });
    }

    parallaxPhotos.forEach(photo => {
      if (!desktop.matches || !motionActive()) {
        photo.style.removeProperty('--parallax-y');
        return;
      }
      const rect = photo.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const position = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      const offset = Math.max(-1, Math.min(1, position)) * Number(photo.dataset.parallax);
      photo.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
    });
  }

  function requestScrollUpdate() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateScroll);
  }
  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', () => { requestScrollUpdate(); updateVideos(); }, { passive: true });
  desktop.addEventListener('change', () => { requestScrollUpdate(); updateVideos(); });
  mobile.addEventListener('change', requestScrollUpdate);
  updateScroll();

  // The breath clock advances only while this section is in view and the tab is visible.
  const breath = document.querySelector('.breath');
  const circle = breath?.querySelector('.breath-circle');
  let breathVisible = false;
  let breathElapsed = 0;
  let breathPrevious = null;
  let breathFrame = null;

  function tickBreath(now) {
    breathFrame = null;
    if (!motionActive() || !breathVisible || breathElapsed >= 22000) {
      breathPrevious = null;
      return;
    }
    if (breathPrevious !== null) breathElapsed += Math.min(now - breathPrevious, 100);
    breathPrevious = now;
    const state = breathAt(breathElapsed);
    circle.style.transform = `scale(${state.scale})`;
    breath.classList.add('is-guiding');
    breath.classList.toggle('is-inhale', state.phase === 'inhale');
    breath.classList.toggle('is-exhale', state.phase === 'exhale');
    breath.classList.toggle('is-complete', state.phase === 'complete');
    if (state.phase !== 'complete') breathFrame = window.requestAnimationFrame(tickBreath);
  }

  function updateBreath() {
    if (!breath) return;
    if (!motionActive() || !breathVisible) {
      if (breathFrame !== null) window.cancelAnimationFrame(breathFrame);
      breathFrame = null;
      breathPrevious = null;
      if (!motionAllowed()) {
        breath.classList.remove('is-guiding', 'is-inhale', 'is-exhale');
        circle.style.removeProperty('transform');
      }
      return;
    }
    if (breathElapsed >= 22000) {
      breath.classList.add('is-guiding', 'is-complete');
    } else if (breathFrame === null) {
      breathFrame = window.requestAnimationFrame(tickBreath);
    }
  }

  if (breath && 'IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      breathVisible = entries[0].isIntersecting && entries[0].intersectionRatio >= .4;
      updateBreath();
    }, { threshold: [0, .4] }).observe(breath);
  }

  // Native horizontal scrolling provides touch momentum and a no-JS fallback.
  function enableDrag(track) {
    let drag = null;
    let suppressClick = false;
    track.addEventListener('dragstart', event => event.preventDefault());
    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      suppressClick = false;
      drag = { id: event.pointerId, x: event.clientX, scroll: track.scrollLeft, moved: false };
    });
    track.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const distance = event.clientX - drag.x;
      if (!drag.moved && Math.abs(distance) < 6) return;
      drag.moved = true;
      track.setPointerCapture(drag.id);
      track.classList.add('is-dragging');
      event.preventDefault();
      track.scrollLeft = drag.scroll - distance;
    });
    const finish = () => {
      if (!drag) return;
      suppressClick = drag.moved;
      const pointerId = drag.id;
      drag = null;
      if (track.hasPointerCapture(pointerId)) track.releasePointerCapture(pointerId);
      track.classList.remove('is-dragging');
    };
    track.addEventListener('pointerup', finish);
    track.addEventListener('pointercancel', finish);
    track.addEventListener('lostpointercapture', finish);
    track.addEventListener('pointerleave', () => { if (drag && !drag.moved) finish(); });
    track.addEventListener('click', event => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
    }, true);
  }
  document.querySelectorAll('.carousel-track').forEach(enableDrag);

  // Stays: one option at a time. Transform-based (not native scroll) so Safari/iOS arrows always work.
  const stays = document.querySelector('.stay-carousel');
  if (stays) {
    const track = stays.querySelector('.stay-track');
    const cards = [...track.children];
    const previous = stays.querySelector('.carousel-prev');
    const next = stays.querySelector('.carousel-next');
    const progress = stays.querySelector('.carousel-progress');
    stays.querySelector('.stay-controls').hidden = false;
    [previous, next].forEach(button => button.setAttribute('aria-controls', track.id));
    let index = 0;
    function goStay(to) {
      index = Math.max(0, Math.min(cards.length - 1, to));
      track.style.transform = `translateX(${-index * 100}%)`;
      cards.forEach((card, i) => { card.toggleAttribute('inert', i !== index); card.setAttribute('aria-hidden', i !== index ? 'true' : 'false'); });
      previous.disabled = index === 0;
      next.disabled = index === cards.length - 1;
      const pct = Math.round((index + 1) / cards.length * 100);
      progress.setAttribute('aria-valuenow', String(pct));
      progress.firstElementChild.style.width = `${pct}%`;
    }
    previous.addEventListener('click', () => goStay(index - 1));
    next.addEventListener('click', () => goStay(index + 1));
    track.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') { event.preventDefault(); goStay(index + 1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); goStay(index - 1); }
      if (event.key === 'Home') { event.preventDefault(); goStay(0); }
      if (event.key === 'End') { event.preventDefault(); goStay(cards.length - 1); }
    });
    // Swipe (touch) and drag (mouse): a 40px flick moves one stay.
    let startX = null, startY = null, dragging = false;
    const viewport = stays.querySelector('.stay-viewport');
    viewport.addEventListener('pointerdown', event => { if (event.button !== 0) return; startX = event.clientX; startY = event.clientY; dragging = false; });
    viewport.addEventListener('pointermove', event => { if (startX !== null && Math.abs(event.clientX - startX) > 8) dragging = true; });
    viewport.addEventListener('pointerup', event => {
      if (startX === null) return;
      const dx = event.clientX - startX, dy = event.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goStay(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
    viewport.addEventListener('pointercancel', () => { startX = null; });
    viewport.addEventListener('click', event => { if (dragging) { event.preventDefault(); event.stopPropagation(); dragging = false; } }, true);
    // A stay link elsewhere (or the form) can bring its card into view.
    stays.goToStay = name => { const i = cards.findIndex(c => c.querySelector('h3')?.textContent.trim() === name); if (i >= 0) goStay(i); };
    goStay(0);
  }

  const carousel = document.querySelector('.quote-carousel');
  const quoteTrack = carousel?.querySelector('.quote-track');
  const quotes = [...document.querySelectorAll('[data-quote]')];
  const dots = [...document.querySelectorAll('[data-quote-to]')];
  const quotePause = document.querySelector('.quote-pause');
  let quoteCards = [];
  let currentQuote = 0;
  let currentCard = quotes.length;
  let quoteTimer = null;
  let settleTimer = null;
  let quotesPaused = false;
  let carouselVisible = false;
  let carouselHover = false;
  let carouselFocused = false;
  let carouselTouched = false;

  function quoteLeft(card) {
    return card.offsetLeft - (quoteTrack.clientWidth - card.offsetWidth) / 2;
  }
  function markQuote(index) {
    currentCard = index;
    currentQuote = Number(quoteCards[index].dataset.quote);
    quoteCards.forEach((quote, i) => quote.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === currentQuote)));
  }
  function showQuote(index, instant = false) {
    const safeIndex = Math.max(0, Math.min(quoteCards.length - 1, index));
    if (instant) quoteTrack.classList.add('is-repositioning');
    quoteTrack.scrollTo({ left: quoteLeft(quoteCards[safeIndex]), behavior: !instant && motionAllowed() ? 'smooth' : 'instant' });
    if (instant) {
      markQuote(safeIndex);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => quoteTrack.classList.remove('is-repositioning')));
    }
  }
  function updateQuoteTimer() {
    window.clearInterval(quoteTimer);
    quoteTimer = null;
    if (!carousel || !desktop.matches || !carouselVisible || !motionActive() || quotesPaused || carouselHover || carouselFocused || carouselTouched) return;
    quoteTimer = window.setInterval(() => showQuote(currentCard + 1), 6000);
  }

  if (carousel) {
    // Hidden, inert copies allow the three real quotes to wrap in either direction.
    const cloneQuote = quote => {
      const clone = quote.cloneNode(true);
      clone.removeAttribute('id');
      clone.removeAttribute('role');
      clone.removeAttribute('aria-label');
      clone.removeAttribute('aria-roledescription');
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;
      return clone;
    };
    quoteTrack.prepend(...quotes.map(cloneQuote));
    quoteTrack.append(...quotes.map(cloneQuote));
    quoteCards = [...quoteTrack.children];
    quoteTrack.id = 'quote-track';
    carousel.querySelector('.quote-controls').hidden = false;
    carousel.querySelectorAll('.round-button').forEach(button => button.setAttribute('aria-controls', quoteTrack.id));
    showQuote(quotes.length, true);
    quoteTrack.addEventListener('scroll', () => {
      let nearest = 0;
      let distance = Infinity;
      quoteCards.forEach((card, index) => {
        const delta = Math.abs(quoteLeft(card) - quoteTrack.scrollLeft);
        if (delta < distance) { distance = delta; nearest = index; }
      });
      markQuote(nearest);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (quoteTrack.classList.contains('is-dragging')) return;
        if (currentCard < quotes.length || currentCard >= quotes.length * 2) {
          showQuote(currentQuote + quotes.length, true);
        }
      }, 160);
    }, { passive: true });
    carousel.querySelector('.carousel-prev').addEventListener('click', () => showQuote(currentCard - 1));
    carousel.querySelector('.carousel-next').addEventListener('click', () => showQuote(currentCard + 1));
    dots.forEach(dot => dot.addEventListener('click', () => {
      showQuote(Number(dot.dataset.quoteTo) + quotes.length);
      updateQuoteTimer();
    }));
    quoteTrack.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') showQuote(quotes.length);
      else if (event.key === 'End') showQuote(quotes.length * 2 - 1);
      else showQuote(currentCard + (event.key === 'ArrowRight' ? 1 : -1));
    });
    quotePause.addEventListener('click', () => {
      quotesPaused = !(quotesPaused || carouselTouched);
      carouselTouched = false;
      quotePause.setAttribute('aria-pressed', String(quotesPaused));
      quotePause.textContent = quotesPaused ? 'Resume quotes' : 'Pause quotes';
      updateQuoteTimer();
    });
    carousel.addEventListener('mouseenter', () => { carouselHover = true; updateQuoteTimer(); });
    carousel.addEventListener('mouseleave', () => { carouselHover = false; updateQuoteTimer(); });
    carousel.addEventListener('focusin', () => { carouselFocused = true; updateQuoteTimer(); });
    carousel.addEventListener('focusout', event => {
      if (!carousel.contains(event.relatedTarget)) { carouselFocused = false; updateQuoteTimer(); }
    });
    carousel.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || event.target.closest('.quote-pause')) return;
      carouselTouched = true;
      quotePause.textContent = 'Resume quotes';
      quotePause.setAttribute('aria-pressed', 'true');
      updateQuoteTimer();
    }, { passive: true });
    window.addEventListener('resize', () => showQuote(currentQuote + quotes.length, true), { passive: true });
    desktop.addEventListener('change', updateQuoteTimer);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        carouselVisible = entries[0].isIntersecting;
        updateQuoteTimer();
      }, { threshold: .1 }).observe(carousel);
    }
  }

  const motionButton = document.querySelector('.motion-toggle');
  function applyMotionPreference() {
    const enabled = motionAllowed();
    root.classList.toggle('motion-paused', !enabled);
    if (motionButton) {
      motionButton.hidden = reduced.matches;
      motionButton.textContent = enabled ? 'Pause motion' : 'Resume motion';
      motionButton.setAttribute('aria-pressed', String(!enabled));
    }
    if (quotePause) quotePause.hidden = !enabled;
    if (!enabled) {
      accordionAnimations.forEach(animation => animation.finish());
      // Clearing the source restores the actual poster, not a frozen video frame.
      videos.forEach(video => {
        video.pause();
        video.removeAttribute('autoplay');
        if (video.hasAttribute('src')) { video.removeAttribute('src'); video.load(); }
      });
    }
    updateVideos();
    updateBreath();
    updateQuoteTimer();
    requestScrollUpdate();
  }
  motionButton?.addEventListener('click', () => { userPaused = !userPaused; applyMotionPreference(); });
  reduced.addEventListener('change', applyMotionPreference);
  document.addEventListener('visibilitychange', () => { updateVideos(); updateBreath(); updateQuoteTimer(); requestScrollUpdate(); });
  applyMotionPreference();

  // Native details/summary keeps keyboard interaction and the no-JS fallback.
  document.querySelectorAll('.accordion details').forEach(details => {
    const summary = details.querySelector('summary');
    const answer = details.querySelector('.answer');
    let animation = null;
    let desiredOpen = details.open;
    summary.addEventListener('click', event => {
      if (!motionAllowed() || !details.animate) return;
      event.preventDefault();
      desiredOpen = !desiredOpen;
      const startHeight = details.getBoundingClientRect().height;
      if (animation) animation.cancel();
      details.open = true;
      const endHeight = summary.getBoundingClientRect().height + (desiredOpen ? answer.getBoundingClientRect().height : 0) + 1;
      details.style.overflow = 'hidden';
      animation = details.animate({ height: [`${startHeight}px`, `${endHeight}px`] }, { duration: 700, easing: 'cubic-bezier(.22,.61,.36,1)' });
      const currentAnimation = animation;
      accordionAnimations.add(currentAnimation);
      currentAnimation.oncancel = () => accordionAnimations.delete(currentAnimation);
      animation.onfinish = () => {
        details.open = desiredOpen;
        details.style.removeProperty('overflow');
        accordionAnimations.delete(currentAnimation);
        animation = null;
      };
    });
    details.addEventListener('toggle', () => { if (!animation) desiredOpen = details.open; });
  });

  const form = document.querySelector('.enquiry-form');
  if (!form) return;
  const staySelect = form.elements.namedItem('stay');
  document.querySelectorAll('[data-stay]').forEach(link => link.addEventListener('click', () => {
    staySelect.value = link.dataset.stay;
    staySelect.dispatchEvent(new Event('change', { bubbles: true }));
    window.setTimeout(() => form.elements.namedItem('name').focus({ preventScroll: true }), motionAllowed() ? 800 : 0);
  }));
  document.querySelectorAll('[data-ask]').forEach(link => link.addEventListener('click', () => {
    window.setTimeout(() => form.elements.namedItem('message').focus({ preventScroll: true }), motionAllowed() ? 800 : 0);
  }));
  const status = document.querySelector('.form-status');
  const fallback = document.querySelector('.mail-fallback');
  const submitButton = form.querySelector('[type="submit"]');
  let submitting = false;
  form.addEventListener('input', event => { if (event.target.setCustomValidity) event.target.setCustomValidity(''); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    const nameInput = form.elements.namedItem('name');
    nameInput.value = nameInput.value.trim();
    nameInput.setCustomValidity(nameInput.value ? '' : 'Please enter your name.');
    if (!form.reportValidity()) return;
    const fields = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, String(value).trim()]));
    const retreat = body.dataset.retreat;
    const message = enquiryMessage(fields, retreat);
    fallback.href = message.mailto;
    fallback.hidden = true;
    status.hidden = true;

    if (!FORM_ENDPOINT) {
      window.location.assign(message.mailto);
      status.textContent = 'Thank you. Your enquiry is ready in your email app. Please send it there to reach Kim.';
      status.hidden = false;
      fallback.textContent = 'Open email again ↗';
      fallback.hidden = false;
      status.focus({ preventScroll: true });
      return;
    }

    submitting = true;
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      // The configured endpoint must accept JSON and allow this site's origin.
      const response = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, retreat, subject: message.subject, body: message.body }),
        signal: controller.signal,
        credentials: 'omit'
      });
      if (!response.ok) throw new Error(`Enquiry response: ${response.status}`);
      form.hidden = true;
      status.textContent = 'Thank you. Your enquiry has been sent to Kim.';
    } catch {
      status.textContent = "Your enquiry couldn't be sent. Please try again, or email your enquiry to Kim.";
      fallback.textContent = 'Email your enquiry ↗';
      fallback.hidden = false;
    } finally {
      window.clearTimeout(timeout);
      submitting = false;
      submitButton.disabled = false;
      submitButton.textContent = 'Send to Kim ↗';
      status.hidden = false;
      status.focus({ preventScroll: true });
    }
  });
})();
