/* ============================================================
   WAQEF — hype site motion
   GSAP + ScrollTrigger + SplitText + ScrambleText
   ============================================================ */

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

const SCRAMBLE_CHARS = "WAQEF#/\\<>*!?وقف";

/* ------------------------------------------------------------
   Custom cursor
------------------------------------------------------------ */
(function cursor() {
  const cursor = document.querySelector(".cursor");
  const dot = document.querySelector(".cursor__dot");
  const ring = document.querySelector(".cursor__ring");
  if (!cursor) return;

  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { x: pos.x, y: pos.y };

  window.addEventListener("mousemove", (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    gsap.set(dot, { x: pos.x, y: pos.y });
  });

  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * 0.18;
    ringPos.y += (pos.y - ringPos.y) * 0.18;
    gsap.set(ring, { x: ringPos.x, y: ringPos.y });
  });

  document.querySelectorAll(".hoverable, a, button").forEach((el) => {
    el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
    el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
  });
})();

/* ------------------------------------------------------------
   Preloader: counter + cycling glyphs, then reveal
------------------------------------------------------------ */
function runPreloader(onDone) {
  const pre = document.getElementById("preloader");
  const count = document.getElementById("loadCount");
  const bar = document.getElementById("loadBar");
  const glyphs = pre.querySelectorAll(".glyph");

  let g = 0;
  const glyphLoop = setInterval(() => {
    glyphs.forEach((el, i) => el.classList.toggle("is-on", i === g % glyphs.length));
    g++;
  }, 180);

  const state = { v: 0 };
  gsap.to(state, {
    v: 100,
    duration: 2.4,
    ease: "power2.inOut",
    onUpdate() {
      count.textContent = String(Math.round(state.v)).padStart(3, "0");
      bar.style.width = state.v + "%";
    },
    onComplete() {
      clearInterval(glyphLoop);
      glyphs.forEach((el) => el.classList.add("is-on"));
      gsap.timeline({ onComplete: () => { pre.remove(); onDone(); } })
        .to(pre, { opacity: 1, duration: 0.15 })
        .to(pre.children, { y: -40, opacity: 0, stagger: 0.06, duration: 0.4, ease: "power2.in" })
        .to(pre, { yPercent: -100, duration: 0.7, ease: "power4.inOut" }, "-=0.1");
    },
  });
}

/* ------------------------------------------------------------
   Glitch bursts on .glitch elements (random RGB-split slices)
------------------------------------------------------------ */
function startGlitchLoop(el) {
  function burst() {
    el.classList.add("is-glitching");
    setTimeout(() => el.classList.remove("is-glitching"), 250);
    setTimeout(burst, 1500 + Math.random() * 3500);
  }
  setTimeout(burst, 800 + Math.random() * 1200);
}

