# KIITDual — Frontend Integration Guide

**Audience:** backend and full-stack teammates connecting the real API to the existing frontend.
**Goal:** replace the simulated data sources **without touching screen components**.
**Read first:** [FRONTEND_BACKEND_CONTRACT.md](./FRONTEND_BACKEND_CONTRACT.md) (endpoints and shapes), then [TEAM_FRONTEND_HANDOFF.md](./TEAM_FRONTEND_HANDOFF.md) (architecture tour).

---

## The one-paragraph version

Every screen reads state and calls actions through **one hook, `useApp()`**, defined in `src/context/AppContext.tsx`. Components never call services, `fetch`, or `localStorage` directly. So integration happens in three layers **below** the components:
- a new `src/api/` layer (HTTP client and response mappers),
- the existing `src/services/*` (swap each simulated body for API calls),
- `AppContext` (make actions async, with loading and rollback).

If a component file needs editing, stop and check: the only expected component-level changes are the few new states listed in §8.

```
TODAY     Components ──useApp()──▶ AppContext ──▶ services/* (simulated) ──▶ localStorage
FUTURE    Components ──useApp()──▶ AppContext ──▶ services/* ──▶ src/api/client ──▶ REST  ─▶ backend
                                        ▲                                          WS /ws/match/:id
                                        └──────── src/api/matchSocket (events) ◀──────┘
```

---

## 1. Where API calls should live

Create `src/api/`. There is deliberately no stub for it yet, so that no shapes are frozen before the team agrees them.

