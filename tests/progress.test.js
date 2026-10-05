import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreProblems, advanceSkill, sessionXp, playerLevel, xpForLevel, dayStreak, bestDayStreak, weekSeconds,
  secondsByDay, badges, factStats, troubleFacts, isPass, unlockedTables, XP,
} from '../src/progress.js';

const prob = (ans, tries, ms = 5000, k = 'x') => ({ q: '?', k, ans, tries, ms });
const right = (n) => Array.from({ length: n }, () => prob(1, [1]));
const session = (o = {}) => {
  const problems = o.problems || right(20);
  return { id: Math.random().toString(36), kidId: 'k', date: '2026-10-05', skill: 'add', mode: 'practice', level: 0, complete: true, ...scoreProblems(problems), problems, ...o };
};
const kid = { id: 'k', name: 'Test', dailyGoal: 5, weeklyGoal: 20 };

test('scoring counts first tries, retries, combos and capped time', () => {
  const s = scoreProblems([prob(5, [5]), prob(5, [4, 5]), prob(5, [4, 3]), ...right(5).map((p) => ({ ...p, ms: 120000 }))]);
  assert.equal(s.total, 8);
  assert.equal(s.firstTry, 6);
  assert.equal(s.correct, 7);
  assert.equal(s.bestCombo, 5);
  assert.equal(s.combos, 1);
  assert.equal(s.seconds, 3 * 5 + 5 * 60); // the 2-minute problems only count 60 s each
});

test('two passing sessions at a level move a kid up; misses and other levels do not', () => {
  const pass = session();
  assert.ok(isPass(pass));
  let r = advanceSkill(kid, pass);
  assert.deepEqual(r.kid.skills.add, { level: 0, passes: 1 });
  assert.equal(r.levelUp, null);
  r = advanceSkill(r.kid, pass);
  assert.deepEqual(r.kid.skills.add, { level: 1, passes: 0 });
  assert.deepEqual(r.levelUp, { from: 0, to: 1 });

  const shaky = session({ problems: [...right(17), prob(1, [2, 1]), prob(1, [2, 1]), prob(1, [2, 1])] }); // 85%
  assert.equal(advanceSkill(kid, shaky).levelUp, null);
  assert.equal(advanceSkill(kid, shaky).kid, kid);
  assert.equal(advanceSkill(kid, session({ mode: 'pick' })).kid, kid, 'picked tables do not level up');
  assert.equal(advanceSkill(kid, session({ complete: false })).kid, kid, 'quitting early does not count');
  assert.equal(advanceSkill(kid, session({ level: 3 })).kid, kid, 'a session at another level does not count');
  const top = { ...kid, skills: { add: { level: 4, passes: 0 } } };
  assert.equal(advanceSkill(top, session({ level: 4 })).levelUp, null, 'no level above the top');
});

test('XP includes goal bonuses exactly when the goal is crossed', () => {
  const s = session({ problems: right(20).map((p) => ({ ...p, ms: 15000 })) }); // 5 minutes
  const { xp, parts } = sessionXp(kid, s, [], '2026-10-05');
  const labels = parts.map((p) => p.label);
  assert.ok(labels.includes('Daily goal'));
  assert.ok(labels.includes('Perfect!'));
  assert.equal(xp, 20 * XP.firstTry + 4 * XP.combo + XP.complete + XP.perfect + XP.dailyGoal);
  const again = sessionXp(kid, s, [{ ...s, xp }], '2026-10-05');
  assert.ok(!again.parts.some((p) => p.label === 'Daily goal'), 'only once a day');
});

test('player levels need more XP each time', () => {
  assert.equal(playerLevel(0).level, 1);
  assert.equal(playerLevel(99).level, 1);
  assert.equal(playerLevel(100).level, 2);
  assert.equal(playerLevel(xpForLevel(10)).level, 10);
  assert.equal(playerLevel(xpForLevel(10)).title, 'Math Wizard');
  const p = playerLevel(150);
  assert.equal(p.into, 50);
  assert.equal(p.need, 200);
});

test('streaks and weeks', () => {
  const byDay = { '2026-10-01': 60, '2026-10-02': 60, '2026-10-03': 60, '2026-10-05': 60 };
  assert.equal(dayStreak(byDay, '2026-10-05'), 1);
  assert.equal(dayStreak(byDay, '2026-10-04'), 3, 'today not practised yet keeps yesterday’s streak');
  assert.equal(bestDayStreak(byDay), 3);
  // 2026-10-05 is a Monday, so it starts a new week.
  assert.equal(weekSeconds(byDay, '2026-10-05'), 60);
  assert.equal(weekSeconds(byDay, '2026-10-04'), 180);
  assert.deepEqual(secondsByDay([{ date: 'a', seconds: 5 }, { date: 'a', seconds: 7 }]), { a: 12 });
});

test('badges and trouble facts', () => {
  const sessions = [session({ skill: 'mult', problems: [prob(56, [54, 56], 5000, '7×8'), prob(56, [48], 5000, '7×8'), prob(6, [6], 5000, '2×3')] })];
  const b = badges(kid, sessions);
  assert.ok(b.find((x) => x.id === 'first').earned);
  assert.ok(!b.find((x) => x.id === 'p100').earned);
  const stats = factStats(sessions);
  assert.deepEqual(stats['7×8'], { n: 2, wrong: 2, ms: 10000 });
  assert.deepEqual(troubleFacts(stats).map((f) => f.key), ['7×8']);
  assert.deepEqual(unlockedTables({ skills: { mult: { level: 2 } } }), [0, 1, 2, 10]);
});
