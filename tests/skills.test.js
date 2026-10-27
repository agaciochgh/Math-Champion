import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, skillById } from '../src/skills/index.js';
import { STAGES, factKey } from '../src/skills/multiplication.js';
import { seeded } from '../src/util.js';

const many = (skill, level, opts = {}) => skill.problems({ level, count: 20, rng: seeded(level * 7 + 1), ...opts })
  .concat(...Array.from({ length: 40 }, (_, i) => skill.problems({ level, count: 20, rng: seeded(1000 + i + level), ...opts })));

test('multiplication is the only skill for now', () => {
  assert.deepEqual(SKILLS.map((s) => s.id), ['mult']);
  assert.equal(skillById('add'), null);
  assert.equal(skillById('sub'), null);
});

test('every skill makes correct, well-formed problems at every level', () => {
  for (const skill of SKILLS) {
    skill.levels.forEach((lv, level) => {
      assert.ok(lv.name && lv.example, `${skill.id} level ${level} has a name and example`);
      const ps = skill.problems({ level, count: 20, rng: seeded(level + 3) });
      assert.equal(ps.length, 20);
      for (const p of ps) {
        const real = p.op === '+' ? p.a + p.b : p.op === '−' ? p.a - p.b : p.a * p.b;
        assert.equal(p.answer, real, p.text);
        assert.equal(p.text, `${p.a} ${p.op} ${p.b}`);
        assert.ok(p.key);
        assert.ok(skill.hint(p).includes(String(p.answer)), `hint for ${p.text} shows the answer`);
      }
      for (let i = 1; i < ps.length; i++) assert.notEqual(ps[i].text, ps[i - 1].text, 'no immediate repeats');
    });
  }
});

test('multiplication focuses on the current table, with some review, all within 0–12', () => {
  const mult = skillById('mult');
  assert.equal(mult.levels.length, STAGES.length + 1);
  const level = 4; // ×3, after 0/1, 2, 10, 5
  const ps = many(mult, level);
  const has = (p, t) => p.a === t || p.b === t;
  const current = ps.filter((p) => has(p, 3)).length;
  assert.ok(current / ps.length > 0.6, `mostly ×3 (${current}/${ps.length})`);
  const allowed = STAGES.slice(0, level + 1).flat();
  for (const p of ps) {
    assert.ok(p.a >= 0 && p.a <= 12 && p.b >= 0 && p.b <= 12, p.text);
    assert.ok(allowed.some((t) => has(p, t)), `${p.text} uses an unlocked table`);
  }
});

test('every times-table level goes all the way up to × 12, and says so', () => {
  const mult = skillById('mult');
  STAGES.forEach((ts, level) => {
    const partners = new Set(many(mult, level).filter((p) => ts.includes(p.table)).map((p) => (p.a === p.table ? p.b : p.a)));
    assert.deepEqual([...partners].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], `level ${level + 1}`);
    assert.match(mult.levels[level].example, /× 12$/);
  });
});

test('picked tables are respected, and missed facts come up more', () => {
  const mult = skillById('mult');
  for (const p of many(mult, 0, { tables: [7, 8] })) assert.ok([7, 8].includes(p.table), p.text);
  const history = { [factKey(6, 7)]: { n: 10, wrong: 10 } };
  const count = (h) => many(mult, 0, { tables: [7], history: h }).filter((p) => p.key === '6×7').length;
  assert.ok(count(history) > count({}), 'a fact she keeps missing shows up more often');
});

test('fact keys ignore order', () => {
  assert.equal(factKey(8, 7), '7×8');
  assert.equal(factKey(7, 8), '7×8');
});
