/* global document, window, requestAnimationFrame, setInterval, clearInterval, URLSearchParams, performance */

(() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const finite = (...values) => values.find((value) => typeof value === 'number' && Number.isFinite(value));
  const DISCRETE_GPU = [/nvidia/i, /geforce/i, /\brtx\b/i, /\bgtx\b/i, /quadro/i, /radeon\s+rx/i, /radeon\s+pro/i, /\brx\s*\d/i, /\barc\b/i];
  const INTEGRATED_GPU = [/integrated/i, /\bintel\b/i, /\buhd\b/i, /\biris\b/i, /\bxe\b/i, /\bvega\b/i, /radeon\(tm\)\s+graphics/i, /radeon\s+graphics/i, /microsoft basic display/i, /virtual display/i];

  const normalizeLoad = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return clamp(value > 1 ? value : value * 100, 0, 100);
  };

  const gpuName = (gpu) => String(gpu?.name || gpu?.model || gpu?.deviceName || gpu?.displayName || gpu?.adapter || '');

  function gpuScore(gpu) {
    const name = gpuName(gpu);
    let score = 0;
    if (DISCRETE_GPU.some((matcher) => matcher.test(name))) score += 1000;
    if (INTEGRATED_GPU.some((matcher) => matcher.test(name))) score -= 1000;
    if ((finite(gpu?.temperature, gpu?.temp, 0) || 0) > 0) score += 80;
    if ((finite(gpu?.power, gpu?.powerDraw, gpu?.watts, 0) || 0) > 0) score += 120;
    return score + normalizeLoad(finite(gpu?.load, gpu?.usage, gpu?.utilization, gpu?.loadPercent, 0) || 0);
  }

  function pickDiscreteGpu(gpus) {
    if (!Array.isArray(gpus) || !gpus.length) return {};
    return [...gpus].sort((a, b) => gpuScore(b) - gpuScore(a))[0] || {};
  }

  function toGb(value) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value > 1024 * 1024 * 64) return value / (1024 ** 3);
    return value / 1024;
  }

  function mapMonitoring(data) {
    const cpu = Array.isArray(data?.cpus) ? data.cpus[0] || {} : data?.cpu || {};
    const gpu = pickDiscreteGpu(data?.gpus);
    const ram = data?.ram || {};
    const kraken = data?.kraken || {};
    const totalRam = finite(ram.totalSize, ram.total, 0) || 0;
    const usedRam = finite(ram.inUse, ram.used, 0) || 0;
    const cpuLoad = normalizeLoad(finite(cpu.load, cpu.usage, cpu.utilization, 0) || 0);
    const gpuLoad = normalizeLoad(finite(gpu.load, gpu.usage, gpu.utilization, gpu.loadPercent, 0) || 0);
    const cpuPower = finite(cpu.power, cpu.powerDraw, cpu.watts);
    const gpuPower = finite(gpu.power, gpu.powerDraw, gpu.watts);
    const powerAvailable = cpuPower !== undefined || gpuPower !== undefined;

    window.__nzxtMonolithGpuSelection = {
      selected: gpuName(gpu),
      candidates: Array.isArray(data?.gpus) ? data.gpus.map((candidate) => ({ name: gpuName(candidate), score: gpuScore(candidate) })) : [],
    };

    return {
      cpuTemp: finite(cpu.temperature, cpu.temp, 0) || 0,
      cpuLoad,
      gpuTemp: finite(gpu.temperature, gpu.temp, 0) || 0,
      gpuLoad,
      ramPct: totalRam > 0 ? clamp((usedRam / totalRam) * 100, 0, 100) : 0,
      ramUsedGb: toGb(usedRam),
      ramTotalGb: toGb(totalRam),
      liquid: finite(kraken.liquidTemperature, kraken.temperature, 0) || 0,
      pump: finite(kraken.pumpSpeed, kraken.pumpRpm, kraken.pump?.speed, kraken.pump?.rpm, 0) || 0,
      fan: finite(kraken.fanSpeed, kraken.fanRpm, kraken.fan?.speed, kraken.fan?.rpm, cpu.fanSpeed, cpu.fanRpm, 0) || 0,
      power: powerAvailable ? clamp((cpuPower || 0) + (gpuPower || 0), 0, 999) : null,
    };
  }

  const metrics = {
    cpuTemp: { current: null, target: 0, id: 'cpu-value', card: '.main-dial' },
    gpuTemp: { current: null, target: 0, id: 'gpu-value', card: '.card-gpu' },
    gpuLoad: { current: null, target: 0, id: 'gpu-load', card: '.card-gpu-load' },
    ramPct: { current: null, target: 0, id: 'ram-value', card: '.card-ram' },
    liquid: { current: null, target: 0, id: 'liquid-value', card: '.stat-liquid' },
    pump: { current: null, target: 0, id: 'pump-value', card: '.card-pump' },
    fan: { current: null, target: 0, id: 'fan-value', card: '.card-fan' },
    cpuLoad: { current: null, target: 0, id: 'cpu-load-card', card: '.card-cpu-load' },
    power: { current: null, target: null, id: 'power-value', card: '.stat-power' },
  };

  function pulse(selector) {
    const element = document.querySelector(selector);
    if (!element || !element.classList.contains('data-card')) return;
    element.classList.remove('updated');
    requestAnimationFrame(() => element.classList.add('updated'));
    window.setTimeout(() => element.classList.remove('updated'), 800);
  }

  function setBar(id, value, max = 100) {
    const element = $(id);
    if (element) element.style.width = `${clamp((value / max) * 100, 0, 100).toFixed(1)}%`;
  }

  function updateDial(cpuTemp) {
    const level = clamp((cpuTemp - 20) / 80, 0, 1);
    $('cpu-arc').style.strokeDasharray = `${(level * 74).toFixed(1)} ${(100 - level * 74).toFixed(1)}`;
    $('dial-needle').style.transform = `rotate(${(-126 + level * 252).toFixed(1)}deg)`;
  }

  function setTargets(snapshot) {
    for (const [key, metric] of Object.entries(metrics)) {
      const next = snapshot[key];
      if (next === null) {
        metric.target = null;
        metric.current = null;
        $(metric.id).textContent = '--';
        continue;
      }
      if (metric.current !== null && Math.round(metric.target) !== Math.round(next)) pulse(metric.card);
      metric.target = next;
      if (metric.current === null) metric.current = next;
    }

    $('cpu-load').textContent = `${Math.round(snapshot.cpuLoad)}% LOAD`;
    $('ram-detail').textContent = snapshot.ramTotalGb > 0 ? `${snapshot.ramUsedGb.toFixed(1)} / ${snapshot.ramTotalGb.toFixed(0)} GB` : 'MEMORY';
    setBar('gpu-bar', snapshot.gpuTemp, 100);
    setBar('gpu-load-bar', snapshot.gpuLoad);
    setBar('pump-bar', snapshot.pump, 3500);
    setBar('ram-bar', snapshot.ramPct);
    setBar('cpu-load-bar', snapshot.cpuLoad);
    setBar('fan-bar', snapshot.fan, 2200);
    updateDial(snapshot.cpuTemp);

    const fanSpeed = Math.max(snapshot.fan, 400);
    document.documentElement.style.setProperty('--fan-duration', `${clamp(4200 - fanSpeed, 700, 3600)}ms`);
  }

  let lastFrame = performance.now();
  function animateValues(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    for (const metric of Object.values(metrics)) {
      if (metric.current === null || metric.target === null) continue;
      metric.current += (metric.target - metric.current) * Math.min(1, dt * 2.8);
      $(metric.id).textContent = metric.current.toFixed(0);
    }
    requestAnimationFrame(animateValues);
  }

  function updateClock() {
    const now = new Date();
    $('clock').textContent = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    $('date').textContent = now.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
  }

  function resize() {
    const padding = new URLSearchParams(window.location.search).get('kraken') === '1' ? 0 : 24;
    const scale = Math.min(1, (window.innerWidth - padding * 2) / 640, (window.innerHeight - padding * 2) / 640);
    document.documentElement.style.setProperty('--scale', Math.max(0.2, scale).toFixed(4));
  }

  const isKraken = new URLSearchParams(window.location.search).get('kraken') === '1';
  if (isKraken) document.body.classList.add('kraken');
  else {
    $('setup').hidden = false;
    const baseUrl = `${window.location.origin}${window.location.pathname}?kraken=1`;
    $('cam-url').value = `nzxt-cam://action/load-web-integration?url=${encodeURIComponent(baseUrl)}`;
    $('cam-url').addEventListener('click', (event) => event.currentTarget.select());
  }

  let receivedCamData = false;
  window.nzxt = {
    v1: {
      ...(window.nzxt?.v1 || {}),
      onMonitoringDataUpdate: (data) => {
        receivedCamData = true;
        $('data-state').innerHTML = '<i class="mode-live"></i>CAM LIVE';
        setTargets(mapMonitoring(data));
      },
    },
  };

  let demoTick = 0;
  const demoTimer = setInterval(() => {
    if (receivedCamData) {
      clearInterval(demoTimer);
      return;
    }
    demoTick += 1;
    setTargets(mapMonitoring({
      cpus: [{ name: 'Demo CPU', temperature: 54 + Math.sin(demoTick / 3.8) * 4, load: 0.38 + Math.sin(demoTick / 4.5) * 0.12, power: 64 + Math.sin(demoTick / 5) * 12, fanSpeed: 1180 + Math.sin(demoTick / 4) * 110 }],
      gpus: [{ name: 'Intel Integrated Graphics', temperature: 34, load: 0.03, power: 6 }, { name: 'NVIDIA GeForce RTX Demo', temperature: 39 + Math.cos(demoTick / 4.8) * 3, load: 0.42 + Math.cos(demoTick / 5) * 0.13, power: 72 + Math.cos(demoTick / 5) * 18 }],
      ram: { totalSize: 32768, inUse: 32768 * (0.28 + Math.sin(demoTick / 7) * 0.025) },
      kraken: { liquidTemperature: 32 + Math.sin(demoTick / 8) * 1.1, pumpSpeed: 2760 + Math.sin(demoTick / 6) * 90, fanSpeed: 1210 + Math.sin(demoTick / 5) * 100 },
    }));
  }, 1800);

  window.addEventListener('resize', resize);
  updateClock();
  setInterval(updateClock, 1000);
  resize();
  setTargets(mapMonitoring({
    cpus: [{ name: 'Demo CPU', temperature: 54, load: 0.38, power: 64, fanSpeed: 1180 }],
    gpus: [{ name: 'NVIDIA GeForce RTX Demo', temperature: 39, load: 0.42, power: 72 }],
    ram: { totalSize: 32768, inUse: 9175 },
    kraken: { liquidTemperature: 32, pumpSpeed: 2760, fanSpeed: 1210 },
  }));
  requestAnimationFrame(animateValues);
})();
