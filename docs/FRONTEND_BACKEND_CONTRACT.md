# KIITDual — Frontend ⇄ Backend Contract

**Audience:** backend developers building the KIITDual API.
**Status:** the frontend is complete and runs entirely on simulated services today. This document defines what the existing UI needs from the backend so it can be connected **without rewriting any screen**.

---

## 0. How to read this document

Every item is labelled with one of these tags:

| Label | Meaning |
|---|---|
| **SRS** | Defined in the SRS (`focusmatch-project-documentation.md` §10, §11, §13–§15). The method and path are agreed. |
| **PROPOSED** | Not defined anywhere yet. It's the shape the current UI needs; the team must confirm or change it. The frontend does not depend on the exact name. |
| **DECISION REQUIRED** | The SRS and the existing UI conflict, or neither defines the behaviour. It has to be settled before that part is integrated. |

### 0.1 Known SRS discrepancies (please resolve first)

1. **Focus session paths differ between sources.**
   - SRS §11: `POST /matches/:id/sessions/start` and `PATCH /matches/:id/sessions/:sessionId/complete`.
   - Integration brief: `POST /matches/:id/sessions` and `PATCH /matches/:id/sessions/:sessionId`.

   This document uses the **brief's** paths. Either works for the frontend, but the team should pick one.
2. **Auth flow.** The SRS lists `POST /auth/register` ("College email verification (OTP)") and `POST /auth/login` ("returns JWT"). The UI is a two-step, passwordless flow: *send code → verify code*, with the same screen for new and returning users. §2.1 shows how the two map; please confirm.
3. **Draws.** The SRS allows ties (§13), but the `users` table has no `total_draws` column. The UI shows a draws count. Either add the column or let the frontend derive draws from history (it already does; see §2.3).

### 0.2 Conventions (PROPOSED)

- **Base URL:** `VITE_API_BASE_URL` (see `.env.example`). All paths below are relative to it.
- **JSON casing:** the UI's models are camelCase (`src/types/index.ts`). The API may use snake_case, but conversion must happen in the frontend mapper layer (see the Integration Guide), never inside components. The response bodies below are written in the **frontend model shape** so the mapping target is unambiguous.
- **Timestamps:** ISO-8601 UTC strings (`2026-09-24T10:00:00.000Z`). The UI parses them with `Date.parse`.
- **IDs:** opaque strings. The UI never parses or displays ids.
- **Auth:** "Required" means an authenticated, verified user. Token transport is covered in the Integration Guide §3.

### 0.3 Error envelope (PROPOSED)

The UI only needs a human-readable message, plus a stable code for the few cases it branches on.

```json
{ "error": { "code": "MATCH_NOT_ACTIVE", "message": "This match has already ended.", "details": {} } }
```

| HTTP | Typical `code` values | What the UI does |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_EMAIL_DOMAIN`, `INVALID_OTP`, `OTP_EXPIRED` | Shows `message` inline (auth forms already have inline `role="alert"` errors) |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` | Signs the user out locally and returns to the email screen |
| 403 | `NOT_A_PARTICIPANT` | Treated as "not found"; shows the existing "No … found" fallback |
| 404 | `NOT_FOUND` | Existing fallback screens |
| 409 | `ACTIVE_MATCH_EXISTS`, `ALREADY_QUEUED`, `MATCH_NOT_ACTIVE`, `MATCH_NOT_COMPLETED` | Re-syncs state with `GET /matches/current` |
| 429 | `RATE_LIMITED` | Shows `message` (SRS §16 requires rate-limiting auth endpoints) |
| 5xx | `INTERNAL` | Generic error message; the ErrorBoundary is the last resort |

---

## 1. Frontend models (the target shapes)

These are copied from `src/types/index.ts` and are what every response is mapped into.

