# KIITDual — Team Frontend Handoff

**Audience:** teammates joining the project, especially the backend developers.
**Frontend status:** feature-complete and QA-verified. It runs **entirely in the browser** on simulated services and localStorage; no backend exists yet.
**Companion docs:** [FRONTEND_BACKEND_CONTRACT.md](./FRONTEND_BACKEND_CONTRACT.md) · [FRONTEND_INTEGRATION_GUIDE.md](./FRONTEND_INTEGRATION_GUIDE.md) · SRS: `../focusmatch-project-documentation.md`

---

## 1. Architecture at a glance

| Layer | What it is |
|---|---|
| UI | React 18, TypeScript (strict), Vite 5, Tailwind CSS 3, Lucide icons |
| State | **One React Context**: `AppProvider` / `useApp()` in `src/context/AppContext.tsx` |
| Domain logic | Pure functions in `src/utils/` (scoring, pomodoro, stats, ids) |
| Data sources | Simulated services in `src/services/`, persisted through `src/services/storage.ts` |
| Dev-only tools | `src/dev/` (stripped from production builds) |

> **Not used**, despite appearing in some briefs: Zustand, Framer Motion, shadcn/ui and React Query. Animations are Tailwind/CSS. UI primitives are hand-built in `src/components/ui/`. Adding any of these is a team decision, not a prerequisite for integration.

### Component tree

```
main.tsx
└─ ErrorBoundary                      (last-resort "Reload KIITDual" screen)
   └─ AppProvider                     (all state + actions; useApp())
      └─ App → AppContent             (switches on authStep)
         ├─ AuthScreen                 'unauthenticated'
         ├─ OtpVerification            'awaiting_otp'
         ├─ AnonymousIdentitySetup     'identity_setup'
         └─ 'authenticated' → AuthenticatedView (switches on activeView) + MatchmakingModal (app-level)
            ├─ Dashboard               Navbar · hero or active-match banner · metrics · recent 6 matches
            ├─ MatchWorkspace          header (⚡ fast-forward, MatchCountdown) · PomodoroTimer · progress
            │                          · TaskManager · OpponentSidebar · DevOutcomeControl (dev only)
            ├─ Scorecard               verdict · head-to-head · breakdown · streak · actions
            ├─ MatchHistoryPage        Navbar · analytics cards · filters/search · history cards
            └─ SettingsPage            Navbar · identity · notification toggles · delete account
```

There is **no router**. Navigation is `activeView` in context, persisted per user so a refresh reopens the same screen.

## 2. Important folders and files

| Path | Why it matters |
|---|---|
| `src/context/AppContext.tsx` | **The heart of the app.** All state, persistence, the match lifecycle tick, and every user action. |
| `src/types/index.ts` | Domain models. They are the mapping target for every API response. |
| `src/services/storage.ts` | The only localStorage access point: safe parsing, per-user scoping, legacy migration. |
| `src/services/validators.ts` | Runtime shape guards for persisted (and later, API) data. |
| `src/services/authService.ts` | Simulated email + OTP auth, and anonymous identity generation. |
| `src/services/matchmakingService.ts` | Simulated opponent and match creation. |
| `src/services/matchService.ts` | Expiry check, user result, simulated opponent result, finalization. |
| `src/services/activityService.ts` | Simulated opponent feed, and the `ActivityEvent` model. |
| `src/utils/scoring.ts` | **The scoring formula.** Don't change it. |
| `src/utils/pomodoro.ts` | Pure, timestamp-based pomodoro engine. |
| `src/utils/stats.ts` | Single source for history statistics and dedupe. |
| `src/data/collegeConfig.ts` | Allowed email domains. This is a UX pre-check only; the server must enforce the real list. |
| `src/config/env.ts` | Reads `VITE_API_BASE_URL` / `VITE_WS_BASE_URL`. Nothing uses it yet; the future API client should. |
| `src/dev/` | Dev-only WIN/LOSS/DRAW demo control. |
| `tests/unit`, `tests/e2e`, `scripts/` | Test suites and their runners. |

## 3. Where to start reading

