/* Math Champion — mental math and times-tables practice for kids.
 * State lives in localStorage on each device and syncs through Firebase when a family account is signed in. */
import { SKILLS, skillById, topLevel } from './skills/index.js';
import { ALL_TABLES } from './skills/multiplication.js';
import {
  scoreProblems, advanceSkill, sessionXp, playerLevel, totalXp, secondsByDay, weekSeconds, dayStreak, bestDayStreak,
  badges, factStats, challengeBest, skillState, enabledSkills, unlockedTables, dailyGoalOf, weeklyGoalOf, sessionLengthOf,
  CHALLENGE_SECONDS, MAX_PROBLEM_MS, PASSES_TO_LEVEL_UP, PASS_ACCURACY, DEFAULT_KID,
} from './progress.js';
import { loadState, saveState, normalize, blankState, loadPrefs, savePrefs } from './store.js';
import { Sync } from './sync.js';
import { sounds, setMuted } from './sound.js';
import { ICONS, ringHTML, progressBar, barChart, tile, badgeCard } from './views/common.js';
import { reportHTML, settingsHTML } from './views/parent.js';
import { uid, esc, dayKey, parseKey, addDays, weekStart, clamp, plural, pct, fmtDuration, randInt } from './util.js';

const APP_VERSION = '2026-10-27.1'; // bump with each release (and CACHE in sw.js) so parents can see which version a device runs
const AVATARS = ['🦊', '🐼', '🦄', '🐸', '🐯', '🐙', '🦖', '🐧', '🐨', '🦁', '🐰', '🚀', '🐶', '🐱', '🦋', '🐲', '🌟', '🧚'];
const COLORS = ['#7c5cff', '#ff5c8a', '#ff8a3d', '#12b886', '#339af0', '#e64980', '#f59f00', '#15aabf'];
const CHEERS = ['Awesome!', 'Great job!', 'You did it!', 'Way to go!', 'Fantastic!', 'You rock!', 'Brilliant!'];
const RIGHT = ['Yes!', 'Correct!', 'Nice!', 'Great!', 'You got it!', 'Super!'];
const LOCK_AFTER_MS = 2 * 60 * 1000;

const $ = (sel, root = document) => root.querySelector(sel);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let state = loadState();
const prefs = loadPrefs();
setMuted(prefs.muted);

const ui = {
  tab: 'home',
  picking: state.kids.length > 1, // several kids on one device: start on "Who's practising?"
  modal: null,
  play: null,     // the practice in progress (see startPractice)
  summary: null,  // the results screen after a practice
  parentOpen: false,
  parentTab: 'report',
  reportKidId: null,
  openSession: null,
  syncMsg: '', syncMsgErr: false,
};

const kid = () => state.kids.find((k) => k.id === state.activeKidId) || null;
const kidSessions = (id) => state.sessions.filter((s) => s.kidId === id);

function save() {
  saveState(state);
  Sync.push();
}
function commit() { save(); render(); }

// ---------------------------------------------------------------------------
// Rendering: kid screens
// ---------------------------------------------------------------------------
function render() {
  const app = $('#app');
  const k = kid();
  document.documentElement.style.setProperty('--accent', (ui.parentOpen ? null : k?.color) || '#7c5cff');
  if (ui.parentOpen) { app.innerHTML = parentHTML(); return; }
  if (!state.kids.length) { app.innerHTML = welcomeHTML(); return; }
  if (!k || ui.picking) { app.innerHTML = pickerHTML(); return; }
  const sessions = kidSessions(k.id);
  const body = ui.tab === 'badges' ? badgesHTML(k, sessions) : ui.tab === 'me' ? meHTML(k, sessions) : homeHTML(k, sessions);
  app.innerHTML = `<div class="wrap">${topbarHTML(k, sessions)}${body}</div>${navHTML()}`;
}

function topbarHTML(k, sessions) {
  const lvl = playerLevel(totalXp(sessions));
  return `<header class="topbar">
    <button class="avatar" style="--kid:${k.color}" data-action="switch-kid" aria-label="Switch kid">${k.avatar}</button>
    <div class="hello"><h1>Hi, ${esc(k.name)}!</h1><div class="sub">${lvl.icon} Level ${lvl.level} · ${esc(lvl.title)}</div></div>
    <button class="icon-btn" data-action="mute" aria-label="${prefs.muted ? 'Turn sound on' : 'Turn sound off'}">${prefs.muted ? ICONS.soundOff : ICONS.soundOn}</button>
    <button class="icon-btn" data-action="parent" aria-label="Grown-ups">${ICONS.lock}</button>
  </header>`;
}

function navHTML() {
  const b = (tab, icon, label) => `<button class="${ui.tab === tab ? 'on' : ''}" data-action="tab" data-tab="${tab}">${icon}<span>${label}</span></button>`;
  return `<nav class="nav">${b('home', ICONS.home, 'Practice')}${b('badges', ICONS.badges, 'Badges')}${b('me', ICONS.stats, 'My progress')}</nav>`;
}

function welcomeHTML() {
  return `<div class="welcome"><div class="inner">
    <img class="logo" src="icon.svg" alt="" />
    <h1>Math Champion</h1>
    <p class="lead">Quick daily times-tables practice. Level up, earn badges and keep your streak going!</p>
    <button class="btn btn-primary btn-block" data-action="add-kid">Let's get started</button>
    ${Sync.enabled ? `<button class="btn btn-soft btn-block" style="margin-top:12px" data-action="sync-open">Sign in to your family account</button>` : ''}
  </div></div>`;
}

function pickerHTML() {
  return `<div class="welcome"><div class="inner">
    <h1>Who's practising?</h1>
    <div class="pick">${state.kids.map((k) => {
      const byDay = secondsByDay(kidSessions(k.id));
      const streak = dayStreak(byDay);
      return `<button class="who" data-action="choose-kid" data-id="${k.id}"><div class="avatar lg" style="--kid:${k.color}">${k.avatar}</div>${esc(k.name)}<span class="mini">${streak ? `🔥 ${streak}-day streak` : '&nbsp;'}</span></button>`;
    }).join('')}</div>
    <button class="link-btn" data-action="parent">${ICONS.lock} Grown-ups</button>
  </div></div>`;
}