| File (suggested) | Responsibility |
|---|---|
| `src/api/client.ts` | `fetch` wrapper. Reads `API_BASE_URL` from `src/config/env.ts`, attaches credentials, parses JSON, converts the error envelope into a typed `ApiError { status, code, message }`, and fires one global `onUnauthorized` callback on 401. |
| `src/api/mappers.ts` | **The only place** DTOs (the server's JSON) become frontend models (`src/types`): snake_case → camelCase, orientation (user1 = me), opponent id anonymisation checks, date normalisation. |
| `src/api/matchSocket.ts` | Connects to `${WS_BASE_URL}/ws/match/:id`, reconnects with backoff, and emits typed events into `AppContext`. |

Then swap the implementations **inside** the existing services, keeping their call sites:

| Service | Today (simulated) | After integration |
|---|---|---|
| `authService.requestOtp(email)` | 600 ms delay, validates the domain, stores the dev OTP `123456` | `POST /auth/register` |
| `authService.verifyOtp(email, otp)` | Checks `123456`, creates or loads a local account under a SHA-256 email-hash key | `POST /auth/login` |
| `authService.generateAnonymousProfile` | Random alias and avatar seed | `POST /users/me/identity` (PROPOSED). Local generation remains valid only for the simulation. |
| `authService.saveUser / saveProfile / logout` | Local account records | Mostly deleted: the server owns accounts. `logout` becomes `POST /auth/logout` (PROPOSED) plus local clearing. |
| `matchmakingService.generateSimulatedOpponent` | Random opponent | **Deleted.** The opponent comes from the server match. |
| `matchmakingService.createMatch` | Local 24h match | **Deleted.** The server creates matches. |
| `matchService.checkMatchExpiry` | `Date.now() >= endTime` | Keep, as a *display* hint only. The server worker is authoritative (§9). |
| `matchService.calculateUserResult` | Formula over local tasks/sessions | **Keep** for the live score in the workspace. |
| `matchService.getOrCreateOpponentResult` / `finalizeMatch` | Deterministic simulated opponent | Replaced by `GET /matches/:id/result`. |
| `activityService.*` | Fake opponent feed | Replaced by WebSocket events (§5). `MAX_ACTIVITY_EVENTS` stays. |

**Keep the simulation available until integration is complete.** A switch such as `VITE_DATA_SOURCE=mock|api`, or one `services/index.ts` that picks the implementation, lets the team develop the UI and the API in parallel. It isn't in `.env.example` yet because nothing reads it; add both together.

---

## 2. Authentication state today, and later

`AuthStep` (`src/services/authService.ts`) drives which top-level screen `App.tsx` renders:

```
'unauthenticated' → AuthScreen (email)
'awaiting_otp'    → OtpVerification
'identity_setup'  → AnonymousIdentitySetup ("Enter KIITDual")
'authenticated'   → Dashboard / Workspace / Scorecard / History / Settings
```

**Today:** `bootstrap()` restores the step synchronously from localStorage and repairs inconsistent combinations. For example, "authenticated" without a user falls back to the email screen.

**After integration:**
- On load, call `GET /users/me`. `200` means `authenticated`; `401` means `unauthenticated`.
- This call is **asynchronous**, so add a boot state. The UI currently has none because bootstrap is synchronous today. The smallest change: an `isBootstrapping` flag in `AppContext`, with `App.tsx` rendering `LoadingIndicator` (it already exists in `src/components/ui/`) until it resolves. This is the one expected addition at the `App.tsx` level.
- `'identity_setup'` stays exactly as it is, shown right after a successful verify.
- `pendingEmail` stays client-side, and **only while a code is pending**. It's cleared after a successful verify (privacy rule).

## 3. Tokens and session information

The recommendation, which the team should confirm:
- **Preferred: an httpOnly, `Secure`, `SameSite=Lax` session cookie** set by `POST /auth/login`. The frontend stores **no token at all**, and `client.ts` uses `credentials: 'include'`. This removes the XSS token-theft risk, and the WebSocket handshake reuses the same cookie.
- **If you must use a bearer JWT:** keep it in memory. If it has to survive a reload, store it under the `focusmatch_` prefix (e.g. `focusmatch_auth_token`) **through `storage`**, never with raw `localStorage` calls. `storage.clearAll()` in logout and delete already wipes every `focusmatch_*` key.
- **Never** put secrets in `VITE_*` variables. They're embedded in the public JavaScript bundle.

## 4. Mapping REST responses to frontend models

All mapping goes in `src/api/mappers.ts`. The components already consume exactly these types (`src/types/index.ts`), so nothing above the mapper changes.

| API response | Frontend model | Key mapping rules |
|---|---|---|
| `users/me.user` | `User` | Drop `collegeEmailHash`, or leave it `''`; it's simulation-only. Derive `totalDraws` if the API doesn't send it. |
| `users/me.profile` | `AnonymousProfile` | As-is. |
| match DTO | `Match` | **Orient so `user1Id`/`user1Profile` are the requester.** Opponent ids must be opaque. |
| task DTO | `MatchTask` | `is_completed` → `isCompleted`; `completed_at` → `completedAt` (optional). |
| session DTO | `FocusSession` | Pass through the server `durationMinutes` (25 or 50). |
| result DTO | `MatchHistory` | Build `userResult` and `opponentResult` from the requester's point of view. Set `isWinner = user > opponent` and `isDraw = user === opponent`, unless the server sends them. |

Run mapped data through the existing guards in `src/services/validators.ts` (`isMatch`, `isMatchHistory`, and so on) in development builds. They catch contract drift early.

## 5. WebSocket events → UI

Let `matchSocket` dispatch into `AppContext`. The context already owns the matching state:

| Event (PROPOSED) | `AppContext` update | Visible effect |
|---|---|---|
| `match:state` | Store `serverTime - Date.now()` as a clock offset, and use it for the countdown and expiry display | 24h countdown accurate on skewed devices |
| `opponent:joined` / `opponent:activity` / `opponent:reaction` | Prepend a mapped `ActivityEvent` to `activityEvents` (cap 30). Use the existing internal `appendActivity`. | "Live Activity Stream" in `OpponentSidebar` |
| `match:completed` | `GET /matches/:id/result`, then the same state transition `finalizeCurrentMatch` performs today: set `activeScorecard`, set view `'scorecard'`, and clear the active-match state | The Scorecard appears automatically, even from another screen (as it already does locally) |
| `match:forfeited` (opponent) | **Needs a product decision** (contract §3.3) | — |

Then **remove** the simulation hook: the `setTimeout` loop in `OpponentSidebar.tsx` that calls `simulateOpponentActivity`.

## 6. localStorage: what disappears and what stays

All keys use the prefix `focusmatch_`. **Don't rename it** (it's internal, and existing browsers' data depends on it). User-owned keys are scoped per account: `focusmatch_u_<userId>_<key>`.

| Key | Today | After integration |
|---|---|---|
| `user`, `anon_profile` | Session snapshot | **Disappears.** Comes from `GET /users/me`. |
| `user_<emailHash>`, `profile_<emailHash>` | Simulated account records | **Disappears.** |
| `pending_otp_email`, `simulated_otp` | Simulated OTP | **Disappears.** |
| `opp_result_<matchId>` | Cached simulated opponent result | **Disappears.** |
| `u_<id>_match_history`, `completed_match_ids` | Local history and dedupe | **Disappears.** Comes from `GET /matches/history`; the server dedupes. |
| `u_<id>_current_match`, `match_tasks`, `focus_sessions` | Local active match | **Disappears** as the source of truth. It may remain as an offline or instant-render cache, but the server always wins. |
| `u_<id>_activity_events` | Local feed | **Disappears** (socket), unless kept as a short cache. |
| `u_<id>_matchmaking_session` | Local search state | **Disappears.** Use queue status (contract §2.2). |
| `auth_step` | Which auth screen | **Mostly disappears** (derived from `/users/me`). May stay only for `awaiting_otp`. |
| `pending_email` | Email awaiting a code | **Stays**, client-side and only until verify. |
| `u_<id>_pomodoro_state` | Running, paused or idle timer | **Stays client-side.** Pause and resume are purely client concepts. Keep it so a refresh mid-session recovers the timer. |
| `u_<id>_active_view`, `active_scorecard` | Which screen and scorecard to reopen | **Stays** (UI state). Re-validate against the server after load. |
| `u_<id>_notification_prefs` | Toggles | **Stays** unless `/users/me/preferences` is adopted. |
| `dev_demo_outcome` | Dev-only outcome control | **Stays dev-only.** It's ignored in production builds. |

Always go through `src/services/storage.ts`. It already handles missing and malformed values, per-user scoping, legacy migration, and `clearAll()`.

## 7. Error, loading and empty states the UI already has

| Screen | Already supported | Add during integration |
|---|---|---|
| Auth (email and OTP) | Spinner inside the submit button; inline `role="alert"` errors; disabled inputs while loading; resend cooldown | Map `ApiError.message` into the existing `error` state (the components already `await` and `catch`) |
| Matchmaking modal | Idle → Searching (with an elapsed timer) → Found. Cancel blocked mid-search except via "Cancel Search". | A visible error if `POST /matchmaking/queue` fails (the modal has no error slot yet; small addition) |
| Dashboard | Active-match banner vs. "Ready to focus?"; empty history message | Loading state for the first `GET /matches/history` |
| Workspace | "No active match session found → Return to Dashboard" fallback; empty task list; empty feed ("No activity yet.") | Optimistic updates with rollback on failure (§10) |
| Scorecard | "No completed match scorecard found → Return to Dashboard" fallback | Retry on 409 `MATCH_NOT_COMPLETED` |
| History | Empty state, "no results match your filters" state (with Clear Filters), search | Loading state |
| Whole app | `ErrorBoundary` with a "Reload KIITDual" screen (never a blank page) | — |

## 8. Match lifecycle integration

```
Queued ──(paired + accept?  see contract §2.2)──▶ Active ──(endTime reached, worker)──▶ Completed
                                                    └──(POST /matches/:id/forfeit)──▶ Forfeited
```

- **Today:** a single 1-second lifecycle tick in `AppContext` checks `Date.now() >= endTime`. It fires even when the workspace isn't on screen, and on reopening after the browser was closed. It then calls `finalizeCurrentMatch()`, which is idempotent (guarded by `closedMatchRef` and `completedMatchIds`).
- **After integration:** the **server worker closes the match** (SRS §16: idempotent). Keep the tick, but instead of computing the result locally, have it:
  1. call `GET /matches/current`, and if `match` is `null`, then
  2. call `GET /matches/:id/result` (retry on 409) and show the scorecard.

  `match:completed` over the socket short-circuits this.
- **Keep the one-active-match guards.** `openMatchmakingModal` routes to the existing match, and `startSearch` and `confirmMatch` refuse a second one. The server enforces the same rule with 409 `ACTIVE_MATCH_EXISTS`.
- **"Fast-Forward Expiry" (⚡ in the workspace header)** is a demo tool with **no backend equivalent**. Hide it once a real match is involved (§14).

## 9. Task integration

| UI action | Call | Notes |
|---|---|---|
| Add goal (`addTask`) | `POST /matches/:id/tasks` | The UI trims, rejects empty or whitespace-only text, and caps at 200 characters. It returns `boolean` synchronously today; make it async. Optimistic insert, then replace the temporary id with the server id. |
| Tick / un-tick (`toggleTask`) | `PATCH …/tasks/:taskId` `{ isCompleted }` | Optimistic; roll back on failure. |
| Delete (`deleteTask`) | `DELETE …/tasks/:taskId` (PROPOSED) | — |

A task only ever affects the score of its own match (`matchId`), and only once.

## 10. Pomodoro / session integration

The pomodoro engine (`src/utils/pomodoro.ts`) is pure and timestamp-based. **Keep it.**

| UI moment | Today | After integration |
|---|---|---|
| Start Focus | `startPomodoro` sets a (virtual) `startedAt` | Also `POST /matches/:id/sessions` `{ mode, clientSessionId }`. Store the returned `sessionId` in `pomodoroState`. |
| Pause / Resume | Client-only; `startedAt` is shifted on resume | Client-only. No API call. |
| Timer reaches 0 | The lifecycle tick runs `settlePomodoro`, producing one `FocusSession` with a deterministic id | `PATCH …/sessions/:sessionId` `{ completed: true }`. Idempotent, so the same completion may be sent twice. |
| Reset | Discards the run; nothing is counted | `PATCH …/sessions/:sessionId` `{ completed: false }` (PROPOSED) |
| Break mode | Never produces a session | No API call |
| Tab closed at completion | Settled on the next load (only if it finished before the match ended) | The server must accept a late completion whose planned end is ≤ `endTime`, **or** its expiry worker should auto-complete such sessions. Otherwise users lose sessions they legitimately finished. **Team decision.** |

**Invariants to keep:** only completed sessions count; each session counts once; breaks never count.

**Before connecting a real backend:** the **"Enable 10s Demo Timer"** toggle credits a full 25- or 50-minute session after 10 seconds. That's fine for a local demo, but against a real server it's a scoring exploit. Hide it in API mode, and have the server validate elapsed time (§14).

## 11. Scorecard integration

- The scorecard renders `activeScorecard: MatchHistory`. Feed it from `GET /matches/:id/result`, already oriented and mapped.
- The score breakdown rows are computed with `getScoreBreakdown` from the same formula, so a server `finalScore` that disagrees with its own components will look visibly wrong. That's intentional: the server must use the exact formula.
- "You" uses `match.user1Profile` (the alias used **in that match**), not the current profile, so regenerating your identity never rewrites old scorecards.
- Reopening a scorecard from History uses the same history record. Numbers must never change between views.

## 12. History integration

- Source: `GET /matches/history`, newest first, **unique per match**. Run it through `normalizeHistory` (`src/utils/stats.ts`) anyway; it dedupes and sorts defensively.
- **Every** statistic (Dashboard metrics and the History analytics cards) comes from `computeHistoryStats` in `src/utils/stats.ts`. Don't add a second calculation anywhere.
- Filters (all, wins, losses, draws) use `getOutcome`. Search matches opponent alias or date.
- New users must see the empty state. **Never fabricate history.**
- Analytics intentionally lives inside Match History. There is no separate Analytics page, and none should be created.

## 13. Logout and session expiry

| Trigger | Required behaviour | Current implementation |
|---|---|---|
| Logout (Navbar) | Server logout (PROPOSED), then reset in-memory state and show the email screen. **Do not wipe the user's history.** (After integration it lives on the server anyway.) | `AppContext.logout`: clears the session keys and any in-progress search, but keeps per-user data on disk |
| 401 on any call | Treat as logout. Don't show an error page. | Add `onUnauthorized → logout()` in `client.ts` |
| Delete account (Settings) | `DELETE /users/me` (PROPOSED), then `storage.clearAll()`, then the email screen | `AppContext.deleteAccount` (clears every `focusmatch_*` key) |

## 14. Integration checklist (in order)

1. Agree on the **DECISION REQUIRED** items in the contract: session paths, auth mapping, pairing and acceptance, forfeit UX, and forfeited matches in history.
2. Add `src/api/client.ts` and `mappers.ts`, plus a `VITE_DATA_SOURCE` switch (keeping `mock` as the default).
3. Auth: `/auth/register`, `/auth/login`, `/users/me`, plus the boot loading state.
4. Matchmaking, then `GET /matches/current`.
5. Tasks, then sessions.
6. Results and history, with the lifecycle tick switched to server polling.
7. The WebSocket, then remove the `OpponentSidebar` simulation loop.
8. In API mode, hide the ⚡ Fast-Forward button and the 10s demo toggle. **Keep them in mock mode.** The dev-only WIN/LOSS/DRAW control (`src/dev/`) is already absent from production builds; keep it that way.
9. Run `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e`. The browser suite targets mock mode, so keep it green there.
