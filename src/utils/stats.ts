/**
 * KIITDual — Single source for history-derived statistics.
 * Dashboard, History and Scorecard all read metrics from here so that the
 * same number is never computed two different ways.
 */

import { MatchHistory } from '../types';

export type MatchOutcome = 'win' | 'loss' | 'draw';

export const getOutcome = (item: MatchHistory): MatchOutcome =>
  item.isDraw ? 'draw' : item.isWinner ? 'win' : 'loss';

export interface HistoryStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number; // 0–100, rounded
  totalFocusMinutes: number;
  totalFocusHours: string; // one decimal place
  totalTasks: number;
  totalSessions: number;
  avgSessionMinutes: number; // 0 when no sessions logged
}

export function computeHistoryStats(history: MatchHistory[]): HistoryStats {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalFocusMinutes = 0;
  let totalTasks = 0;
  let totalSessions = 0;

  history.forEach((item) => {
    const outcome = getOutcome(item);
    if (outcome === 'win') wins++;
    else if (outcome === 'loss') losses++;
    else draws++;
    totalFocusMinutes += item.userResult.totalFocusMinutes;
    totalTasks += item.userResult.tasksCompleted;
    totalSessions += item.userResult.sessionsCompleted;
  });

  const totalMatches = history.length;
  return {
    totalMatches,
    wins,
    losses,
    draws,
    winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
    totalFocusMinutes,
    totalFocusHours: (totalFocusMinutes / 60).toFixed(1),
    totalTasks,
    totalSessions,
    avgSessionMinutes: totalSessions > 0 ? Math.round(totalFocusMinutes / totalSessions) : 0,
  };
}

/** Newest first, one entry per match id. */
export function normalizeHistory(history: MatchHistory[]): MatchHistory[] {
  const seen = new Set<string>();
  return [...history]
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .filter((item) => {
      if (seen.has(item.match.id)) return false;
      seen.add(item.match.id);
      return true;
    });
}
