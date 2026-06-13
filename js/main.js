/* ============================================================
   WAQEF — motion
   GSAP + ScrollTrigger + SplitText + ScrambleText
   ============================================================ */
gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

const CH = "WAQEF#/\\<>*!?وقف";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const noHover = matchMedia("(hover: none)").matches;

/* ---------- cursor ---------- */
(function cursor() {
  if (noHover) return;
  const c = document.querySelector(".cursor");
  const dot = document.querySelector(".cursor__dot");
  const ring = document.querySelector(".cursor__ring");
  const p = { x: innerWidth / 2, y: innerHeight / 2 };
  const r = { ...p };
  addEventListener("mousemove", (e) => { p.x = e.clientX; p.y = e.clientY; gsap.set(dot, { x: p.x, y: p.y }); });
  gsap.ticker.add(() => { r.x += (p.x - r.x) * .18; r.y += (p.y - r.y) * .18; gsap.set(ring, { x: r.x, y: r.y }); });
  const hook = () => document.querySelectorAll(".hoverable, a, button").forEach((el) => {
    el.addEventListener("mouseenter", () => c.classList.add("is-hover"));
    el.addEventListener("mouseleave", () => c.classList.remove("is-hover"));
  });
  hook();
})();

/* ---------- glitch burst loop (CSS-free; via scramble on data-text) ---------- */
function glitchName(el) {
  if (!el || reduced) return;
  const txt = el.dataset.text || el.textContent;
  function burst() {
    gsap.to(el, { duration: .5, scrambleText: { text: txt, chars: CH, speed: .8 } });
    setTimeout(burst, 2600 + Math.random() * 4000);
  }
  setTimeout(burst, 1200 + Math.random() * 2000);
}

/* ---------- preloader ---------- */
function preloader(done) {
  const pre = document.getElementById("preloader");
  const bar = document.getElementById("loadBar");
  const count = document.getElementById("loadCount");
  const s = { v: 0 };
  gsap.to(s, {
    v: 100, duration: 2, ease: "power2.inOut",
    onUpdate() { count.textContent = String(Math.round(s.v)).padStart(2, "0"); bar.style.width = s.v + "%"; },
    onComplete() {
      gsap.timeline({ onComplete: () => { pre.remove(); done(); } })
        .to(".preloader__mark, .preloader__bar, .preloader__count", { y: -30, opacity: 0, stagger: .06, duration: .4, ease: "power2.in" })
        .to(pre, { yPercent: -100, duration: .7, ease: "power4.inOut" }, "-=.15");
    },
  });
}