1. `src/types/index.ts` — 5 minutes. The vocabulary.
2. `src/App.tsx` — which screen shows when.
3. `src/context/AppContext.tsx`, top to bottom. Pay particular attention to:
   - `loadUserData` and `bootstrap` (hydration and self-repair),
   - `finalizeCurrentMatch` (idempotent completion),
   - the lifecycle `useEffect` (the 1 s tick),
   - `confirmMatch` and `startSearch` (the one-active-match guards).
4. `src/utils/scoring.ts`, `pomodoro.ts`, `stats.ts`.
5. Then any screen. Screens are presentational and read everything from `useApp()`.

## 4. State management overview

- **One provider, one hook.** Components destructure what they need from `useApp()`. There's no prop drilling beyond small leaf props.
- **Per-user state** (history, active match, tasks, sessions, feed, pomodoro, view, scorecard, preferences, search) is loaded together by `loadUserData(userId)`. It's swapped atomically on login, logout and delete (`applyUserData`), so one account's data can never render under another.
- **Persistence:** each per-user value is written by `useUserPersist(userId, key, value)` whenever it changes. With no user signed in, nothing is written.
- **`stateRef`** mirrors the latest state for timers and double-click guards. Actions such as `confirmMatch` update it immediately, so a second click that lands before the re-render is rejected.
- **Timers** (all are cleaned up; none speed up when the page re-renders):

  | Timer | Where | Runs while |
  |---|---|---|
  | Match lifecycle tick (1 s): expiry + pomodoro completion | `AppContext` | a match is active |
  | Search → found (3 s timeout, resumes after refresh) | `AppContext` | searching |
  | 24h countdown display (1 s) | `MatchCountdown` in `MatchWorkspace` | workspace open |
  | Pomodoro display (1 s) | `PomodoroTimer` | the timer is running |
  | Queue wait display (1 s) | `MatchmakingModal` | searching |
  | Opponent activity simulation (35–75 s) | `OpponentSidebar` | workspace open |
  | OTP resend cooldown (30 s) | `OtpVerification` | on the OTP screen |

## 5. Current simulated behaviour (everything that is fake today)

| Simulation | Location | Replaced by |
|---|---|---|
| OTP always `123456`; 600/800 ms fake latency | `authService` | `POST /auth/register`, `POST /auth/login` |
| Local "accounts" keyed by a SHA-256 email hash | `authService` | Server accounts |
| Anonymous alias and avatar generation | `authService.generateAnonymousProfile` | Server (PROPOSED `POST /users/me/identity`) |
| Queue → opponent found after 3 s | `AppContext` search effect + `matchmakingService` | Server queue + worker |
| Opponent's final result: deterministic from the match id (≥ 105 pts) | `matchService.getOrCreateOpponentResult` | `GET /matches/:id/result` |
| Local match finalization, history, streak and stats | `AppContext.finalizeCurrentMatch` | Server expiry worker |
| Opponent activity feed | `activityService` + `OpponentSidebar` timer | WebSocket `/ws/match/:id` |
| Reactions (only echoed locally) | `AppContext.sendReaction` | WebSocket (PROPOSED `reaction:send`) |
| ⚡ Fast-Forward Expiry, 10 s demo pomodoro | Workspace header, `PomodoroTimer` | **No backend equivalent**: hide in API mode |
| WIN/LOSS/DRAW control | `src/dev/` (dev builds only) | Stays dev-only |

## 6. Backend integration boundaries

- Components **must not** change to integrate. Everything happens in `src/api/` (new), `src/services/*`, and `AppContext`. See the Integration Guide §1.
- The `useApp()` API surface is the contract between screens and data. Extend it; don't reshape it.
- Mapping from API shape to model happens **only** in `src/api/mappers.ts` (new).

## 7. Important invariants (the regression suites enforce them)

