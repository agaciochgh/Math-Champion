/* The skill registry: every kind of practice the app offers.
 *
 * To add new content, write a module like multiplication.js and list it here. A skill is:
 *   id        short, stable string. It is stored in saved sessions, so never rename it.
 *   name, icon, color
 *   levels    [{ name, example }] in teaching order. Kids move up after passing sessions (see progress.js).
 *             Only ever ADD levels at the end: saved progress refers to levels by position.
 *   problems({ level, count, rng, tables?, history? }) → [{ a, b, op, answer, text, key }]
 *   hint(problem) → a one-line strategy shown after two wrong tries
 *   pickable  optional { label, options }: lets kids choose what to practise (e.g. which times tables)
 *
 * New skills are switched on for every kid automatically; parents can switch them off per kid.
 */
import multiplication from './multiplication.js';

// Addition and subtraction were taken out on 2026-10-27 to focus on times tables. They're in git history
// (commit de32247) if they're wanted back; re-adding them with ids 'add' and 'sub' revives saved levels too.
export const SKILLS = [multiplication];
export const skillById = (id) => SKILLS.find((s) => s.id === id) || null;
export const topLevel = (skill) => skill.levels.length - 1;