/* ------------------------------------------------------------
   Hero intro
------------------------------------------------------------ */
function heroIntro() {
  const title = document.querySelector(".hero__title");
  const split = new SplitText(title, { type: "chars" });

  gsap.timeline()
    .from(split.chars, {
      yPercent: 110,
      skewX: -12,
      duration: 0.9,
      stagger: 0.07,
      ease: "power4.out",
    })
    .from(".hero__glyphline", { opacity: 0, y: 20, duration: 0.5 }, "-=0.5")
    .to("#heroTag", {
      duration: 1.4,
      scrambleText: { text: "PAUSE LIFE. LET LAUGHTER BEGIN.", chars: SCRAMBLE_CHARS, speed: 0.6 },
    }, "-=0.4")
    .from(".hero__meta span", { opacity: 0, y: 12, stagger: 0.1, duration: 0.4 }, "-=0.8")
    .from(".hero__scroll", { opacity: 0, duration: 0.5 }, "-=0.2")
    .to("#nav", { opacity: 1, duration: 0.6 }, "-=0.4");

  startGlitchLoop(title);

  // Parallax: arabic ghost word drifts on scroll
  gsap.to(".hero__arabic", {
    yPercent: 30,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
  gsap.to(".hero__title", {
    yPercent: -40,
    opacity: 0.2,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
  });
}

/* ------------------------------------------------------------
   Nav link scramble on hover
------------------------------------------------------------ */
function navScramble() {
  document.querySelectorAll("[data-scramble]").forEach((el) => {
    const original = el.dataset.scramble;
    el.addEventListener("mouseenter", () => {
      gsap.to(el, {
        duration: 0.6,
        scrambleText: { text: original, chars: SCRAMBLE_CHARS, speed: 1 },
      });
    });
  });
}

/* ------------------------------------------------------------
   Marquees: scroll-velocity-reactive infinite loop
------------------------------------------------------------ */
function marquees() {
  document.querySelectorAll(".marquee__track").forEach((track) => {
    const dir = parseFloat(track.dataset.speed) || 1;
    const half = track.scrollWidth / 2;
    const proxy = { x: 0 };
    let speed = 60 * dir;

    gsap.ticker.add((time, delta) => {
      proxy.x -= (speed * delta) / 1000;
      const x = ((proxy.x % half) + half) % half;
      gsap.set(track, { x: -x });
    });

    ScrollTrigger.create({
      onUpdate(self) {
        speed = 60 * dir + self.getVelocity() * 0.05 * dir;
        gsap.to({}, { duration: 0.5, onComplete: () => (speed = 60 * dir) });
      },
    });
  });
}

/* ------------------------------------------------------------
   Manifesto: line-by-line reveal on scroll
------------------------------------------------------------ */
function manifesto() {
  document.querySelectorAll(".reveal-line").forEach((line) => {
    gsap.from(line, {
      yPercent: 100,
      opacity: 0,
      duration: 0.8,
      ease: "power3.out",
      scrollTrigger: { trigger: line, start: "top 85%" },
    });
  });
}

/* ------------------------------------------------------------
   Movement: scramble section title, floating preview follows
   cursor over the pillars list (LD&R episode-list feel)
------------------------------------------------------------ */
function movement() {
  document.querySelectorAll("[data-scramble-onview]").forEach((title) => {
    ScrollTrigger.create({
      trigger: title,
      start: "top 80%",
      once: true,
      onEnter() {
        gsap.to(title, {
          duration: 1.2,
          scrambleText: { text: title.dataset.scrambleOnview, chars: SCRAMBLE_CHARS, speed: 0.5 },
        });
      },
    });
  });

  gsap.from(".pillar", {
    opacity: 0,
    y: 50,
    stagger: 0.12,
    duration: 0.7,
    ease: "power3.out",
    scrollTrigger: { trigger: ".pillars", start: "top 80%" },
  });

  const preview = document.getElementById("pillarPreview");
  const list = document.querySelector(".pillars");
  if (!preview || !list || matchMedia("(hover: none)").matches) return;

  list.addEventListener("mousemove", (e) => {
    gsap.to(preview, {
      x: e.clientX + 30,
      y: e.clientY - 75,
      duration: 0.5,
      ease: "power3.out",
    });
  });
  list.addEventListener("mouseenter", () => {
    gsap.to(preview, { opacity: 1, scale: 1, rotate: 6, duration: 0.35 });
  });
  list.addEventListener("mouseleave", () => {
    gsap.to(preview, { opacity: 0, scale: 0.6, rotate: -6, duration: 0.3 });
  });
}

/* ------------------------------------------------------------
   Cities: pinned horizontal scroll
------------------------------------------------------------ */
function cities() {
  const track = document.getElementById("citiesTrack");
  const pin = document.querySelector(".cities__pin");

  const distance = () => track.scrollWidth - innerWidth + innerWidth * 0.16;

  const horiz = gsap.to(track, {
    x: () => -distance(),
    ease: "none",
    scrollTrigger: {
      trigger: ".cities",
      start: "top top",
      end: () => "+=" + distance(),
      pin: pin,
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });

  gsap.utils.toArray(".city-card").forEach((card) => {
    gsap.from(card, {
      opacity: 0,
      scale: 0.92,
      duration: 0.6,
      scrollTrigger: {
        trigger: card,
        containerAnimation: horiz,
        start: "left 90%",
      },
    });
  });
}

/* ------------------------------------------------------------
   Rules: pinned section, statements swap with glitch
------------------------------------------------------------ */
function rules() {
  const statements = gsap.utils.toArray(".rule");
  statements.forEach(startGlitchLoop);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".rules",
      start: "top top",
      end: "+=" + statements.length * 90 + "%",
      pin: ".rules__pin",
      scrub: 0.6,
    },
  });

  statements.forEach((st, i) => {
    tl.fromTo(st,
      { autoAlpha: 0, scale: 1.15, filter: "blur(8px)" },
      { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 1 }
    );
    if (i < statements.length - 1) {
      tl.to(st, { autoAlpha: 0, scale: 0.9, filter: "blur(8px)", duration: 1 }, "+=0.6");
    }
  });
}

