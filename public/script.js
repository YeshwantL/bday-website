/* ============================================================
   BIRTHDAY SLIDESHOW — script.js
   Cinematic, romantic, desktop-only experience

   INIT FLOW:
     DOMContentLoaded
       └── loadSlides()        fetch + validate slides.json
       └── initializeIntro()   attach button + heart animation
             └── (button click) startExperience()
                   └── hideIntro / showSlideshow / renderSlide(0) / startMusic
   ============================================================ */

'use strict';

// ══════════════════════════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════════════════════════
let slides = [];
let currentIndex = 0;
let activeBg = 'a';
let musicStarted = false;
let isTransitioning = false;
let isFinalAnimating = false;
let finalTriggered = false;
let animFrameId = null;
let particles = [];
let spawnAccum = 0;
let particlesRunning = false;
let textRevealTimer = null;

const imgCache = {};

// ══════════════════════════════════════════════════════════
// ENTRY POINT — wait for DOM then load slides and init intro
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await loadSlides();
  initializeIntro();
});

// ══════════════════════════════════════════════════════════
// LOAD SLIDES
// ══════════════════════════════════════════════════════════
async function loadSlides() {
  try {
    const res = await fetch('slides.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('slides.json returned empty or invalid data');
    }
    slides = data;
    console.log(`Slides loaded: ${slides.length}`);
    preloadAllImages();
  } catch (err) {
    console.error('Failed to load slides:', err);
    // slides remains [] — button stays disabled
  }
}

// ══════════════════════════════════════════════════════════
// INITIALIZE INTRO — attaches button + heart animation
// ══════════════════════════════════════════════════════════
function initializeIntro() {
  // — DOM refs —
  const introScreen = document.getElementById('introScreen');
  const introBtn = document.getElementById('intro-btn');
  const btnRipple = document.getElementById('btn-ripple');
  const introHearts = document.getElementById('intro-hearts');
  const slideshowContainer = document.getElementById('slideshowContainer');

  if (!introBtn) { console.error('intro-btn not found'); return; }

  // Button is disabled if slides failed to load
  if (!slides || slides.length === 0) {
    introBtn.disabled = true;
    introBtn.textContent = 'Loading…';
    return;
  }

  // ── Floating hearts ──────────────────────────────────────
  const ihCtx = introHearts.getContext('2d');
  let introHeartsArr = [];
  let introAnimId = null;

  function resizeIntroCanvas() {
    introHearts.width = window.innerWidth;
    introHearts.height = window.innerHeight;
  }

  function makeIntroHeart() {
    return {
      x: Math.random() * introHearts.width,
      y: introHearts.height + 20,
      vx: (Math.random() - 0.5) * 0.6,
      vy: -(Math.random() * 0.8 + 0.4),
      size: Math.random() * 18 + 8,
      alpha: Math.random() * 0.45 + 0.1,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpd: Math.random() * 0.025 + 0.01
    };
  }

  function tickIntroHearts() {
    ihCtx.clearRect(0, 0, introHearts.width, introHearts.height);
    if (introHeartsArr.length < 30) introHeartsArr.push(makeIntroHeart());

    for (let i = introHeartsArr.length - 1; i >= 0; i--) {
      const p = introHeartsArr[i];
      p.wobble += p.wobbleSpd;
      p.x += p.vx + Math.sin(p.wobble) * 0.4;
      p.y += p.vy;
      if (p.y < -30) { introHeartsArr.splice(i, 1); continue; }

      ihCtx.save();
      ihCtx.globalAlpha = p.alpha;
      ihCtx.font = `${p.size}px serif`;
      ihCtx.fillStyle = '#c0405a';
      ihCtx.textAlign = 'center';
      ihCtx.textBaseline = 'middle';
      ihCtx.fillText('♥', p.x, p.y);
      ihCtx.restore();
    }
    introAnimId = requestAnimationFrame(tickIntroHearts);
  }

  resizeIntroCanvas();
  window.addEventListener('resize', resizeIntroCanvas);
  tickIntroHearts();

  // ── Button click ─────────────────────────────────────────
  introBtn.addEventListener('click', () => {
    if (introBtn.disabled) return;
    introBtn.disabled = true;

    // Ripple
    btnRipple.classList.remove('ripple-active');
    void btnRipple.offsetWidth;
    btnRipple.classList.add('ripple-active');

    startExperience(introScreen, slideshowContainer, introAnimId);
  });
}

