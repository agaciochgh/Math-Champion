/* Mental subtraction: 2-digit − 2-digit, never below zero. */
import { randInt } from '../util.js';
import { problem, levelProblems, ones, tens } from './common.js';

const levels = [
  {
    name: 'Taking away tens',
    example: '74 − 30',
    gen: (rng) => { const a = randInt(21, 99, rng); const b = 10 * randInt(1, Math.floor((a - 1) / 10), rng); return problem(a, '−', b, a - b); },
  },
  {
    name: 'No regrouping',
    example: '78 − 35',
    gen: (rng) => {
      const ta = randInt(2, 9, rng), tb = randInt(1, ta - 1, rng);
      const oa = randInt(1, 9, rng), ob = randInt(1, oa, rng);
      return problem(10 * ta + oa, '−', 10 * tb + ob, 10 * (ta - tb) + (oa - ob));
    },
  },
  {
    name: 'With regrouping',
    example: '72 − 38',
    gen: (rng) => {
      const ta = randInt(2, 9, rng), tb = randInt(1, ta - 1, rng);
      const oa = randInt(0, 8, rng), ob = randInt(oa + 1, 9, rng);
      const a = 10 * ta + oa, b = 10 * tb + ob;
      return problem(a, '−', b, a - b);
    },
  },
  {
    name: 'Tricky 8s and 9s',
    example: '83 − 29',
    // Numbers ending in 8 or 9 are made for the "take away 30, add 1 back" trick.
    gen: (rng) => { const b = 10 * randInt(1, 8, rng) + (rng() < 0.5 ? 8 : 9); const a = randInt(b + 3, 99, rng); return problem(a, '−', b, a - b); },
  },
  { name: 'Mix it up', example: 'All kinds', gen: 'mix' },
];

export default {
  id: 'sub',
  name: 'Subtraction',
  icon: '➖',
  color: '#339af0',
  levels: levels.map(({ name, example }) => ({ name, example })),
  problems: levelProblems(levels),
  hint({ a, b, answer }) {
    if (ones(b) >= 8) {
      const up = tens(b) + 10, mid = a - up;
      return `${a} − ${up} = ${mid}, then add back ${up - b}: ${mid} + ${up - b} = ${answer}`;
    }
    if (ones(b) === 0 || tens(b) === 0) return `${a} − ${b} = ${answer}`;
    const mid = a - tens(b);
    return `${a} − ${tens(b)} = ${mid}, then ${mid} − ${ones(b)} = ${answer}`;
  },
};