/* ---------- hero intro ---------- */
function hero() {
  const word = document.querySelector(".hero__word");
  const split = new SplitText(word, { type: "chars" });
  gsap.timeline()
    .from(split.chars, { yPercent: 115, skewX: -10, opacity: 0, stagger: .08, duration: .9, ease: "power4.out" })
    .from(".hero__eyebrow", { opacity: 0, y: 16, duration: .5 }, "-=.6")
    .from(".smile--hero path", { drawSVG: "0%", opacity: 0, duration: .8 }, "-=.5") // graceful no-op without DrawSVG
    .to("#heroTag", { duration: 1.2, scrambleText: { text: "Pause life. Let laughter begin.", chars: CH, speed: .6 } }, "-=.4")
    .from(".hero__sub", { opacity: 0, y: 16, duration: .5 }, "-=.6")
    .from(".hero__cta .btn", { opacity: 0, y: 16, stagger: .1, duration: .4 }, "-=.4")
    .from(".stat", { opacity: 0, y: 20, stagger: .08, duration: .5 }, "-=.3")
    .from(".hero__scroll", { opacity: 0, duration: .4 }, "-=.2")
    .to("#nav", { opacity: 1, duration: .5 }, "-=1")
    .to("#util", { opacity: 1, duration: .5 }, "<");

  // animated smile draw (works without DrawSVG plugin)
  const path = document.querySelector(".smile--hero path");
  if (path) {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
    gsap.to(path, { strokeDashoffset: 0, duration: 1, delay: .8, ease: "power2.out" });
  }

  glitchName(word);

  // counters (any element with data-count)
  document.querySelectorAll("[data-count]").forEach((b) => {
    const target = +b.dataset.count, suf = b.dataset.suffix || "";
    const o = { v: 0 };
    ScrollTrigger.create({ trigger: b, start: "top 92%", once: true, onEnter() {
      gsap.to(o, { v: target, duration: 1.4, ease: "power2.out", onUpdate: () => b.textContent = Math.round(o.v) + suf });
    }});
  });

  // parallax
  if (!reduced) {
    gsap.to(".hero__arabic", { yPercent: 22, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero__word", { yPercent: -30, opacity: .25, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  }
}

/* ---------- nav state ---------- */
function nav() {
  const n = document.getElementById("nav");
  ScrollTrigger.create({ start: "top -80", onUpdate: (s) => n.classList.toggle("scrolled", s.progress > 0 || scrollY > 80) });
  addEventListener("scroll", () => n.classList.toggle("scrolled", scrollY > 80));
  const burger = document.getElementById("burger");
  burger.addEventListener("click", () => n.classList.toggle("open"));
  n.querySelectorAll(".nav__links a").forEach((a) => a.addEventListener("click", () => n.classList.remove("open")));
}

/* ---------- marquee (velocity reactive) ---------- */
function marquee() {
  document.querySelectorAll(".marquee__track").forEach((track) => {
    const dir = parseFloat(track.dataset.speed) || 1;
    const half = track.scrollWidth / 2;
    const proxy = { x: 0 };
    let speed = 55 * dir;
    gsap.ticker.add((t, dt) => { proxy.x -= (speed * dt) / 1000; const x = ((proxy.x % half) + half) % half; gsap.set(track, { x: -x }); });
    ScrollTrigger.create({ onUpdate: (s) => { speed = 55 * dir + s.getVelocity() * .04 * dir; gsap.to({}, { duration: .4, onComplete: () => speed = 55 * dir }); } });
  });
}

/* ---------- generic reveal-up ---------- */
function reveals() {
  gsap.utils.toArray(".reveal-up").forEach((el) => {
    gsap.from(el, { opacity: 0, y: 40, duration: .8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" } });
  });
  // display headlines: word-by-word
  gsap.utils.toArray(".display").forEach((h) => {
    const sp = new SplitText(h, { type: "words" });
    gsap.from(sp.words, { yPercent: 110, opacity: 0, stagger: .08, duration: .7, ease: "power3.out", scrollTrigger: { trigger: h, start: "top 85%" } });
  });
  // value + trait cards stagger
  gsap.from(".value", { opacity: 0, y: 50, stagger: .1, duration: .6, ease: "power3.out", scrollTrigger: { trigger: ".values", start: "top 82%" } });
  gsap.from(".trait", { opacity: 0, x: -20, stagger: .08, duration: .5, scrollTrigger: { trigger: ".traits", start: "top 85%" } });
  gsap.from(".bubble", { opacity: 0, scale: .9, duration: .7, ease: "back.out(1.3)", scrollTrigger: { trigger: ".bubble", start: "top 85%" } });
  gsap.from(".ess", { opacity: 0, y: 40, stagger: .1, duration: .6, scrollTrigger: { trigger: ".essence__row", start: "top 85%" } });
  gsap.from(".tba", { opacity: 0, y: 30, stagger: .1, duration: .5, scrollTrigger: { trigger: ".lineup__tba", start: "top 85%" } });
}

/* ---------- names: strike-out then winner ---------- */
function names() {
  const dead = gsap.utils.toArray(".dead");
  const tl = gsap.timeline({ scrollTrigger: { trigger: ".names__chips", start: "top 78%", once: true } });
  dead.forEach((el) => tl.add(() => el.classList.add("is-dead"), "+=.22"));
  tl.from(".winner", { scale: 1.5, opacity: 0, duration: .5, ease: "power4.out" }, "+=.3");
}

/* ---------- movement: floating preview + scramble title done via reveals ---------- */
function movement() {
  gsap.from(".pillar", { opacity: 0, y: 40, stagger: .1, duration: .6, ease: "power3.out", scrollTrigger: { trigger: ".pillars", start: "top 82%" } });
  const preview = document.getElementById("pillarPreview");
  const list = document.querySelector(".pillars");
  if (!preview || !list || noHover) return;
  list.querySelectorAll(".pillar").forEach((p) => {
    p.addEventListener("mouseenter", () => { preview.dataset.n = "0" + p.dataset.img; gsap.to(preview, { opacity: 1, scale: 1, rotate: 6, duration: .35 }); });
  });
  list.addEventListener("mousemove", (e) => gsap.to(preview, { x: e.clientX + 28, y: e.clientY - 100, duration: .5, ease: "power3.out" }));
  list.addEventListener("mouseleave", () => gsap.to(preview, { opacity: 0, scale: .7, rotate: -6, duration: .3 }));
}

/* ---------- cities horizontal pin ---------- */
function cities() {
  const track = document.getElementById("citiesTrack");
  const pin = document.querySelector(".cities__pin");
  const dist = () => Math.max(0, track.scrollWidth - innerWidth + innerWidth * 0.06);
  const tween = gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: ".cities", start: "top top", end: () => "+=" + dist(), pin, scrub: 1, invalidateOnRefresh: true } });
  gsap.utils.toArray(".city-card").forEach((card) => {
    gsap.from(card, { opacity: 0, scale: .92, duration: .6, scrollTrigger: { trigger: card, containerAnimation: tween, start: "left 92%" } });
  });
}

/* ---------- rules pinned swap ---------- */
function rules() {
  const st = gsap.utils.toArray(".rule");
  const tl = gsap.timeline({ scrollTrigger: { trigger: ".rules", start: "top top", end: "+=" + st.length * 90 + "%", pin: ".rules__pin", scrub: .6 } });
  st.forEach((s, i) => {
    tl.fromTo(s, { autoAlpha: 0, scale: 1.15, filter: "blur(8px)" }, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 1 });
    if (i < st.length - 1) tl.to(s, { autoAlpha: 0, scale: .9, filter: "blur(8px)", duration: 1 }, "+=.6");
  });
}

/* ---------- lineup ---------- */
function lineup() {
  glitchName(document.querySelector(".lineup__name"));
  document.querySelectorAll(".tba").forEach((li) => {
    const b = li.querySelector("b"); const hidden = b.textContent;
    li.addEventListener("mouseenter", () => gsap.to(b, { duration: .5, scrambleText: { text: li.dataset.tba, chars: CH, speed: 1 } }));
    li.addEventListener("mouseleave", () => gsap.to(b, { duration: .5, scrambleText: { text: hidden, chars: CH, speed: 1 } }));
  });
}

/* ---------- film storyboard ---------- */
function film() {
  const frames = gsap.utils.toArray(".film__frame");
  const tl = gsap.timeline({ scrollTrigger: { trigger: ".film", start: "top top", end: "+=" + frames.length * 80 + "%", pin: ".film__pin", scrub: .6 } });
  frames.forEach((f, i) => {
    tl.fromTo(f, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1 });
    if (i < frames.length - 1) tl.to(f, { autoAlpha: 0, y: -40, duration: 1 }, "+=.5");
  });
}