function homeHTML(k, sessions) {
  const byDay = secondsByDay(sessions);
  const todayMin = Math.floor((byDay[dayKey()] || 0) / 60);
  const weekMin = Math.floor(weekSeconds(byDay) / 60);
  const goal = dailyGoalOf(k), wgoal = weeklyGoalOf(k);
  const streak = dayStreak(byDay);
  const lvl = playerLevel(totalXp(sessions));
  const msg = todayMin >= goal ? (weekMin >= wgoal ? 'Week goal done! You’re a champion! 🏆' : 'Today’s goal done! 🎉')
    : todayMin > 0 ? `${goal - todayMin} more minute${goal - todayMin === 1 ? '' : 's'} to reach today’s goal!` : 'Ready for some math?';
  return `<section class="card hero">
      <div class="hero-row">
        ${ringHTML(todayMin, goal, `${todayMin} of ${goal} minutes today`)}
        <div class="hero-info">
          <div class="msg">${msg}</div>
          <div class="pill-row"><span class="pill">🔥 ${plural(streak, 'day')}</span><span class="pill">⭐ ${lvl.xp.toLocaleString()} XP</span></div>
        </div>
      </div>
      <div class="meter light ${weekMin >= wgoal ? 'done' : ''}"><div class="m-top"><span>This week</span><b>${weekMin} / ${wgoal} min</b></div>${progressBar(weekMin, wgoal, { done: weekMin >= wgoal })}</div>
      <div class="meter light"><div class="m-top"><span>${lvl.icon} Level ${lvl.level} → ${lvl.level + 1}</span><b>${lvl.into} / ${lvl.need} XP</b></div>${progressBar(lvl.into, lvl.need)}</div>
    </section>
    <div class="section-title"><h2>Practice</h2></div>
    ${enabledSkills(k).map((sk) => skillCard(k, sk, sessions)).join('') || '<div class="card empty"><p>No skills are switched on. Ask a grown-up to turn some on.</p></div>'}`;
}

function skillCard(k, sk, sessions) {
  const st = skillState(k, sk.id);
  const top = st.level >= topLevel(sk);
  const best = challengeBest(sessions, sk.id, st.level);
  return `<div class="card skill" style="--skill:${sk.color}">
    <div class="skill-head">
      <div class="skill-icon">${sk.icon}</div>
      <div class="grow">
        <h3>${esc(sk.name)}</h3>
        <div class="s">Level ${st.level + 1} of ${sk.levels.length}: <b>${esc(sk.levels[st.level].name)}</b> · ${esc(sk.levels[st.level].example)}</div>
      </div>
    </div>
    <div class="stars-row" aria-label="${top ? 'Top level reached' : `${st.passes} of ${PASSES_TO_LEVEL_UP} great practices towards the next level`}">
      ${top ? '<span class="tag">🏆 Top level! Keep it sharp.</span>' : `${Array.from({ length: PASSES_TO_LEVEL_UP }, (_, i) => `<span class="star ${i < st.passes ? 'on' : ''}">★</span>`).join('')}
      <span class="tag">${PASSES_TO_LEVEL_UP - st.passes} great practice${PASSES_TO_LEVEL_UP - st.passes === 1 ? '' : 's'} to level up</span>`}
    </div>
    <div class="skill-actions">
      <button class="btn btn-primary" data-action="start" data-skill="${sk.id}" data-mode="practice">${ICONS.play} Practice</button>
      <button class="btn btn-soft" data-action="start" data-skill="${sk.id}" data-mode="challenge">⚡ 1-minute${best ? ` <small>best ${best}</small>` : ''}</button>
      ${sk.pickable ? `<button class="btn btn-soft" data-action="pick-open" data-skill="${sk.id}">🎯 ${esc(sk.pickable.label)}</button>` : ''}
    </div>
  </div>`;
}

function badgesHTML(k, sessions) {
  const list = badges(k, sessions);
  const earned = list.filter((b) => b.earned).length;
  return `<div class="section-title"><h2>Badges</h2><span class="muted">${earned} of ${list.length}</span></div>
    <div class="badges">${[...list.filter((b) => b.earned), ...list.filter((b) => !b.earned)].map(badgeCard).join('')}</div>`;
}

function meHTML(k, sessions) {
  const byDay = secondsByDay(sessions);
  const ws = weekStart();
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = dayKey(addDays(ws, i));
    const m = Math.floor((byDay[d] || 0) / 60);
    return { label: parseKey(d).toLocaleDateString(undefined, { weekday: 'short' }), value: m, today: d === today, future: d > today, title: `${m} min` };
  });
  const total = sessions.reduce((a, s) => a + s.total, 0);
  const first = sessions.reduce((a, s) => a + s.firstTry, 0);
  return `<div class="section-title"><h2>This week</h2></div>
    <div class="card">${barChart(days, { goal: dailyGoalOf(k) })}</div>
    <div class="tiles">
      ${tile('🧮', total.toLocaleString(), 'Problems solved')}
      ${tile('🎯', total ? `${pct(first, total)}%` : '–', 'Right first try')}
      ${tile('🔥', bestDayStreak(byDay), 'Best streak (days)')}
      ${tile('⏱️', fmtDuration(sessions.reduce((a, s) => a + (s.seconds || 0), 0)), 'Practice time')}
    </div>
    <div class="section-title"><h2>My level map</h2></div>
    ${enabledSkills(k).map((sk) => {
      const st = skillState(k, sk.id);
      return `<div class="card"><h3 class="card-title">${sk.icon} ${esc(sk.name)}</h3><ol class="level-map">${sk.levels.map((lv, i) => `
        <li class="${i < st.level ? 'done' : i === st.level ? 'now' : 'locked'}"><span class="lm-dot">${i < st.level ? '✓' : i === st.level ? '▶' : '🔒'}</span>
        <span><b>${esc(lv.name)}</b> <small>${esc(lv.example)}</small></span></li>`).join('')}</ol></div>`;
    }).join('')}`;
}