```ts
interface User {                 // the signed-in account (never the opponent)
  id: string;
  collegeEmailHash: string;      // simulation-only; see note below
  isVerified: boolean;
  createdAt: string;
  currentStreak: number;         // consecutive COMPLETED matches (SRS §10)
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;            // not in SRS users table, see §0.1(3)
}

interface AnonymousProfile {
  id: string;
  userId: string;                // opponent: an opaque id, NOT their account id (see §5)
  anonUsername: string;          // e.g. "QuietFalcon482"
  avatarSeed: string;            // deterministic identicon seed
  rotatesPerMatch: boolean;      // current behaviour: false (persistent per account)
}

type MatchStatus = 'queued' | 'active' | 'completed' | 'forfeited';

interface Match {
  id: string;
  user1Id: string;               // ALWAYS the requesting user (see §5)
  user2Id: string;               // ALWAYS the opponent
  user1Profile: AnonymousProfile;
  user2Profile: AnonymousProfile;
  status: MatchStatus;
  startTime: string;
  endTime: string;               // startTime + 24h
  winnerId: string | null;
}

interface MatchTask {
  id: string; matchId: string; userId: string;
  description: string;           // 1–200 chars after trim (UI enforces)
  isCompleted: boolean;
  createdAt: string;
  completedAt?: string;
}

interface FocusSession {
  id: string; matchId: string; userId: string;
  startedAt: string;
  durationMinutes: number;       // 25 (standard) or 50 (deep); breaks are never sessions
  completed: boolean;
}

interface MatchResult {
  id: string; matchId: string; userId: string;
  totalFocusMinutes: number;
  tasksCompleted: number;
  sessionsCompleted: number;
  finalScore: number;            // formula in §4
}

interface MatchHistory {         // what the Scorecard and History render
  match: Match;
  userResult: MatchResult;       // the requester
  opponentResult: MatchResult;
  isWinner: boolean;             // from the requester's point of view
  isDraw: boolean;
  completedAt: string;
}
```

> `collegeEmailHash` exists only so the simulation can key local accounts. The real API **should not return it**; the frontend doesn't need it once it's connected to the backend.

---

## 2. REST endpoints

### 2.1 Authentication

#### `POST /auth/register` — SRS (interpreted as "send verification code")

| | |
|---|---|
| **Purpose** | Start sign-in: validate the college domain and email a 6-digit one-time code. Used for new **and** returning users; the UI has no separate sign-up screen. |
| **Request** | `{ "email": "roll_number@kiit.ac.in" }` |
| **Response** | `202 Accepted`, with body `{}`. PROPOSED optional fields: `{ "resendAfterSeconds": 30 }`. The UI currently hard-codes a 30 s resend cooldown. |
| **Errors** | 400 `INVALID_EMAIL_DOMAIN` / `VALIDATION_ERROR`; 429 `RATE_LIMITED` |
| **Auth** | None |
| **Consumer** | `AppContext.requestOtp` → `authService.requestOtp`; used by `AuthScreen` and by "Resend" in `OtpVerification` |
| **Notes** | The server-side domain allowlist is authoritative. The frontend list in `src/data/collegeConfig.ts` also includes demo domains (`college.edu`, `mit.edu`, …) and is only a UX pre-check. The UI normalises the email (trim + lowercase) before sending. The response must be identical whether or not the email already has an account, so accounts can't be enumerated. |

#### `POST /auth/login` — SRS (interpreted as "verify code, issue session")

| | |
|---|---|
| **Purpose** | Exchange email + OTP for an authenticated session. |
| **Request** | `{ "email": "roll_number@kiit.ac.in", "otp": "123456" }` |
| **Response** | `200` `{ "token": "<jwt>", "user": User, "profile": AnonymousProfile }`. Omit `token` if the backend uses an httpOnly cookie (Integration Guide §3). |
| **Errors** | 400 `INVALID_OTP` / `OTP_EXPIRED`; 429 `RATE_LIMITED` |
| **Auth** | None |
| **Consumer** | `AppContext.verifyOtp` → `authService.verifyOtp`, used by `OtpVerification` |
| **Notes** | On success the UI shows the identity screen ("Your Study Identity"), then the dashboard. The OTP is exactly 6 digits. The UI displays error `message`s verbatim, so don't include secrets or the expected code. |

