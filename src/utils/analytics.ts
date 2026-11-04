import { FocusSession, MatchHistory, PersonalGoals } from '../types';
import { getOutcome, normalizeHistory } from './stats';

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export interface MonthlyMetrics {
  completedMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  totalFocusMinutes: number;
  completedSessions: number;
  averageSessionMinutes: number | null;
  completedTasks: number;
}

export interface MetricChange {
  difference: number;
  percentChange: number | null;
}

export interface MonthlyReport {
  month: string;
  current: MonthlyMetrics;
  previous: MonthlyMetrics;
  changes: {
    focusMinutes: MetricChange;
    completedMatches: MetricChange;
    completedSessions: MetricChange;
    completedTasks: MetricChange;
  };
}

export interface FocusTrendPoint {
  key: string;
  label: string;
  focusMinutes: number;
}

export interface OutcomeTrendPoint {
  key: string;
  label: string;
  wins: number;
  losses: number;
}

export interface WeeklyGoalProgress {
  weekStartsAt: string;
  focusTargetMinutes: number | null;
  sessionTarget: number | null;
  focusMinutes: number;
  completedSessions: number;
  focusMinutesRemaining: number | null;
  sessionsRemaining: number | null;
  focusPercentAchieved: number | null;
  sessionsPercentAchieved: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getUtcMonthKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function shiftUtcMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return getUtcMonthKey(new Date(Date.UTC(year, monthNumber - 1 + offset, 1)));
}

function sumMonth(history: MatchHistory[], month: string): MonthlyMetrics {
  const items = normalizeHistory(history).filter(
    (item) =>
      item.match.status === 'completed' &&
      Number.isFinite(Date.parse(item.completedAt)) &&
      getUtcMonthKey(new Date(item.completedAt)) === month
  );
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalFocusMinutes = 0;
  let completedSessions = 0;
  let completedTasks = 0;

  for (const item of items) {
    const outcome = getOutcome(item);
    if (outcome === 'win') wins += 1;
    else if (outcome === 'loss') losses += 1;
    else draws += 1;
    totalFocusMinutes += item.userResult.totalFocusMinutes;
    completedSessions += item.userResult.sessionsCompleted;
    completedTasks += item.userResult.tasksCompleted;
  }

  const completedMatches = items.length;
  return {
    completedMatches,
    wins,
    losses,
    draws,
    // Keep the existing application definition: wins divided by all matches.
    winRate: completedMatches ? Math.round((wins / completedMatches) * 100) : null,
    totalFocusMinutes,
    completedSessions,
    averageSessionMinutes: completedSessions
      ? Math.round(totalFocusMinutes / completedSessions)
      : null,
    completedTasks,
  };
}

function compare(current: number, previous: number): MetricChange {
  return {
    difference: current - previous,
    percentChange: previous === 0 ? null : ((current - previous) / previous) * 100,
  };
}

export function getMonthlyReport(history: MatchHistory[], month: string): MonthlyReport {
  const current = sumMonth(history, month);
  const previous = sumMonth(history, shiftUtcMonth(month, -1));
  return {
    month,
    current,
    previous,
    changes: {
      focusMinutes: compare(current.totalFocusMinutes, previous.totalFocusMinutes),
      completedMatches: compare(current.completedMatches, previous.completedMatches),
      completedSessions: compare(current.completedSessions, previous.completedSessions),
      completedTasks: compare(current.completedTasks, previous.completedTasks),
    },
  };
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function startOfUtcWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return startOfUtcDay(date) - mondayOffset * DAY_MS;
}

function uniqueCompletedSessions(sessions: FocusSession[]): FocusSession[] {
  const seen = new Set<string>();
  return sessions.filter((session) => {
    if (
      !session.completed ||
      !Number.isFinite(Date.parse(session.startedAt)) ||
      !Number.isFinite(session.durationMinutes) ||
      session.durationMinutes <= 0 ||
      seen.has(session.id)
    ) {
      return false;
    }
    seen.add(session.id);
    return true;
  });
}

function rangeStart(range: AnalyticsRange, now: Date, firstTimestamp: number): number {
  const today = startOfUtcDay(now);
  if (range === '7d') return today - 6 * DAY_MS;
  if (range === '30d') return today - 29 * DAY_MS;
  if (range === '90d') return today - 89 * DAY_MS;
  return firstTimestamp;
}

