# Implementation Plan - FocusMatch 1v1 Campus Accountability Web App

Build a fully interactive, production-grade Web Application for **FocusMatch** — a 1v1 anonymous study match platform designed for college students, implementing the SRS spec from [`focusmatch-project-documentation.md`](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/focusmatch-project-documentation.md) and adhering to the design system established in Stitch (`projects/6592375690522484798`).

---

## Technical Architecture & Design System

The application will feature a high-fidelity dark mode interface with deep space navy backgrounds (`#0F1420`), Electric Indigo primary accents (`#6C7CFF`), Bio Teal secondary highlights (`#3DD9B3`), and Warm Amber chronometers (`#FFB547`), complete with glassmorphic cards and ambient lighting.

### Key Technology Stack:
- **Framework & Build**: Vite + React + TypeScript
- **Styling**: Tailored CSS design tokens (Inter & JetBrains Mono fonts, glassmorphism, responsive 12-column layout)
- **State Management**: Reactive local & persistent state (simulating real-time WebSocket match sync, countdowns, queueing, session persistence in `localStorage`)
- **Iconography & Graphics**: Generative SVG Identicons & custom visual components matching the Stitch design specs

---

## User Review Required

> [!NOTE]
> The app will be built as a full-featured single-page web application using Vite + React + TypeScript with zero-backend dependency needed for local running (all real-time matchmaking, Pomodoro timers, 24-hour match simulation, and scorecard calculations will run with realistic simulated background state engines and local storage persistence).

---

## Proposed Features & Modules

### 1. Authentication & Anonymous Identity Generator
- **College Email Verification**: `.edu` domain validation + 6-digit OTP modal workflow.
- **Anonymous Identity Engine**: Deterministic & random generator for anonymous usernames (e.g. `QuietFalcon482`, `BioLynx310`) with custom vector identicons.

### 2. Student Dashboard & Matchmaking Hub
- **Stats Counter Bar**: Current streak, total focus hours, wins/losses/draws, average session length.
- **Match Queue Controls**: "Find a Focus Partner" interactive queue modal with real-time matching indicator.
- **Recent Match History Summary**: Visual cards showing past pairings and scorecards.

### 3. 1v1 Active Match Workspace
- **24-Hour Match Countdown Chronometer**: Tabular JetBrains Mono countdown display.
- **Pomodoro Focus Timer Engine**:
  - Customizable focus durations (25m standard / 50m deep focus / 5m short break).
  - Live progress ring animation, play/pause/skip/complete actions.
  - Automatic focus session logger.
- **Match Task Manager**:
  - Goal entry, check-off mechanics with animated point feedback.
- **Live Opponent Activity Feed (Privacy-Preserving)**:
  - Real-time event notifications ("Opponent completed a 25m session!", "Opponent checked off 1 task").
  - Simulated active partner status indicator with Bio Teal pulse.
- **Anonymous Quick-Encouragement Reactions**:
  - Send predefined anonymous emoji nudges ("Keep pushing! 🔥", "Hydrate break 💧", "Focus mode on 🎯").

### 4. End-of-Match Scorecard & Tally Engine
- **Weighted Formula Execution**:
  $$\text{Score} = (0.5 \times \text{Focus Mins}) + (30 \times \text{Tasks Completed}) + (10 \times \text{Sessions Completed})$$
- **Side-by-Side Match Results**: Animated score reveal, winner banner, detailed metrics breakdown.
- **Streak Updates & Immediate Re-queue Action**.

### 5. Analytics & Match History View
- **Interactive Streak Timeline**: Visual graph of past matches.
- **Detailed History Logs**: Inspect scores, task logs, and focus minutes for past 1v1 matches.

---

## Proposed File Changes

#### [NEW] [package.json](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/package.json)
App dependencies (React, Vite, Lucide Icons, Canvas Confetti).

#### [NEW] [vite.config.ts](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/vite.config.ts)
Vite configuration setup.

#### [NEW] [src/index.css](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/index.css)
Complete design tokens (colors, typography, glassmorphism, keyframes, scrollbars).

#### [NEW] [src/types/index.ts](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/types/index.ts)
Data models for Users, Anonymous Profiles, Matches, Tasks, Focus Sessions, and Scorecards.

#### [NEW] [src/utils/identicon.ts](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/utils/identicon.ts)
Generative SVG Identicon component for anonymous student avatars.

#### [NEW] [src/context/AppContext.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/context/AppContext.tsx)
Global application state manager handling authentication, active match state, timers, tasks, and history persistence.

#### [NEW] [src/components/Navbar.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/components/Navbar.tsx)
Header navigation bar with active match ticker, user avatar badge, and streak stats.

#### [NEW] [src/components/AuthModal.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/components/AuthModal.tsx)
College email verification & anonymous identity setup modal.

#### [NEW] [src/components/Dashboard.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/components/Dashboard.tsx)
Main dashboard view with stats, matchmaking launcher, active match banner, and past performance preview.

#### [NEW] [src/components/MatchmakingModal.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/components/MatchmakingModal.tsx)
Matchmaking queue interface with animated partner search & opponent reveal.

#### [NEW] [src/components/MatchWorkspace.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/components/MatchWorkspace.tsx)
Core 1v1 match environment featuring 24h timer, Pomodoro chronometer, tasks checklist, opponent activity ticker, and reaction bar.

#### [NEW] [src/components/ScorecardModal.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/components/ScorecardModal.tsx)
Side-by-side scorecard modal displaying winner calculation, breakdown stats, and streak rewards.

#### [NEW] [src/components/HistoryView.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/components/HistoryView.tsx)
Match history log & performance analytics view.

#### [NEW] [src/components/SettingsView.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/components/SettingsView.tsx)
User preferences, identity rotation, notification toggles, and account management.

#### [NEW] [src/App.tsx](file:///c:/Users/KIIT/OneDrive/Desktop/se%20project/src/App.tsx)
Main container application with routing & modal management.

---

## Verification Plan

### Automated Tests & Linting
- TypeScript type checking: `npx tsc --noEmit`
- Vite build verification: `npm run build`

### Manual Verification
1. **Auth & Identity**: Verify `.edu` validation, OTP submission, and random identicon generator.
2. **Matchmaking Queue**: Trigger queueing, verify search animation, and opponent pairing.
3. **Workspace Operations**: Test 25m Pomodoro timer countdown, session completion logging, task checking, and opponent activity feed triggers.
4. **Scorecard Engine**: Fast-forward/complete match to verify weighted score calculation (`0.5*mins + 30*tasks + 10*sessions`) and winner determination.
5. **Persistence**: Reload browser to ensure match state, tasks, timer progress, and streak stats persist in `localStorage`.
