import { formatSpeed, badgeSpeed, badgeColor } from './lib/format.js';

const HOST = 'com.velotrack.host';
const PING_URL = 'https://www.gstatic.com/generate_204';
const STALE_MS = 3500;       // no sample for this long => not "current"
const PING_EVERY_MS = 10000;

let port = null;
let unit = 'bytes';
let pinging = false;
let state = {
  status: 'connecting',      // connecting | ok | offline | no-helper | helper-error
  down: null, up: null, adapter: null, type: null,
  ts: 0,                     // when the last real sample arrived
  ping: null,                // { ms, ts } or null
  error: null
};

const persist = () => chrome.storage.session.set({ vt_state: state }).catch(() => {});

// ---------- badge ----------
function setBadge(text, color, title) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
  chrome.action.setTitle({ title });
}

function renderBadge() {
  const age = Date.now() - state.ts;
  if (state.status === 'no-helper' || state.status === 'helper-error') {
    return setBadge('!', '#C42B1C', 'VeloTrack: native helper not connected');
  }
  if (state.status === 'offline') {
    return setBadge('×', '#6B6B6B', 'VeloTrack: network unavailable');
  }
  if (state.status !== 'ok' || age > STALE_MS) {
    return setBadge('…', '#6B6B6B', 'VeloTrack: waiting for network data...');
  }
  const d = formatSpeed(state.down, unit), u = formatSpeed(state.up, unit);
  const ping = state.ping && Date.now() - state.ping.ts < 30000 ? `${state.ping.ms} ms` : '—';
  setBadge(badgeSpeed(state.down, unit), badgeColor(state.down, unit),
    `VeloTrack\n↓ ${d.text}\n↑ ${u.text}\nPing ${ping}`);
}

// ---------- native helper ----------
function connect() {
  if (port) return;
  try {
    port = chrome.runtime.connectNative(HOST);
  } catch (e) {
    port = null;
    return fail('no-helper', String(e));
  }
  port.onMessage.addListener(onHostMessage);
  port.onDisconnect.addListener(() => {
    const msg = chrome.runtime.lastError?.message || 'Helper disconnected';
    port = null;
    fail('no-helper', msg);
  });
}

function fail(status, error) {
  state = { ...state, status, error, down: null, up: null, ping: null };
  persist(); renderBadge();
}

function onHostMessage(m) {
  if (m.t === 'error') return fail('helper-error', m.message);
  if (m.t !== 'sample') return;
  if (m.online === false) {
    state = { ...state, status: 'offline', down: null, up: null, adapter: null, type: null,
              ping: null, ts: Date.now(), error: null };
  } else {
    state = { ...state, status: 'ok', down: m.down, up: m.up, adapter: m.adapter,
              type: m.type, ts: Date.now(), error: null };
  }
  persist(); renderBadge();
}

// ---------- latency (HTTP round-trip to a 204 endpoint) ----------
async function measurePing() {
  if (pinging || state.status !== 'ok') return;
  pinging = true;
  try {
    const rtts = [];
    for (let i = 0; i < 3; i++) {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 3000);
      const t0 = performance.now();
      try {
        await fetch(`${PING_URL}?vt=${Date.now()}_${i}`,
          { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctl.signal });
        rtts.push(performance.now() - t0);
      } finally { clearTimeout(to); }
    }
    // First request pays DNS/TCP/TLS setup; the warm ones approximate network RTT.
    state.ping = { ms: Math.max(1, Math.round(Math.min(...rtts.slice(1)))), ts: Date.now() };
  } catch {
    state.ping = null;       // timeout/unreachable: never show a made-up number
  } finally {
    pinging = false; persist(); renderBadge();
  }
}

// ---------- lifecycle ----------
async function init() {
  const s = await chrome.storage.local.get('vt_unit');
  unit = s.vt_unit || 'bytes';
  connect();
  renderBadge();
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && ch.vt_unit) { unit = ch.vt_unit.newValue || 'bytes'; renderBadge(); }
});

chrome.alarms.create('vt-keepalive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => { connect(); renderBadge(); });
chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

setInterval(renderBadge, 1000);              // flips to "…" if samples stop arriving
setInterval(() => { if (!port) connect(); }, 5000);
setInterval(measurePing, PING_EVERY_MS);

init();
