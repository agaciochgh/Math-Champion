/* Scoring, levels, XP, streaks, badges and stats. Pure functions over kids and sessions, so they're easy to test.
 *
 * A session record (saved after every practice):
 *   { id, kidId, date: 'YYYY-MM-DD', createdAt, skill, mode: 'practice' | 'pick' | 'challenge', level, tables?,
 *     problems: [{ q: '7 × 8', k: '7×8', ans: 56, tries: [54, 56], ms }],
 *     seconds, total, firstTry, correct, bestCombo, complete, xp, levelUp?: { from, to } }
 */
import { SKILLS, skillById, topLevel } from './skills/index.js';
import { STAGES } from './skills/multiplication.js';
import { dayKey, parseKey, addDays, weekStart } from './util.js';

export const PASS_ACCURACY = 0.9;       // first-try accuracy needed for a session to count towards the next level
export const PASSES_TO_LEVEL_UP = 2;    // passing sessions needed at a level to move up
export const MIN_PASS_PROBLEMS = 10;    // shorter sessions don't count towards levelling up
export const MAX_PROBLEM_MS = 60_000;   // time on one problem counted towards goals is capped (no credit for wandering off)
export const CHALLENGE_SECONDS = 60;

export const XP = { firstTry: 10, retry: 4, combo: 10, comboEvery: 5, complete: 20, perfect: 30, personalBest: 25, dailyGoal: 50, weeklyGoal: 100 };

export const DEFAULT_KID = { dailyGoal: 5, weeklyGoal: 20, sessionLength: 20 };

// ---------------------------------------------------------------------------
// Kids
// ---------------------------------------------------------------------------
export const dailyGoalOf = (k) => k.dailyGoal || DEFAULT_KID.dailyGoal;
export const weeklyGoalOf = (k) => k.weeklyGoal || DEFAULT_KID.weeklyGoal;
export const sessionLengthOf = (k) => k.sessionLength || DEFAULT_KID.sessionLength;
export const skillState = (k, skillId) => ({ level: 0, passes: 0, ...(k.skills?.[skillId] || {}) });
export const enabledSkills = (k) => SKILLS.filter((s) => !(k.disabledSkills || []).includes(s.id));

/** Times tables a kid has reached so far (for challenges and the parent report). */
export function unlockedTables(k) {
  const { level } = skillState(k, 'mult');
  return STAGES.slice(0, Math.min(level, STAGES.length - 1) + 1).flat();
}

// ---------------------------------------------------------------------------
// Scoring one session
// ---------------------------------------------------------------------------
export function scoreProblems(problems) {
  let firstTry = 0, correct = 0, combo = 0, bestCombo = 0, combos = 0, ms = 0;
  for (const p of problems) {
    const first = p.tries[0] === p.ans;
    if (first) { firstTry++; combo++; if (combo % XP.comboEvery === 0) combos++; } else combo = 0;
    if (p.tries[p.tries.length - 1] === p.ans) correct++;
    bestCombo = Math.max(bestCombo, combo);
    ms += Math.min(p.ms || 0, MAX_PROBLEM_MS);
  }
  return { total: problems.length, firstTry, correct, bestCombo, combos, seconds: Math.round(ms / 1000) };
}

/** Did this session count towards levelling up? Only full practice sessions at her own level do. */
export const isPass = (s) => s.mode === 'practice' && s.complete && s.total >= MIN_PASS_PROBLEMS && s.firstTry / s.total >= PASS_ACCURACY;

/** Apply a finished session to the kid's level for that skill. Returns the updated kid and any level-up. */
export function advanceSkill(kid, session) {
  const skill = skillById(session.skill);
  const st = skillState(kid, session.skill);
  if (!skill || !isPass(session) || session.level !== st.level || st.level >= topLevel(skill)) {
    return { kid, levelUp: null, passed: isPass(session) };
  }
  let next = { level: st.level, passes: st.passes + 1 };
  let levelUp = null;
  if (next.passes >= PASSES_TO_LEVEL_UP) {
    levelUp = { from: st.level, to: st.level + 1 };
    next = { level: st.level + 1, passes: 0 };
  }
  return { kid: { ...kid, skills: { ...(kid.skills || {}), [session.skill]: next } }, levelUp, passed: true };
}

/**
 * XP for a session. `before` is the kid's other sessions, used for goal bonuses and personal bests.
 * The result is stored on the session, so changing goals later never takes XP away.
 */