/* ---------- sound: equalizer + web-audio signature ---------- */
function sound() {
  const bars = gsap.utils.toArray("#soundEq span");
  const idle = () => bars.forEach((b, i) => gsap.to(b, { height: () => 15 + Math.random() * 70 + "%", duration: .4 + Math.random() * .5, repeat: -1, yoyo: true, ease: "sine.inOut", delay: i * .04 }));
  idle();
  let ctx;
  document.getElementById("soundBtn").addEventListener("click", () => {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const dur = 2.2, buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const t = i / d.length;
      const stat = t < .25 ? (Math.random() * 2 - 1) * .5 * (Math.random() > .97 ? 2 : .4) : 0;
      const swell = t >= .25 ? (Math.random() * 2 - 1) * Math.sin((t - .25) * Math.PI / .75) * .6 : 0;
      d[i] = stat + swell;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(2400, ctx.currentTime); f.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + dur);
    const g = ctx.createGain(); g.gain.value = .5;
    src.connect(f).connect(g).connect(ctx.destination); src.start();
    bars.forEach((b) => gsap.to(b, { height: () => 40 + Math.random() * 60 + "%", duration: .12, repeat: Math.floor(dur / .12), yoyo: true, ease: "none", overwrite: true, onComplete() { gsap.to(b, { height: () => 15 + Math.random() * 70 + "%", duration: .5, repeat: -1, yoyo: true, ease: "sine.inOut" }); } }));
  });
}

