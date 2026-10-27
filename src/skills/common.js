/* Shared building blocks for skills. */
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