function makeBuckets(start: number, end: number, weekly: boolean): Map<number, string> {
  const first = weekly ? startOfUtcWeek(start) : start;
  const step = weekly ? 7 * DAY_MS : DAY_MS;
  const buckets = new Map<number, string>();
  for (let timestamp = first; timestamp <= end; timestamp += step) {
    const date = new Date(timestamp);
    const label = weekly
      ? `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${String(date.getUTCFullYear()).slice(-2)}`
      : `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
    buckets.set(timestamp, label);
  }
  return buckets;
}

export function buildFocusTrend(
  sessions: FocusSession[],
  range: AnalyticsRange,
  now: Date = new Date()
): FocusTrendPoint[] {
  const completed = uniqueCompletedSessions(sessions);
  if (completed.length === 0) return [];

  const currentTime = now.getTime();
  const firstTimestamp = Math.min(...completed.map((session) => Date.parse(session.startedAt)));
  const start = rangeStart(range, now, firstTimestamp);
  const weekly = range === '90d' || range === 'all';
  const buckets = makeBuckets(start, startOfUtcDay(now), weekly);
  const totals = new Map<number, number>();

  for (const session of completed) {
    const timestamp = Date.parse(session.startedAt);
    if (timestamp < start || timestamp > currentTime) continue;
    const key = weekly ? startOfUtcWeek(timestamp) : startOfUtcDay(new Date(timestamp));
    if (buckets.has(key)) {
      totals.set(key, (totals.get(key) ?? 0) + session.durationMinutes);
    }
  }

  return Array.from(buckets, ([timestamp, label]) => ({
    key: new Date(timestamp).toISOString(),
    label,
    focusMinutes: totals.get(timestamp) ?? 0,
  }));
}

export function buildOutcomeTrend(
  history: MatchHistory[],
  range: AnalyticsRange,
  now: Date = new Date()
): OutcomeTrendPoint[] {
  const completed = normalizeHistory(history).filter(
    (item) =>
      item.match.status === 'completed' && Number.isFinite(Date.parse(item.completedAt))
  );
  if (completed.length === 0) return [];

  const currentTime = now.getTime();
  const firstTimestamp = Math.min(...completed.map((item) => Date.parse(item.completedAt)));
  const start = rangeStart(range, now, firstTimestamp);
  const weekly = range === '90d' || range === 'all';
  const buckets = makeBuckets(start, startOfUtcDay(now), weekly);
  const outcomes = new Map<number, { wins: number; losses: number }>();

  for (const item of completed) {
    const timestamp = Date.parse(item.completedAt);
    if (timestamp < start || timestamp > currentTime) continue;
    const key = weekly
      ? startOfUtcWeek(timestamp)
      : startOfUtcDay(new Date(timestamp));
    if (!buckets.has(key)) continue;
    const bucket = outcomes.get(key) ?? { wins: 0, losses: 0 };
    const result = getOutcome(item);
    if (result === 'win') bucket.wins += 1;
    if (result === 'loss') bucket.losses += 1;
    outcomes.set(key, bucket);
  }

  return Array.from(buckets, ([timestamp, label]) => ({
    key: new Date(timestamp).toISOString(),
    label,
    wins: outcomes.get(timestamp)?.wins ?? 0,
    losses: outcomes.get(timestamp)?.losses ?? 0,
  }));
}

function percentAchieved(actual: number, target: number | null): number | null {
  return target === null ? null : Math.round((actual / target) * 100);
}

export function getWeeklyGoalProgress(
  sessions: FocusSession[],
  goals: PersonalGoals,
  now: Date = new Date()
): WeeklyGoalProgress {
  const weekStart = startOfUtcWeek(now.getTime());
  const end = now.getTime();
  const completed = uniqueCompletedSessions(sessions).filter((session) => {
    const timestamp = Date.parse(session.startedAt);
    return timestamp >= weekStart && timestamp <= end;
  });
  const focusMinutes = completed.reduce((total, session) => total + session.durationMinutes, 0);
  const completedSessions = completed.length;
  return {
    weekStartsAt: new Date(weekStart).toISOString(),
    focusTargetMinutes: goals.weeklyFocusTargetMinutes,
    sessionTarget: goals.weeklySessionTarget,
    focusMinutes,
    completedSessions,
    focusMinutesRemaining:
      goals.weeklyFocusTargetMinutes === null
        ? null
        : Math.max(0, goals.weeklyFocusTargetMinutes - focusMinutes),
    sessionsRemaining:
      goals.weeklySessionTarget === null
        ? null
        : Math.max(0, goals.weeklySessionTarget - completedSessions),
    focusPercentAchieved: percentAchieved(focusMinutes, goals.weeklyFocusTargetMinutes),
    sessionsPercentAchieved: percentAchieved(completedSessions, goals.weeklySessionTarget),
  };
}
