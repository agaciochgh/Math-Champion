/* Small HTML building blocks shared by the kid and parent screens. */
import { esc } from '../util.js';

export const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  badges: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6M22 9l-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m16 9-6 6M10 9l6 6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

/** Circular progress ring. */
export function ringHTML(value, goal, label) {
  const r = 52, c = 2 * Math.PI * r;
  const frac = goal ? Math.min(1, value / goal) : 0;
  return `<div class="ring" role="img" aria-label="${esc(label)}">
    <svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="${r}" fill="none" stroke-width="12"/>
      <circle class="bar" cx="60" cy="60" r="${r}" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - frac)}"/></svg>
    <div class="center"><div class="num">${value}</div><div class="of">of ${goal} min</div></div>
  </div>`;
}

export function progressBar(value, goal, { done = false } = {}) {
  const w = goal ? Math.min(100, (100 * value) / goal) : 0;
  return `<div class="bar-track ${done ? 'done' : ''}"><i style="width:${w}%"></i></div>`;
}

/**
 * Vertical bar chart with an optional dashed goal line. items: [{ label, value, title, today, future }].
 * Bars that reach the goal turn green. Every bar has a hover title (and a screen-reader label).
 */
export function barChart(items, { goal = 0, unit = '', showValues = true, dense = false } = {}) {
  const max = Math.max(goal * 1.15, ...items.map((i) => i.value), 1);
  const line = goal ? `<div class="goal-line" style="bottom:${(100 * goal) / max}%"><span>${goal}${unit}</span></div>` : '';
  const cols = items.map((i) => {
    const h = i.value ? Math.max(3, (100 * i.value) / max) : 0;
    const cls = i.future ? 'future' : goal && i.value >= goal ? 'met' : 'on';
    const title = esc(i.title || `${i.label}: ${i.value}${unit}`);
    return `<div class="col" title="${title}" aria-label="${title}">${i.value > 0 || i.future
      ? `<div class="bar ${cls}" style="height:${i.future ? 3 : h}%">${showValues && i.value > 0 ? `<span class="v">${i.value}</span>` : ''}</div>`
      : '<div class="bar zero"></div>'}</div>`;
  }).join('');
  const labels = items.map((i) => `<div class="day ${i.today ? 'today' : ''}">${esc(i.label)}</div>`).join('');
  return `<div class="chart ${dense ? 'dense' : ''}" style="--n:${items.length}"><div class="plot">${line}${cols}</div><div class="labels">${labels}</div></div>`;
}

export function tile(icon, value, label) {
  return `<div class="tile"><div class="ic">${icon}</div><div class="n">${value}</div><div class="l">${esc(label)}</div></div>`;
}

export function badgeCard(b) {
  return `<div class="badge ${b.earned ? '' : 'locked'}">
    <div class="medal">${b.icon}</div>
    <div class="bn">${esc(b.name)}</div>
    <div class="bd">${esc(b.desc)}</div>
    ${b.earned ? '<div class="when">✓ Earned</div>' : `<div class="bp"><i style="width:${(100 * b.value) / b.goal}%"></i></div><div class="bd">${b.value} / ${b.goal}</div>`}
  </div>`;
}
