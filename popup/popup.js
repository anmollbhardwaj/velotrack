import { formatSpeed } from '../lib/format.js';

const $ = (id) => document.getElementById(id);
const STALE_MS = 3500, PING_MAX_AGE = 30000;
let state = null, mode = 'bytes';

function set(id, text) { $(id).textContent = text; }

function render() {
  $('unit').textContent = mode === 'bits' ? 'Mbps' : 'MB/s';
  const banner = $('banner');
  banner.hidden = true; banner.className = 'banner';

  const now = Date.now();
  const age = state ? now - state.ts : Infinity;
  let live = false, status = 'Waiting for network data...';

  if (state?.status === 'no-helper' || state?.status === 'helper-error') {
    status = 'Native helper not connected';
    banner.hidden = false;
    banner.textContent = state.status === 'helper-error'
      ? state.error
      : 'Native helper not connected. Run native-host/install.ps1, then reload the extension.';
  } else if (state?.status === 'offline') {
    status = 'Network unavailable';
    banner.hidden = false; banner.textContent = 'Network unavailable';
  } else if (state?.status === 'ok' && age <= STALE_MS) {
    live = true; status = 'Connected';
  } else {
    banner.hidden = false; banner.className = 'banner info';
    banner.textContent = 'Waiting for network data...';
  }

  const d = live ? formatSpeed(state.down, mode) : null;
  const u = live ? formatSpeed(state.up, mode) : null;
  set('heroDown', d ? d.text : '—');
  set('heroUp', u ? u.text : '—');
  set('rowDown', d ? d.text : '—');
  set('rowUp', u ? u.text : '—');

  const pingOk = live && state.ping && now - state.ping.ts < PING_MAX_AGE;
  set('heroPing', pingOk ? `${state.ping.ms} ms` : '—');
  set('rowPing', pingOk ? `${state.ping.ms} ms` : live ? 'Measuring…' : '—');

  set('rowType', live ? state.type : '—');
  set('rowAdapter', live ? state.adapter : '—');
  $('rowAdapter').title = live ? state.adapter : '';
  set('rowStatus', status);

  if (live) {
    set('updated', age < 1500 ? 'Updated just now' : `Updated ${Math.round(age / 1000)}s ago`);
  } else if (state?.ts) {
    set('updated', `Last data at ${new Date(state.ts).toLocaleTimeString()}`);
  } else {
    set('updated', 'Waiting for network data...');
  }
}

$('unit').addEventListener('click', () => {
  mode = mode === 'bytes' ? 'bits' : 'bytes';
  chrome.storage.local.set({ vt_unit: mode });
  render();
});

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'session' && ch.vt_state) { state = ch.vt_state.newValue; render(); }
});

(async () => {
  const [s, l] = await Promise.all([chrome.storage.session.get('vt_state'), chrome.storage.local.get('vt_unit')]);
  state = s.vt_state || null; mode = l.vt_unit || 'bytes';
  render();
  setInterval(render, 1000);
})();
