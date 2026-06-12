/*
  NZXT "Circuit" Kraken Elite web integration.

  Same telemetry wiring as the other Fluid Dynamics faces: inside NZXT CAM
  the page is loaded with ?kraken=1 and CAM calls
  window.nzxt.v1.onMonitoringDataUpdate with live data. In a normal browser a
  configuration card is shown and the dashboard runs on simulated data.

  The PCB traces are generated procedurally and electric sparks travel along
  them continuously, animated with requestAnimationFrame via dash offsets.
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

  // Deterministic pseudo-random so the board layout is stable between loads
  let seed = 23;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  /* ---------- glass modules ---------- */

  const PANELS = {
    liquid: { x: 222, y: 50, w: 196, h: 120, rx: 24 },
    cpu: { x: 210, y: 200, w: 220, h: 236, rx: 28 },
    gpu: { x: 56, y: 230, w: 130, h: 186, rx: 22 },
    ram: { x: 454, y: 230, w: 130, h: 186, rx: 22 },
    power: { x: 222, y: 466, w: 196, h: 118, rx: 22 },
  };

  function buildModules() {
    const g = $('modules');
    for (const p of Object.values(PANELS)) {
      svgEl('rect', {
        x: p.x - 6, y: p.y - 6, width: p.w + 12, height: p.h + 12,
        rx: p.rx + 7, class: 'glass-outer',
      }, g);
      svgEl('rect', { x: p.x, y: p.y, width: p.w, height: p.h, rx: p.rx, class: 'glass-inner' }, g);
      // corner screws
      for (const [cx, cy] of [
        [p.x + 15, p.y + 15], [p.x + p.w - 15, p.y + 15],
        [p.x + 15, p.y + p.h - 15], [p.x + p.w - 15, p.y + p.h - 15],
      ]) {
        svgEl('circle', { cx, cy, r: 4, class: 'screw' }, g);
        const a = rnd() * Math.PI;
        svgEl('line', {
          x1: cx - 2.4 * Math.cos(a), y1: cy - 2.4 * Math.sin(a),
          x2: cx + 2.4 * Math.cos(a), y2: cy + 2.4 * Math.sin(a),
          class: 'screw-slot',
        }, g);
      }
    }
  }

  /* ---------- procedural PCB traces ---------- */

  const DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const traceData = []; // { d, len } for spark routing

  // Manhattan-routed trace from a start point heading `dir`, 2-4 segments
  function routeTrace(x, y, dir) {
    let [dx, dy] = DIRS[dir];
    let d = `M ${x} ${y}`;
    let len = 0;
    const segs = 2 + Math.floor(rnd() * 3);
    for (let s = 0; s < segs; s++) {
      const step = 22 + rnd() * 58;
      x += dx * step;
      y += dy * step;
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      len += step;
      // turn 90° left or right
      [dx, dy] = rnd() > 0.5 ? [-dy, dx] : [dy, -dx];
    }
    return { d, len, endX: x, endY: y };
  }

  function buildTraces() {
    const traces = $('traces');
    const pads = $('pads');

    const anchors = [];
    for (const p of Object.values(PANELS)) {
      const n = 4;
      for (let i = 1; i <= n; i++) {
        anchors.push([p.x + (p.w * i) / (n + 1), p.y - 7, 'N']);
        anchors.push([p.x + (p.w * i) / (n + 1), p.y + p.h + 7, 'S']);
      }
      for (let i = 1; i <= 3; i++) {
        anchors.push([p.x - 7, p.y + (p.h * i) / 4, 'W']);
        anchors.push([p.x + p.w + 7, p.y + (p.h * i) / 4, 'E']);
      }
    }
    // free-floating traces in the outer ring area
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 240 + rnd() * 55;
      anchors.push([320 + r * Math.cos(a), 320 + r * Math.sin(a), pick(['N', 'S', 'E', 'W'])]);
    }

    for (const [x, y, dir] of anchors) {
      const t = routeTrace(x, y, dir);
      const style = rnd();
      const attrs = { d: t.d };
      if (style < 0.18) {
        attrs.stroke = '#fbbf24';
        attrs['stroke-width'] = 1.7;
        attrs.opacity = 0.85;
        attrs.filter = 'url(#soft-glow)';
      } else if (style < 0.5) {
        attrs.stroke = '#caa64a';
        attrs['stroke-width'] = 1.4;
        attrs.opacity = 0.6;
      } else {
        attrs.stroke = '#7a5a1a';
        attrs['stroke-width'] = 1.1;
        attrs.opacity = 0.5;
      }
      svgEl('path', attrs, traces);
      svgEl('circle', {
        cx: t.endX.toFixed(1), cy: t.endY.toFixed(1), r: 2.4,
        fill: '#caa64a', opacity: 0.7,
      }, pads);
      traceData.push(t);
    }
  }

  function buildDecor() {
    const g = $('pcb-decor');
    // vias
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 150 + rnd() * 150;
      svgEl('circle', {
        cx: (320 + r * Math.cos(a)).toFixed(1),
        cy: (320 + r * Math.sin(a)).toFixed(1),
        r: (1 + rnd() * 1.2).toFixed(1),
        fill: '#6b5520',
        opacity: (0.3 + rnd() * 0.4).toFixed(2),
      }, g);
    }
    // small chips with pin stubs
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 235 + rnd() * 55;
      const cx = 320 + r * Math.cos(a);
      const cy = 320 + r * Math.sin(a);
      const w = 18 + rnd() * 14;
      const h = 10 + rnd() * 8;
      const chip = svgEl('g', { opacity: 0.75 }, g);
      svgEl('rect', {
        x: (cx - w / 2).toFixed(1), y: (cy - h / 2).toFixed(1), width: w.toFixed(1), height: h.toFixed(1),
        rx: 1.5, fill: '#11100a', stroke: '#6b5520', 'stroke-width': 1,
      }, chip);
      for (let k = 1; k <= 3; k++) {
        const px = cx - w / 2 + (w * k) / 4;
        svgEl('line', { x1: px, y1: cy - h / 2 - 3, x2: px, y2: cy - h / 2, stroke: '#6b5520', 'stroke-width': 1 }, chip);
        svgEl('line', { x1: px, y1: cy + h / 2, x2: px, y2: cy + h / 2 + 3, stroke: '#6b5520', 'stroke-width': 1 }, chip);
      }
    }
  }

  /* ---------- electric spark animation ---------- */

  // Each spark is a bright dash sliding along a trace: dasharray = one short
  // dash + a gap the length of the wire, with the offset advanced every frame
  // (stroke-dashoffset is periodic, so the spark loops along its wire).
  const sparks = [];

  function buildSparks() {
    const g = $('sparks');
    const candidates = traceData.filter((t) => t.len > 90);
    for (let i = 0; i < 16 && candidates.length; i++) {
      const t = candidates.splice(Math.floor(rnd() * candidates.length), 1)[0];
      const dash = 12 + rnd() * 12;
      const el = svgEl('path', {
        d: t.d,
        'stroke-width': 2.2,
        'stroke-dasharray': `${dash.toFixed(1)} ${t.len.toFixed(1)}`,
      }, g);
      sparks.push({
        el,
        speed: 60 + rnd() * 130,
        offset: rnd() * (t.len + dash),
        flicker: 1 + rnd() * 5,
      });
    }
  }

  let lastT = 0;
  function animateSparks(timeMs) {
    const t = timeMs / 1000;
    const dt = Math.min(t - lastT, 0.1);
    lastT = t;
    for (const s of sparks) {
      s.offset -= s.speed * dt;
      s.el.setAttribute('stroke-dashoffset', s.offset.toFixed(1));
      s.el.setAttribute('opacity', (0.65 + 0.35 * Math.sin(t * s.flicker)).toFixed(2));
    }
    requestAnimationFrame(animateSparks);
  }

  /* ---------- value updates ---------- */

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
    setText('cpu-value', `${Math.round(v.cpuTemp)}°`);
    setText('gpu-value', `${Math.round(v.gpuTemp)}°`);
    setText('ram-value', `${Math.round(v.ramPct)}`);
    setText('power-value', `${Math.round(v.power)}`);
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

    let ramPct = 0;
    if (typeof ram.totalSize === 'number' && ram.totalSize > 0 && typeof ram.inUse === 'number') {
      ramPct = (ram.inUse / ram.totalSize) * 100;
    }

    // CAM does not expose total system power, so estimate it from CPU/GPU
    // package power when reported, otherwise from their loads.
    const power = num(cpu.power, undefined) !== undefined || num(gpu.power, undefined) !== undefined
      ? (num(cpu.power, 0) + num(gpu.power, 0))
      : 40 + normLoad(cpu.load) * 140 + normLoad(gpu.load) * 280;

    return { liquid, cpuTemp, gpuTemp, ramPct: clamp(ramPct, 0, 100), power };
  }

  /* ---------- bootstrap ---------- */

  buildDecor();
  buildTraces();
  buildModules();
  buildSparks();
  requestAnimationFrame(animateSparks);

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
    update(mapMonitoring({
      cpus: [{ temperature: 55 + 6 * Math.sin(t / 5), load: 0.35 + 0.25 * Math.sin(t / 4) }],
      gpus: [{ temperature: 39 + 4 * Math.cos(t / 6), load: 0.3 + 0.25 * Math.cos(t / 5) }],
      ram: { totalSize: 32768, inUse: 32768 * (0.18 + 0.05 * Math.sin(t / 8)) },
      kraken: { liquidTemperature: 32 + 1.5 * Math.sin(t / 7) },
    }));
  }, 1000);
})();
