/* The grown-ups' report: what each kid practised, how it went, and what to work on. Pure HTML builders. */
import { SKILLS, skillById } from '../skills/index.js';
import { ALL_TABLES, factKey } from '../skills/multiplication.js';
import {
  secondsByDay, weekSeconds, dayStreak, skillState, skillSummary, factStats, troubleFacts, totalXp, playerLevel,
  dailyGoalOf, weeklyGoalOf, enabledSkills, PASSES_TO_LEVEL_UP, PASS_ACCURACY,
} from '../progress.js';
import { esc, dayKey, parseKey, addDays, weekStart, fmtDuration, fmtDate, pct, plural } from '../util.js';
import { barChart, tile } from './common.js';

const MODES = { practice: 'Practice', pick: 'Picked tables', challenge: '1-minute challenge' };
const accText = (acc) => (acc == null ? '–' : `${Math.round(acc * 100)}%`);
const accClass = (acc) => (acc == null ? '' : acc >= PASS_ACCURACY ? 'good' : acc >= 0.7 ? 'ok' : 'low');

export function reportHTML(state, kid, ui, today = dayKey()) {
  const sessions = state.sessions.filter((s) => s.kidId === kid.id);
  const byDay = secondsByDay(sessions);
  const ws = dayKey(weekStart(parseKey(today)));
  const thisWeek = sessions.filter((s) => s.date >= ws && s.date <= today);
  const daysThisWeek = new Set(thisWeek.map((s) => s.date)).size;
  const probs = thisWeek.reduce((a, s) => a + s.total, 0);
  const first = thisWeek.reduce((a, s) => a + s.firstTry, 0);
  const weekMin = Math.round(weekSeconds(byDay, today) / 60);
  const lvl = playerLevel(totalXp(sessions));

  if (!sessions.length) {
    return `${kidChips(state, kid)}<div class="card empty"><div class="big">🌱</div><h3>No practice yet</h3><p>${esc(kid.name)}'s results will show up here after the first practice.</p></div>`;
  }

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = dayKey(addDays(parseKey(today), i - 13));
    const m = Math.round((byDay[d] || 0) / 60);
    return { label: parseKey(d).toLocaleDateString(undefined, { weekday: 'narrow' }), value: m, today: d === today, title: `${fmtDate(d, today)}: ${m} min` };
  });

  return `${kidChips(state, kid)}
    <div class="tiles tiles-3">
      ${tile('⏱️', `${weekMin}<small>/${weeklyGoalOf(kid)}m</small>`, 'Minutes this week')}
      ${tile('📅', `${daysThisWeek}<small>/7</small>`, 'Days practised')}
      ${tile('🎯', probs ? `${pct(first, probs)}%` : '–', `Right first try (${probs} problems)`)}
      ${tile('🔥', dayStreak(byDay, today), 'Day streak')}
      ${tile(lvl.icon, lvl.level, `Player level · ${lvl.title}`)}
      ${tile('🧮', sessions.reduce((a, s) => a + s.total, 0).toLocaleString(), 'Problems, all time')}
    </div>

    <div class="card">
      <div class="chart-head"><h3>Minutes per day</h3><span class="muted">Last 2 weeks · daily goal ${dailyGoalOf(kid)} min</span></div>
      ${barChart(days, { goal: dailyGoalOf(kid), dense: true })}
    </div>

    <div class="card">
      <h3 class="card-title">Skills</h3>
      <div class="table-wrap"><table class="report">
        <thead><tr><th>Skill</th><th>Level</th><th>Last 7 days</th><th>All time</th><th>Sec / problem</th></tr></thead>
        <tbody>${SKILLS.map((sk) => skillRow(kid, sessions, sk, today)).join('')}</tbody>
      </table></div>
      <p class="hint">Accuracy is "right on the first try". A practice counts towards the next level at ${Math.round(PASS_ACCURACY * 100)}% or better, and it takes ${PASSES_TO_LEVEL_UP} of those to level up.</p>
    </div>

    ${multReport(sessions, today, kid)}
    ${missedReport(sessions, kid)}

    <div class="card">
      <h3 class="card-title">Recent practice</h3>
      <div class="list">${sessions.slice(-20).reverse().map((s) => sessionRow(s, ui.openSession === s.id, today)).join('')}</div>
    </div>`;
}

