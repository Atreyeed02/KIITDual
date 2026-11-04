import {
  AnalyticsDemoState,
  AnonymousProfile,
  FocusSession,
  MatchHistory,
  MatchResult,
  MatchTask,
  PersonalGoals,
} from '../types';
import { matchmakingService } from '../services/matchmakingService';
import { matchService } from '../services/matchService';
import { calculateScore } from '../utils/scoring';
import { isDevBuild } from './demoOutcome';

export interface AnalyticsDemoDataset {
  matchHistory: MatchHistory[];
  focusSessions: FocusSession[];
  goals: PersonalGoals;
}

export interface AnalyticsDemoSnapshot {
  matchHistory: MatchHistory[];
  focusSessions: FocusSession[];
  goals: PersonalGoals;
  state: AnalyticsDemoState | null;
}

interface DemoMatchPlan {
  month: 'previous' | 'current';
  day: number;
  hour: number;
  outcome: 'win' | 'loss' | 'draw';
  durations: number[];
  completedTasks: number;
  isCurrentWeekActivity?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GOALS: PersonalGoals = {
  weeklyFocusTargetMinutes: 180,
  weeklySessionTarget: 4,
};

function monthStart(date: Date, offset: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function daysInMonth(date: Date): number {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

function dateForPlan(
  now: Date,
  monthOffset: number,
  day: number,
  hour: number
): Date {
  const month = monthStart(now, monthOffset);
  const boundedDay = Math.min(day, daysInMonth(month));
  const at = Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), boundedDay, hour);
  return new Date(Math.min(at, now.getTime()));
}

function plansFor(now: Date): DemoMatchPlan[] {
  const currentDay = now.getUTCDate();
  const weekStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    currentDay - ((now.getUTCDay() + 6) % 7)
  ));
  const monthStartDate = monthStart(now, 0);
  const currentWeekStartDay = Math.max(weekStart.getUTCDate(), monthStartDate.getUTCDate());

  return [
    { month: 'previous', day: 4, hour: 10, outcome: 'win', durations: [25, 50], completedTasks: 2 },
    { month: 'previous', day: 14, hour: 13, outcome: 'loss', durations: [25], completedTasks: 1 },
    { month: 'previous', day: 24, hour: 16, outcome: 'draw', durations: [50, 25, 25], completedTasks: 3 },
    { month: 'current', day: Math.min(2, currentDay), hour: 9, outcome: 'win', durations: [25], completedTasks: 1 },
    { month: 'current', day: Math.min(7, currentDay), hour: 11, outcome: 'loss', durations: [50, 25], completedTasks: 2 },
    { month: 'current', day: Math.min(12, currentDay), hour: 13, outcome: 'draw', durations: [25, 25], completedTasks: 2 },
    { month: 'current', day: Math.min(17, currentDay), hour: 15, outcome: 'win', durations: [50], completedTasks: 2 },
    {
      month: 'current',
      day: Math.max(currentWeekStartDay, Math.min(20, currentDay)),
      hour: 18,
      outcome: 'loss',
      durations: [50, 25],
      completedTasks: 1,
      isCurrentWeekActivity: true,
    },
  ];
}

function makeOpponent(userId: string): AnonymousProfile {
  return {
    id: `demo_profile_${userId}`,
    userId: `demo_opponent_${userId}`,
    anonUsername: 'DemoPartner',
    avatarSeed: `demo_partner_${userId}`,
    rotatesPerMatch: false,
  };
}

function opponentResultFor(
  outcome: DemoMatchPlan['outcome'],
  userResult: MatchResult,
  matchId: string,
  opponentId: string
): MatchResult {
  const totalFocusMinutes = outcome === 'win' ? 0 : userResult.totalFocusMinutes;
  const tasksCompleted = outcome === 'loss'
    ? userResult.tasksCompleted + 1
    : outcome === 'win'
      ? 0
      : userResult.tasksCompleted;
  const sessionsCompleted = outcome === 'win' ? 0 : userResult.sessionsCompleted;
  return {
    id: `demo_result_opponent_${matchId}`,
    matchId,
    userId: opponentId,
    totalFocusMinutes,
    tasksCompleted,
    sessionsCompleted,
    finalScore: calculateScore(totalFocusMinutes, tasksCompleted, sessionsCompleted),
  };
}