// ---------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------
function startPractice(skillId, mode, tables = null) {
  const k = kid();
  const sk = skillById(skillId);
  if (!k || !sk) return;
  const { level } = skillState(k, skillId);
  const history = factStats(kidSessions(k.id).filter((s) => s.date >= dayKey(addDays(new Date(), -60))), skillId);
  // Challenges on times tables mix every table she has unlocked so far.
  const useTables = mode === 'pick' ? tables : mode === 'challenge' && skillId === 'mult' ? unlockedTables(k) : null;
  const count = mode === 'challenge' ? 150 : sessionLengthOf(k);
  ui.summary = null;
  ui.play = {
    kidId: k.id, skill: skillId, mode, level, tables: mode === 'pick' ? tables : null,
    queue: sk.problems({ level, count, tables: useTables, history }),
    i: 0, entry: '', tries: [], feedback: null, anim: false, combo: 0,
    done: [], shownAt: performance.now(), startedAt: Date.now(),
    endsAt: mode === 'challenge' ? Date.now() + CHALLENGE_SECONDS * 1000 : null,
  };
  sounds.tap();
  renderPlay();
  if (mode === 'challenge') tickChallenge();
}

function tickChallenge() {
  const p = ui.play;
  if (!p || p.mode !== 'challenge') return;
  const left = Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000));
  const el = $('#play-clock');
  if (el) { el.textContent = `${left}s`; el.classList.toggle('low', left <= 10); }
  if (left <= 0) { finishPractice(true); return; }
  p.timer = setTimeout(tickChallenge, 250);
}

function current() { const p = ui.play; return p.queue[p.i]; }

function playKey(key) {
  const p = ui.play;
  if (!p || p.feedback === 'right') return;
  if (p.feedback === 'reveal') { if (key === 'enter') nextProblem(); return; }
  if (key === 'back') p.entry = p.entry.slice(0, -1);
  else if (key === 'enter') { submitAnswer(); return; }
  else if (/^[0-9]$/.test(key) && p.entry.length < 4) p.entry = (p.entry === '0' ? '' : p.entry) + key;
  p.anim = false;
  renderPlay();
}

function submitAnswer() {
  const p = ui.play;
  if (p.entry === '') return;
  const prob = current();
  const given = Number(p.entry);
  p.tries.push(given);
  p.anim = true;
  if (given === prob.answer) {
    if (p.tries.length === 1) p.combo++; else p.combo = 0;
    p.feedback = 'right';
    p.cheer = pickOne(RIGHT);
    if (p.tries.length === 1 && p.combo > 0 && p.combo % 5 === 0) sounds.combo(); else sounds.correct();
    record();
    renderPlay();
    setTimeout(nextProblem, p.mode === 'challenge' ? 250 : 650);
    return;
  }
  p.combo = 0;
  sounds.wrong();
  if (p.mode === 'challenge') { // one try only: keep moving
    p.feedback = 'miss';
    record();
    renderPlay();
    setTimeout(nextProblem, 600);
    return;
  }
  if (p.tries.length === 1) { p.feedback = 'wrong'; p.entry = ''; renderPlay(); return; }
  p.feedback = 'reveal';
  record();
  // Missed it twice: bring it back once later in this practice (instead of the last planned problem).
  if (!prob.again && p.queue.length - p.i > 3) {
    p.queue.splice(p.i + 3 + randInt(0, 2), 0, { ...prob, again: true });
    p.queue.pop();
  }
  renderPlay();
}

/** Save the current problem's result (once it's answered or revealed). */
function record() {
  const p = ui.play;
  const prob = current();
  p.done.push({ q: prob.text, k: prob.key, ans: prob.answer, tries: [...p.tries], ms: Math.round(Math.min(performance.now() - p.shownAt, MAX_PROBLEM_MS)) });
}

function nextProblem() {
  const p = ui.play;
  if (!p || ui.play !== p) return;
  if (p.mode === 'challenge' && Date.now() >= p.endsAt) { finishPractice(true); return; }
  p.i++;
  p.entry = ''; p.tries = []; p.feedback = null; p.anim = false;
  p.shownAt = performance.now();
  if (p.i >= p.queue.length) { finishPractice(true); return; }
  renderPlay();
}

function quitPractice() {
  const p = ui.play;
  if (!p) return;
  if (p.done.length && !confirm('Stop now? The problems you’ve done still count.')) return;
  finishPractice(false);
}

function finishPractice(complete) {
  const p = ui.play;
  if (!p) return;
  clearTimeout(p.timer);
  ui.play = null;
  const k = state.kids.find((x) => x.id === p.kidId);
  if (!p.done.length || !k) { renderPlay(); render(); return; }

  const before = kidSessions(k.id);
  const badgesBefore = new Set(badges(k, before).filter((b) => b.earned).map((b) => b.id));
  const levelBefore = playerLevel(totalXp(before)).level;
  const session = {
    id: uid(), kidId: k.id, date: dayKey(), createdAt: new Date().toISOString(),
    skill: p.skill, mode: p.mode, level: p.level, ...(p.tables ? { tables: p.tables } : {}),
    problems: p.done, complete: p.mode === 'challenge' ? true : complete,
  };
  const { combos: _c, ...score } = scoreProblems(session.problems);
  Object.assign(session, score);
  const { xp, parts } = sessionXp(k, session, before);
  session.xp = xp;
  const adv = advanceSkill(k, session);
  if (adv.levelUp) session.levelUp = adv.levelUp;
  state.kids = state.kids.map((x) => (x.id === k.id ? adv.kid : x));
  state.sessions.push(session);
  save();

  const after = kidSessions(k.id);
  const newBadges = badges(adv.kid, after).filter((b) => b.earned && !badgesBefore.has(b.id));
  const lvl = playerLevel(totalXp(after));
  ui.summary = { session, parts, levelUp: adv.levelUp, passed: adv.passed, newBadges, playerUp: lvl.level > levelBefore ? lvl : null,
    best: p.mode === 'challenge' ? challengeBest(before, p.skill, p.level) : 0 };
  render();
  renderPlay();
  if (adv.levelUp || ui.summary.playerUp) { sounds.levelUp(); confetti(); }
  else if (newBadges.length) { sounds.badge(); confetti(); }
  else sounds.finish();
}