// ══════════════════════════════════════════════════════════
// START EXPERIENCE
// ══════════════════════════════════════════════════════════
function startExperience(introScreen, slideshowContainer, introAnimId) {
  if (!slides || slides.length === 0) return;
  const firstSlide = slides[0];
  if (!firstSlide) return;

  // Fade out intro
  introScreen.classList.add('fade-out');
  setTimeout(() => {
    cancelAnimationFrame(introAnimId);
    introScreen.style.display = 'none';
  }, 750);

  // Fade in slideshow
  slideshowContainer.classList.remove('hidden-slide');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      slideshowContainer.classList.add('visible-slide');
    });
  });

  // Render first slide
  currentIndex = 0;
  renderSlide(firstSlide);
  updateScarfProgress(0);
  startMusic();
}

// ══════════════════════════════════════════════════════════
// RESET FINAL STATE
// ══════════════════════════════════════════════════════════
function resetFinalState() {
  const scarfContainer = document.getElementById('scarf-container');
  const finalReveal = document.getElementById('final-reveal');
  const particleCanvas = document.getElementById('particle-canvas');
  const music = document.getElementById('bg-music');

  document.body.classList.remove('final-mode');
  scarfContainer.classList.remove('center-pop', 'glow', 'fade-out');
  scarfContainer.style.cssText = '';
  document.getElementById('slide-text-container').style.display = 'flex';

  particlesRunning = false;
  if (animFrameId !== null) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  particles = [];
  spawnAccum = 0;
  const pCtx = particleCanvas.getContext('2d');
  pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
  particleCanvas.classList.remove('show');

  finalReveal.classList.remove('show');
  finalReveal.classList.add('hidden');

  if (musicStarted) fadeVolume(music, 0.4, 800);

  if (textRevealTimer !== null) { clearTimeout(textRevealTimer); textRevealTimer = null; }

  isFinalAnimating = false;
  finalTriggered = false;
}

// ══════════════════════════════════════════════════════════
// RENDER SLIDE
// ══════════════════════════════════════════════════════════
function renderSlide(slide) {
  const slideTextEl = document.getElementById('slide-text');
  const slideSubtextEl = document.getElementById('slide-subtext');
  const overlay = document.getElementById('overlay');

  crossFadeBackground(slide.image, slide.backgroundPosition, slide.backgroundSize, slide.blur);

  // Overlay: use inline gradient if slide defines one, else CSS class
  if (slide.overlayGradient) {
    overlay.className = 'overlay';
    overlay.style.background = slide.overlayGradient;
  } else {
    overlay.style.background = '';
    overlay.className = 'overlay ' + (slide.type || 'normal');
  }

  // Per-slide text layout
  const textContainer = document.getElementById('slide-text-container');
  if (slide.textLayout === 'top') {
    textContainer.classList.add('layout-top');
  } else {
    textContainer.classList.remove('layout-top');
  }

  slideTextEl.classList.remove('visible', 'hint-text');
  slideSubtextEl.classList.remove('visible');
  slideTextEl.textContent = '';
  slideSubtextEl.textContent = '';

  preloadImage(slides[currentIndex + 1]);

  textRevealTimer = setTimeout(() => {
    textRevealTimer = null;
    slideTextEl.style.fontSize = slide.fontSize || '';
    slideTextEl.style.lineHeight = slide.lineHeight || '';
    slideTextEl.textContent = slide.text;
    if (slide.type === 'hint') slideTextEl.classList.add('hint-text');
    void slideTextEl.offsetWidth;
    slideTextEl.classList.add('visible');

    if (slide.subtext) {
      slideSubtextEl.textContent = slide.subtext;
      void slideSubtextEl.offsetWidth;
      slideSubtextEl.classList.add('visible');
    }
  }, 500);
}

// ══════════════════════════════════════════════════════════
// UPDATE SCARF PROGRESS
// ══════════════════════════════════════════════════════════
function updateScarfProgress(index) {
  const scarfFillRect = document.getElementById('scarf-fill-rect');
  const total = slides.length;
  const progress = total <= 1 ? 1 : (index + 1) / total;
  scarfFillRect.setAttribute('width', Math.round(1440 * progress));
}

