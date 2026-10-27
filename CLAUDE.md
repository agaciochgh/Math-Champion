# Math Champion — maintainer notes

A no-build static web app (vanilla ES modules) on GitHub Pages, with optional Firebase sync. The owner doesn't maintain the code themselves; Claude does, and pushes changes when asked. Keep it dependency-free and keep `npm test` green.

## Conventions
- Mirrors the owner's Reading Quest app (agaciochgh/Reading-Tracker): same look, PIN approach, sync design and Firebase project.
- UI is template-string HTML re-rendered from `state` + `ui` in `src/app.js`. Clicks route through `data-action` → the `actions` table.
- Pure logic goes in `src/progress.js` and `src/skills/*`, with tests in `tests/`. Use the `rng` parameter for anything random so tests stay repeatable.
- For each release, bump `APP_VERSION` in `src/app.js` **and** `CACHE` in `sw.js`. Add any new file to `SHELL` in `sw.js`.
- The user-facing copy is for a 3rd grader. Keep it short, warm and encouraging.

## Adding or extending content
- **New level for an existing skill:** add it at the END of that skill's `levels` array (saved progress refers to levels by index). If the last level is "Mix it up" (`gen: 'mix'`), insert the new level before it and add a migration in `store.js normalize()` that bumps saved levels at or above the insert point.
- **Times tables only for now.** Addition and subtraction (2-digit ± 2-digit, 5 levels each) were removed at the owner's request on 2026-10-27. Restore `src/skills/addition.js` and `subtraction.js` from commit de32247 and re-register them, keeping the ids `add` and `sub`. Old sessions with those ids stay in kids' history (labelled via `RETIRED` in `src/views/parent.js`).
- **New skill** (e.g. 3-digit addition, division, missing numbers): create `src/skills/<name>.js` that follows the interface documented in `src/skills/index.js`, then register it in `SKILLS`. It appears for every kid automatically; parents can switch it off per kid. Add generator tests to `tests/skills.test.js`. If it needs a skill badge, add it to `BADGES` in `progress.js`.
- Never rename a skill `id`: it's stored in saved sessions.

## Data
- `state = { kids, sessions, settings, activeKidId }` in localStorage key `math-champion-v1`. `activeKidId` and prefs (mute) are per device.
- Sync: `families/{uid}/math/meta` (kids, settings) and `families/{uid}/math/s-YYYY-MM` (sessions by month), each record at its own field path.
- XP is stored on each session when it's saved, so later goal changes never take XP away. Badges, streaks and stats are worked out from the sessions.