function renderPlay() {
  const root = $('#play-root');
  if (ui.summary) { root.innerHTML = summaryHTML(); return; }
  const p = ui.play;
  if (!p) { root.innerHTML = ''; return; }
  const k = state.kids.find((x) => x.id === p.kidId);
  const sk = skillById(p.skill);
  const prob = current();
  const fb = p.feedback;
  const status = p.mode === 'challenge'
    ? `<div class="clock" id="play-clock">${Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000))}s</div><div class="count">✓ ${p.done.filter((d) => d.tries[0] === d.ans).length}</div>`
    : `<div class="play-progress">${progressBar(p.i, p.queue.length)}</div><div class="count">${p.i + 1} / ${p.queue.length}</div>`;
  const boxCls = fb === 'right' ? 'right' : fb === 'wrong' || fb === 'miss' ? 'wrong' : fb === 'reveal' ? 'reveal' : '';
  const shown = fb === 'reveal' ? prob.answer : p.entry || '?';
  let feedback = '';
  if (fb === 'right') feedback = `<div class="fb good ${p.anim ? 'pop' : ''}">${p.combo >= 3 ? `🔥 ${p.combo} in a row!` : `✓ ${esc(p.cheer)}`}</div>`;
  else if (fb === 'wrong') feedback = `<div class="fb try ${p.anim ? 'shake' : ''}">Not quite. Try again!</div>`;
  else if (fb === 'miss') feedback = `<div class="fb try">${esc(prob.text)} = ${prob.answer}</div>`;
  else if (fb === 'reveal') feedback = `<div class="fb reveal ${p.anim ? 'pop' : ''}"><div>The answer is <b>${prob.answer}</b>.</div><div class="hint-line">💡 ${esc(sk.hint(prob))}</div></div>`;
  else if (p.combo >= 3) feedback = `<div class="fb combo">🔥 ${p.combo} in a row</div>`;

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', 'enter'];
  root.innerHTML = `<div class="play" style="--accent:${k?.color || '#7c5cff'};--skill:${sk.color}">
    <div class="play-top">
      <button class="icon-btn" data-action="quit" aria-label="Stop">${ICONS.close}</button>
      ${status}
      <button class="icon-btn" data-action="mute" aria-label="${prefs.muted ? 'Turn sound on' : 'Turn sound off'}">${prefs.muted ? ICONS.soundOff : ICONS.soundOn}</button>
    </div>
    <div class="play-main">
      <div class="problem ${fb === 'right' && p.anim ? 'bounce' : ''}" aria-live="polite">
        <span class="q">${esc(prob.text)} =</span>
        <span class="answer ${boxCls} ${(fb === 'wrong' || fb === 'miss') && p.anim ? 'shake' : ''}">${shown}</span>
      </div>
      <div class="fb-slot">${feedback}</div>
    </div>
    ${fb === 'reveal'
      ? `<div class="numpad-slot"><button class="btn btn-primary btn-block btn-big" data-action="play-key" data-key="enter">Next ➜</button></div>`
      : `<div class="numpad">${keys.map((key) => key === 'back'
        ? `<button data-action="play-key" data-key="back" aria-label="Delete">${ICONS.back}</button>`
        : key === 'enter' ? `<button class="go" data-action="play-key" data-key="enter" aria-label="Check answer" ${p.entry ? '' : 'disabled'}>${ICONS.check}</button>`
          : `<button data-action="play-key" data-key="${key}">${key}</button>`).join('')}</div>`}
  </div>`;
}

function summaryHTML() {
  const { session: s, parts, levelUp, passed, newBadges, playerUp, best } = ui.summary;
  const sk = skillById(s.skill);
  const k = state.kids.find((x) => x.id === s.kidId);
  const st = skillState(k, s.skill);
  const acc = s.total ? s.firstTry / s.total : 0;
  const isChallenge = s.mode === 'challenge';
  const big = isChallenge ? (s.correct > best ? '🚀' : '⚡') : acc === 1 ? '🌟' : acc >= PASS_ACCURACY ? '🎉' : acc >= 0.7 ? '👍' : '💪';
  const head = isChallenge ? (s.correct > best && best > 0 ? 'New personal best!' : `${s.correct} right in one minute!`)
    : !s.complete ? 'Good effort!' : acc === 1 ? 'Perfect score!' : acc >= PASS_ACCURACY ? pickOne(CHEERS) : acc >= 0.7 ? 'Nice work!' : 'Keep practising, you’re getting there!';

  let progress = '';
  if (levelUp) {
    progress = `<div class="banner level"><div class="b-ic">⬆️</div><div><b>Level up!</b> ${esc(sk.name)} level ${levelUp.to + 1} unlocked:<br><b>${esc(sk.levels[levelUp.to].name)}</b> <small>(${esc(sk.levels[levelUp.to].example)})</small></div></div>`;
  } else if (s.mode === 'practice' && st.level < topLevel(sk)) {
    const left = PASSES_TO_LEVEL_UP - st.passes;
    progress = passed
      ? `<div class="banner"><div class="b-ic">⭐</div><div>That one counts! <b>${left} more great practice${left === 1 ? '' : 's'}</b> to unlock <b>${esc(sk.levels[st.level + 1].name)}</b>.</div></div>`
      : `<div class="banner soft"><div class="b-ic">🎯</div><div>Get ${Math.round(PASS_ACCURACY * 100)}% right first try in a full practice to earn a ★ towards <b>${esc(sk.levels[st.level + 1].name)}</b>.</div></div>`;
  }
  return `<div class="play summary" style="--accent:${k?.color || '#7c5cff'}">
    <div class="sum-inner">
      <div class="sum-big pop">${big}</div>
      <h2>${esc(head)}</h2>
      <div class="sum-stats">
        ${isChallenge ? `<div><b>${s.correct}</b><small>right</small></div><div><b>${Math.max(best, s.correct)}</b><small>best</small></div>`
          : `<div><b>${s.firstTry}/${s.total}</b><small>first try</small></div><div><b>${Math.round(acc * 100)}%</b><small>score</small></div>`}
        <div><b>${fmtDuration(s.seconds)}</b><small>time</small></div>
      </div>
      <div class="xp-box"><div class="xp-total">+${s.xp} XP</div>${parts.map((x) => `<div class="xp-line"><span>${esc(x.label)}</span><b>+${x.n}</b></div>`).join('')}</div>
      ${playerUp ? `<div class="banner level"><div class="b-ic">${playerUp.icon}</div><div><b>You reached level ${playerUp.level}!</b><br>${esc(playerUp.title)}</div></div>` : ''}
      ${progress}
      ${newBadges.map((b) => `<div class="banner badge-won"><div class="b-ic">${b.icon}</div><div><b>New badge: ${esc(b.name)}</b><br><small>${esc(b.desc)}</small></div></div>`).join('')}
      <div class="sum-actions">
        <button class="btn btn-soft" data-action="summary-done">Done</button>
        <button class="btn btn-primary" data-action="again">Play again</button>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Grown-ups area
// ---------------------------------------------------------------------------
function parentHTML() {
  const rk = state.kids.find((k) => k.id === ui.reportKidId) || kid() || state.kids[0];
  const tabBtn = (t, label) => `<button class="${ui.parentTab === t ? 'on' : ''}" data-action="parent-tab" data-tab="${t}">${label}</button>`;
  const body = ui.parentTab === 'settings' || !rk
    ? settingsHTML(state, { syncHTML: syncSectionHTML(), version: APP_VERSION })
    : reportHTML(state, rk, ui);
  return `<div class="wrap parent">
    <header class="topbar">
      <div class="hello"><h1>Grown-ups</h1><div class="sub">Reports and settings</div></div>
      <button class="btn btn-soft lock-btn" data-action="parent-lock">🔒 Lock</button>
    </header>
    <div class="seg">${tabBtn('report', '📊 Report')}${tabBtn('settings', '⚙️ Settings')}</div>
    ${body}
  </div>`;
}

function syncSectionHTML() {
  const head = '<h3 class="card-title">Family sync</h3>';
  if (!Sync.enabled) return `${head}<p class="hint">Sync isn't set up. See SYNC-SETUP.md.</p>`;
  const st = Sync.status;
  const chip = { synced: '<span class="sync-chip ok">✓ Up to date</span>', syncing: '<span class="sync-chip">Syncing…</span>', error: `<span class="sync-chip err">⚠️ ${esc(Sync.error)}</span>`, loading: '<span class="sync-chip">Loading…</span>' }[st] || '';
  if (Sync.email) {
    return `${head}<p class="hint" style="margin:0 0 10px">Signed in as <b>${esc(Sync.email)}</b>. ${chip}</p>
      <p class="hint" style="margin:0 0 10px">Practice from every signed-in device shows up in these reports.</p>
      <button class="btn btn-soft btn-block" data-action="sync-signout">Sign out on this device</button>`;
  }
  return `${head}<p class="hint" style="margin:0 0 10px">Sign in with your family account to back up progress and see reports from any device. ${st === 'error' ? chip : ''}</p>
    <button class="btn btn-primary btn-block" data-action="sync-open">Sign in</button>`;
}

