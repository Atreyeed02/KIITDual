# KIITDual

An anonymous 1v1 study-match web app for KIIT students. Two students are paired for a private 24-hour match, log Pomodoro focus sessions, and see a private scorecard at the end. Real names are never shown: each student gets a random alias such as `CalmOwl131`.

**Live site:** https://kiit-dual.vercel.app

Built as a Software Engineering project (Group 7, CSE-02, KIIT) by Kousheyo Banerjee, Prantika Majumder, Smarak Dey, Atreyee Debnath and Swapnanil Ghoshal.

## Features

- **College-only sign-up:** only `@kiit.ac.in` addresses; login with a real 6-digit email code (Supabase Auth).
- **Anonymous identity:** random adjective + animal + number alias and avatar, regenerable in Settings.
- **Matchmaking:** pairs two waiting students live (Supabase Realtime with a database polling fallback). If nobody is found after a short wait, a simulated bot opponent is used.
- **24-hour match workspace:** personal task list, Pomodoro timer (25 min standard, 50 min deep, 5 min break) and an activity feed of coarse opponent events.
- **Private scorecard:** win, loss or draw, visible only to the two participants.
- **History and streaks:** past matches, wins/losses/draws and consecutive-match streak.
- **Focus analytics:** monthly report with month-on-month comparison, weekly goals, and a **Load Demo Data** button that fills the charts with synthetic, clearly labelled sample data (local to your browser, resettable).

### Scoring

```
Score = 1 × focus minutes + 15 × sessions completed
```

Only completed sessions count. Tasks are for personal planning and carry no weight. Higher score wins; equal scores are a draw. See `src/utils/scoring.ts`.

## Tech stack

React 18, TypeScript (strict), Vite, Tailwind CSS, Lucide icons, Supabase (auth, database, realtime), deployed on Vercel. State lives in one React Context (`src/context/AppContext.tsx`); domain logic is pure functions in `src/utils/`.

## Getting started

Requires Node.js 18+.

```bash
git clone https://github.com/Atreyeed02/KIITDual.git
cd KIITDual
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev
```

The app will not start without these in `.env.local` (never commit this file):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key |
| `VITE_ENABLE_ANALYTICS_DEMO` | Optional. Set to `false` to hide the demo-data buttons (shown by default) |

Ask a teammate for the Supabase values. The dev server runs at http://localhost:3000.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production (`dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check only |
| `npm test` | Unit tests (7 suites) |
| `npm run test:e2e` | Browser tests (Playwright) — **currently out of date**, see below |

## Testing

- **Unit tests** (`tests/unit/`) cover scoring, Pomodoro logic, validators, analytics, demo outcome control and auth rules. They bundle with esbuild and run in Node; no network or Supabase project needed.
- **Browser tests** (`tests/e2e/`) were written for the earlier simulated login and do not pass against the real Supabase flow yet. They need their Supabase calls stubbed before they are useful again.

## Project structure

```
src/
  components/   UI by screen: auth, dashboard, workspace, scorecard, history, analytics, settings, ui
  context/      AppContext: global state and actions
  services/     auth, matchmaking, match and storage services (Supabase)
  utils/        scoring, pomodoro, stats, analytics, ids
  hooks/        idle and interaction detection
  lib/          Supabase client
  dev/          development-only demo tools
db/, scripts/   SQLite test database and its generator (generate_test_db.py)
docs/           integration and handoff notes
tests/          unit and browser tests
```

## Deployment

Vercel builds the `main` branch automatically (`npm run build`, output `dist/`). `vercel.json` rewrites all routes to `index.html` and `.npmrc` sets `legacy-peer-deps`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment variables, then redeploy: Vite bakes them in at build time.

## Branches and workflow

- `main` is production; merging to it redeploys the live site.
- Work on a feature branch and open a pull request into `main`.

## Further reading

The notes in `docs/` and `focusmatch-project-documentation.md` describe the original frontend-only design and the frontend–backend contract. Parts of them (for example "no backend is connected" and the old score weights) predate the Supabase integration, so treat this README and the code as the source of truth where they differ.
