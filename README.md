# Math Champion 🏆

Quick daily times-tables practice for kids, from 0 to 12. Kids level up, earn badges and keep streaks going. Grown-ups get a PIN-locked report showing what each kid practised, how it went, and which facts need work.

## What's in it

- **Who's practising?** One profile per kid, each with their own avatar, colour, goals, levels and history.
- **Times tables 0–12**, one table at a time in this order: ×0 and ×1, ×2, ×10, ×5, ×3, ×4, ×9, ×11, ×6, ×8, ×7, ×12, then all tables mixed (13 levels). About a quarter of each practice reviews tables learned earlier. Facts a kid has missed recently come up more often. **Pick tables** lets kids choose any tables they want.
- **Practice:** 20 problems by default, typed on a big number pad (a keyboard works too). A wrong answer gets one more try. After that the app shows the answer with a strategy tip (e.g. "Times 9: times 10, then take away one group"), and the problem comes back once later in the practice.
- **1-minute challenge:** as many right answers as possible in 60 seconds, with a personal best for each level. It mixes every table unlocked so far.
- **Levelling up:** two practices with 90% or more right on the first try unlock the next times table. Separately, XP from every practice raises the kid's player level (Number Rookie → Math Explorer → … → Math Champion).
- **Goals:** 5 minutes a day and 20 minutes a week by default (weeks run Monday to Sunday). Only time spent on problems counts, up to 60 seconds per problem.
- **24 badges:** streaks, weekly goals, problems solved, perfect practices, combos, challenge speed, and times-table milestones.
- **Sound effects** with a mute button (on the home screen and during practice). Confetti for level-ups and badges.
- **Grown-ups area (PIN):**
  - **Report:** minutes this week against the goal, days practised, accuracy, a 2-week minutes chart, current level and accuracy, a 0–12 times-table grid coloured by accuracy, facts to work on, and every practice with each answer typed.
  - **Settings:** add, edit or remove kids; daily and weekly goals; problems per practice; move a kid's level up or down; change the PIN; family sync; backup and restore.
- **Family sync** through Firebase, so the reports on your phone include practice done on her tablet. See [SYNC-SETUP.md](SYNC-SETUP.md).
- Installable as an app, works offline, supports dark mode, and fits phones, tablets and desktops.

## Running it

There's no build step. Serve the folder over HTTP:

```sh
npx serve .            # or: python3 -m http.server
```

Tests (Node 20+, no installs needed):

```sh
npm test
```

## Putting it online

Use GitHub Pages: in the repo, go to **Settings → Pages**, choose **Deploy from a branch**, pick the branch, and choose `/ (root)`. The app will be at `https://agaciochgh.github.io/Math-Champion/`. Open it on the tablet and use **Add to Home Screen**.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | App shell and all styling |
| `src/app.js` | Screens, practice engine, PIN, events |
| `src/progress.js` | Scoring, level-ups, XP, streaks, badges, report stats |
| `src/skills/` | The math content: times tables for now. One file per skill, listed in `index.js` |
| `src/views/` | HTML for charts, badges and the grown-ups report |
| `src/store.js`, `src/sync.js`, `sync-config.js` | Saving on the device, and Firebase family sync |
| `src/sound.js` | Sound effects (generated in the browser, no audio files) |
| `sw.js`, `manifest.webmanifest`, `icon.svg` | Offline support and install-as-app |
| `firestore.rules` | Database security rules (the same ones Reading Quest uses) |
| `tests/` | Unit tests for the math content and progress rules |