function kidChips(state, kid) {
  if (state.kids.length < 2) return '';
  return `<div class="choices kid-chips">${state.kids.map((k) => `<button class="choice ${k.id === kid.id ? 'on' : ''}" data-action="report-kid" data-id="${k.id}">${k.avatar} ${esc(k.name)}</button>`).join('')}</div>`;
}

function skillRow(kid, sessions, sk, today) {
  const st = skillState(kid, sk.id);
  const week = skillSummary(sessions, sk.id, dayKey(addDays(parseKey(today), -6)));
  const all = skillSummary(sessions, sk.id);
  const off = (kid.disabledSkills || []).includes(sk.id);
  const top = st.level >= sk.levels.length - 1;
  return `<tr class="${off ? 'off' : ''}">
    <td><b>${sk.icon} ${esc(sk.name)}</b>${off ? '<div class="s">Switched off</div>' : ''}</td>
    <td>${st.level + 1}/${sk.levels.length} · ${esc(sk.levels[st.level].name)}<div class="s">${top ? 'Top level' : `${st.passes}/${PASSES_TO_LEVEL_UP} passes to next`}</div></td>
    <td><span class="acc ${accClass(week.acc)}">${accText(week.acc)}</span><div class="s">${week.total} problems</div></td>
    <td><span class="acc ${accClass(all.acc)}">${accText(all.acc)}</span><div class="s">${all.total} problems</div></td>
    <td>${all.avgSec == null ? '–' : all.avgSec.toFixed(1)}</td>
  </tr>`;
}