export function sessionXp(kid, session, before, today = dayKey()) {
  const sc = scoreProblems(session.problems);
  const parts = [];
  const add = (label, n) => { if (n) parts.push({ label, n }); };
  add('Correct answers', sc.firstTry * XP.firstTry + (sc.correct - sc.firstTry) * XP.retry);
  add('Combos', sc.combos * XP.combo);
  if (session.mode !== 'challenge' && session.complete) {
    add('Finished', XP.complete);
    if (sc.total >= MIN_PASS_PROBLEMS && sc.firstTry === sc.total) add('Perfect!', XP.perfect);
  }
  if (session.mode === 'challenge' && sc.correct > 0 && sc.correct > challengeBest(before, session.skill, session.level)) add('New best!', XP.personalBest);

  const byDay = secondsByDay(before);
  const dayBefore = byDay[today] || 0;
  const weekBefore = weekSeconds(byDay, today);
  if (dayBefore < dailyGoalOf(kid) * 60 && dayBefore + sc.seconds >= dailyGoalOf(kid) * 60) add('Daily goal', XP.dailyGoal);
  if (weekBefore < weeklyGoalOf(kid) * 60 && weekBefore + sc.seconds >= weeklyGoalOf(kid) * 60) add('Weekly goal', XP.weeklyGoal);
  return { xp: parts.reduce((a, p) => a + p.n, 0), parts };
}

export function challengeBest(sessions, skill, level) {
  let best = 0;
  for (const s of sessions) if (s.mode === 'challenge' && s.skill === skill && s.level === level) best = Math.max(best, s.correct || 0);
  return best;
}

// ---------------------------------------------------------------------------
// Player level (from total XP)
// ---------------------------------------------------------------------------
/** XP needed to reach level L: each level takes 100 more XP than the one before (100, 200, 300…). */
export const xpForLevel = (L) => 50 * L * (L - 1);
const TITLES = [[1, 'Number Rookie', '🐣'], [4, 'Math Explorer', '🧭'], [7, 'Number Ninja', '🥷'], [10, 'Math Wizard', '🧙'],
  [14, 'Math Hero', '🦸'], [18, 'Math Legend', '🐉'], [23, 'Math Superstar', '🌟'], [30, 'Math Champion', '🏆']];

export function playerLevel(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const [, title, icon] = [...TITLES].reverse().find(([l]) => level >= l);
  const base = xpForLevel(level), next = xpForLevel(level + 1);
  return { level, title, icon, xp, into: xp - base, need: next - base };
}
export const totalXp = (sessions) => sessions.reduce((a, s) => a + (s.xp || 0), 0);

// ---------------------------------------------------------------------------
// Time, goals and streaks
// ---------------------------------------------------------------------------
export function secondsByDay(sessions) {
  const map = {};
  for (const s of sessions) map[s.date] = (map[s.date] || 0) + (s.seconds || 0);
  return map;
}

export function weekSeconds(byDay, today = dayKey()) {
  const start = weekStart(parseKey(today));
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += byDay[dayKey(addDays(start, i))] || 0;
  return sum;
}

/** Days in a row with any practice. Today not done yet doesn't break it. */
export function dayStreak(byDay, today = dayKey()) {
  let d = parseKey(today);
  if (!byDay[dayKey(d)]) d = addDays(d, -1);
  let n = 0;
  while (byDay[dayKey(d)] > 0) { n++; d = addDays(d, -1); }
  return n;
}

