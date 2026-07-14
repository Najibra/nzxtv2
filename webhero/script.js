/* global document, requestAnimationFrame, window, setInterval, clearInterval, URLSearchParams, Node, Math */
/*
  NZXT "Web Hero" Kraken Elite web integration.

  Comic spider-suit face. Telemetry wiring matches the other faces: CAM loads
  the page with ?kraken=1 and calls window.nzxt.v1.onMonitoringDataUpdate; a
  browser shows a config card + simulated preview.

  Signature animation: the two hexagon mask lenses are alive but SUBTLE — they
  blink at a natural randomized cadence (quick close, brief hold, slower reopen,
  with an occasional double-blink), squint a little when the CPU runs hot, and
  their rim glow breathes. The web line art shimmers very gently.
*/

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const CX = 320, CY = 320;

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }

  /* ---------- honeycomb lens fill ---------- */

  function buildHex(groupId, x0, y0, x1, y1) {
    const g = $(groupId);
    const r = 11;                       // hex radius (flat-top)
    const hstep = r * 1.5;              // column spacing
    const vstep = r * Math.sqrt(3);     // row spacing
    let col = 0;
    for (let cx = x0; cx <= x1 + r; cx += hstep, col++) {
      const yoff = (col % 2) * (vstep / 2);
      for (let cy = y0 + yoff; cy <= y1 + r; cy += vstep) {
        let d = '';
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k;   // flat-top hexagon
          const px = cx + r * Math.cos(a);
          const py = cy + r * Math.sin(a);
          d += (k ? ' L' : 'M') + ` ${px.toFixed(1)} ${py.toFixed(1)}`;
        }
        svgEl('path', { d: d + ' Z' }, g);
      }
    }
  }

  /* ---------- web line art ---------- */

  const webStrands = [];
  function buildWeb() {
    for (const side of ['web-left', 'web-right']) {
      const g = $(side);
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2;
        const x1 = CX + 40 * Math.cos(a), y1 = CY + 40 * Math.sin(a);
        const x2 = CX + 336 * Math.cos(a), y2 = CY + 336 * Math.sin(a);
        const el = svgEl('path', {
          d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`,
          'stroke-width': 1.2, opacity: 0.34,
        }, g);
        webStrands.push({ el, base: 0.34, phase: Math.random() * 6.28, rate: 0.3 + Math.random() * 0.5 });
      }
      for (let r = 78; r <= 336; r += 40) {
        const el = svgEl('circle', { cx: CX, cy: CY, r, 'stroke-width': 1.1, opacity: 0.26 }, g);
        webStrands.push({ el, base: 0.26, phase: Math.random() * 6.28, rate: 0.2 + Math.random() * 0.4 });
      }
    }
  }

  /* ---------- CPU tick ring (upper-right arc, like a speedo) ---------- */

  function buildCpuTicks() {
    const g = $('cpu-ticks');
    const cx = 320, cy = 330;
    for (let i = 0; i <= 26; i++) {
      const a = (-100 + (i / 26) * 190) * Math.PI / 180;  // top -> right -> bottom sweep
      const long = i % 4 === 0;
      const r1 = 95, r2 = long ? 82 : 88;
      svgEl('line', {
        x1: (cx + r1 * Math.cos(a)).toFixed(1), y1: (cy + r1 * Math.sin(a)).toFixed(1),
        x2: (cx + r2 * Math.cos(a)).toFixed(1), y2: (cy + r2 * Math.sin(a)).toFixed(1),
        'stroke-width': long ? 2.2 : 1.2, opacity: long ? 0.85 : 0.5,
      }, g);
    }
  }

  /* ---------- spider emblem ---------- */

  function buildSpider() {
    const g = $('spider');
    const body = svgEl('g', { fill: 'none', stroke: '#e11d2e', 'stroke-width': 3.2, 'stroke-linecap': 'round', opacity: 0.95 }, g);
    const legs = [
      'M -7 -8 C -22 -20, -34 -26, -44 -24', 'M -8 -3 C -26 -8, -40 -6, -50 2',
      'M -8 3 C -26 6, -38 14, -46 26',      'M -7 8 C -20 18, -28 28, -32 40',
      'M 7 -8 C 22 -20, 34 -26, 44 -24',     'M 8 -3 C 26 -8, 40 -6, 50 2',
      'M 8 3 C 26 6, 38 14, 46 26',          'M 7 8 C 20 18, 28 28, 32 40',
    ];
    for (const d of legs) svgEl('path', { d }, body);
    svgEl('ellipse', { cx: 0, cy: -10, rx: 6.5, ry: 8, fill: '#e11d2e' }, g);
    svgEl('path', { d: 'M 0 -3 C 9 0, 11 14, 0 30 C -11 14, -9 0, 0 -3 Z', fill: '#e11d2e' }, g);
  }

  /* ---------- eye blink state machine ---------- */

  const EYE_CY = 342;
  let blinkPhase = 'idle';
  let phaseStart = 0;
  let nextBlink = 1.6 + Math.random() * 2;
  let doublePending = false;
  let squint = 0, squintTarget = 0;
  const CLOSE_T = 0.09, HOLD_T = 0.07, OPEN_T = 0.18;

  function eyeScale(t) {
    let s = 1;
    if (blinkPhase === 'closing') {
      const k = clamp((t - phaseStart) / CLOSE_T, 0, 1);
      s = 1 - 0.94 * (k * k);
      if (k >= 1) { blinkPhase = 'closed'; phaseStart = t; }
    } else if (blinkPhase === 'closed') {
      s = 0.06;
      if (t - phaseStart >= HOLD_T) { blinkPhase = 'opening'; phaseStart = t; }
    } else if (blinkPhase === 'opening') {
      const k = clamp((t - phaseStart) / OPEN_T, 0, 1);
      s = 0.06 + 0.94 * (1 - (1 - k) * (1 - k));
      if (k >= 1) {
        blinkPhase = 'idle';
        if (doublePending) { doublePending = false; nextBlink = t + 0.18; }
        else { nextBlink = t + 3.2 + Math.random() * 4.3; }
      }
    } else if (t >= nextBlink) {
      blinkPhase = 'closing'; phaseStart = t; doublePending = Math.random() < 0.2;
    }
    return s;
  }

  let lastT = 0;
  function animate(timeMs) {
    const t = timeMs / 1000;
    const dt = Math.min(t - lastT || 0.016, 0.05);
    lastT = t;

    squint += (squintTarget - squint) * (1 - Math.exp(-2 * dt));
    const breathe = 0.985 + 0.015 * Math.sin(t * 0.7);
    const sy = eyeScale(t) * (1 - 0.2 * squint) * breathe;
    const eyes = $('eyes');
    eyes.setAttribute('transform', `translate(0 ${(EYE_CY * (1 - sy)).toFixed(2)}) scale(1 ${sy.toFixed(4)})`);

    for (let i = 0; i < webStrands.length; i += 2) {
      const w = webStrands[i];
      w.el.setAttribute('opacity', (w.base * (0.7 + 0.3 * Math.sin(t * w.rate + w.phase))).toFixed(3));
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

  function setArc(id, frac) {
    $(id).setAttribute('stroke-dasharray', `${(clamp(frac, 0, 1) * 100).toFixed(1)} 100`);
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
    setTarget('cpu-value', v.cpuTemp);       setArc('cpu-arc', v.cpuTemp / 100);
    setTarget('liquid-value', v.liquid);     setArc('liquid-arc', v.liquid / 60);
    setTarget('gpu-value', v.gpuTemp);       setArc('gpu-arc', v.gpuTemp / 100);
    setTarget('ram-value', v.ramPct);        setArc('ram-arc', v.ramPct / 100);
    setTarget('power-value', v.power);       setArc('power-arc', v.power / 500);
    squintTarget = clamp((v.cpuTemp - 60) / 30, 0, 1);
  }

  /* ---------- bootstrap ---------- */

  buildWeb();
  buildHex('hex-left', 44, 256, 216, 420);
  buildHex('hex-right', 424, 256, 596, 420);
  buildCpuTicks();
  buildSpider();
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