#### `GET /users/me` — SRS

| | |
|---|---|
| **Purpose** | Restore the session on app load; provides the account stats and streak used in the Navbar, Dashboard and Scorecard. |
| **Request** | — |
| **Response** | `200` `{ "user": User, "profile": AnonymousProfile }` |
| **Errors** | 401 `UNAUTHENTICATED` / `TOKEN_EXPIRED` |
| **Auth** | Required |
| **Consumer** | App bootstrap (today `bootstrap()` in `AppContext.tsx` reads localStorage) |
| **Notes** | `currentStreak` counts consecutive **completed** matches: +1 for any completed match (win, loss or draw); 0 after the user forfeits. Wins, losses and draws shown in the UI are derived from history (see §2.3). |

#### Endpoints the UI needs that the SRS lacks — PROPOSED

| Method & path | UI trigger | Request → Response | Notes |
|---|---|---|---|
| `POST /auth/logout` | Navbar "Logout" | — → `204` | Optional with stateless JWT; needed to clear an httpOnly cookie. |
| `POST /users/me/identity` | Settings "Regenerate Identity", identity screen "Shuffle" | — → `200 AnonymousProfile` | Past scorecards must keep the identity used *in that match* (they read `match.user1Profile`). |
| `DELETE /users/me` | Settings "Delete Local Account" → "Reset All Data" | — → `204` | SRS §16: deletion must cascade and remove hashed identity links. The UI then clears all local data and shows the email screen. |
| `GET/PUT /users/me/preferences` | Settings notification toggles | `{ matchFound, matchEndingSoon, matchResultsReady }` (all booleans) | Or keep these client-side only. The toggles currently do nothing beyond being saved. |

### 2.2 Matchmaking

#### `POST /matchmaking/queue` — SRS

| | |
|---|---|
| **Purpose** | "Find a Focus Partner" → "Start Matching". |
| **Request** | `{}` |
| **Response** | `202` `{ "status": "searching", "queuedAt": "<ISO>" }`. PROPOSED body. The UI shows elapsed wait time, measured from `queuedAt`. |
| **Errors** | 409 `ACTIVE_MATCH_EXISTS` (the UI routes to the active match); 409 `ALREADY_QUEUED` (safe to treat as success) |
| **Auth** | Required |
| **Consumer** | `AppContext.startSearch`, used by `MatchmakingModal` |
| **Notes** | **Invariant: one user has at most one active match.** The UI already blocks queueing while a match is active, but the server must enforce it too. |

#### `DELETE /matchmaking/queue` — SRS

| | |
|---|---|
| **Purpose** | "Cancel Search". |
| **Response** | `204`. Must be idempotent (204 even if not queued). |
| **Auth** | Required |
| **Consumer** | `AppContext.cancelSearch` |
| **Notes** | After cancelling, the client must never receive a match from that search. The simulation guarantees this and the regression suite tests it. |

#### How the client learns it was paired — DECISION REQUIRED

The SRS has no "match found" endpoint or event before a match exists: `/ws/match/:id` needs a match id. Two options:
- **(a)** While searching, poll `GET /matches/current` every 2–3 s. (The SRS already recommends React Query polling.)
- **(b)** Add a user-level socket channel, **PROPOSED** `match:found`.

#### "Partner found" confirmation — DECISION REQUIRED

The UI has an intentional step between pairing and the match starting:
1. The **"Focus Partner Found"** dialog appears, with **"Start Match Now"** and **"Cancel & Return to Dashboard"**.
2. **Closing or cancelling that dialog intentionally discards the found partner.** This behaviour must be preserved.

SRS §15 instead goes straight `Queued → Active` ("paired with opponent, 24h timer starts"). If the backend creates an active match at pairing time, "Cancel" would have to become a forfeit, which changes both the intended UX and the forfeit rules. The team must choose:
- **(a)** A short-lived *pending* pairing that becomes `active` only when **both** users confirm. PROPOSED: `POST /matches/:id/accept` and `POST /matches/:id/decline`. This preserves the UI exactly.
- **(b)** Keep the SRS lifecycle and change the UI. That's a product change, so it needs sign-off from the frontend owner.

