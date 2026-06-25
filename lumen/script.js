/* global document, requestAnimationFrame, window, setInterval, clearInterval, URLSearchParams, Node */
/*
  NZXT "Lumen" Kraken Elite web integration.

  Telemetry wiring matches the other faces: inside NZXT CAM the page loads with
  ?kraken=1 and CAM calls window.nzxt.v1.onMonitoringDataUpdate; in a normal
  browser a configuration card is shown and the dashboard runs on simulated
  data.

  Motion is intentionally restrained: values ease toward their targets, the
  load ring sweeps smoothly with a softly breathing leading dot, and a faint
  sheen rotates slowly around the ring like light catching polished metal.
*/

(() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const CX = 320, CY = 320, R = 300;

  /* ---------- sheen arc geometry ---------- */

  function arcPath(r, a0deg, a1deg) {
    const a0 = (a0deg * Math.PI) / 180, a1 = (a1deg * Math.PI) / 180;
    const x0 = CX + r * Math.cos(a0), y0 = CY + r * Math.sin(a0);
    const x1 = CX + r * Math.cos(a1), y1 = CY + r * Math.sin(a1);
    const large = Math.abs(a1deg - a0deg) > 180 ? 1 : 0;
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  $('sheen').setAttribute('d', arcPath(R, 0, 34));

  /* ---------- eased counters ---------- */

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
    if (el.firstChild && el.firstChild.nodeType === Node.TEXT_NODE) {
      el.firstChild.nodeValue = text;
    } else {
      el.insertBefore(document.createTextNode(text), el.firstChild);
    }
  }

  function setTarget(id, value) {
    const c = counters[id];
    if (!c) return;
    if (c.cur === null) { c.cur = value; c.tgt = value; setRawText(id, `${Math.round(value)}`); return; }
    c.tgt = value;
  }

  // load ring fraction (CPU temp / 100), eased separately for a smooth sweep
  let loadCur = 0, loadTgt = 0;

  function tickValues() {
    for (const [id, c] of Object.entries(counters)) {
      if (c.cur === null || c.tgt === null) continue;
      const diff = c.tgt - c.cur;
      if (Math.abs(diff) < 0.5) c.cur = c.tgt;
      else c.cur += diff * 0.1;
      setRawText(id, `${Math.round(c.cur)}`);
    }
    loadCur += (loadTgt - loadCur) * 0.08;
  }

  /* ---------- animation loop ---------- */

  function animate(timeMs) {
    const t = timeMs / 1000;
    tickValues();

    // load ring + leading dot
    const frac = clamp(loadCur, 0, 1);
    $('load-arc').setAttribute('stroke-dasharray', `${(frac * 100).toFixed(2)} 100`);
    const ang = (-90 + frac * 360) * Math.PI / 180;
    $('load-dot').setAttribute('cx', (CX + R * Math.cos(ang)).toFixed(1));
    $('load-dot').setAttribute('cy', (CY + R * Math.sin(ang)).toFixed(1));
    $('load-dot').setAttribute('opacity', (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.6))).toFixed(2));

    // slow rotating sheen
    $('sheen').setAttribute('transform', `rotate(${((t * 14) % 360).toFixed(2)} ${CX} ${CY})`);

    requestAnimationFrame(animate);
  }

  /* ---------- value updates ---------- */

  function update(v) {
    setTarget('cpu-value', v.cpuTemp);
    setTarget('liquid-value', v.liquid);
    setTarget('gpu-value', v.gpuTemp);
    setTarget('ram-value', v.ramPct);
    setTarget('power-value', v.power);
    loadTgt = clamp(v.cpuTemp / 100, 0, 1);
  }

  /* ---------- monitoring data mapping ---------- */

  const normLoad = (l) => (typeof l === 'number' ? (l > 1 ? l / 100 : l) : 0);
  const num = (...c) => c.find((x) => typeof x === 'number' && isFinite(x));

  const discreteGpuMatchers = [
    /nvidia/i,
    /geforce/i,
    /\brtx\b/i,
    /\bgtx\b/i,
    /\bquadro\b/i,
    /\bradeon\s+rx\b/i,
    /\bradeon\s+pro\b/i,
    /\brx\s*\d/i,
    /\barc\b/i,
  ];
  const integratedGpuMatchers = [
    /integrated/i,
    /\bintel\b/i,
    /\buhd\b/i,
    /\biris\b/i,
    /\bxe\b/i,
    /\bvega\b/i,
    /\bradeon\(tm\)\s+graphics\b/i,
    /\bradeon\s+graphics\b/i,
    /microsoft basic display/i,
    /virtual display/i,
  ];

  function gpuName(gpu) {
    return String(gpu.name || gpu.model || gpu.deviceName || gpu.displayName || gpu.adapter || '');
  }

  function gpuScore(gpu) {
    const name = gpuName(gpu);
    const load = normLoad(num(gpu.load, gpu.usage, gpu.utilization, gpu.loadPercent, 0)) * 100;
    const temperature = num(gpu.temperature, gpu.temp, 0) || 0;
    const power = num(gpu.power, gpu.powerDraw, gpu.watts, 0) || 0;
    let score = 0;

    if (discreteGpuMatchers.some((matcher) => matcher.test(name))) score += 1000;
    if (integratedGpuMatchers.some((matcher) => matcher.test(name))) score -= 1000;
    if (temperature > 0) score += 80;
    if (power > 0) score += 80 + Math.min(power, 350);
    if (load > 0) score += Math.min(load, 100);

    return score;
  }

  function pickGpu(gpus) {
    if (!Array.isArray(gpus) || gpus.length === 0) return {};
    const scored = [...gpus].sort((a, b) => gpuScore(b) - gpuScore(a));
    return scored[0] || {};
  }

  function mapMonitoring(data) {
    const cpu = (data.cpus && data.cpus[0]) || {};
    const gpu = pickGpu(data.gpus);
    const kraken = data.kraken || {};
    const ram = data.ram || {};
    window.__nzxtLumenGpuSelection = {
      selected: gpuName(gpu),
      candidates: Array.isArray(data.gpus)
        ? data.gpus.map((candidate) => ({
            name: gpuName(candidate),
            score: gpuScore(candidate),
            temperature: num(candidate.temperature, candidate.temp, 0) || 0,
            power: num(candidate.power, candidate.powerDraw, candidate.watts, 0) || 0,
            load: normLoad(num(candidate.load, candidate.usage, candidate.utilization, candidate.loadPercent, 0)) * 100,
          }))
        : [],
    };

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
      cpus: [{ temperature: 48 + 9 * Math.sin(t / 6), load: 0.35 + 0.25 * Math.sin(t / 4) }],
      gpus: [{ temperature: 42 + 6 * Math.cos(t / 7), load: 0.3 + 0.25 * Math.cos(t / 5) }],
      ram: { totalSize: 32768, inUse: 32768 * (0.2 + 0.06 * Math.sin(t / 8)) },
      kraken: { liquidTemperature: 31 + 2 * Math.sin(t / 9) },
    }));
  }, 1200);
})();
