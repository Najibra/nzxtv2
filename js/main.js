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
  const title = document.querySelector("[data-scramble-onview]");
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
    cities();
    rules();
    outro();
    ScrollTrigger.refresh();
  });
});
