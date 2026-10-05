/* Mental addition: 2-digit + 2-digit, building up to regrouping and sums over 100. */
import { randInt } from '../util.js';
import { problem, levelProblems, ones, tens } from './common.js';

const add = (a, b, rng) => (rng() < 0.5 ? problem(a, '+', b, a + b) : problem(b, '+', a, a + b));

const levels = [
  {
    name: 'Adding tens',
    example: '34 + 20',
    // Big number first: that's how we teach the strategy ("start at 34, jump 2 tens").
    gen: (rng) => { const a = randInt(11, 89, rng); const b = 10 * randInt(1, Math.floor((99 - a) / 10), rng); return problem(a, '+', b, a + b); },
  },
  {
    name: 'No regrouping',
    example: '34 + 25',
    gen: (rng) => {
      const ta = randInt(1, 8, rng), tb = randInt(1, 9 - ta, rng);
      const oa = randInt(0, 8, rng), ob = randInt(1, 9 - oa, rng);
      return add(10 * ta + oa, 10 * tb + ob, rng);
    },
  },
  {
    name: 'With regrouping',
    example: '38 + 27',
    gen: (rng) => {
      const ta = randInt(1, 7, rng), tb = randInt(1, 8 - ta, rng);
      const oa = randInt(1, 9, rng), ob = randInt(10 - oa, 9, rng);
      return add(10 * ta + oa, 10 * tb + ob, rng);
    },
  },
  {
    name: 'Over 100',
    example: '67 + 58',
    gen: (rng) => { const a = randInt(15, 99, rng); const b = randInt(Math.max(11, 101 - a), 99, rng); return add(a, b, rng); },
  },
  { name: 'Mix it up', example: 'All kinds', gen: 'mix' },
];

export default {
  id: 'add',
  name: 'Addition',
  icon: '➕',
  color: '#12b886',
  levels: levels.map(({ name, example }) => ({ name, example })),
  problems: levelProblems(levels),
  /** Split the second number into tens and ones: 38 + 27 → 38 + 20 = 58, 58 + 7 = 65. */
  hint({ a, b, answer }) {
    if (ones(b) === 0 || tens(b) === 0) return `${a} + ${b} = ${answer}`;
    const mid = a + tens(b);
    return `${a} + ${tens(b)} = ${mid}, then ${mid} + ${ones(b)} = ${answer}`;
  },
};