/* ------------------------------------------------------------
   The Name: contenders get struck through one by one,
   then WAQEF lands with a glitch
------------------------------------------------------------ */
function names() {
  const dead = gsap.utils.toArray(".dead-name");
  const winner = document.querySelector(".names__winner");
  startGlitchLoop(winner);

  const tl = gsap.timeline({
    scrollTrigger: { trigger: ".names__list", start: "top 75%", once: true },
  });
  dead.forEach((el) => {
    tl.add(() => el.classList.add("is-dead"), "+=0.28");
  });
  tl.from(winner, {
    scale: 1.6,
    opacity: 0,
    duration: 0.5,
    ease: "power4.out",
  }, "+=0.4");

  gsap.from(".voice__col", {
    opacity: 0,
    y: 40,
    stagger: 0.15,
    duration: 0.7,
    scrollTrigger: { trigger: ".voice", start: "top 85%" },
  });
}

/* ------------------------------------------------------------
   The Film: pinned storyboard, scenes fade through like cuts
------------------------------------------------------------ */
function film() {
  const frames = gsap.utils.toArray(".film__frame");

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: ".film",
      start: "top top",
      end: "+=" + frames.length * 80 + "%",
      pin: ".film__pin",
      scrub: 0.6,
    },
  });

  frames.forEach((frame, i) => {
    tl.fromTo(frame,
      { autoAlpha: 0, y: 40 },
      { autoAlpha: 1, y: 0, duration: 1 }
    );
    if (i < frames.length - 1) {
      tl.to(frame, { autoAlpha: 0, y: -40, duration: 1 }, "+=0.5");
    }
  });
}

/* ------------------------------------------------------------
   The Road: progress line fills, steps light up on scroll
------------------------------------------------------------ */
function road() {
  gsap.to("#roadProgress", {
    height: "100%",
    ease: "none",
    scrollTrigger: {
      trigger: ".road__track",
      start: "top 70%",
      end: "bottom 60%",
      scrub: true,
    },
  });
  gsap.utils.toArray(".road__step").forEach((step) => {
    gsap.from(step, {
      opacity: 0,
      x: -40,
      duration: 0.7,
      ease: "power3.out",
      scrollTrigger: { trigger: step, start: "top 80%" },
    });
  });
}

/* ------------------------------------------------------------
   Lineup: glitching headliner + teased acts scramble on hover
------------------------------------------------------------ */
function lineup() {
  const name = document.querySelector(".lineup__name");
  startGlitchLoop(name);

  gsap.from(".lineup__pre, .lineup__name, .lineup__sub", {
    opacity: 0,
    y: 40,
    stagger: 0.15,
    duration: 0.8,
    ease: "power3.out",
    scrollTrigger: { trigger: ".lineup", start: "top 70%" },
  });

  document.querySelectorAll(".lineup__tba li").forEach((li) => {
    const b = li.querySelector("b");
    const hidden = b.textContent;
    li.addEventListener("mouseenter", () => {
      gsap.to(b, {
        duration: 0.5,
        scrambleText: { text: li.dataset.tba, chars: SCRAMBLE_CHARS, speed: 1 },
      });
    });
    li.addEventListener("mouseleave", () => {
      gsap.to(b, {
        duration: 0.5,
        scrambleText: { text: hidden, chars: SCRAMBLE_CHARS, speed: 1 },
      });
    });
  });
}

