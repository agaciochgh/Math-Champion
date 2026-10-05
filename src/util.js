/* Small shared helpers. Pure functions only, so they run in tests under Node too. */

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** Monday of the week containing d (weeks run Monday to Sunday). */
export const weekStart = (d = new Date()) => addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
export const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);

/** "4 min", "1h 5m", "45 sec" from seconds. */
export function fmtDuration(sec) {
  const s = Math.round(sec || 0);
  if (s < 60) return `${s} sec`;
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${m} min`;
}

export const fmtDate = (k, today = dayKey()) => {
  if (k === today) return 'Today';
  if (k === dayKey(addDays(parseKey(today), -1))) return 'Yesterday';
  return parseKey(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

// Random helpers take an rng (defaults to Math.random) so tests can make them repeatable.
export const randInt = (lo, hi, rng = Math.random) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** Pick an item with probability proportional to weight(item). */
export function weightedPick(items, weight, rng = Math.random) {
  const ws = items.map(weight);
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r < 0) return items[i]; }
  return items[items.length - 1];
}
/** Seeded RNG (mulberry32), for tests and demo data. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