1. **One user can only have one active match.** Queueing, confirming or opening matchmaking while a match is active routes back to it.
2. **Match expiry is timestamp-based** (`Date.now() >= endTime`). That covers expiry while the tab is open, on another screen, and while the browser was closed.
3. **Finalization is idempotent.** A match is added to history once, the streak increments once, and a closed match never becomes active again.
4. **Pomodoro and session completion is idempotent.** The session id is derived from its start time, and duplicates are dropped.
5. **Only completed sessions and tasks of that match count.** Cancelled, reset or incomplete sessions never count, and breaks never count.
6. **Refresh never corrupts state.** Active match, tasks, running or paused timer, search, found partner and scorecard all survive a reload. Malformed storage falls back to safe defaults.
7. **User data is isolated between accounts** (`focusmatch_u_<userId>_*`).
8. **Scores are stable.** Reopening a scorecard or refreshing never changes numbers, and the opponent result is never re-rolled.
9. **Match history never contains fabricated matches.** New users see empty states.
10. **Every statistic comes from `computeHistoryStats`.** Dashboard and History can't disagree.

## 8. Scoring formula (never modify, including for demos)

```
final_score = (0.5 × total_focus_minutes) + (30 × tasks_completed) + (10 × sessions_completed)
```

Higher score wins, and a tie is a draw. It's implemented once, in `src/utils/scoring.ts`. The dev-only outcome control produces WIN/LOSS/DRAW by choosing the simulated **opponent's stats**. It never bypasses the formula.

## 9. Match lifecycle

```
queued → active → completed
               └→ forfeited   (a user leaves early; NOT a loss for the remaining user — SRS §15)
```

- 24 hours from `startTime`.
- **Streak** means consecutive completed matches: +1 for any completed match (win, loss or draw); the leaver's streak goes to 0 on forfeit.
- Forfeited matches aren't added to history.

## 10. Persistence rules

- Every read and write goes through `storage` (`src/services/storage.ts`). There are **no direct `localStorage` calls elsewhere.**
- The prefix is **`focusmatch_`**. It's internal and must **not** be renamed for branding: existing browsers' data and the migration logic depend on it.
- Per-user keys are `focusmatch_u_<userId>_<key>`. Global keys are the session pointer (`user`, `anon_profile`, `auth_step`, `pending_email`), the simulated account records, and the opponent-result cache.
- Logout keeps a user's data for their next sign-in. "Delete Local Account" wipes every `focusmatch_*` key.
- The Integration Guide §6 lists which keys disappear after integration.

## 11. Privacy and anonymity rules

- The opponent sees only an **anonymous alias + identicon**. No component renders an email, real name or account id.
- The college email is used only while a code is pending. After verification, the plaintext email is cleared, and only a one-way **SHA-256 hash** keys the simulated account. (Earlier builds used a reversible base64 prefix; those accounts are migrated automatically on the next sign-in.)
- Scorecards are private to the two participants. The server must enforce this (403).
- Identity is currently **persistent per account** (`rotatesPerMatch: false`), and Settings says so. Past scorecards keep the alias used in that match.
- Tasks are private. The opponent only gets coarse activity signals, never task text.

## 12. Known intentional behaviours (don't "fix" these)

1. Closing the **partner-found** dialog **discards** the found partner.
2. There's **no cross-tab synchronization**. Two open tabs aren't kept in sync; this is acceptable for the frontend-only phase.
3. **Analytics lives inside Match History.** Don't create a separate Analytics page.
4. Internal storage prefixes remain **`focusmatch_`**. User-facing branding is **KIITDual** everywhere.
5. The **dev-only WIN/LOSS/DRAW control** must stay development-only. **Production builds must never expose it.** The `import.meta.env.DEV` guard lets Vite strip it, and this is tested.
6. The **real scoring formula is never modified for demo purposes.**
7. **No fake history** for new users.
8. Two starter tasks are created when a match starts.

## 13. Known limitations