// ══════════════════════════════════════════════════════════
// FINAL ANIMATION
// ══════════════════════════════════════════════════════════
function triggerFinalAnimation(slide) {
  if (isFinalAnimating) return;
  isFinalAnimating = true;
  finalTriggered = true;

  const scarfContainer = document.getElementById('scarf-container');
  const scarfFillRect = document.getElementById('scarf-fill-rect');
  const finalReveal = document.getElementById('final-reveal');
  const slideTextContainer = document.getElementById('slide-text-container');
  const slideTextEl = document.getElementById('slide-text');
  const slideSubtextEl = document.getElementById('slide-subtext');
  const finalHeading = document.getElementById('final-heading');
  const music = document.getElementById('bg-music');

  // Fully unmount old text visually so no stacking is possible
  clearTimeout(textRevealTimer);
  slideTextContainer.style.display = 'none';
  slideTextEl.textContent = '';
  slideSubtextEl.textContent = '';
  slideTextEl.classList.remove('visible', 'hint-text');
  slideSubtextEl.classList.remove('visible');

  // Set the isolated final slide text
  finalHeading.textContent = slide.text;

  if (musicStarted) fadeVolume(music, 0.5, 1200);

  // 1. Fill completion (800ms)
  scarfFillRect.style.transition = 'width 800ms ease-in-out';
  scarfFillRect.setAttribute('width', 1440);

  // Wait for fill to finish
  setTimeout(() => {
    // 2. Pop to center
    scarfContainer.classList.add('center-pop');

    // 3. Glow effect (starts slightly after pop begins)
    setTimeout(() => {
      scarfContainer.classList.add('glow');

      // Part of climax: trigger particles and end text
      setTimeout(() => {
        scarfContainer.classList.add('fade-out');

        // Cleanup after fade (hide from DOM)
        setTimeout(() => {
          scarfContainer.style.display = 'none';

          startParticles();

          // Delay text animation by 600ms to prevent overlap
          setTimeout(() => {
            finalReveal.classList.remove('hidden');
            void finalReveal.offsetWidth;
            finalReveal.classList.add('show');
            isFinalAnimating = false;
          }, 600);

        }, 1000);
      }, 1000); // hold glow for 1s
    }, 600); // wait for 600ms pop transition
  }, 800); // wait for 800ms fill
}

// ══════════════════════════════════════════════════════════
// NAVIGATION — strict guards, direction-agnostic
// ══════════════════════════════════════════════════════════
function transitionToSlide(index) {
  if (!slides || slides.length === 0) return;   // slides not loaded
  if (isTransitioning) return;                  // mid-crossfade
  if (isFinalAnimating) return;                  // mid-climax
  if (index < 0 || index >= slides.length) return;

  const slide = slides[index];
  if (!slide) return;                             // explicit null guard

  resetFinalState();
  currentIndex = index;

  if (slide.type === 'final') {
    crossFadeBackground(slide.image, slide.backgroundPosition, slide.backgroundSize, slide.blur);
    document.getElementById('overlay').style.background = '';
    document.getElementById('overlay').className = 'overlay final';
    updateScarfProgress(index);
    triggerFinalAnimation(slide);
  } else {
    renderSlide(slide);
    updateScarfProgress(index);
  }
}

const goNext = () => transitionToSlide(currentIndex + 1);
const goPrev = () => transitionToSlide(currentIndex - 1);

// ══════════════════════════════════════════════════════════
// BACKGROUND CROSSFADE
// Pure inline-style transitions — no CSS class conflicts.
// ══════════════════════════════════════════════════════════
function crossFadeBackground(imageSrc, bgPosition, bgSize, blurAmount) {
  const bgA = document.getElementById('bg-layer-a');
  const bgB = document.getElementById('bg-layer-b');

  const incoming = activeBg === 'a' ? bgB : bgA;
  const outgoing = activeBg === 'a' ? bgA : bgB;
  activeBg = activeBg === 'a' ? 'b' : 'a';

  isTransitioning = true;

  incoming.style.transition = 'none';
  incoming.style.backgroundImage = `url('${imageSrc}')`;
  incoming.style.backgroundPosition = bgPosition || 'center center';
  incoming.style.backgroundSize = bgSize || 'cover';
  incoming.style.filter = `blur(${blurAmount || '8px'})`;
  incoming.style.opacity = '0';
  incoming.style.transform = 'scale(1.04)';
  void incoming.offsetWidth;

  const T = '0.8s ease-in-out';
  incoming.style.transition = `opacity ${T}, transform ${T}`;
  outgoing.style.transition = `opacity ${T}, transform ${T}`;

  incoming.style.opacity = '1';
  incoming.style.transform = 'scale(1)';
  outgoing.style.opacity = '0';
  outgoing.style.transform = 'scale(1.02)';

  setTimeout(() => {
    outgoing.style.transition = 'none';
    outgoing.style.transform = 'scale(1.04)';
    // Reset outgoing blur/size to defaults for next use
    outgoing.style.filter = 'blur(8px)';
    outgoing.style.backgroundSize = 'cover';
    isTransitioning = false;

    setTimeout(() => {
      incoming.style.transition = 'transform 12s ease-in-out';
      incoming.style.transform = 'scale(1.07)';
    }, 30);
  }, 820);
}