#### Queue status on reload — PROPOSED

The UI restores an in-progress search after a page refresh. The SRS has no way to read queue state. PROPOSED options:
- `GET /matchmaking/queue` returning `200 { status: "searching", queuedAt }` or `204`,
- or a `queue` field on `GET /users/me`.

### 2.3 Matches, tasks, sessions, results

#### `GET /matches/current` — SRS

| | |
|---|---|
| **Purpose** | The active match, if any. Called on load, after reconnects, and on any 409. |
| **Response** | `200` `{ "match": Match, "tasks": MatchTask[], "sessions": FocusSession[], "serverTime": "<ISO>" }`, or `200 { "match": null }` when there's no active match. |
| **Errors** | 401 |
| **Auth** | Required |
| **Consumer** | Bootstrap and the match lifecycle (today `loadUserData` in `AppContext.tsx`) |
| **Notes** | **PROPOSED additions:** `tasks` and `sessions` (the requester's own only). The SRS has no GET endpoint for either, but the workspace needs them after a refresh. `serverTime` lets the countdown correct for clock skew. The match must be **oriented to the requester** (§5). A `completed`/`forfeited` match must never come back as current. |

#### `POST /matches/:id/tasks` — SRS

| | |
|---|---|
| **Purpose** | Add a study goal. |
| **Request** | `{ "description": "Revise Ch 4 notes" }` (trimmed, 1–200 chars) |
| **Response** | `201 MatchTask` |
| **Errors** | 400 `VALIDATION_ERROR`; 403 `NOT_A_PARTICIPANT`; 409 `MATCH_NOT_ACTIVE` |
| **Auth** | Required; participant only |
| **Consumer** | `AppContext.addTask`, used by `TaskManager` |
| **Notes** | Tasks are private to their owner. The opponent only ever sees an anonymised activity event (§3), never the description. When a match starts, the UI currently creates two starter tasks locally; the team should decide whether the server creates them or the client POSTs them. |

#### `PATCH /matches/:id/tasks/:taskId` — SRS

| | |
|---|---|
| **Purpose** | Tick a task done, **or un-tick it**. The UI allows reopening tasks. |
| **Request** | `{ "isCompleted": true }` or `{ "isCompleted": false }` |
| **Response** | `200 MatchTask`, with `completedAt` set or cleared |
| **Errors** | 403, 404, 409 `MATCH_NOT_ACTIVE` |
| **Auth** | Required; task owner only |
| **Consumer** | `AppContext.toggleTask` |
| **Notes** | The SRS describes this as "Mark task complete". The UI also needs `false`. It must be idempotent. |

#### `DELETE /matches/:id/tasks/:taskId` — PROPOSED

The UI has a delete button on each task; the SRS has no delete endpoint. Response `204`. Consumer: `AppContext.deleteTask`.

#### `POST /matches/:id/sessions` — SRS (see §0.1 for the `/start` path variant)

| | |
|---|---|
| **Purpose** | The user pressed "Start Focus". |
| **Request** | PROPOSED: `{ "mode": "standard" \| "deep", "clientSessionId": "sess_<matchId>_<startMs>" }` |
| **Response** | `201 FocusSession` with `completed: false` and `durationMinutes` of 25 or 50 |
| **Errors** | 403; 409 `MATCH_NOT_ACTIVE`; 409 if another session is already running (the UI allows only one) |
| **Auth** | Required; participant only |
| **Consumer** | `AppContext.startPomodoro` |
| **Notes** | Break mode (5 min) is **never** sent: breaks don't score. `clientSessionId` makes retries idempotent; the UI already uses that deterministic id to dedupe. The server decides `durationMinutes` from `mode`. |

#### `PATCH /matches/:id/sessions/:sessionId` — SRS (see §0.1 for the `/complete` path variant)

| | |
|---|---|
| **Purpose** | The timer finished, or the user reset the timer. |
| **Request** | `{ "completed": true }` when finished. PROPOSED: `{ "completed": false }` on reset/cancel. |
| **Response** | `200 FocusSession` |
| **Errors** | 403, 404; 409 `MATCH_NOT_ACTIVE`; PROPOSED 422 `SESSION_TOO_SHORT` |
| **Auth** | Required; owner only |
| **Consumer** | The lifecycle tick in `AppContext` (it detects completion from timestamps) and `AppContext.resetPomodoro` |
| **Notes** | **Must be idempotent.** The same completion may arrive twice after a refresh or reconnect. Pause/resume happens entirely on the client (the frontend shifts a virtual start time), so the server sees one session. Pausing only makes it longer, so it's safe to validate `now - startedAt >= durationMinutes`. **Cancelled or incomplete sessions never count.** A session that finished before `endTime`, but was reported late (the tab was closed at the time), should still count; see the Integration Guide §11. |

#### `GET /matches/:id/result` — SRS

| | |
|---|---|
| **Purpose** | The private scorecard. |
| **Response** | `200 MatchHistory`, oriented to the requester |
| **Errors** | 403 `NOT_A_PARTICIPANT`; 404; 409 `MATCH_NOT_COMPLETED` (the UI retries shortly) |
| **Auth** | Required; **only the two participants** (SRS §14: enforced at the API, not just the UI) |
| **Consumer** | `Scorecard` (via `activeScorecard`) and history cards |
| **Notes** | The result must be **stable**: reopening the scorecard or refreshing always shows the same numbers. |

#### `GET /matches/history` — SRS

| | |
|---|---|
| **Purpose** | Past matches for the Dashboard's "Recent Match History" (first 6), the History list, its filters and search, and the analytics cards. |
| **Response** | `200 MatchHistory[]`, newest `completedAt` first, one entry per match |
| **Errors** | 401 |
| **Auth** | Required |
| **Consumer** | `Dashboard`, `MatchHistoryPage` (stats come from `computeHistoryStats` in `src/utils/stats.ts`) |
| **Notes** | **New users get an empty array.** Never seed fabricated matches. **DECISION REQUIRED:** the UI has no representation for forfeited matches, and today they don't appear in history. Either exclude them, or agree a small UI addition (it's a product change). |