- **Demo tools in production builds:** ⚡ Fast-Forward Expiry and the "10s Demo Timer" are visible in `npm run build` output, on purpose, for local demos. They **must be hidden before connecting a real backend** (the Integration Guide §14, step 8). The 10 s timer credits a full session.
- **No UI for "opponent forfeited"**, and forfeited matches don't appear in history. Both need product decisions (contract §2.3 and §3.3).
- **Notification toggles** are saved but don't trigger anything; there is no notification system.
- **The opponent status** always reads "Focusing now"; there's no presence data.
- The allowed domains include **demo domains** (`college.edu`, `university.edu`, `mit.edu`, `stanford.edu`) alongside `kiit.ac.in`. The server must enforce the real list.
- **Insecure origins** (e.g. `http://192.168.x.x`) lack Web Crypto, so the simulation falls back to a non-cryptographic hash there. The same email then maps to a different local account than on `localhost`. This only affects simulated accounts.
- **Boot is synchronous today.** An async `GET /users/me` will need a loading state (the Integration Guide §2).
- **`npm audit`** reports a moderate advisory in the Vite 5 / esbuild **dev server** (GHSA-67mh-4wv8-2f99). Production dependencies report 0 vulnerabilities. Fixing it requires a Vite major upgrade, which is a separate decision. Until then, don't expose `npm run dev` to untrusted networks.

## 14. How to run

**Requirements:** Node.js **≥ 20.11** (tested on Node 24), npm. The browser tests need a local Chrome, Chromium or Edge.

```bash
npm install
npm run dev          # http://localhost:3000 (opens a browser; see vite.config.ts)
npm run build        # tsc type-check + production bundle in dist/
npm run preview      # serve dist/ at http://localhost:4173
npm run typecheck    # tsc --noEmit
npm test             # unit suites (tests/unit), ~10 s
npm run test:e2e     # builds, starts preview (:4173) + dev (:5174), runs browser suites, stops servers
```

- **Demo login:** any allowed college email, then OTP **`123456`**.
- **Browser tests:** they auto-detect Chrome or Edge. Otherwise set `CHROME_PATH=/path/to/chrome`. Only `playwright-core` is installed; it downloads no browsers.

### Test inventory

| Suite | Build mode | Checks |
|---|---|---|
| `tests/unit/core.test.ts` | production | 41: scoring cases (160, 0, 100…), win/loss/draw, pomodoro pause/resume/refresh/idempotency, stats, storage corruption and migration |
| `tests/unit/auth.test.ts` | production | 12: domain and OTP validation, SHA-256 hashing, no plaintext email after sign-in, legacy migration |
| `tests/unit/demoOutcome.dev.test.ts` | dev | 53: forced WIN/LOSS/DRAW, formula integrity, refresh stability |
| `tests/unit/demoOutcome.prod.test.ts` | production | 4: the dev control is inert in production |
| `tests/e2e/journey.e2e.cjs` | production preview | 79: full journey, refresh matrix, edge cases A–F, isolation, reset, overflow at 1440/1280/1024/768/390/375, keyboard basics |
| `tests/e2e/devOutcome.e2e.cjs` | dev + production | 11: dev control works in dev, absent in production, contrast tokens |

## 15. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Not yet (planned) | REST origin, e.g. `http://localhost:5000` |
| `VITE_WS_BASE_URL` | Optional (planned) | WebSocket origin. Derived from the API URL when unset. |

Copy `.env.example` to `.env.local`. **Everything `VITE_*` is public** (it's embedded in the JS bundle), so never put secrets there. `.env` and `.env.local` are git-ignored.

## 16. Git workflow recommendations

This folder is **not a git repository yet**. Suggested setup:

```bash
git init && git add . && git commit -m "KIITDual frontend: feature-complete baseline"
```

- **Branches:** protect `main`. Work on `feat/<area>-<topic>` (e.g. `feat/api-auth`) and `fix/<topic>`. Integrate the backend behind the mock/API switch, so `main` always runs in mock mode.
- **Before every PR:** run `npm run typecheck`, `npm test` and `npm run build`. Also run `npm run test:e2e` if the change touches `AppContext`, services or screens.
- **Commit `package-lock.json`.** Never commit `.env*` (except `.env.example`), `dist/` or `node_modules/`.
- **Backend teammates must not change** the scoring formula, the `focusmatch_` prefix, the intentional behaviours in §12, or the invariants in §7 without the frontend owner's review.
