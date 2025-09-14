/*
  JavaScript to power the aviation‑inspired Kraken web integration.  It
  dynamically builds either a configuration view (for desktop browsers) or
  the device view (for NZXT Kraken displays) based on the presence of
  `?kraken=1` in the URL.  When running on a Kraken, it registers
  `onMonitoringDataUpdate` to receive telemetry from CAM and updates the
  gauges accordingly.  Outside of CAM it runs a demo mode with simulated
  values so the interface can be previewed.
*/

// Helper to create and append an element
function createEl(tag, className, parent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (parent) parent.appendChild(el);
  return el;
}

// Build the configuration view.  Displays a shareable link that encodes the
// current page URL and instructs the user how to load the integration.
function buildConfigView() {
  const container = createEl('div', 'container config', document.getElementById('app'));
  const title = createEl('h1', null, container);
  title.textContent = 'Aviation‑Inspired Kraken Monitor';
  const desc1 = createEl('p', null, container);
  desc1.innerHTML =
    'This web integration displays CPU & GPU temperatures, loads and other stats on your NZXT Kraken Elite in an aviation‑style gauge panel.\n' +
    'It works only when loaded through NZXT CAM on firmware 4.50 or newer.';
  const url = location.origin + location.pathname; // remove query parameters
  const encoded = encodeURIComponent(url);
  const shareUrl = `nzxt-cam://action/load-web-integration?url=${encoded}`;
  const desc2 = createEl('p', null, container);
  desc2.innerHTML = '<strong>Shareable Link:</strong>';
  const input = createEl('input', null, container);
  input.type = 'text';
  input.value = shareUrl;
  input.readOnly = true;
  input.onclick = () => input.select();
  const desc3 = createEl('p', null, container);
  desc3.innerHTML =
    'Copy this link into a browser and click <em>Open NZXT CAM</em> to load the integration.\n' +
    'If your browser doesn\'t support the protocol, use the redirect domain: ' +
    '<code>https://cam-redirect.nzxt.com/action/load-web-integration?url=…</code>.';
}

// Build the device view.  Creates radial gauges, bars and stats elements
// and returns an update function that can be called with fresh data.
function buildDeviceView() {
  const container = createEl('div', 'container device', document.getElementById('app'));

  // Liquid temperature
  const liquid = createEl('div', 'liquid', container);
  const liqLabel = createEl('div', 'label', liquid);
  liqLabel.textContent = 'LIQUID';
  const liqValue = createEl('div', 'value', liquid);
  liqValue.textContent = '-- °C';

  // Gauges row
  const gaugesRow = createEl('div', 'gauges', container);
  // CPU gauge
  const cpuGauge = createEl('div', 'gauge', gaugesRow);
  const cpuDial = createEl('div', 'dial', cpuGauge);
  const cpuVal = createEl('div', 'value', cpuGauge);
  cpuVal.textContent = '-- °C';
  const cpuLabel = createEl('div', 'label', cpuGauge);
  cpuLabel.textContent = 'CPU';
  // GPU gauge
  const gpuGauge = createEl('div', 'gauge', gaugesRow);
  const gpuDial = createEl('div', 'dial', gpuGauge);
  const gpuVal = createEl('div', 'value', gpuGauge);
  gpuVal.textContent = '-- °C';
  const gpuLabel = createEl('div', 'label', gpuGauge);
  gpuLabel.textContent = 'GPU';

  // Bars row
  const bars = createEl('div', 'bars', container);
  function createBar(labelText) {
    const barWrap = createEl('div', 'bar', bars);
    const barLabel = createEl('div', 'bar-label', barWrap);
    barLabel.textContent = labelText;
    const track = createEl('div', 'bar-track', barWrap);
    const fill = createEl('div', 'bar-fill', track);
    return fill;
  }
  const cpuLoadFill = createBar('CPU Load');
  const gpuLoadFill = createBar('GPU Load');
  const ramLoadFill = createBar('RAM Load');

  // Stats row
  const stats = createEl('div', 'stats', container);
  function createStat(labelText) {
    const stat = createEl('div', 'stat', stats);
    const sLabel = createEl('div', 'label', stat);
    sLabel.textContent = labelText;
    const sValue = createEl('div', 'value', stat);
    sValue.textContent = '--';
    return sValue;
  }
  const cpuFreqVal = createStat('CPU Freq');
  const pumpSpeedVal = createStat('Pump RPM');
  const gpuFreqVal = createStat('GPU Freq');

  // Function to update the UI with monitoring data
  function updateUI(data) {
    // CPU and GPU objects
    const cpu = data.cpus && data.cpus.length ? data.cpus[0] : {};
    const gpu = data.gpus && data.gpus.length ? data.gpus[0] : {};
    const ram = data.ram || {};
    const kraken = data.kraken || {};

    // Liquid temperature
    const liqTemp = kraken.liquidTemperature ?? kraken.temperature; // support both names
    if (typeof liqTemp === 'number') {
      liqValue.textContent = `${Math.round(liqTemp)} °C`;
    }

    // CPU temp gauge
    const cpuTemp = cpu.temperature ?? 0;
    cpuVal.textContent = `${Math.round(cpuTemp)} °C`;
    const cpuPct = Math.min(Math.max(cpuTemp / 100, 0), 1);
    cpuDial.style.backgroundImage = `conic-gradient(var(--accent-cpu) 0% ${cpuPct * 100}%, var(--bar-bg) ${cpuPct * 100}% 100%)`;

    // GPU temp gauge
    const gpuTemp = gpu.temperature ?? 0;
    gpuVal.textContent = `${Math.round(gpuTemp)} °C`;
    const gpuPct = Math.min(Math.max(gpuTemp / 100, 0), 1);
    gpuDial.style.backgroundImage = `conic-gradient(var(--accent-gpu) 0% ${gpuPct * 100}%, var(--bar-bg) ${gpuPct * 100}% 100%)`;

    // CPU load bar
    const cpuLoad = cpu.load ?? 0;
    cpuLoadFill.style.width = `${Math.round(cpuLoad * 100)}%`;
    // GPU load bar
    const gpuLoad = gpu.load ?? 0;
    gpuLoadFill.style.width = `${Math.round(gpuLoad * 100)}%`;
    // RAM load bar (use percent of used memory)
    let ramPct = 0;
    if (typeof ram.totalSize === 'number' && typeof ram.inUse === 'number' && ram.totalSize > 0) {
      ramPct = ram.inUse / ram.totalSize;
    }
    ramLoadFill.style.width = `${Math.round(ramPct * 100)}%`;

    // Stats
    cpuFreqVal.textContent = cpu.frequency ? `${Math.round(cpu.frequency)} MHz` : '--';
    // Use CPU fanSpeed or GPU fanSpeed as pump speed; prefer cpu.fanSpeed
    const pump = cpu.fanSpeed ?? gpu.fanSpeed;
    pumpSpeedVal.textContent = typeof pump === 'number' ? `${Math.round(pump)} RPM` : '--';
    gpuFreqVal.textContent = gpu.frequency ? `${Math.round(gpu.frequency)} MHz` : '--';
  }

  return updateUI;
}