/* ---------- game: wipe static ---------- */
function game() {
  const card = document.getElementById("gameCard"), layer = document.getElementById("gameStatic");
  if (!card) return;
  const wipe = (x, y) => { const r = card.getBoundingClientRect(); const mx = ((x - r.left) / r.width) * 100, my = ((y - r.top) / r.height) * 100; const m = `radial-gradient(circle 130px at ${mx}% ${my}%, transparent 0 60%, black 100%)`; layer.style.webkitMaskImage = m; layer.style.maskImage = m; };
  card.addEventListener("mousemove", (e) => wipe(e.clientX, e.clientY));
  card.addEventListener("touchmove", (e) => { const t = e.touches[0]; wipe(t.clientX, t.clientY); }, { passive: true });
  card.addEventListener("mouseleave", () => { layer.style.webkitMaskImage = ""; layer.style.maskImage = ""; });
}

/* ---------- road progress ---------- */
function road() {
  gsap.to("#roadProgress", { height: "100%", ease: "none", scrollTrigger: { trigger: ".road__track", start: "top 70%", end: "bottom 60%", scrub: true } });
  gsap.utils.toArray(".road__step").forEach((s) => gsap.from(s, { opacity: 0, x: -30, duration: .6, ease: "power3.out", scrollTrigger: { trigger: s, start: "top 82%" } }));
}

/* ---------- tickets ---------- */
function tickets() {
  gsap.from("#ticketCta", { opacity: 0, y: 70, rotate: -6, duration: .9, ease: "back.out(1.3)", scrollTrigger: { trigger: ".tickets", start: "top 72%" } });
  gsap.from(".footer__word", { yPercent: 50, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: ".footer", start: "top 88%" } });
  const big = document.querySelector(".ticket__big");
  document.getElementById("ticketCta").addEventListener("click", () => {
    gsap.to(big, { duration: 1, scrambleText: { text: "Soon, habibi. Soon.", chars: CH, speed: .6 },
      onComplete() { gsap.to(big, { delay: 1.3, duration: 1, scrambleText: { text: "Get in the room", chars: CH, speed: .6 } }); } });
  });
}

/* ---------- countdown to showtime ---------- */
function countdown() {
  const target = new Date("2026-03-14T20:00:00+03:00").getTime();
  const elD = document.getElementById("cdD"), elH = document.getElementById("cdH"), elM = document.getElementById("cdM"), elS = document.getElementById("cdS");
  if (!elD) return;
  const pad = (n) => String(Math.max(0, n)).padStart(2, "0");
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) { elD.textContent = elH.textContent = elM.textContent = elS.textContent = "00"; return; }
    const d = Math.floor(diff / 864e5), h = Math.floor(diff % 864e5 / 36e5), m = Math.floor(diff % 36e5 / 6e4), s = Math.floor(diff % 6e4 / 1e3);
    elD.textContent = pad(d); elH.textContent = pad(h); elM.textContent = pad(m); elS.textContent = pad(s);
  }
  tick();
  setInterval(tick, 1000);
}

/* ---------- faq accordion ---------- */
function faq() {
  document.querySelectorAll(".faq__item").forEach((item) => {
    const q = item.querySelector(".faq__q"), a = item.querySelector(".faq__a");
    q.addEventListener("click", () => {
      const open = item.classList.contains("open");
      document.querySelectorAll(".faq__item.open").forEach((o) => { if (o !== item) { o.classList.remove("open"); gsap.to(o.querySelector(".faq__a"), { height: 0, duration: .4, ease: "power2.inOut" }); } });
      if (open) { item.classList.remove("open"); gsap.to(a, { height: 0, duration: .4, ease: "power2.inOut" }); }
      else { item.classList.add("open"); gsap.set(a, { height: "auto" }); gsap.from(a, { height: 0, duration: .45, ease: "power2.out" }); }
    });
  });
}

/* ---------- boot ---------- */
addEventListener("load", () => {
  preloader(() => {
    nav(); hero(); countdown(); marquee(); reveals(); movement(); cities(); rules(); lineup(); game(); faq(); tickets();
    ScrollTrigger.refresh();
  });
});