function multReport(sessions, today, kid) {
  const since = dayKey(addDays(parseKey(today), -29));
  const stats = factStats(sessions, 'mult', since);
  if (!Object.keys(stats).length) return '';
  const cell = (r, c) => {
    const f = stats[factKey(r, c)];
    if (!f) return `<td class="c-none" title="${r} × ${c}: not practised yet"></td>`;
    const acc = 1 - f.wrong / f.n;
    const cls = acc >= PASS_ACCURACY ? 'c-good' : acc >= 0.6 ? 'c-ok' : 'c-low';
    const t = `${r} × ${c} = ${r * c}: right first try ${f.n - f.wrong} of ${f.n} (${Math.round(acc * 100)}%), ${(f.ms / f.n / 1000).toFixed(1)} sec average`;
    return `<td class="${cls}" title="${t}" aria-label="${t}"></td>`;
  };
  const trouble = troubleFacts(stats);
  return `<div class="card">
    <div class="chart-head"><h3>Times tables</h3><span class="muted">Last 30 days</span></div>
    <div class="table-wrap"><table class="facts-grid">
      <thead><tr><th>×</th>${ALL_TABLES.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${ALL_TABLES.map((r) => `<tr><th>${r}</th>${ALL_TABLES.map((c) => cell(r, c)).join('')}</tr>`).join('')}</tbody>
    </table></div>
    <div class="legend"><i class="c-good"></i> ${Math.round(PASS_ACCURACY * 100)}%+ right first try <i class="c-ok"></i> 60–89% <i class="c-low"></i> under 60% <i class="c-none"></i> not yet</div>
    ${trouble.length ? `<h4>Facts to work on</h4><div class="chips">${trouble.map((f) => `<span class="fact-chip" title="${f.n - f.wrong} of ${f.n} right first try">${f.key.replace('×', ' × ')} <b>${Math.round(f.acc * 100)}%</b></span>`).join('')}</div>
      <p class="hint">These come up more often in ${esc(kid.name)}'s practice automatically.</p>` : '<p class="hint">No trouble spots in the last 30 days. 🎉</p>'}
  </div>`;
}

function missedReport(sessions, kid) {
  const missed = [];
  for (const s of [...sessions].reverse()) {
    if (s.skill === 'mult') continue;
    for (const p of s.problems) if (p.tries[0] !== p.ans) missed.push({ ...p, skill: s.skill, date: s.date });
    if (missed.length >= 12) break;
  }
  if (!missed.length) return '';
  return `<div class="card">
    <h3 class="card-title">Recent addition & subtraction misses</h3>
    <div class="chips">${missed.slice(0, 12).map((p) => `<span class="fact-chip" title="${fmtDate(p.date)}">${esc(p.q)} = ${p.ans} <s>${p.tries.filter((t) => t !== p.ans).join(', ')}</s></span>`).join('')}</div>
    <p class="hint">Struck-through numbers are what ${esc(kid.name)} typed.</p>
  </div>`;
}

function sessionRow(s, open, today) {
  const sk = skillById(s.skill);
  const title = `${sk?.name || s.skill} · ${s.mode === 'pick' && s.tables ? `×${s.tables.join(', ×')}` : MODES[s.mode] || s.mode}`;
  const lv = sk && s.mode !== 'pick' ? ` · Level ${s.level + 1}` : '';
  const sub = s.mode === 'challenge' ? `${s.correct} right in a minute` : `${s.firstTry}/${s.total} right first try${s.complete ? '' : ' · stopped early'}`;
  return `<button class="list-item" data-action="toggle-session" data-id="${s.id}" aria-expanded="${open}">
      <div class="dot">${sk?.icon || '🧮'}</div>
      <div class="grow"><div class="t">${esc(title)}${lv}</div><div class="s">${fmtDate(s.date, today)} · ${fmtDuration(s.seconds)} · ${sub}${s.levelUp ? ' · ⬆️ levelled up' : ''}</div></div>
      <div class="score ${accClass(s.total ? s.firstTry / s.total : null)}">${pct(s.firstTry, s.total)}%</div>
    </button>
    ${open ? `<div class="session-detail">${s.problems.map((p) => {
      const ok = p.tries[0] === p.ans;
      return `<span class="pd ${ok ? 'ok' : 'miss'}" title="${(p.ms / 1000).toFixed(1)} sec">${esc(p.q)} = ${ok ? p.ans : `<s>${p.tries.filter((t) => t !== p.ans).join(', ')}</s> ${p.ans}`}</span>`;
    }).join('')}</div>` : ''}`;
}

export function settingsHTML(state, { syncHTML, version }) {
  return `<div class="card">
      <h3 class="card-title">Kids</h3>
      <div class="list">${state.kids.map((k) => `<button class="list-item" data-action="edit-kid" data-id="${k.id}">
        <div class="avatar sm" style="--kid:${k.color}">${k.avatar}</div>
        <div class="grow"><div class="t">${esc(k.name)}</div><div class="s">Goal ${dailyGoalOf(k)} min a day, ${weeklyGoalOf(k)} min a week · ${plural(k.sessionLength || 20, 'problem')} per practice · ${enabledSkills(k).map((s) => s.icon).join(' ')}</div></div>
        <span class="chev">›</span></button>`).join('')}</div>
      <button class="btn btn-soft btn-block" data-action="add-kid">＋ Add a kid</button>
    </div>
    <div class="card">
      <h3 class="card-title">Parent PIN</h3>
      <p class="hint" style="margin:0 0 10px">The PIN protects this grown-ups area: reports, goals, levels and kids.</p>
      <div class="row"><button class="btn btn-soft" data-action="pin-set">Change PIN</button></div>
    </div>
    <div class="card">${syncHTML}</div>
    <div class="card">
      <h3 class="card-title">Backup</h3>
      <p class="hint" style="margin:0 0 10px">Save everything to a file, or load a file you saved before.</p>
      <div class="row"><button class="btn btn-soft" data-action="export">⬇️ Export</button><button class="btn btn-soft" data-action="import">⬆️ Import</button></div>
      <button class="btn btn-danger btn-block" style="margin-top:12px" data-action="erase">Erase everything on this device</button>
    </div>
    <p class="hint center">Math Champion · version ${esc(version)}</p>`;
}