#### `POST /matches/:id/forfeit` — PROPOSED (the SRS has the state but no endpoint)

| | |
|---|---|
| **Purpose** | "Leave / Forfeit Match" → "Confirm Leave". |
| **Response** | `204` |
| **Consumer** | `AppContext.forfeitCurrentMatch` |
| **Notes** | Current UI behaviour: the leaver's streak resets to 0, nothing is added to their history, and they return to the dashboard. SRS §15: the forfeit **must not count as a loss for the remaining user**. How the *remaining* user's UI reacts is a gap; see §3 `match:forfeited`. |

---

## 3. WebSocket contract — `/ws/match/:id`

The SRS defines only the path and the purpose: "Live channel: opponent activity ticks, countdown sync, optional chat" (§11). It also names Socket.io as the real-time stack (§9). **Everything below is PROPOSED**, and the event names don't exist in the code yet. The one exception is the `ActivityEvent` shape that events are mapped into, which does exist (`src/services/activityService.ts`).

**DECISION REQUIRED:** Socket.io (namespaces and rooms, its own path) or raw WebSocket at `/ws/match/:id`. The mapping layer below works with either.

### 3.1 Connection

- **URL:** `${WS_BASE_URL}/ws/match/:id` (`src/config/env.ts`).
- **Auth:** same credential as REST (cookie, or a token in the connection handshake). Reject non-participants.
- **Lifetime:** open while the match is `active`, and closed on completion or forfeit.
- **REST is the source of truth.** On connect and on every reconnect, the client calls `GET /matches/current`. The socket only delivers live changes.

