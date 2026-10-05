/* Multiplication facts 0–12, learned one table at a time in a kid-friendly order, with review of earlier tables. */
import { pick, weightedPick } from '../util.js';
import { uniqueSet } from './common.js';

/** Teaching order: the easy patterns first, the hardest facts (7s, 12s) last. */
export const STAGES = [[0, 1], [2], [10], [5], [3], [4], [9], [11], [6], [8], [7], [12]];
export const ALL_TABLES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const REVIEW_SHARE = 0.25;

const TIPS = {
  0: 'Anything times 0 is 0.',
  1: 'Anything times 1 stays the same.',
  2: 'Times 2 means double it.',
  3: 'Times 3: double it, then add one more group.',
  4: 'Times 4: double it, then double again.',
  5: 'Times 5: count by 5s, or take half of times 10.',
  6: 'Times 6: times 5, then add one more group.',
  7: 'Times 7: times 5 plus times 2.',
  8: 'Times 8: double, double, double!',
  9: 'Times 9: times 10, then take away one group.',
  10: 'Times 10: put a 0 on the end.',
  11: 'Times 11: for 1 to 9, just repeat the digit (11 × 4 = 44).',
  12: 'Times 12: times 10 plus times 2.',
};

export const factKey = (a, b) => `${Math.min(a, b)}×${Math.max(a, b)}`;

function fact(t, n, rng) {
  const [a, b] = rng() < 0.5 ? [t, n] : [n, t];
  return { a, b, op: '×', answer: a * b, text: `${a} × ${b}`, key: factKey(a, b), table: t };
}

const levels = [
  ...STAGES.map((ts) => ({ name: ts.map((t) => `×${t}`).join(' and '), example: `${ts[ts.length - 1]} × 7` })),
  { name: 'All tables mixed', example: '7 × 8' },
];

export default {
  id: 'mult',
  name: 'Multiplication',
  icon: '✖️',
  color: '#f76707',
  levels,
  /** Lets kids pick their own tables to practise. */
  pickable: { label: 'Pick tables', options: ALL_TABLES },

  /**
   * level: index into levels. tables: optional custom list (overrides level).
   * history: { [factKey]: { n, wrong } } so facts she's missed before come up more often.
   */
  problems({ level, count, rng = Math.random, tables = null, history = {} }) {
    let current, review;
    if (tables?.length) { current = tables; review = []; }
    else if (level >= STAGES.length) { current = ALL_TABLES; review = []; }
    else { current = STAGES[level]; review = STAGES.slice(0, level).flat(); }
    const weight = (t) => (n) => { const h = history[factKey(t, n)]; return 1 + (h?.n ? 3 * (h.wrong / h.n) : 0); };
    return uniqueSet(count, (r) => {
      const t = review.length && r() < REVIEW_SHARE ? pick(review, r) : pick(current, r);
      return fact(t, weightedPick(ALL_TABLES, weight(t), r), r);
    }, rng);
  },

  hint({ a, b, answer, table }) {
    const t = table ?? Math.max(a, b);
    const other = t === a ? b : a;
    // A tip for the "other" number is sometimes friendlier (e.g. 7 × 0 → the 0 rule).
    const tip = [0, 1, 10].includes(other) ? TIPS[other] : TIPS[t];
    return `${a} × ${b} = ${answer}. ${tip}`;
  },
};