// ══════════════════════════════════════════════════════════
// IMAGE PRELOADING
// ══════════════════════════════════════════════════════════
function preloadImage(slide) {
  if (!slide || imgCache[slide.image]) return;
  const img = new Image();
  img.src = slide.image;
  imgCache[slide.image] = img;
}

function preloadAllImages() {
  slides.forEach(s => preloadImage(s));
}

// ══════════════════════════════════════════════════════════
// MUSIC
// ══════════════════════════════════════════════════════════
function startMusic() {
  const music = document.getElementById('bg-music');
  if (musicStarted) return;
  musicStarted = true;
  music.volume = 0;
  music.play().catch(() => { });
  fadeVolume(music, 0.4, 2000);
}

function fadeVolume(audioEl, targetVol, duration) {
  const startVol = audioEl.volume;
  const startTime = performance.now();
  const diff = targetVol - startVol;
  (function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    audioEl.volume = startVol + diff * easeInOut(t);
    if (t < 1) requestAnimationFrame(step);
  })(performance.now());
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ══════════════════════════════════════════════════════════
// PARTICLE SYSTEM — confetti + hearts (final slide only)
// ══════════════════════════════════════════════════════════
const COLORS = [
  '#FF6B9D', '#FF9DC0', '#FFB3C6', '#FF4D6D',
  '#FFF0F3', '#FFD6E7', '#FFADCA', '#C9184A',
  '#fff', '#ffe4ec'
];

function makeParticle(canvas) {
  const isHeart = Math.random() < 0.35;
  return {
    x: Math.random() * canvas.width,
    y: -20,
    vx: (Math.random() - 0.5) * 1.8,
    vy: Math.random() * 1.6 + 0.8,
    size: isHeart ? Math.random() * 18 + 10 : Math.random() * 9 + 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: 1,
    decay: Math.random() * 0.004 + 0.002,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.06,
    isHeart,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpd: Math.random() * 0.04 + 0.02
  };
}

function startParticles() {
  const canvas = document.getElementById('particle-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.classList.add('show');
  particlesRunning = true;
  tickParticles(canvas);
}

function tickParticles(canvas) {
  if (!particlesRunning) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  spawnAccum++;
  if (spawnAccum % 3 === 0) particles.push(makeParticle(canvas));
  if (particles.length > 220) particles.splice(0, 5);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.wobble += p.wobbleSpd;
    p.x += p.vx + Math.sin(p.wobble) * 0.5;
    p.y += p.vy;
    p.rotation += p.rotSpeed;
    p.alpha -= p.decay;

    if (p.alpha <= 0 || p.y > canvas.height + 30) { particles.splice(i, 1); continue; }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    if (p.isHeart) {
      ctx.font = `${p.size}px serif`;
      ctx.fillStyle = p.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', 0, 0);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    }
    ctx.restore();
  }

  animFrameId = requestAnimationFrame(() => tickParticles(canvas));
}

// ══════════════════════════════════════════════════════════
// NAVIGATION EVENT LISTENERS
// (attached once DOM is ready via DOMContentLoaded above)
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const zoneRight = document.getElementById('zone-right');
  const zoneLeft = document.getElementById('zone-left');
  const slideshowContainer = document.getElementById('slideshowContainer');

  zoneRight.addEventListener('click', goNext);
  zoneLeft.addEventListener('click', goPrev);

  document.addEventListener('keydown', (e) => {
    if (!slideshowContainer.classList.contains('visible-slide')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
  });

  window.addEventListener('resize', () => {
    const canvas = document.getElementById('particle-canvas');
    if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  });
});
