/* global document, requestAnimationFrame, window, setInterval, clearInterval, URLSearchParams, Node, Math */
/*
  NZXT "Porcelain" Kraken Elite web integration.

  A soft neumorphic white face. Telemetry wiring matches the other faces: CAM
  loads the page with ?kraken=1 and calls window.nzxt.v1.onMonitoringDataUpdate;
  a browser shows a config card + simulated preview.

  Motion is deliberately calm and subtle: the progress arcs ease to their
  values, a soft light sheen drifts slowly across the surface, the scattered
  colour chips breathe, and the two slider thumbs bob gently.
*/

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }

  /* ---------- embossed background ridges + colour chips ---------- */

  const chips = [];

  function buildDecor() {
    const gg = $('grooves');
    // raised white ridges (embossed panels)
    const ridges = [
      [96, 150, 150, 15], [118, 232, 96, 13], [90, 300, 60, 12],
      [120, 432, 120, 14], [446, 138, 96, 13], [470, 210, 70, 12],
    ];
    for (const [x, y, w, h] of ridges) {
      svgEl('rect', { x, y, width: w, height: h, rx: h / 2, fill: '#f2f3f6', filter: 'url(#raised-sm)' }, gg);
    }
    // little grey dot pairs (subtle detail)
    for (const [x, y] of [[214, 250], [214, 412], [452, 300]]) {
      svgEl('circle', { cx: x, cy: y, r: 3, fill: '#cdd1d9' }, gg);
      svgEl('circle', { cx: x + 12, cy: y, r: 3, fill: '#dfe2e8' }, gg);
    }

    // scattered raised colour chips
    const g = $('chips');
    const defs = [
      { x: 196, y: 150, w: 32, h: 13, rot: -8, color: '#f5a623' },
      { x: 392, y: 150, w: 22, h: 11, rot: -10, color: '#f5a623' },
      { x: 442, y: 158, w: 30, h: 13, rot: -7, color: '#a78bfa' },
      { x: 128, y: 470, w: 28, h: 12, rot: -6, color: '#2dd4bf' },
      { x: 486, y: 470, w: 28, h: 13, rot: -8, color: '#fb923c' },
    ];
    for (const d of defs) {
      const el = svgEl('rect', {
        x: d.x, y: d.y, width: d.w, height: d.h, rx: 4, fill: d.color,
        filter: 'url(#raised-sm)', transform: `rotate(${d.rot} ${d.x + d.w / 2} ${d.y + d.h / 2})`,
      }, g);
      chips.push({ el, cx: d.x + d.w / 2, cy: d.y + d.h / 2, rot: d.rot, phase: Math.random() * 6.28, rate: 0.4 + Math.random() * 0.5 });
    }
  }

  /* ---------- eased progress arcs + numeric readouts ---------- */

  const arcs = {
    'cpu-arc':    { cur: 0, tgt: 0 },
    'gpu-arc':    { cur: 0, tgt: 0 },
    'ram-arc':    { cur: 0, tgt: 0 },
    'liquid-arc': { cur: 0, tgt: 0 },
    'power-arc':  { cur: 0, tgt: 0 },
  };

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

  /* ---------- animation loop ---------- */

  let lastT = 0;
  function animate(timeMs) {
    const t = timeMs / 1000;
    const dt = Math.min(t - lastT || 0.016, 0.05);
    lastT = t;

    // arcs ease toward their targets
    for (const [id, a] of Object.entries(arcs)) {
      a.cur += (a.tgt - a.cur) * (1 - Math.exp(-5 * dt));
      $(id).setAttribute('stroke-dasharray', `${(clamp(a.cur, 0, 1) * 100).toFixed(2)} 100`);
    }

    // numbers ease
    for (const [id, c] of Object.entries(counters)) {
      if (c.cur === null || c.tgt === null) continue;
      const diff = c.tgt - c.cur;
      if (Math.abs(diff) < 0.5) c.cur = c.tgt; else c.cur += diff * 0.12;
      setRawText(id, `${Math.round(c.cur)}`);
    }

    // soft light sheen drifts slowly
    $('sheen').setAttribute('cx', (300 + 90 * Math.sin(t * 0.16)).toFixed(1));
    $('sheen').setAttribute('cy', (250 + 70 * Math.cos(t * 0.12)).toFixed(1));

    // chips breathe (opacity + a hair of scale)
    for (const c of chips) {
      const b = 0.5 + 0.5 * Math.sin(t * c.rate + c.phase);
      const s = 1 + 0.06 * b;
      c.el.setAttribute('opacity', (0.78 + 0.22 * b).toFixed(3));
      c.el.setAttribute('transform', `rotate(${c.rot} ${c.cx} ${c.cy}) translate(${c.cx} ${c.cy}) scale(${s.toFixed(3)}) translate(${-c.cx} ${-c.cy})`);
    }

    // slider thumbs bob gently
    $('thumb-teal').setAttribute('y', (556 + 6 * Math.sin(t * 0.8)).toFixed(1));
    $('thumb-purple').setAttribute('y', (520 + 7 * Math.sin(t * 0.6 + 1.5)).toFixed(1));

    requestAnimationFrame(animate);
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

    return { liquid, cpuTemp, gpuTemp, ramPct: clamp(ramPct, 0, 100), power };
  }

  function update(v) {
    setTarget('cpu-value', v.cpuTemp);       arcs['cpu-arc'].tgt = v.cpuTemp / 100;
    setTarget('gpu-value', v.gpuTemp);        arcs['gpu-arc'].tgt = v.gpuTemp / 100;
    setTarget('ram-value', v.ramPct);         arcs['ram-arc'].tgt = v.ramPct / 100;
    setTarget('liquid-value', v.liquid);      arcs['liquid-arc'].tgt = v.liquid / 60;
    setTarget('power-value', v.power);        arcs['power-arc'].tgt = v.power / 500;
  }

  /* ---------- bootstrap ---------- */

  buildDecor();
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

  let t = 0;
  const demo = setInterval(() => {
    if (gotRealData) { clearInterval(demo); return; }
    t += 1;
    update(mapMonitoring({
      cpus: [{ temperature: 52 + 8 * Math.sin(t / 6), load: 0.4 + 0.3 * Math.sin(t / 4) }],
      gpus: [{ name: 'GeForce RTX', temperature: 38 + 6 * Math.cos(t / 7), load: 0.35 + 0.3 * Math.cos(t / 5) }],
      ram: { totalSize: 32768, inUse: 32768 * (0.18 + 0.06 * Math.sin(t / 8)) },
      kraken: { liquidTemperature: 32 + 2 * Math.sin(t / 9) },
    }));
  }, 1200);
})();
