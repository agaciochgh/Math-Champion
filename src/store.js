/* App state and saving. localStorage is each device's working copy; sync.js mirrors it to Firebase. */
import { SKILLS } from './skills/index.js';

const STORE_KEY = 'math-champion-v1';
const PREFS_KEY = 'math-champion-prefs';

export function blankState() {
  return { version: 1, kids: [], sessions: [], settings: {}, activeKidId: null };
}

export function normalize(s) {
  const base = blankState();
  if (!s || typeof s !== 'object') return base;
  const kids = (Array.isArray(s.kids) ? s.kids : []).map((k) => ({ skills: {}, disabledSkills: [], ...k }));
  // Keep saved levels inside the range each skill has today.
  for (const k of kids) {
    for (const sk of SKILLS) {
      const st = k.skills[sk.id];
      if (st && st.level > sk.levels.length - 1) k.skills[sk.id] = { level: sk.levels.length - 1, passes: 0 };
    }
  }
  return {
    ...base,
    ...s,
    kids,
    sessions: Array.isArray(s.sessions) ? s.sessions : [],
    settings: s.settings && typeof s.settings === 'object' ? s.settings : {},
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? normalize(JSON.parse(raw)) : blankState();
  } catch {
    return blankState();
  }
}

export function saveState(state) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

/** Per-device preferences that don't sync (sound on/off). */
export function loadPrefs() {
  try { return { muted: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { muted: false }; }
}
export function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
