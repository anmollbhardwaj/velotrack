// Shared by the service worker and the popup.
// Input is always bytes/second as measured by the native helper.

export function formatSpeed(bytesPerSec, mode = 'bytes') {
  const b = Math.max(0, bytesPerSec || 0);
  let value, unit;
  if (mode === 'bits') {
    const bits = b * 8;
    if (bits >= 1e6) { value = bits / 1e6; unit = 'Mbps'; }
    else             { value = bits / 1e3; unit = 'Kbps'; }
  } else {
    const kb = b / 1024;
    if (kb >= 1000) { value = kb / 1024; unit = 'MB/s'; }
    else            { value = kb;        unit = 'KB/s'; }
  }
  let digits = 0;
  if (unit === 'MB/s' || unit === 'Mbps') digits = value < 10 ? 2 : value < 100 ? 1 : 0;
  else digits = value < 10 ? 1 : 0;
  return { value: value.toFixed(digits), unit, text: `${value.toFixed(digits)} ${unit}` };
}

// Badge has room for ~4 characters, so it shows "4.8↓", "850↓", "25↓".
// The unit is conveyed by badge colour (amber = KB/s or Kbps, blue = MB/s, teal = Mbps)
// and by the tooltip, which has the full readout.
export function badgeSpeed(bytesPerSec, mode = 'bytes') {
  const n = parseFloat(formatSpeed(bytesPerSec, mode).value);
  return (n < 10 ? n.toFixed(1) : String(Math.round(n))) + '\u2193';
}

export function badgeColor(bytesPerSec, mode = 'bytes') {
  const unit = formatSpeed(bytesPerSec, mode).unit;
  if (unit === 'Mbps') return '#0F7B6C';
  if (unit === 'MB/s') return '#0F6CBD';
  return '#B7791F';
}
