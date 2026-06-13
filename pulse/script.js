/*
  NZXT "Pulse" Kraken Elite web integration.

  Original design. Telemetry wiring matches the other faces: inside NZXT CAM
  the page loads with ?kraken=1 and CAM calls
  window.nzxt.v1.onMonitoringDataUpdate with live data; in a normal browser a
  configuration card is shown and the dashboard runs on simulated data.

  Signature ideas:
   - Thermal accent: the accent colour warms from cyan (cool) to orange (hot)
     with CPU temperature, so the whole face "feels" the heat.
   - Heartbeat core: a halo behind the CPU number pulses, and the pulse rate
     rises with temperature (cool ≈ 55 bpm, hot ≈ 130 bpm).
   - Radial spectrum ring: bars breathe around the core, amplitude scaled by
     CPU load so the dashboard looks busier under heavy work.
   - Smooth eased counters with a glow flash whenever a value changes.
*/

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const lerp = (a, b, t) => a + (b - a) * t;

  // fixed pod accent colours (distinct so each reading reads at a glance)
  const COOL = '#5ad1ff', MEM = '#b694ff', PWR = '#ffd166';

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }

  // deterministic pseudo-random for a stable composition
  let seed = 91;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const CX = 320, CY = 320;

  /* ---------- thermal accent ---------- */

  // Map CPU temp to an HSL hue: cool cyan (~190°) down to hot orange/red (~12°)
  function tempColor(temp) {
    const k = clamp((temp - 35) / (82 - 35), 0, 1);
    const hue = lerp(190, 12, k);
    const sat = lerp(85, 95, k);
    const lit = lerp(62, 58, k);
    return `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${lit.toFixed(0)}%)`;
  }

  let accent = tempColor(45);
  const coreStops = [];      // gradient stops to recolour
  function applyAccent(color) {
    accent = color;
    document.documentElement.style.setProperty('--accent', color);
    // SVG attributes don't resolve CSS var(), so set these directly
    $('cpu-arc').setAttribute('stroke', color);
    $('gpu-arc').setAttribute('stroke', color);
    $('sweep').setAttribute('stroke', color);
    for (const s of coreStops) s.el.setAttribute('stop-color', color);
  }

  /* ---------- static colour init (attributes can't use CSS vars) ---------- */

  function initColors() {
    $('liquid-arc').setAttribute('stroke', COOL);
    $('ram-arc').setAttribute('stroke', MEM);
    $('power-arc').setAttribute('stroke', PWR);

    // recolour the core-grad stops live, so capture their elements
    const grad = $('core-grad');
    if (grad) {
      const stops = grad.querySelectorAll('stop');
      const ops = [0.55, 0.22, 0];
      stops.forEach((el, i) => {
        el.setAttribute('stop-opacity', ops[i]);
        coreStops.push({ el });
      });
    }
  }

  /* ---------- background: nebula, orbits, particles ---------- */

  function buildNebula() {
    const g = $('nebula');
    const blobs = [
      { color: '#1d6cff', r: 190, ox: -110, oy: -70 },
      { color: '#9b4dff', r: 170, ox: 130,  oy: 90 },
      { color: '#1fb6c9', r: 150, ox: 60,   oy: -150 },
    ];
    for (const b of blobs) {
      const el = svgEl('circle', { cx: CX + b.ox, cy: CY + b.oy, r: b.r, fill: b.color, opacity: 0.28 }, g);
      nebula.push({ el, ox: b.ox, oy: b.oy, phase: rnd() * Math.PI * 2, rate: 0.05 + rnd() * 0.06, span: 26 + rnd() * 22 });
    }
  }
  const nebula = [];

  function buildOrbits() {
    const g = $('orbits');
    const rings = [
      { r: 205, dash: '2 14', w: 1.2, op: 0.22, speed: 6 },
      { r: 246, dash: '2 22', w: 1.1, op: 0.16, speed: -4 },
      { r: 286, dash: '1.5 30', w: 1, op: 0.12, speed: 3 },
    ];
    for (const ring of rings) {
      const el = svgEl('circle', {
        cx: CX, cy: CY, r: ring.r,
        stroke: '#5e74b0', 'stroke-width': ring.w,
        'stroke-dasharray': ring.dash, opacity: ring.op,
      }, g);
      orbits.push({ el, speed: ring.speed, angle: rnd() * 360 });
    }
  }
  const orbits = [];

  function buildParticles() {
    const g = $('particles');
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 130 + rnd() * 175;
      const el = svgEl('circle', {
        cx: CX + r * Math.cos(a), cy: CY + r * Math.sin(a),
        r: (0.7 + rnd() * 1.6).toFixed(1),
      }, g);
      particles.push({ el, a, r, drift: (rnd() - 0.5) * 0.05, tw: 0.4 + rnd() * 1.6, base: 0.1 + rnd() * 0.4 });
    }
  }
  const particles = [];

  /* ---------- radial spectrum ring ---------- */

  const SPEC_INNER = 124, SPEC_N = 84;
  const specBars = [];
  function buildSpectrum() {
    const g = $('spectrum');
    for (let i = 0; i < SPEC_N; i++) {
      const ang = (i / SPEC_N) * Math.PI * 2;
      const el = svgEl('line', {
        x1: CX + SPEC_INNER * Math.cos(ang), y1: CY + SPEC_INNER * Math.sin(ang),
        x2: CX + SPEC_INNER * Math.cos(ang), y2: CY + SPEC_INNER * Math.sin(ang),
        stroke: accent, 'stroke-width': 2.6, opacity: 0.5,
      }, g);
      specBars.push({ el, ang, phase: (i / SPEC_N) * Math.PI * 6, jitter: 0.6 + rnd() * 0.8 });
    }
  }

  /* ---------- perimeter scanner sweep ---------- */

  function arcPath(r, a0deg, a1deg) {
    const a0 = (a0deg * Math.PI) / 180, a1 = (a1deg * Math.PI) / 180;
    const x0 = CX + r * Math.cos(a0), y0 = CY + r * Math.sin(a0);
    const x1 = CX + r * Math.cos(a1), y1 = CY + r * Math.sin(a1);
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  function initSweep() { $('sweep').setAttribute('d', arcPath(312, 0, 46)); }

  /* ---------- animation state ---------- */

  let lastT = 0;
  let cpuTempLive = 45, cpuLoadLive = 0.3;   // smoothed signals driving visuals

  function animate(timeMs) {
    const t = timeMs / 1000;
    const dt = Math.min(t - lastT, 0.1);
    lastT = t;

    // nebula drift (slow lissajous)
    for (const b of nebula) {
      b.el.setAttribute('cx', (CX + b.ox + Math.sin(t * b.rate + b.phase) * b.span).toFixed(1));
      b.el.setAttribute('cy', (CY + b.oy + Math.cos(t * b.rate * 0.8 + b.phase) * b.span).toFixed(1));
    }

    // orbit rings rotate
    for (const o of orbits) {
      o.angle += o.speed * dt;
      o.el.setAttribute('transform', `rotate(${o.angle.toFixed(2)} ${CX} ${CY})`);
    }

    // particles slow orbit + twinkle
    for (const p of particles) {
      p.a += p.drift * dt;
      p.el.setAttribute('cx', (CX + p.r * Math.cos(p.a)).toFixed(1));
      p.el.setAttribute('cy', (CY + p.r * Math.sin(p.a)).toFixed(1));
      p.el.setAttribute('opacity', (p.base * (0.5 + 0.5 * Math.sin(t * p.tw + p.a))).toFixed(2));
    }

    // spectrum bars — breathe; amplitude grows with CPU load
    const amp = 9 + cpuLoadLive * 26;
    for (const s of specBars) {
      const wave = 0.5 + 0.5 * Math.sin(t * 2.2 * s.jitter + s.phase);
      const len = 6 + amp * wave;
      const r2 = SPEC_INNER + len;
      s.el.setAttribute('x2', (CX + r2 * Math.cos(s.ang)).toFixed(1));
      s.el.setAttribute('y2', (CY + r2 * Math.sin(s.ang)).toFixed(1));
      s.el.setAttribute('stroke', accent);
      s.el.setAttribute('opacity', (0.3 + 0.55 * wave).toFixed(2));
    }

    // heartbeat core halo — pulse rate rises with temperature
    const bpm = lerp(55, 130, clamp((cpuTempLive - 35) / (82 - 35), 0, 1));
    const beat = t * (bpm / 60) * Math.PI * 2;
    // double-thump waveform (lub-dub) using two offset peaks
    const pulse = Math.max(Math.sin(beat), 0.55 * Math.sin(beat - 0.6));
    const scale = 1 + 0.10 * Math.max(pulse, 0);
    $('core-halo').setAttribute('transform', `translate(${CX} ${CY}) scale(${scale.toFixed(3)}) translate(${-CX} ${-CY})`);
    $('core-halo').setAttribute('opacity', (0.5 + 0.5 * Math.max(pulse, 0)).toFixed(2));

    // scanner sweep
    $('sweep').setAttribute('transform', `rotate(${(t * 30) % 360} ${CX} ${CY})`);

    // eased counters + glow flashes
    tickCounters();
    tickGlows(t);

    requestAnimationFrame(animate);
  }

  /* ---------- eased value counters with glow flash ---------- */

  const counters = {
    'cpu-value':    { cur: null, tgt: null, hasUnit: true,  fmt: (v) => `${Math.round(v)}` },
    'liquid-value': { cur: null, tgt: null, hasUnit: true,  fmt: (v) => `${Math.round(v)}` },
    'gpu-value':    { cur: null, tgt: null, hasUnit: true,  fmt: (v) => `${Math.round(v)}` },
    'ram-value':    { cur: null, tgt: null, hasUnit: true,  fmt: (v) => `${Math.round(v)}` },
    'power-value':  { cur: null, tgt: null, hasUnit: true,  fmt: (v) => `${Math.round(v)}` },
  };

  function setRawText(id, text) {
    const el = $(id);
    if (!el) return;
    // value text node is the first child; a <tspan> unit follows it
    if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
      el.firstChild.nodeValue = text;
    } else {
      el.insertBefore(document.createTextNode(text), el.firstChild);
    }
  }

  function tickCounters() {
    for (const [id, c] of Object.entries(counters)) {
      if (c.cur === null || c.tgt === null) continue;
      const diff = c.tgt - c.cur;
      if (Math.abs(diff) < 0.5) c.cur = c.tgt;
      else c.cur += diff * 0.12;
      setRawText(id, c.fmt(c.cur));
    }
  }

  const activeGlows = new Map();
  function pulseGlow(id) { activeGlows.set(id, lastT); }
  function tickGlows(t) {
    for (const [id, start] of activeGlows) {
      const el = $(id);
      const age = t - start;
      if (age > 0.7) { el.removeAttribute('filter'); activeGlows.delete(id); continue; }
      const intensity = Math.sin(Math.PI * age / 0.35) * (1 - age / 0.7);
      if (intensity > 0.05) el.setAttribute('filter', 'url(#glow-strong)');
      else el.removeAttribute('filter');
    }
  }

  function setTarget(id, value) {
    const c = counters[id];
    if (!c) return;
    if (c.cur === null) { c.cur = value; c.tgt = value; setRawText(id, c.fmt(value)); return; }
    if (Math.round(value) !== Math.round(c.cur)) pulseGlow(id);
    c.tgt = value;
  }

  function setArc(id, frac) {
    $(id).setAttribute('stroke-dasharray', `${(clamp(frac, 0, 1) * 100).toFixed(1)} 100`);
  }

  /* ---------- value updates ---------- */

  function update(v) {
    setTarget('cpu-value', v.cpuTemp);     setArc('cpu-arc', v.cpuTemp / 100);
    setTarget('liquid-value', v.liquid);   setArc('liquid-arc', v.liquid / 60);
    setTarget('gpu-value', v.gpuTemp);     setArc('gpu-arc', v.gpuTemp / 100);
    setTarget('ram-value', v.ramPct);      setArc('ram-arc', v.ramPct / 100);
    setTarget('power-value', v.power);     setArc('power-arc', v.power / 500);

    // ease the visual drivers toward the new readings
    cpuTempLive = lerp(cpuTempLive, v.cpuTemp, 0.25);
    cpuLoadLive = lerp(cpuLoadLive, clamp(v.cpuTemp / 90, 0, 1), 0.25);
    applyAccent(tempColor(cpuTempLive));
  }

  /* ---------- monitoring data mapping ---------- */

  const normLoad = (l) => (typeof l === 'number' ? (l > 1 ? l / 100 : l) : 0);
  const num = (...c) => c.find((x) => typeof x === 'number' && isFinite(x));

  function mapMonitoring(data) {
    const cpu = (data.cpus && data.cpus[0]) || {};
    const gpu = (data.gpus && data.gpus[0]) || {};
    const kraken = data.kraken || {};
    const ram = data.ram || {};

    const cpuTemp = num(cpu.temperature, 0);
    const gpuTemp = num(gpu.temperature, 0);
    const liquid = num(kraken.liquidTemperature, kraken.temperature, 0);

    let ramPct = 0;
    if (typeof ram.totalSize === 'number' && ram.totalSize > 0 && typeof ram.inUse === 'number') {
      ramPct = (ram.inUse / ram.totalSize) * 100;
    }

    const power = num(cpu.power, undefined) !== undefined || num(gpu.power, undefined) !== undefined
      ? (num(cpu.power, 0) + num(gpu.power, 0))
      : 40 + normLoad(cpu.load) * 140 + normLoad(gpu.load) * 280;

    return { liquid, cpuTemp, gpuTemp, ramPct: clamp(ramPct, 0, 100), power };
  }

  /* ---------- bootstrap ---------- */

  initColors();
  buildNebula();
  buildOrbits();
  buildParticles();
  buildSpectrum();
  initSweep();
  applyAccent(accent);
  requestAnimationFrame(animate);

  const params = new URLSearchParams(window.location.search);
  const isKraken = params.get('kraken') === '1';
  let gotRealData = false;

  window.nzxt = {
    v1: {
      ...(window.nzxt && window.nzxt.v1),
      onMonitoringDataUpdate: (data) => { gotRealData = true; update(mapMonitoring(data)); },
    },
  };

  if (isKraken) {
    document.body.classList.add('kraken');
  } else {
    const config = $('config');
    config.hidden = false;
    const input = $('share-url');
    const url = window.location.origin + window.location.pathname;
    input.value = `nzxt-cam://action/load-web-integration?url=${encodeURIComponent(url)}`;
    input.addEventListener('click', () => input.select());
  }

  // simulated telemetry until the first real CAM update
  let t = 0;
  const demo = setInterval(() => {
    if (gotRealData) { clearInterval(demo); return; }
    t += 1;
    update(mapMonitoring({
      cpus: [{ temperature: 52 + 14 * Math.sin(t / 6), load: 0.4 + 0.3 * Math.sin(t / 4) }],
      gpus: [{ temperature: 44 + 8 * Math.cos(t / 7), load: 0.35 + 0.3 * Math.cos(t / 5) }],
      ram: { totalSize: 32768, inUse: 32768 * (0.22 + 0.08 * Math.sin(t / 8)) },
      kraken: { liquidTemperature: 33 + 3 * Math.sin(t / 9) },
    }));
  }, 1200);
})();
