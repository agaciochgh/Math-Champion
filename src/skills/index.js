/* The skill registry: every kind of practice the app offers.
 *
 * To add new content, write a module like addition.js and list it here. A skill is:
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
import addition from './addition.js';
import subtraction from './subtraction.js';
import multiplication from './multiplication.js';

export const SKILLS = [addition, subtraction, multiplication];
export const skillById = (id) => SKILLS.find((s) => s.id === id) || null;
export const topLevel = (skill) => skill.levels.length - 1;