export function createAnalyticsDemoDataset(
  profile: AnonymousProfile,
  now: Date
): AnalyticsDemoDataset {
  const userId = profile.userId;
  const opponent = makeOpponent(userId);
  const plans = plansFor(now);
  const matchHistory: MatchHistory[] = [];
  const focusSessions: FocusSession[] = [];

  plans.forEach((plan, index) => {
    const matchId = `demo_match_${userId}_${plan.month}_${index}`;
    const plannedEnd = dateForPlan(
      now,
      plan.month === 'previous' ? -1 : 0,
      plan.day,
      plan.hour
    );
    const weekStart = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - ((now.getUTCDay() + 6) % 7)
    ));
    const isCurrentWeek = plan.isCurrentWeekActivity || (
      plan.month === 'current' && plannedEnd.getTime() >= weekStart.getTime()
    );
    const endTime = plannedEnd.toISOString();
    const startTime = new Date(plannedEnd.getTime() - DAY_MS).toISOString();
    const match = {
      ...matchmakingService.createMatch(profile, opponent),
      id: matchId,
      status: 'completed' as const,
      startTime,
      endTime,
    };

    const sessions = plan.durations.map((durationMinutes, sessionIndex): FocusSession => {
      const desiredStart = plannedEnd.getTime() - (durationMinutes + 5) * 60_000 - sessionIndex * 3 * 60 * 60 * 1000;
      const earliestAllowed = isCurrentWeek ? weekStart.getTime() : plannedEnd.getTime() - DAY_MS;
      const startedAt = new Date(Math.min(plannedEnd.getTime(), Math.max(earliestAllowed, desiredStart)));
      return {
        id: `demo_session_${userId}_${index}_${sessionIndex}`,
        matchId,
        userId,
        startedAt: startedAt.toISOString(),
        durationMinutes,
        completed: true,
        source: 'demo',
      };
    });

    const tasks: MatchTask[] = Array.from({ length: plan.completedTasks }, (_, taskIndex) => ({
      id: `demo_task_${userId}_${index}_${taskIndex}`,
      matchId,
      userId,
      description: `Synthetic completed task ${taskIndex + 1}`,
      isCompleted: true,
      createdAt: startTime,
      completedAt: endTime,
    }));
    const userResult = matchService.calculateUserResult(matchId, userId, sessions, tasks);
    const opponentResult = opponentResultFor(plan.outcome, userResult, matchId, opponent.userId);
    const outcome = matchService.determineOutcome(
      userResult.finalScore,
      opponentResult.finalScore,
      userId,
      opponent.userId
    );

    matchHistory.push({
      match: { ...match, winnerId: outcome.winnerId },
      userResult,
      opponentResult,
      isWinner: outcome.isWinner,
      isDraw: outcome.isDraw,
      completedAt: endTime,
      source: 'demo',
    });
    focusSessions.push(...sessions);
  });

  return { matchHistory, focusSessions, goals: DEFAULT_GOALS };
}

export function applyAnalyticsDemoDataset(
  matchHistory: MatchHistory[],
  focusSessions: FocusSession[],
  goals: PersonalGoals,
  previousState: AnalyticsDemoState | null,
  dataset: AnalyticsDemoDataset
): AnalyticsDemoSnapshot {
  return {
    matchHistory: [
      ...matchHistory.filter((item) => item.source !== 'demo'),
      ...dataset.matchHistory,
    ],
    focusSessions: [
      ...focusSessions.filter((session) => session.source !== 'demo'),
      ...dataset.focusSessions,
    ],
    goals: dataset.goals,
    state: { previousGoals: previousState?.previousGoals ?? goals },
  };
}

export function removeAnalyticsDemoDataset(
  matchHistory: MatchHistory[],
  focusSessions: FocusSession[],
  currentGoals: PersonalGoals,
  state: AnalyticsDemoState | null
): AnalyticsDemoSnapshot {
  return {
    matchHistory: matchHistory.filter((item) => item.source !== 'demo'),
    focusSessions: focusSessions.filter((session) => session.source !== 'demo'),
    goals: state?.previousGoals ?? currentGoals,
    state: null,
  };
}

export function isAnalyticsDemoAvailable(): boolean {
  return isDevBuild;
}