// Determine whether we are running on Kraken or a standard browser
const searchParams = new URLSearchParams(window.location.search);
const isKraken = searchParams.get('kraken') === '1';

if (isKraken && window.nzxt?.v1) {
  // Device view with real data
  const update = buildDeviceView();
  window.nzxt.v1.onMonitoringDataUpdate = (data) => {
    update(data);
  };
} else {
  // Outside of Kraken or CAM; build a config view and a demo device view below it
  buildConfigView();
  // Insert a small separator and then the demo device view
  const sep = document.createElement('hr');
  sep.style.margin = '2rem 0';
  sep.style.border = 'none';
  sep.style.borderTop = '1px solid var(--border-colour)';
  document.getElementById('app').appendChild(sep);
  const demoUpdate = buildDeviceView();

  // Simulate monitoring data every second
  let t = 0;
  setInterval(() => {
    t += 1;
    // Generate sine‑wave‑like variation for nicer animation
    const cpuTemp = 45 + 10 * Math.sin(t / 5);
    const gpuTemp = 40 + 8 * Math.cos(t / 4);
    const cpuLoad = 0.3 + 0.2 * Math.sin(t / 3);
    const gpuLoad = 0.35 + 0.25 * Math.cos(t / 3.5);
    const ramTotal = 32 * 1024; // 32 GiB
    const ramInUse = ramTotal * (0.4 + 0.2 * Math.sin(t / 6));
    const cpuFreq = 4200 + 300 * Math.sin(t / 2);
    const gpuFreq = 1800 + 250 * Math.cos(t / 2.5);
    const fan = 1800 + 200 * Math.sin(t / 1.8);
    const liq = 38 + 2 * Math.sin(t / 4);
    demoUpdate({
      cpus: [
        {
          temperature: cpuTemp,
          load: cpuLoad,
          frequency: cpuFreq,
          fanSpeed: fan,
        },
      ],
      gpus: [
        {
          temperature: gpuTemp,
          load: gpuLoad,
          frequency: gpuFreq,
          fanSpeed: fan * 0.8,
        },
      ],
      ram: {
        totalSize: ramTotal,
        inUse: ramInUse,
        modules: [],
      },
      kraken: {
        liquidTemperature: liq,
      },
    });
  }, 1000);
}