let lockTimer = null;
function openParent() {
  ui.parentOpen = true;
  ui.parentTab = 'report';
  ui.reportKidId = state.activeKidId;
  touchParent();
  render();
  scrollTo({ top: 0 });
}
function lockParent(reason = '') {
  const wasOpen = ui.parentOpen;
  ui.parentOpen = false;
  clearTimeout(lockTimer);
  if (ui.modal && ui.modal.type !== 'pin') closeModal();
  render();
  if (wasOpen && reason) toast('🔒', 'Grown-ups area locked', reason);
}
function touchParent() {
  if (!ui.parentOpen) return;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => lockParent('Locked after 2 minutes without a tap'), LOCK_AFTER_MS);
}

// Parent PIN: a kid-proof lock, not real security (it lives in the family's own data).
function pinHash(pin, salt) {
  let h = 2166136261;
  for (const c of `${salt}:${pin}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** The grown-ups area always needs the PIN. The first time, the parent creates one. */
function requirePin(fn) {
  if (ui.parentOpen) return fn();
  if (!state.settings.pinHash) openModal('pin', { mode: 'set', entry: '', first: true, then: fn });
  else openModal('pin', { mode: 'check', entry: '', then: fn });
}

function pinKey(key) {
  const m = ui.modal;
  if (!m || m.type !== 'pin') return;
  m.error = '';
  if (key === 'back') m.entry = m.entry.slice(0, -1);
  else if (m.entry.length < 4) m.entry += key;
  if (m.entry.length === 4) {
    if (m.mode === 'check') {
      if (pinHash(m.entry, state.settings.pinSalt) === state.settings.pinHash) { closeModal(); m.then?.(); return; }
      m.entry = ''; m.error = 'That’s not it. Try again.';
    } else if (m.mode === 'set') {
      m.first_pin = m.entry; m.entry = ''; m.mode = 'confirm';
    } else if (m.mode === 'confirm') {
      if (m.entry !== m.first_pin) { m.entry = ''; m.mode = 'set'; m.error = 'Those didn’t match. Pick a PIN again.'; }
      else {
        const salt = uid();
        state.settings = { ...state.settings, pinSalt: salt, pinHash: pinHash(m.entry, salt) };
        save();
        closeModal();
        toast('🔒', 'PIN saved', Sync.email ? 'It works on all your synced devices.' : 'Tap Lock when you’re done.');
        m.then?.();
        if (ui.parentOpen) render();
        return;
      }
    }
  }
  renderModal();
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------
function openModal(type, data = {}) { ui.modal = { type, ...data }; renderModal(); }
function closeModal() { ui.modal = null; renderModal(); }

function renderModal() {
  const root = $('#modal-root');
  const m = ui.modal;
  if (!m) { root.innerHTML = ''; return; }
  const html = MODALS[m.type](m);
  root.innerHTML = `<div class="modal-backdrop" data-action="backdrop"><div class="modal" role="dialog" aria-modal="true"><div class="grip"></div>${html}</div></div>`;
  root.querySelector('[autofocus]')?.focus();
}

const head = (title) => `<div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-action="close" aria-label="Close">${ICONS.close}</button></div>`;

const MODALS = {
  pin(m) {
    const titles = { check: 'Grown-ups only 🔒', set: m.first ? 'Create a parent PIN' : 'Choose a new 4-digit PIN', confirm: 'Type the PIN again' };
    const sub = m.error || (m.mode === 'check' ? 'Type the parent PIN' : m.mode === 'set' ? (m.first ? 'This keeps reports and settings for grown-ups only.' : "Pick something the kids won't guess") : 'Just to be sure');
    return `${head(titles[m.mode])}
      <div class="pin-dots ${m.error ? 'shake' : ''}">${[0, 1, 2, 3].map((i) => `<i class="${i < m.entry.length ? 'on' : ''}"></i>`).join('')}</div>
      <p class="pin-msg ${m.error ? 'err' : ''}">${esc(sub)}</p>
      <div class="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', m.mode === 'check' ? 'forgot' : '', '0', 'back'].map((key) => {
        if (key === 'forgot') return '<button type="button" class="kp-text" data-action="pin-forgot">Forgot?</button>';
        if (key === 'back') return `<button type="button" class="kp-text" data-action="pin-key" data-val="back" aria-label="Delete">⌫</button>`;
        if (!key) return '<span></span>';
        return `<button type="button" data-action="pin-key" data-val="${key}">${key}</button>`;
      }).join('')}</div>`;
  },

  gate(m) {
    return `${head('Grown-up check')}
      <p class="hint" style="margin:0 0 14px">Forgot the PIN? Answer this to get in, then set a new PIN in Settings.</p>
      <form data-form="gate"><div class="field"><label for="gate-a">What is ${m.a} × ${m.b}?</label>
        <input class="input" id="gate-a" name="answer" inputmode="numeric" autocomplete="off" autofocus /></div>
        ${m.error ? `<p class="pin-msg err" style="text-align:left">${esc(m.error)}</p>` : ''}
        <div class="modal-foot"><button class="btn btn-primary" type="submit">Continue</button></div></form>`;
  },

  pick(m) {
    const sk = skillById(m.skill);
    const sel = new Set(m.tables);
    return `${head(`🎯 ${esc(sk.pickable.label)}`)}
      <p class="hint" style="margin:0 0 12px">Choose the times tables you want to practise.</p>
      <div class="table-pick">${sk.pickable.options.map((t) => `<button class="${sel.has(t) ? 'on' : ''}" data-action="pick-toggle" data-val="${t}">×${t}</button>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="btn btn-soft" data-action="pick-all">All</button><button class="btn btn-soft" data-action="pick-none">None</button></div>
      <div class="modal-foot"><button class="btn btn-primary" data-action="pick-go" ${sel.size ? '' : 'disabled'}>${ICONS.play} Start</button></div>`;
  },

  kid(m) {
    const d = m.draft;
    const isNew = !m.id;
    const goal = (key, label, unit, vals) => `<div class="field"><span class="label">${label}</span>
      <div class="choices">${vals.map((v) => `<button type="button" class="choice ${Number(d[key]) === v ? 'on' : ''}" data-action="draft" data-key="${key}" data-val="${v}">${v} ${unit}</button>`).join('')}
      <input class="input mini-input" type="number" min="1" max="600" name="${key}" value="${esc(d[key])}" aria-label="${label} (custom)" /></div></div>`;
    return `${head(isNew ? (state.kids.length ? 'Add a kid' : 'Who’s going to practise?') : `Edit ${esc(d.name)}`)}
      <form data-form="kid">
        <div class="field"><label for="kid-name">Name</label><input class="input" id="kid-name" name="name" value="${esc(d.name)}" maxlength="24" autocomplete="off" ${isNew ? 'autofocus' : ''} /></div>
        <div class="field"><span class="label">Avatar</span><div class="emoji-pick">${AVATARS.map((a) => `<button type="button" class="${d.avatar === a ? 'on' : ''}" data-action="draft" data-key="avatar" data-val="${a}">${a}</button>`).join('')}</div></div>
        <div class="field"><span class="label">Colour</span><div class="color-pick">${COLORS.map((c) => `<button type="button" class="${d.color === c ? 'on' : ''}" style="background:${c}" data-action="draft" data-key="color" data-val="${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div>
        ${goal('dailyGoal', 'Daily goal', 'min', [5, 10, 15])}
        ${goal('weeklyGoal', 'Weekly goal', 'min', [20, 30, 45, 60])}
        <div class="field"><span class="label">Problems per practice</span><div class="choices">${[10, 15, 20, 30].map((v) => `<button type="button" class="choice ${Number(d.sessionLength) === v ? 'on' : ''}" data-action="draft" data-key="sessionLength" data-val="${v}">${v}</button>`).join('')}</div></div>
        <div class="field"><span class="label">${SKILLS.length > 1 ? 'Skills and levels' : 'Level'}</span>
          ${SKILLS.map((sk) => `<div class="skill-set">
            ${SKILLS.length > 1 ? `<label class="check"><input type="checkbox" name="skill-${sk.id}" ${d.disabledSkills.includes(sk.id) ? '' : 'checked'} /> ${sk.icon} ${esc(sk.name)}</label>` : ''}
            <select class="input" name="level-${sk.id}" aria-label="${esc(sk.name)} level">${sk.levels.map((lv, i) => `<option value="${i}" ${d.levels[sk.id] === i ? 'selected' : ''}>Level ${i + 1}: ${esc(lv.name)} (${esc(lv.example)})</option>`).join('')}</select>
          </div>`).join('')}
          <p class="hint">Kids move up by themselves after ${PASSES_TO_LEVEL_UP} practices with ${Math.round(PASS_ACCURACY * 100)}%+ right first try. Change a level here to skip ahead or go back.</p>
        </div>
        <div class="modal-foot">
          ${isNew ? '' : '<button type="button" class="btn btn-danger" data-action="delete-kid">Remove</button>'}
          <button class="btn btn-primary" type="submit">${isNew ? 'Save' : 'Save changes'}</button>
        </div>
      </form>`;
  },

  sync(m) {
    return `${head('Family account')}
      <p class="hint" style="margin:0 0 14px">Use the same email and password as Reading Quest, or create a new family account. Every device signed in to it shares kids and progress.</p>
      <form data-form="sync">
        <div class="field"><label for="sync-email">Email</label><input class="input" id="sync-email" name="email" type="email" autocomplete="username" value="${esc(m.email || '')}" autofocus /></div>
        <div class="field"><label for="sync-pw">Password</label><input class="input" id="sync-pw" name="password" type="password" autocomplete="current-password" /></div>
        ${ui.syncMsg ? `<p class="pin-msg ${ui.syncMsgErr ? 'err' : ''}" style="text-align:left">${esc(ui.syncMsg)}</p>` : ''}
        <div class="modal-foot"><button class="btn btn-primary" type="submit">Sign in</button></div>
        <div class="row" style="margin-top:10px"><button type="button" class="link-btn" data-action="sync-signup">Create account</button><button type="button" class="link-btn" data-action="sync-reset">Forgot password?</button></div>
      </form>`;
  },
};

function kidDraft(k) {
  const base = k || { name: '', avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)], color: COLORS[state.kids.length % COLORS.length], ...DEFAULT_KID, skills: {}, disabledSkills: [] };
  return {
    name: base.name, avatar: base.avatar, color: base.color,
    dailyGoal: dailyGoalOf(base), weeklyGoal: weeklyGoalOf(base), sessionLength: sessionLengthOf(base),
    disabledSkills: [...(base.disabledSkills || [])],
    levels: Object.fromEntries(SKILLS.map((sk) => [sk.id, skillState(base, sk.id).level])),
  };
}

/** Keep typed values when the kid form re-renders (e.g. after tapping an avatar). */
function readKidForm() {
  const f = $('form[data-form="kid"]');
  const d = ui.modal?.draft;
  if (!f || !d) return;
  d.name = f.elements.name.value;
  d.dailyGoal = f.elements.dailyGoal.value;
  d.weeklyGoal = f.elements.weeklyGoal.value;
  // With only one skill there's no on/off switch, and it's always on.
  d.disabledSkills = SKILLS.length > 1 ? SKILLS.filter((sk) => !f.elements[`skill-${sk.id}`].checked).map((sk) => sk.id) : [];
  for (const sk of SKILLS) d.levels[sk.id] = Number(f.elements[`level-${sk.id}`].value);
}

function saveKid() {
  readKidForm();
  const m = ui.modal;
  const d = m.draft;
  const name = d.name.trim();
  if (!name) { $('#kid-name')?.focus(); return; }
  const dailyGoal = clamp(Math.round(Number(d.dailyGoal) || DEFAULT_KID.dailyGoal), 1, 120);
  const weeklyGoal = clamp(Math.round(Number(d.weeklyGoal) || DEFAULT_KID.weeklyGoal), 1, 600);
  const existing = state.kids.find((k) => k.id === m.id);
  const skills = Object.fromEntries(SKILLS.map((sk) => {
    const old = skillState(existing || {}, sk.id);
    // A level changed by hand starts fresh on its stars.
    return [sk.id, old.level === d.levels[sk.id] ? old : { level: d.levels[sk.id], passes: 0 }];
  }));
  const fields = { name, avatar: d.avatar, color: d.color, dailyGoal, weeklyGoal, sessionLength: Number(d.sessionLength), disabledSkills: d.disabledSkills, skills };
  if (existing) state.kids = state.kids.map((k) => (k.id === m.id ? { ...k, ...fields } : k));
  else {
    const k = { id: uid(), createdAt: new Date().toISOString(), ...fields };
    state.kids.push(k);
    if (!state.activeKidId || !ui.parentOpen) state.activeKidId = k.id;
  }
  closeModal();
  commit();
  if (!existing && !ui.parentOpen) toast(d.avatar, `Welcome, ${name}!`, 'Pick something to practise.');
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------
function exportData() {
  const { activeKidId: _a, ...data } = state;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `math-champion-backup-${dayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const data = normalize(JSON.parse(await file.text()));
      if (!data.kids.length) throw new Error('empty');
      if (!confirm('Replace all current Math Champion data with this backup?')) return;
      state = { ...data, activeKidId: data.kids[0].id };
      commit();
      toast('✅', 'Backup restored', `${plural(state.kids.length, 'kid')} imported`);
    } catch {
      toast('⚠️', "That file didn't work", 'Pick a Math Champion backup (.json)');
    }
  };
  input.click();
}

