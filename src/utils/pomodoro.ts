/**
 * KIITDual — Timestamp-based Pomodoro engine (pure functions).
 *
 * The timer never counts ticks: remaining time is always derived from
 * `startedAt` and the wall clock, so refreshes, background tabs and
 * re-renders cannot drift or accelerate it.
 */

import { FocusSession } from '../types';

export type PomodoroMode = 'standard' | 'deep' | 'break';

export interface PomodoroPersistedState {
  mode: PomodoroMode;
  durationSeconds: number;
  /** Virtual start time: shifted on resume so that `durationSeconds - elapsed` is the true remaining time. */
  startedAt: string | null;
  isRunning: boolean;
  pausedSecondsLeft: number | null;
  /** 10-second demo timer that simulates one full session of the selected mode. */
  demoMode?: boolean;
}

export const MODE_MINUTES: Record<PomodoroMode, number> = {
  standard: 25,
  deep: 50,
  break: 5,
};

export const DEMO_DURATION_SECONDS = 10;

export const durationFor = (mode: PomodoroMode, demoMode = false) =>
  demoMode ? DEMO_DURATION_SECONDS : MODE_MINUTES[mode] * 60;

export const createPomodoroState = (
  mode: PomodoroMode = 'standard',
  demoMode = false
): PomodoroPersistedState => ({
  mode,
  durationSeconds: durationFor(mode, demoMode),
  startedAt: null,
  isRunning: false,
  pausedSecondsLeft: null,
  demoMode,
});

export const isPomodoroState = (v: unknown): v is PomodoroPersistedState => {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    (s.mode === 'standard' || s.mode === 'deep' || s.mode === 'break') &&
    typeof s.durationSeconds === 'number' &&
    s.durationSeconds > 0 &&
    typeof s.isRunning === 'boolean' &&
    (s.startedAt === null || (typeof s.startedAt === 'string' && !Number.isNaN(Date.parse(s.startedAt)))) &&
    (s.pausedSecondsLeft === null || typeof s.pausedSecondsLeft === 'number')
  );
};

export function getRemainingSeconds(state: PomodoroPersistedState, nowMs: number): number {
  if (state.isRunning && state.startedAt) {
    const elapsed = Math.floor((nowMs - Date.parse(state.startedAt)) / 1000);
    return Math.min(state.durationSeconds, Math.max(0, state.durationSeconds - elapsed));
  }
  if (state.pausedSecondsLeft !== null) {
    return Math.min(state.durationSeconds, Math.max(0, state.pausedSecondsLeft));
  }
  return state.durationSeconds;
}

export function startPomodoro(state: PomodoroPersistedState, nowMs: number): PomodoroPersistedState {
  if (state.isRunning) return state;
  const remaining = state.pausedSecondsLeft ?? state.durationSeconds;
  const virtualStart = nowMs - (state.durationSeconds - remaining) * 1000;
  return {
    ...state,
    isRunning: true,
    startedAt: new Date(virtualStart).toISOString(),
    pausedSecondsLeft: null,
  };
}

export function pausePomodoro(state: PomodoroPersistedState, nowMs: number): PomodoroPersistedState {
  if (!state.isRunning) return state;
  return {
    ...state,
    isRunning: false,
    startedAt: null,
    pausedSecondsLeft: getRemainingSeconds(state, nowMs),
  };
}

export const resetPomodoro = (state: PomodoroPersistedState): PomodoroPersistedState =>
  createPomodoroState(state.mode, !!state.demoMode);

/**
 * If a running timer has finished by `cutoffMs`, returns the completed focus
 * session (null for breaks) plus the idle state to continue with.
 * The session id is derived from the start timestamp, so settling the same
 * run twice always yields the same id — callers dedupe on it.
 */
export function settlePomodoro(
  state: PomodoroPersistedState,
  cutoffMs: number,
  matchId: string,
  userId: string
): { finished: boolean; session: FocusSession | null; next: PomodoroPersistedState } {
  if (!state.isRunning || !state.startedAt) {
    return { finished: false, session: null, next: state };
  }
  const startMs = Date.parse(state.startedAt);
  const endMs = startMs + state.durationSeconds * 1000;
  if (cutoffMs < endMs) {
    return { finished: false, session: null, next: state };
  }

  const next = resetPomodoro(state);
  if (state.mode === 'break') {
    return { finished: true, session: null, next };
  }

  return {
    finished: true,
    next,
    session: {
      id: `sess_${matchId}_${startMs}`,
      matchId,
      userId,
      startedAt: new Date(startMs).toISOString(),
      durationMinutes: MODE_MINUTES[state.mode],
      completed: true,
    },
  };
}