### 3.2 Envelope (PROPOSED)

```json
{ "type": "opponent:activity", "matchId": "…", "at": "2026-09-24T10:00:00.000Z", "payload": { } }
```

### 3.3 Server → client events (PROPOSED)

| Event | Payload | UI effect |
|---|---|---|
| `match:state` | `{ match: Match, serverTime }` | Sent on connect. Syncs the 24h countdown and corrects clock skew. |
| `opponent:joined` | `{}` | Activity feed: "*{anon}* joined the 24h match" |
| `opponent:activity` | `{ kind: "session_started" \| "session_completed" \| "task_completed" \| "break_started" \| "focusing", minutes?: number }` | Adds an `ActivityEvent` to the feed (§3.5). **No task descriptions**, only coarse signals (SRS §17: "without exposing details that could feel like surveillance"). |
| `opponent:reaction` | `{ emoji, label }` | Feed: "*{anon}* sent reaction: 🔥 Keep pushing!" |
| `opponent:presence` | `{ online: boolean }` | Optional. The sidebar currently always shows "Focusing now". |
| `match:completed` | `{ matchId }` | Client fetches `GET /matches/:id/result`, then shows the Scorecard. |
| `match:forfeited` | `{ by: "opponent" }` | **Gap: there is no UI for this yet.** SRS: not a loss for the remaining user. Needs a product decision (e.g. a scorecard-style notice). |
| `error` | `{ code, message }` | Log it. Resync via REST. |

### 3.4 Client → server events (PROPOSED)

| Event | Payload | Trigger |
|---|---|---|
| `reaction:send` | `{ emoji, label }` | `AppContext.sendReaction`. Today it's local-only and appears in your own feed as "You sent reaction…". |
| `ping` | `{}` | Heartbeat. |

Task and session changes go through **REST**, not the socket. The server then fans out `opponent:activity` to the other participant.

### 3.5 Mapping into the existing feed model

```ts
interface ActivityEvent {          // src/services/activityService.ts
  id: string;                      // server event id (used as React key; must be unique)
  opponentUsername: string;        // actor's anonUsername, or "You" for your own reactions
  message: string;                 // e.g. "completed a 25m focus session"
  timestamp: string;               // ISO
  type: 'session' | 'task' | 'reaction' | 'status';
}
```

The feed keeps at most 30 events (`MAX_ACTIVITY_EVENTS`).

### 3.6 Disconnects

Reconnect with backoff. After reconnecting, call `GET /matches/current`. If `match` is `null`, the match ended while the client was offline: fetch `GET /matches/:id/result` and show the scorecard. The existing "expired while the browser was closed" path already does exactly this locally.

---

## 4. Scoring (must not change)

```
final_score = (0.5 × total_focus_minutes) + (30 × tasks_completed) + (10 × sessions_completed)
```

- Only **completed** sessions and **completed** tasks of **that match** count, and each id counts once.
- Higher score wins; equal scores are a **draw**.
- The **backend is authoritative** for final results. The frontend keeps `calculateScore` (`src/utils/scoring.ts`) for the live score in the workspace, and it must produce identical numbers.
- Rounding: the frontend rounds to 1 decimal place. With whole-minute focus time, scores are always multiples of 0.5, so no rounding ambiguity arises.

## 5. Orientation & privacy rules (the backend must honour these)

1. **`user1` is always the requester.** Every screen assumes `match.user1Profile` is "You" and `match.user2Profile` is the opponent. Likewise `userResult` is the requester's and `opponentResult` the opponent's, and `isWinner`/`isDraw` are from the requester's point of view. Re-orient server data before it reaches components, either in the response or in the frontend mapper.
2. **Never send the opponent's email, real name, or account id.** Use an opaque, per-match participant id for `user2Id`, `user2Profile.userId`, `opponentResult.userId` and `winnerId`. The UI never displays ids.
3. **Scorecards are visible only to the two participants** (403 otherwise).
4. **Emails are stored as hashes** (SRS §14). The frontend never needs the hash.