/* ------------------------------------------------------------
   The Sound of WAQEF: equalizer + Web Audio static-and-swell
   signature (mic static -> crowd-like burst)
------------------------------------------------------------ */
function sound() {
  const bars = gsap.utils.toArray("#soundEq span");
  bars.forEach((bar, i) => {
    gsap.to(bar, {
      height: () => 15 + Math.random() * 75 + "%",
      duration: 0.4 + Math.random() * 0.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: i * 0.05,
    });
  });

  let ctx;
  document.getElementById("soundBtn").addEventListener("click", () => {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const dur = 2.2;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // 0-0.5s: crackly mic static; 0.5s+: swelling "crowd" noise
      const stat = t < 0.25 ? (Math.random() * 2 - 1) * 0.5 * (Math.random() > 0.97 ? 2 : 0.4) : 0;
      const swell = t >= 0.25 ? (Math.random() * 2 - 1) * Math.sin((t - 0.25) * Math.PI / 0.75) * 0.6 : 0;
      data[i] = stat + swell;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + dur);
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();

    // equalizer goes wild during playback
    bars.forEach((bar) => {
      gsap.to(bar, {
        height: () => 40 + Math.random() * 60 + "%",
        duration: 0.12,
        repeat: Math.floor(dur / 0.12),
        yoyo: true,
        ease: "none",
        overwrite: true,
        onComplete() {
          gsap.to(bar, {
            height: () => 15 + Math.random() * 75 + "%",
            duration: 0.5, repeat: -1, yoyo: true, ease: "sine.inOut",
          });
        },
      });
    });
  });
}

/* ------------------------------------------------------------
   The Game: cursor wipes the static to reveal the dream prize
------------------------------------------------------------ */
function game() {
  const card = document.getElementById("gameCard");
  const staticLayer = document.getElementById("gameStatic");
  if (!card) return;

  function wipe(x, y) {
    const r = card.getBoundingClientRect();
    const mx = ((x - r.left) / r.width) * 100;
    const my = ((y - r.top) / r.height) * 100;
    const mask = `radial-gradient(circle 130px at ${mx}% ${my}%, transparent 0 60%, black 100%)`;
    staticLayer.style.webkitMaskImage = mask;
    staticLayer.style.maskImage = mask;
  }
  card.addEventListener("mousemove", (e) => wipe(e.clientX, e.clientY));
  card.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    wipe(t.clientX, t.clientY);
  }, { passive: true });
  card.addEventListener("mouseleave", () => {
    staticLayer.style.webkitMaskImage = "";
    staticLayer.style.maskImage = "";
  });
}

/* ------------------------------------------------------------
   Tickets + footer reveals
------------------------------------------------------------ */
function outro() {
  gsap.from("#ticketCta", {
    opacity: 0,
    y: 80,
    rotate: -6,
    duration: 0.9,
    ease: "back.out(1.4)",
    scrollTrigger: { trigger: ".tickets", start: "top 70%" },
  });
  gsap.from(".tickets__fomo", {
    opacity: 0,
    duration: 0.8,
    scrollTrigger: { trigger: ".tickets", start: "top 50%" },
  });
  gsap.from(".footer__word", {
    yPercent: 60,
    opacity: 0,
    duration: 1,
    ease: "power3.out",
    scrollTrigger: { trigger: ".footer", start: "top 85%" },
  });

  document.getElementById("ticketCta").addEventListener("click", () => {
    const big = document.querySelector(".ticket__big");
    gsap.to(big, {
      duration: 1,
      scrambleText: { text: "SOON, HABIBI. SOON.", chars: SCRAMBLE_CHARS, speed: 0.6 },
      onComplete() {
        gsap.to(big, {
          delay: 1.4,
          duration: 1,
          scrambleText: { text: "GET IN THE ROOM", chars: SCRAMBLE_CHARS, speed: 0.6 },
        });
      },
    });
  });
}

/* ------------------------------------------------------------
   Boot
------------------------------------------------------------ */
window.addEventListener("load", () => {
  navScramble();
  runPreloader(() => {
    heroIntro();
    marquees();
    manifesto();
    movement();
    names();
    cities();
    rules();
    lineup();
    film();
    sound();
    game();
    road();
    outro();
    ScrollTrigger.refresh();
  });
});