export function bestDayStreak(byDay) {
  const days = Object.keys(byDay).filter((k) => byDay[k] > 0).sort();
  let best = 0, run = 0, prev = null;
  for (const k of days) {
    run = prev && dayKey(addDays(parseKey(prev), 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

/** Number of Mon–Sun weeks in which the weekly goal was met. */
export function weeksGoalMet(kid, byDay) {
  const weeks = {};
  for (const [k, sec] of Object.entries(byDay)) { const w = dayKey(weekStart(parseKey(k))); weeks[w] = (weeks[w] || 0) + sec; }
  return Object.values(weeks).filter((sec) => sec >= weeklyGoalOf(kid) * 60).length;
}

// ---------------------------------------------------------------------------
// Stats for reports
// ---------------------------------------------------------------------------
/** Per-fact results: { [key]: { n, wrong, ms } }. `wrong` counts first tries that were wrong. */
export function factStats(sessions, skill = 'mult', since = '') {
  const out = {};
  for (const s of sessions) {
    if (s.skill !== skill || s.date < since) continue;
    for (const p of s.problems || []) {
      const f = out[p.k] || (out[p.k] = { n: 0, wrong: 0, ms: 0 });
      f.n++;
      if (p.tries[0] !== p.ans) f.wrong++;
      f.ms += Math.min(p.ms || 0, MAX_PROBLEM_MS);
    }
  }
  return out;
}

/** Facts most worth practising: tried at least twice, got wrong first time at least a fifth of the time. */
export function troubleFacts(stats, limit = 8) {
  return Object.entries(stats)
    .filter(([, f]) => f.n >= 2 && f.wrong / f.n >= 0.2)
    .sort(([, a], [, b]) => b.wrong / b.n - a.wrong / a.n || b.n - a.n)
    .slice(0, limit)
    .map(([key, f]) => ({ key, ...f, acc: 1 - f.wrong / f.n }));
}

export function skillSummary(sessions, skill, since = '') {
  let total = 0, firstTry = 0, ms = 0, count = 0, seconds = 0;
  for (const s of sessions) {
    if (s.skill !== skill || s.date < since) continue;
    count++; total += s.total; firstTry += s.firstTry; seconds += s.seconds || 0;
    for (const p of s.problems || []) ms += Math.min(p.ms || 0, MAX_PROBLEM_MS);
  }
  return { sessions: count, total, firstTry, acc: total ? firstTry / total : null, avgSec: total ? ms / total / 1000 : null, seconds };
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
function totals(kid, sessions) {
  const byDay = secondsByDay(sessions);
  let problems = 0, perfect = 0, bestCombo = 0, seconds = 0;
  const bestChallenge = {};
  for (const s of sessions) {
    problems += s.total || 0;
    seconds += s.seconds || 0;
    bestCombo = Math.max(bestCombo, s.bestCombo || 0);
    if (s.mode !== 'challenge' && s.complete && s.total >= MIN_PASS_PROBLEMS && s.firstTry === s.total) perfect++;
    if (s.mode === 'challenge') bestChallenge[s.skill] = Math.max(bestChallenge[s.skill] || 0, s.correct || 0);
  }
  return {
    sessions: sessions.length, problems, perfect, bestCombo, minutes: Math.floor(seconds / 60),
    bestStreak: bestDayStreak(byDay), goalWeeks: weeksGoalMet(kid, byDay),
    challenge: Math.max(0, ...Object.values(bestChallenge)),
    level: (id) => skillState(kid, id).level,
  };
}

const B = (id, icon, name, desc, get, goal) => ({ id, icon, name, desc, get, goal });
export const BADGES = [
  B('first', '🎉', 'First Steps', 'Finish your first practice', (t) => t.sessions, 1),
  B('streak3', '🔥', 'On a Roll', 'Practise 3 days in a row', (t) => t.bestStreak, 3),
  B('streak7', '📅', 'Week Warrior', 'Practise 7 days in a row', (t) => t.bestStreak, 7),
  B('streak14', '⚡', 'Super Streak', 'Practise 14 days in a row', (t) => t.bestStreak, 14),
  B('streak30', '🌋', 'Unstoppable', 'Practise 30 days in a row', (t) => t.bestStreak, 30),
  B('goal1', '🎯', 'Goal Getter', 'Hit your weekly goal', (t) => t.goalWeeks, 1),
  B('goal4', '🏹', 'Goal Crusher', 'Hit your weekly goal 4 times', (t) => t.goalWeeks, 4),
  B('goal12', '🏅', 'Goal Machine', 'Hit your weekly goal 12 times', (t) => t.goalWeeks, 12),
  B('p100', '💯', 'Century', 'Answer 100 problems', (t) => t.problems, 100),
  B('p500', '🧮', 'Number Cruncher', 'Answer 500 problems', (t) => t.problems, 500),
  B('p1000', '🚀', 'Math Rocket', 'Answer 1,000 problems', (t) => t.problems, 1000),
  B('p5000', '🌌', 'Math Galaxy', 'Answer 5,000 problems', (t) => t.problems, 5000),
  B('perfect1', '⭐', 'Perfect!', 'Get every problem right first try', (t) => t.perfect, 1),
  B('perfect10', '🌟', 'Perfectionist', '10 perfect practices', (t) => t.perfect, 10),
  B('combo10', '🔗', 'Hot Streak', '10 right in a row', (t) => t.bestCombo, 10),
  B('combo25', '☄️', 'On Fire', '25 right in a row', (t) => t.bestCombo, 25),
  B('speed15', '⏱️', 'Speedy', '15 right in a 1-minute challenge', (t) => t.challenge, 15),
  B('speed25', '⚡', 'Lightning', '25 right in a 1-minute challenge', (t) => t.challenge, 25),
  B('time60', '⌛', 'Hour of Power', 'Practise for 60 minutes in all', (t) => t.minutes, 60),
  B('time300', '🕰️', 'Time Master', 'Practise for 5 hours in all', (t) => t.minutes, 300),
  B('addAce', '➕', 'Addition Ace', 'Reach the top addition level', (t) => t.level('add'), topLevel(skillById('add'))),
  B('subStar', '➖', 'Subtraction Star', 'Reach the top subtraction level', (t) => t.level('sub'), topLevel(skillById('sub'))),
  B('mult6', '✖️', 'Halfway Hero', 'Unlock 6 times-table levels', (t) => t.level('mult') + 1, 6),
  B('multAll', '🏆', 'Times Table Champion', 'Unlock every times table', (t) => t.level('mult'), topLevel(skillById('mult'))),
];

export function badges(kid, sessions) {
  const t = totals(kid, sessions);
  return BADGES.map((b) => {
    const value = b.get(t);
    return { id: b.id, icon: b.icon, name: b.name, desc: b.desc, goal: b.goal, value: Math.min(value, b.goal), earned: value >= b.goal };
  });
}
