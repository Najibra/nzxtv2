/* global document, requestAnimationFrame, window, setInterval, clearInterval, URLSearchParams, Node, Math */
/*
  NZXT "Spectra" Kraken Elite web integration.

  A music-visualizer face. A full-width mirrored equalizer of rainbow color bars
  rises and falls behind the readouts. Telemetry wiring matches the other faces:
  CAM loads the page with ?kraken=1 and calls
  window.nzxt.v1.onMonitoringDataUpdate; a browser shows a config card + sim.

  The bar motion is deliberately organic: each bar eases toward a target with a
  FAST attack and a SLOWER decay (the classic VU-meter feel), the target is a
  blend of a gently flowing spectrum wave and a per-bar random value refreshed at
  randomized intervals, and the whole thing's amplitude ("energy") tracks system
  load with a lively idle baseline. No uniform sine anywhere.
*/

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const lerp = (a, b, t) => a + (b - a) * t;

  const CX = 320, CY = 320;

  /* ---------- equalizer bars ---------- */

  const N = 48;
  const X0 = 40, X1 = 600;              // bar field horizontal span
  const PITCH = (X1 - X0) / N;
  const BAR_W = 7.4;
  const MIN_H = 5;

  const bars = [];

  // smoothstep for the envelope that dips in the centre (a valley for the text)
  const smooth = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }

  function buildBars() {
    const g = $('bars');
    for (let i = 0; i < N; i++) {
      const cx = X0 + (i + 0.5) * PITCH;
      const centerDist = Math.abs(cx - CX) / CX;            // 0 centre → ~0.9 edge
      // taller toward the sides, calm valley in the middle for the readouts
      const env = 0.30 + 0.70 * smooth(0.10, 0.60, centerDist);
      const maxH = 24 + env * 150;                          // ~24..174 px half-height
      // cool→warm rainbow across the field
      const hue = 200 + (i / (N - 1)) * 168;                // cyan → blue → violet → magenta → red
      const el = svgEl('rect', {
        x: (cx - BAR_W / 2).toFixed(1), y: CY - MIN_H,
        width: BAR_W, height: MIN_H * 2, rx: BAR_W / 2,
        fill: `hsl(${hue.toFixed(0)}, 90%, 58%)`,
      }, g);
      bars.push({
        el, cx, hue, maxH,
        h: MIN_H + Math.random() * 20,
        target: MIN_H,
        nextRefresh: Math.random() * 0.2,
        rnd: Math.random(),                                  // current random component
        // per-bar flowing-wave phases so neighbours correlate but nothing repeats
        p1: i * 0.34, p2: i * 0.71 + 1.3,
      });
    }
  }

  /* ---------- energy (amplitude) from system load ---------- */

  let energy = 0.55, energyTarget = 0.55;

  /* ---------- animation ---------- */

  const ATTACK = 22;   // fast rise (larger = snappier)
  const DECAY = 7;     // gentle fall

  let lastT = 0;
  function animate(timeMs) {
    const t = timeMs / 1000;
    const dt = Math.min(t - lastT || 0.016, 0.05);
    lastT = t;

    energy += (energyTarget - energy) * (1 - Math.exp(-3 * dt));

    for (const b of bars) {
      // refresh the per-bar random component at a randomised cadence (80–360 ms)
      if (t >= b.nextRefresh) {
        b.nextRefresh = t + 0.08 + Math.random() * 0.28;
        b.rnd = Math.pow(Math.random(), 1.7);              // skew low, occasional peaks
      }
      // gently flowing spectrum wave (two drifting components) in 0..1
      const wave = 0.5 + 0.35 * Math.sin(b.p1 + t * 1.6) + 0.15 * Math.sin(b.p2 - t * 1.05);
      const shaped = clamp(0.42 * wave + 0.58 * b.rnd, 0, 1);
      const target = MIN_H + shaped * energy * b.maxH;

      // fast attack, slow decay toward the target (frame-rate independent)
      const rate = target > b.h ? ATTACK : DECAY;
      b.h += (target - b.h) * (1 - Math.exp(-rate * dt));

      const hf = clamp((b.h - MIN_H) / b.maxH, 0, 1);        // height fraction
      b.el.setAttribute('y', (CY - b.h).toFixed(1));
      b.el.setAttribute('height', (b.h * 2).toFixed(1));
      // taller = brighter & more opaque, so peaks pop
      b.el.setAttribute('fill', `hsl(${b.hue.toFixed(0)}, 92%, ${(50 + hf * 22).toFixed(0)}%)`);
      b.el.setAttribute('opacity', (0.45 + 0.55 * hf).toFixed(2));
    }

    tickValues();
    requestAnimationFrame(animate);
  }

  /* ---------- eased numeric readouts ---------- */

  const counters = {
    'cpu-value':    { cur: null, tgt: null },
    'liquid-value': { cur: null, tgt: null },
    'gpu-value':    { cur: null, tgt: null },
    'ram-value':    { cur: null, tgt: null },
    'power-value':  { cur: null, tgt: null },
  };

  function setRawText(id, text) {
    const el = $(id);
    if (!el) return;
    if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) el.firstChild.nodeValue = text;
    else el.insertBefore(document.createTextNode(text), el.firstChild);
  }

  function setTarget(id, value) {
    const c = counters[id];
    if (!c) return;
    if (c.cur === null) { c.cur = value; c.tgt = value; setRawText(id, `${Math.round(value)}`); return; }
    c.tgt = value;
  }

  function tickValues() {
    for (const [id, c] of Object.entries(counters)) {
      if (c.cur === null || c.tgt === null) continue;
      const diff = c.tgt - c.cur;
      if (Math.abs(diff) < 0.5) c.cur = c.tgt; else c.cur += diff * 0.12;
      setRawText(id, `${Math.round(c.cur)}`);
    }
  }

  /* ---------- monitoring data mapping (with discrete-GPU picking) ---------- */

  const normLoad = (l) => (typeof l === 'number' ? (l > 1 ? l / 100 : l) : 0);
  const num = (...c) => c.find((x) => typeof x === 'number' && isFinite(x));

  const discreteGpuMatchers = [
    /nvidia/i, /geforce/i, /\brtx\b/i, /\bgtx\b/i, /\bquadro\b/i,
    /\bradeon\s+rx\b/i, /\bradeon\s+pro\b/i, /\brx\s*\d/i, /\barc\b/i,
  ];
  const integratedGpuMatchers = [
    /integrated/i, /\bintel\b/i, /\buhd\b/i, /\biris\b/i, /\bxe\b/i, /\bvega\b/i,
    /\bradeon\(tm\)\s+graphics\b/i, /\bradeon\s+graphics\b/i,
    /microsoft basic display/i, /virtual display/i,
  ];
  const gpuName = (g) => String(g.name || g.model || g.deviceName || g.displayName || g.adapter || '');
  function gpuScore(g) {
    const name = gpuName(g);
    const load = normLoad(num(g.load, g.usage, g.utilization, g.loadPercent, 0)) * 100;
    const temperature = num(g.temperature, g.temp, 0) || 0;
    const power = num(g.power, g.powerDraw, g.watts, 0) || 0;
    let s = 0;
    if (discreteGpuMatchers.some((m) => m.test(name))) s += 1000;
    if (integratedGpuMatchers.some((m) => m.test(name))) s -= 1000;
    if (temperature > 0) s += 80;
    if (power > 0) s += 80 + Math.min(power, 350);
    if (load > 0) s += Math.min(load, 100);
    return s;
  }
  function pickGpu(gpus) {
    if (!Array.isArray(gpus) || gpus.length === 0) return {};
    return [...gpus].sort((a, b) => gpuScore(b) - gpuScore(a))[0] || {};
  }

  function mapMonitoring(data) {
    const cpu = (data.cpus && data.cpus[0]) || {};
    const gpu = pickGpu(data.gpus);
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

    const cpuLoad = normLoad(cpu.load);
    const gpuLoad = normLoad(gpu.load);

    return { liquid, cpuTemp, gpuTemp, ramPct: clamp(ramPct, 0, 100), power, cpuLoad, gpuLoad };
  }

  function update(v) {
    setTarget('cpu-value', v.cpuTemp);
    setTarget('liquid-value', v.liquid);
    setTarget('gpu-value', v.gpuTemp);
    setTarget('ram-value', v.ramPct);
    setTarget('power-value', v.power);
    // drive equalizer energy from load (with a temperature fallback), lively idle floor
    const load = Math.max(v.cpuLoad, v.gpuLoad, clamp((v.cpuTemp - 30) / 55, 0, 1));
    energyTarget = clamp(0.45 + 0.55 * load, 0.45, 1);
  }

  /* ---------- bootstrap ---------- */

  buildBars();
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
      cpus: [{ temperature: 54 + 10 * Math.sin(t / 6), load: 0.45 + 0.35 * Math.sin(t / 3.5) }],
      gpus: [{ name: 'GeForce RTX', temperature: 48 + 8 * Math.cos(t / 7), load: 0.4 + 0.35 * Math.cos(t / 4) }],
      ram: { totalSize: 32768, inUse: 32768 * (0.35 + 0.12 * Math.sin(t / 8)) },
      kraken: { liquidTemperature: 33 + 3 * Math.sin(t / 9) },
    }));
  }, 1200);
})();
