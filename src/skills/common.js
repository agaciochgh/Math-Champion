/* Shared building blocks for skills. */
import { randInt } from '../util.js';

export const ones = (n) => n % 10;
export const tens = (n) => Math.floor(n / 10) * 10;

/** A problem as stored in a session and shown on screen. `key` identifies the fact for stats. */
export function problem(a, op, b, answer, key = `${a}${op}${b}`) {
  return { a, b, op, answer, text: `${a} ${op} ${b}`, key };
}

/**
 * Build `count` problems by calling gen(rng) repeatedly, avoiding repeats within the set where possible
 * (and never the same problem twice in a row).
 */
export function uniqueSet(count, gen, rng) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    let p;
    for (let tries = 0; tries < 40; tries++) {
      p = gen(rng);
      const last = out[out.length - 1];
      if (last && last.text === p.text) continue;
      if (!seen.has(p.text) || tries > 30) break;
    }
    seen.add(p.text);
    out.push(p);
  }
  return out;
}

/** Turn a list of level generators into the `problems()` function of a skill. The last level may be 'mix'. */
export function levelProblems(levels) {
  return ({ level, count, rng = Math.random }) => {
    const lv = levels[Math.min(level, levels.length - 1)];
    const gen = lv.gen === 'mix'
      ? (r) => levels[randInt(0, levels.length - 2, r)].gen(r)
      : lv.gen;
    return uniqueSet(count, gen, rng);
  };
}
