/*
  NZXT "Fluid Dynamics — Aurora" Kraken Elite web integration.

  Same telemetry wiring as the original Fluid Dynamics face: inside NZXT CAM
  the page is loaded with ?kraken=1 and CAM calls
  window.nzxt.v1.onMonitoringDataUpdate with live data. In a normal browser a
  configuration card is shown and the dashboard runs on simulated data.

  The cyan (left) and magenta (right) energy beams are animated continuously
  with requestAnimationFrame.
*/

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const CYAN = '#67e8f9';
  const MAGENTA = '#e879f9';

  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }

  /* ---------- geometry helpers (angles in degrees, y axis down, 0° = east) ---------- */

  const CX = 320;
  const CY = 320;

  function pt(r, a) {
    const rad = (a * Math.PI) / 180;
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  }

  function arcPath(r, a0, a1) {
    const [x0, y0] = pt(r, a0);
    const [x1, y1] = pt(r, a1);
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  /* ---------- static decoration: outer arcs, curved labels, dots ---------- */

  function buildOuter() {
    $('arc-tl').setAttribute('d', arcPath(308, 198, 252));
    $('arc-tr').setAttribute('d', arcPath(308, 288, 342));
    $('arc-bl').setAttribute('d', arcPath(308, 158, 112));
    $('arc-br').setAttribute('d', arcPath(308, 68, 22));

    // Curved label baselines. Top labels run clockwise (glyphs point outward);
    // bottom labels run counter-clockwise so they stay readable.
    $('lbl-tl').setAttribute('d', arcPath(288, 192, 258));
    $('lbl-tr').setAttribute('d', arcPath(288, 282, 348));
    $('lbl-bl').setAttribute('d', arcPath(302, 160, 110));
    $('lbl-br').setAttribute('d', arcPath(302, 70, 20));

    const dots = { 'dot-tl': 193, 'dot-tr': 347, 'dot-bl': 163, 'dot-br': 17 };
    for (const [id, a] of Object.entries(dots)) {
      const [x, y] = pt(308, a);
      $(id).setAttribute('cx', x.toFixed(2));
      $(id).setAttribute('cy', y.toFixed(2));
    }
  }

  /* ---------- bottom bar icon details ---------- */

  function buildControlIcons() {
    const rays = $('sun-rays');
    for (let i = 0; i < 8; i++) {
      const a = (i * 45 * Math.PI) / 180;
      svgEl('line', {
        x1: 268 + 8.5 * Math.cos(a), y1: 591 + 8.5 * Math.sin(a),
        x2: 268 + 11 * Math.cos(a), y2: 591 + 11 * Math.sin(a),
      }, rays);
    }
    const teeth = $('gear-teeth');
    for (let i = 0; i < 8; i++) {
      const a = ((i * 45 + 22.5) * Math.PI) / 180;
      svgEl('line', {
        x1: 372 + 6 * Math.cos(a), y1: 591 + 6 * Math.sin(a),
        x2: 372 + 9 * Math.cos(a), y2: 591 + 9 * Math.sin(a),
      }, teeth);
    }
  }

  /* ---------- ambient particles ---------- */

  function buildParticles(rnd) {
    const g = $('particles');
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 120 + rnd() * 170;
      svgEl('circle', {
        cx: (CX + r * Math.cos(a)).toFixed(1),
        cy: (CY + r * Math.sin(a)).toFixed(1),
        r: (0.8 + rnd() * 1.6).toFixed(1),
        opacity: (0.1 + rnd() * 0.35).toFixed(2),
      }, g);
    }
  }

  /* ---------- animated aurora beams ---------- */

  // Each beam is a polyline recomputed every frame: a vertical ribbon whose
  // horizontal offset is a sum of two drifting sine waves, faded in and out
  // at the ends with a sin(pi*t) envelope.
  const beams = [];

  function buildBeams(rnd) {
    const sharp = $('beams');
    const haze = $('beams-haze');

    for (const side of [-1, 1]) {
      const grad = side < 0 ? 'url(#beam-cyan)' : 'url(#beam-magenta)';
      const baseX = 320 + side * 240;
      for (let i = 0; i < 8; i++) {
        const beam = {
          baseX,
          drift: (rnd() - 0.5) * 44,
          amp1: 12 + rnd() * 26,
          freq1: 0.010 + rnd() * 0.014,
          speed1: (0.25 + rnd() * 0.6) * (rnd() > 0.5 ? 1 : -1),
          amp2: 4 + rnd() * 10,
          freq2: 0.03 + rnd() * 0.03,
          speed2: (0.5 + rnd() * 1.2) * (rnd() > 0.5 ? 1 : -1),
          breathe: 0.15 + rnd() * 0.5,
          baseOpacity: 0.5 + rnd() * 0.4,
          el: svgEl('path', { stroke: grad, 'stroke-width': (1.2 + rnd() * 1.8).toFixed(1) }, sharp),
          // every second beam also gets a wide hazy twin for the glow wash
          hazeEl: i % 2 === 0
            ? svgEl('path', { stroke: grad, 'stroke-width': 11, opacity: 0.55 }, haze)
            : null,
        };
        beams.push(beam);
      }
    }
  }

  function animateBeams(timeMs) {
    const t = timeMs / 1000;
    for (const b of beams) {
      let d = '';
      for (let y = 110; y <= 530; y += 12) {
        const k = (y - 110) / 420;
        const envelope = Math.sin(Math.PI * k);
        const x = b.baseX
          + b.drift * k
          + Math.sin(y * b.freq1 + t * b.speed1) * b.amp1 * envelope
          + Math.sin(y * b.freq2 + t * b.speed2) * b.amp2 * envelope;
        d += (d ? ' L' : 'M') + ` ${x.toFixed(1)} ${y}`;
      }
      b.el.setAttribute('d', d);
      const op = b.baseOpacity * (0.75 + 0.25 * Math.sin(t * b.breathe * Math.PI));
      b.el.setAttribute('opacity', op.toFixed(2));
      if (b.hazeEl) b.hazeEl.setAttribute('d', d);
    }
    requestAnimationFrame(animateBeams);
  }

  /* ---------- stat pills ---------- */

  const ICONS = {
    pump: (g, c) => {
      svgEl('circle', { r: 5, fill: 'none', stroke: c, 'stroke-width': 1.5 }, g);
      svgEl('circle', { r: 1.6, fill: c }, g);
      svgEl('line', { x1: 0, y1: -5, x2: 0, y2: -7.5, stroke: c, 'stroke-width': 1.5, 'stroke-linecap': 'round' }, g);
    },
    fan: (g, c) => {
      for (let i = 0; i < 6; i++) {
        const a = (i * 60 * Math.PI) / 180;
        svgEl('line', {
          x1: 1.5 * Math.cos(a), y1: 1.5 * Math.sin(a),
          x2: 6.5 * Math.cos(a), y2: 6.5 * Math.sin(a),
          stroke: c, 'stroke-width': 1.8, 'stroke-linecap': 'round',
        }, g);
      }
    },
    drop: (g, c) => {
      svgEl('path', {
        d: 'M 0 -6.5 C 3.5 -2 5 0.5 5 3 A 5 5 0 0 1 -5 3 C -5 0.5 -3.5 -2 0 -6.5 Z',
        fill: c,
      }, g);
    },
    bolt: (g, c) => {
      svgEl('path', { d: 'M 1.5 -7 L -4 1 L -0.5 1 L -1.5 7 L 4 -1 L 0.5 -1 Z', fill: c }, g);
    },
    pulse: (g, c) => {
      svgEl('path', {
        d: 'M -7 0 H -3.5 L -1.5 -5 L 1.5 5 L 3.5 0 H 7',
        fill: 'none', stroke: c, 'stroke-width': 1.6,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }, g);
    },
    flower: (g, c) => {
      for (let i = 0; i < 6; i++) {
        const a = (i * 60 * Math.PI) / 180;
        svgEl('circle', { cx: 3.8 * Math.cos(a), cy: 3.8 * Math.sin(a), r: 2.1, fill: c }, g);
      }
      svgEl('circle', { r: 1.8, fill: '#0b0e18' }, g);
    },
  };

  function buildPill(parent, x, y, icon, label, valueId, unit, accent) {
    const w = 120;
    const h = 38;
    svgEl('rect', { x, y, width: w, height: h, rx: h / 2, class: 'pill-bg' }, parent);
    svgEl('circle', { cx: x + 21, cy: y + h / 2, r: 13, class: 'pill-icon-bg' }, parent);
    const iconG = svgEl('g', { transform: `translate(${x + 21} ${y + h / 2})` }, parent);
    ICONS[icon](iconG, accent);
    const tx = x + 41;
    svgEl('text', { x: tx, y: y + 14, class: 'pill-label' }, parent).textContent = label;
    const value = svgEl('text', { x: tx, y: y + 31, class: 'pill-value' }, parent);
    const num = svgEl('tspan', { id: valueId }, value);
    num.textContent = '--';
    svgEl('tspan', { dx: 3, class: 'pill-unit' }, value).textContent = unit;
  }

  function buildPills() {
    const left = $('pills-left');
    buildPill(left, 86, 386, 'pump', 'PUMP', 'pump-value', 'RPM', CYAN);
    buildPill(left, 86, 430, 'fan', 'FAN SPEED', 'fan-value', 'RPM', CYAN);
    buildPill(left, 86, 474, 'drop', 'FLOW RATE', 'flow-value', 'L/M', CYAN);

    const right = $('pills-right');
    buildPill(right, 434, 386, 'bolt', 'VOLTAGE', 'volt-value', 'V', MAGENTA);
    buildPill(right, 434, 430, 'pulse', 'CURRENT', 'curr-value', 'A', MAGENTA);
    buildPill(right, 434, 474, 'flower', 'EFFICIENCY', 'eff-value', '%', MAGENTA);
  }

  /* ---------- gauge + value updates ---------- */

  // Each gauge shows `fraction` of `span` percent of its ring
  function setArc(id, fraction, span) {
    const visible = clamp(fraction, 0, 1) * span;
    $(id).setAttribute('stroke-dasharray', `${visible.toFixed(1)} ${(100 - visible).toFixed(1)}`);
  }

  function setText(id, text) {
    const el = $(id);
    if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
      el.firstChild.nodeValue = text;
    } else {
      el.textContent = text;
    }
  }

  function update(v) {
    setText('liquid-value', `${Math.round(v.liquid)}°`);
    setArc('liquid-arc', v.liquid / 60, 72);

    setText('cpu-value', `${Math.round(v.cpuTemp)}°`);
    setArc('cpu-arc', v.cpuTemp / 100, 78);

    setText('gpu-value', `${Math.round(v.gpuTemp)}°`);
    setArc('gpu-arc', v.gpuTemp / 100, 72);

    setText('ram-value', `${Math.round(v.ramPct)}%`);
    setArc('ram-arc', v.ramPct / 100, 72);

    setText('power-value', `${Math.round(v.power)}`);
    setArc('power-arc', v.power / 500, 72);

    setText('pump-value', `${Math.round(v.pump)}`);
    setText('fan-value', `${Math.round(v.fan)}`);
    setText('flow-value', v.flow.toFixed(2));
    setText('volt-value', v.voltage.toFixed(2));
    setText('curr-value', v.current.toFixed(2));
    setText('eff-value', `${Math.round(v.efficiency)}`);
  }

  /* ---------- monitoring data mapping ---------- */

  // CAM reports load either as 0..1 or 0..100 depending on version
  const normLoad = (l) => (typeof l === 'number' ? (l > 1 ? l / 100 : l) : 0);
  const num = (...candidates) => candidates.find((c) => typeof c === 'number' && isFinite(c));

  function mapMonitoring(data) {
    const cpu = (data.cpus && data.cpus[0]) || {};
    const gpu = (data.gpus && data.gpus[0]) || {};
    const kraken = data.kraken || {};
    const ram = data.ram || {};

    const cpuTemp = num(cpu.temperature, 0);
    const gpuTemp = num(gpu.temperature, 0);
    const liquid = num(kraken.liquidTemperature, kraken.temperature, 0);
    const pump = num(kraken.pumpRpm, kraken.pumpSpeed, cpu.fanSpeed, 0);
    const fan = num(kraken.fanRpm, kraken.fanSpeed, gpu.fanSpeed, 0);

    let ramPct = 0;
    if (typeof ram.totalSize === 'number' && ram.totalSize > 0 && typeof ram.inUse === 'number') {
      ramPct = (ram.inUse / ram.totalSize) * 100;
    }

    // CAM does not expose PSU telemetry or coolant flow, so these are
    // estimates derived from the data that is available.
    const power = num(cpu.power, undefined) !== undefined || num(gpu.power, undefined) !== undefined
      ? (num(cpu.power, 0) + num(gpu.power, 0))
      : 40 + normLoad(cpu.load) * 140 + normLoad(gpu.load) * 280;
    const voltage = 12 + Math.min(power, 600) * 0.0004;
    const current = voltage > 0 ? power / voltage : 0;
    const flow = (pump / 2850) * 2.45;
    const efficiency = clamp(95 - power * 0.012 - Math.max(0, liquid - 30) * 0.4, 60, 99);

    return { liquid, cpuTemp, gpuTemp, ramPct, pump, fan, flow, voltage, current, power, efficiency };
  }

  /* ---------- clock ---------- */

  function tickClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    setText('clock-time', `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    setText('clock-date', now
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      .toUpperCase());
  }

  /* ---------- bootstrap ---------- */

  // Deterministic pseudo-random so the composition is stable between loads
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  buildOuter();
  buildControlIcons();
  buildParticles(rnd);
  buildBeams(rnd);
  buildPills();
  tickClock();
  setInterval(tickClock, 1000);
  requestAnimationFrame(animateBeams);

  const params = new URLSearchParams(window.location.search);
  const isKraken = params.get('kraken') === '1';
  let gotRealData = false;

  // Register the CAM hook, preserving anything CAM may have injected
  window.nzxt = {
    v1: {
      ...(window.nzxt && window.nzxt.v1),
      onMonitoringDataUpdate: (data) => {
        gotRealData = true;
        update(mapMonitoring(data));
      },
    },
  };

  if (isKraken) {
    document.body.classList.add('kraken');
  } else {
    // Browser mode: show the configuration card with the share link
    const config = $('config');
    config.hidden = false;
    const input = $('share-url');
    const url = window.location.origin + window.location.pathname;
    input.value = `nzxt-cam://action/load-web-integration?url=${encodeURIComponent(url)}`;
    input.addEventListener('click', () => input.select());
  }

  // Simulated telemetry, centred on the reference design's numbers. Runs
  // until the first real CAM update arrives, then stops.
  let t = 0;
  const demo = setInterval(() => {
    if (gotRealData) {
      clearInterval(demo);
      return;
    }
    t += 1;
    const cpuLoad = 0.35 + 0.25 * Math.sin(t / 4);
    const gpuLoad = 0.3 + 0.25 * Math.cos(t / 5);
    update(mapMonitoring({
      cpus: [{
        temperature: 55 + 6 * Math.sin(t / 5),
        load: cpuLoad,
        frequency: 4500,
        fanSpeed: 2850 + 120 * Math.sin(t / 3),
      }],
      gpus: [{
        temperature: 39 + 4 * Math.cos(t / 6),
        load: gpuLoad,
        frequency: 1900,
        fanSpeed: 1200 + 90 * Math.cos(t / 4),
      }],
      ram: { totalSize: 32768, inUse: 32768 * (0.18 + 0.05 * Math.sin(t / 8)) },
      kraken: {
        liquidTemperature: 32 + 1.5 * Math.sin(t / 7),
        pumpRpm: 2850 + 120 * Math.sin(t / 3),
        fanRpm: 1200 + 90 * Math.cos(t / 4),
      },
    }));
  }, 1000);
})();