// ---------------------------------------------------------------------------
// Toasts and confetti
// ---------------------------------------------------------------------------
function toast(icon, title, sub = '') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="ti">${esc(icon)}</div><div>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  const root = $('#toast-root');
  root.appendChild(el);
  while (root.children.length > 2) root.firstElementChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3200);
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('#confetti');
  const ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#7c5cff', '#ff5c8a', '#ffd43b', '#20c997', '#339af0', '#ff8a3d'];
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: pickOne(colors),
  }));
  const t0 = performance.now();
  const frame = (t) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(t / 100 + p.r));
      ctx.restore();
    }
    if (t - t0 < 3000) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Sync sign-in
// ---------------------------------------------------------------------------
function setSyncMsg(msg, isErr = false) { ui.syncMsg = msg; ui.syncMsgErr = isErr; if (ui.modal?.type === 'sync') { const email = $('#sync-email')?.value; ui.modal.email = email; renderModal(); } }

async function syncAuth(method) {
  const f = $('form[data-form="sync"]');
  const email = f.elements.email.value.trim();
  const pw = f.elements.password.value;
  setSyncMsg(method === 'signUp' ? 'Creating account…' : 'Signing in…');
  try {
    await Sync[method](email, pw);
    ui.syncMsg = '';
    closeModal();
    toast('☁️', 'Signed in', 'Progress now syncs across your devices.');
    render();
  } catch (e) {
    setSyncMsg(e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
const actions = {
  tab: (el) => { ui.tab = el.dataset.tab; render(); scrollTo({ top: 0, behavior: 'smooth' }); },
  'switch-kid': () => { if (state.kids.length > 1) { ui.picking = true; render(); } },
  'choose-kid': (el) => { state.activeKidId = el.dataset.id; ui.picking = false; ui.tab = 'home'; saveState(state); render(); },
  mute: () => { prefs.muted = !prefs.muted; setMuted(prefs.muted); savePrefs(prefs); render(); renderPlay(); },
  parent: () => requirePin(openParent),
  'parent-lock': () => lockParent(),
  'parent-tab': (el) => { ui.parentTab = el.dataset.tab; render(); },
  'report-kid': (el) => { ui.reportKidId = el.dataset.id; ui.openSession = null; render(); },
  'toggle-session': (el) => { ui.openSession = ui.openSession === el.dataset.id ? null : el.dataset.id; render(); },

  start: (el) => startPractice(el.dataset.skill, el.dataset.mode),
  'pick-open': (el) => {
    const k = kid();
    const last = [...kidSessions(k.id)].reverse().find((s) => s.mode === 'pick' && s.skill === el.dataset.skill);
    openModal('pick', { skill: el.dataset.skill, tables: last?.tables || unlockedTables(k) });
  },
  'pick-toggle': (el) => {
    const t = Number(el.dataset.val);
    const m = ui.modal;
    m.tables = m.tables.includes(t) ? m.tables.filter((x) => x !== t) : [...m.tables, t].sort((a, b) => a - b);
    renderModal();
  },
  'pick-all': () => { ui.modal.tables = [...ALL_TABLES]; renderModal(); },
  'pick-none': () => { ui.modal.tables = []; renderModal(); },
  'pick-go': () => { const { skill, tables } = ui.modal; closeModal(); startPractice(skill, 'pick', tables); },
  'play-key': (el) => playKey(el.dataset.key),
  quit: () => quitPractice(),
  again: () => { const s = ui.summary.session; startPractice(s.skill, s.mode, s.tables || null); },
  'summary-done': () => { ui.summary = null; renderPlay(); render(); },

  'pin-key': (el) => pinKey(el.dataset.val),
  'pin-forgot': () => openModal('gate', { a: randInt(13, 19), b: randInt(13, 19), then: ui.modal.then }),
  'pin-set': () => openModal('pin', { mode: 'set', entry: '' }),

  'add-kid': () => {
    // The very first kid can be added without a PIN; after that it's a grown-up job.
    if (!state.kids.length || ui.parentOpen) openModal('kid', { draft: kidDraft(null) });
    else requirePin(() => openModal('kid', { draft: kidDraft(null) }));
  },
  'edit-kid': (el) => openModal('kid', { id: el.dataset.id, draft: kidDraft(state.kids.find((k) => k.id === el.dataset.id)) }),
  draft: (el) => { readKidForm(); const v = el.dataset.val; ui.modal.draft[el.dataset.key] = /^\d+$/.test(v) ? Number(v) : v; renderModal(); },
  'delete-kid': () => {
    const k = state.kids.find((x) => x.id === ui.modal.id);
    if (!confirm(`Remove ${k.name} and all of their practice history? This can't be undone.`)) return;
    state.kids = state.kids.filter((x) => x.id !== k.id);
    state.sessions = state.sessions.filter((s) => s.kidId !== k.id);
    if (state.activeKidId === k.id) state.activeKidId = state.kids[0]?.id || null;
    if (ui.reportKidId === k.id) ui.reportKidId = null;
    closeModal();
    commit();
  },

  export: () => exportData(),
  import: () => importData(),
  erase: () => {
    const synced = Sync.email ? ' This also erases it from every synced device.' : '';
    if (!confirm(`Erase all kids and practice history?${synced}`)) return;
    if (!confirm('Are you sure? Maybe export a backup first.')) return;
    state = { ...blankState(), settings: state.settings };
    ui.parentOpen = false;
    commit();
  },

  'sync-open': () => { ui.syncMsg = ''; openModal('sync'); },
  'sync-signup': () => syncAuth('signUp'),
  'sync-reset': async () => {
    const email = $('#sync-email').value.trim();
    if (!email) { setSyncMsg('Type your family email first.', true); return; }
    try { await Sync.resetPassword(email); setSyncMsg(`Password reset email sent to ${email}.`); } catch (e) { setSyncMsg(e.message, true); }
  },
  'sync-signout': async () => {
    if (!confirm('Sign out of family sync on this device? Progress already here stays on this device.')) return;
    try { await Sync.signOut(); render(); } catch (e) { toast('⚠️', e.message); }
  },

  close: () => closeModal(),
  backdrop: (el, e) => { if (e.target === el && ui.modal?.type !== 'pin') closeModal(); },
};

document.addEventListener('click', (e) => {
  touchParent();
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.dataset.action !== 'backdrop') e.preventDefault();
  fn(el, e);
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target.dataset.form;
  if (form === 'kid') saveKid();
  if (form === 'sync') syncAuth('signIn');
  if (form === 'gate') {
    const m = ui.modal;
    if (Number(e.target.elements.answer.value) === m.a * m.b) { closeModal(); m.then?.(); }
    else { m.error = 'Not quite. Try again.'; renderModal(); }
  }
});

document.addEventListener('keydown', (e) => {
  touchParent();
  if (e.target.matches?.('input, select, textarea')) { if (e.key === 'Escape') closeModal(); return; }
  if (ui.modal) {
    if (e.key === 'Escape') closeModal();
    if (ui.modal?.type === 'pin' && /^[0-9]$/.test(e.key)) pinKey(e.key);
    if (ui.modal?.type === 'pin' && e.key === 'Backspace') pinKey('back');
    return;
  }
  if (ui.play) {
    if (/^[0-9]$/.test(e.key)) playKey(e.key);
    else if (e.key === 'Backspace') playKey('back');
    else if (e.key === 'Enter') playKey('enter');
    else if (e.key === 'Escape') quitPractice();
    else return;
    e.preventDefault();
  } else if (ui.summary && e.key === 'Enter') {
    e.preventDefault();
    actions['summary-done']();
  }
});

document.addEventListener('visibilitychange', () => {
  // Switching away from the app locks the grown-ups area.
  if (document.hidden) { if (ui.parentOpen) lockParent(); return; }
  if (!ui.play) render(); // refresh "today" after midnight
});

Sync.init({
  get: () => state,
  // Another device changed something: take the family's data and redraw.
  apply: (data) => {
    state = normalize({ ...state, ...data });
    if (state.activeKidId && !state.kids.some((k) => k.id === state.activeKidId)) state.activeKidId = null;
    if (!state.activeKidId && state.kids.length === 1) state.activeKidId = state.kids[0].id;
    save();
    if (!ui.modal || ui.modal.type === 'sync') render();
  },
  onStatus: () => { if (ui.parentOpen && ui.parentTab === 'settings' && !ui.modal) render(); },
});

render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // Check for a new version whenever the app is opened, and reload once it's installed (but never mid-practice).
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  const reloadForUpdate = () => {
    if (reloading) return;
    if (ui.modal || ui.play) { setTimeout(reloadForUpdate, 2000); return; }
    reloading = true;
    location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) reloadForUpdate(); });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}
