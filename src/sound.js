/* Sound effects, synthesised with Web Audio (no sound files to download). */
let ctx = null;
let muted = false;

export const setMuted = (m) => { muted = m; };

function ac() {
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Play notes: [[frequency Hz, start s, length s], ...] */
function notes(list, { type = 'sine', vol = 0.18 } = {}) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + 0.01;
  for (const [f, start, len] of list) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0, t0 + start);
    g.gain.linearRampToValueAtTime(vol, t0 + start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len);
    o.connect(g).connect(a.destination);
    o.start(t0 + start);
    o.stop(t0 + start + len + 0.05);
  }
}

export const sounds = {
  tap: () => notes([[660, 0, 0.05]], { type: 'triangle', vol: 0.06 }),
  correct: () => notes([[784, 0, 0.12], [1047, 0.08, 0.22]], { type: 'triangle' }),
  combo: () => notes([[784, 0, 0.1], [988, 0.07, 0.1], [1319, 0.14, 0.25]], { type: 'triangle' }),
  wrong: () => notes([[262, 0, 0.18], [220, 0.12, 0.25]], { type: 'sine', vol: 0.14 }),
  finish: () => notes([[523, 0, 0.15], [659, 0.12, 0.15], [784, 0.24, 0.15], [1047, 0.36, 0.4]], { type: 'triangle' }),
  levelUp: () => notes([[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.12], [1319, 0.42, 0.5], [1568, 0.42, 0.5]], { type: 'square', vol: 0.07 }),
  badge: () => notes([[1047, 0, 0.1], [1319, 0.1, 0.1], [1568, 0.2, 0.35]], { type: 'sine' }),
  tick: () => notes([[1200, 0, 0.04]], { type: 'square', vol: 0.03 }),
};
