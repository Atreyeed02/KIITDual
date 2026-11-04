import { eq, finish, mem } from './setup';
import {
  buildFocusTrend,
  getMonthlyReport,
  getWeeklyGoalProgress,
  shiftUtcMonth,
} from '../../src/utils/analytics';
import { FocusSession, MatchHistory, PersonalGoals } from '../../src/types';
import { storage } from '../../src/services/storage';

const base: MatchHistory = {
  match: {
    id: 'm1',
    user1Id: 'u1',
    user2Id: 'u2',
    user1Profile: { id: 'p1', userId: 'u1', anonUsername: 'User', avatarSeed: 'a', rotatesPerMatch: false },
    user2Profile: { id: 'p2', userId: 'u2', anonUsername: 'Peer', avatarSeed: 'b', rotatesPerMatch: false },
    status: 'completed',
    startTime: '2026-01-31T23:00:00.000Z',
    endTime: '2026-02-01T00:00:00.000Z',
    winnerId: 'u1',
  },
  userResult: {
    id: 'r1',
    matchId: 'm1',
    userId: 'u1',
    totalFocusMinutes: 50,
    tasksCompleted: 2,
    sessionsCompleted: 2,
    finalScore: 60,
  },
  opponentResult: {
    id: 'r2',
    matchId: 'm1',
    userId: 'u2',
    totalFocusMinutes: 0,
    tasksCompleted: 0,
    sessionsCompleted: 0,
    finalScore: 0,
  },
  isWinner: true,
  isDraw: false,
  completedAt: '2026-02-01T00:00:00.000Z',
};

const session = (
  id: string,
  startedAt: string,
  durationMinutes: number,
  completed = true
): FocusSession => ({
  id,
  matchId: 'm1',
  userId: 'u1',
  startedAt,
  durationMinutes,
  completed,
});

eq('UTC month shift crosses year boundaries', shiftUtcMonth('2026-01', -1), '2025-12');
const february = getMonthlyReport([base], '2026-02');
eq('monthly aggregation follows UTC completedAt', [
  february.current.completedMatches,
  february.current.totalFocusMinutes,
  february.current.completedSessions,
  february.current.completedTasks,
  february.current.winRate,
], [1, 50, 2, 2, 100]);
eq('previous calendar month is compared', [
  february.previous.completedMatches,
  february.changes.focusMinutes.difference,
  february.changes.focusMinutes.percentChange,
], [0, 50, null]);

const prior = { ...base, match: { ...base.match, id: 'prior' }, completedAt: '2026-01-31T23:59:59.999Z' };
eq('month boundary keeps a pre-midnight UTC match in January', [
  getMonthlyReport([prior], '2026-01').current.completedMatches,
  getMonthlyReport([prior], '2026-02').current.completedMatches,
], [1, 0]);

const zeroWinRate = {
  ...base,
  match: { ...base.match, id: 'loss' },
  userResult: { ...base.userResult, matchId: 'loss' },
  isWinner: false,
};
const draw = {
  ...base,
  match: { ...base.match, id: 'draw' },
  userResult: { ...base.userResult, matchId: 'draw' },
  isWinner: false,
  isDraw: true,
};
eq('existing win-rate definition includes draws in all match count', [
  getMonthlyReport([base, zeroWinRate, draw], '2026-02').current.winRate,
], [33]);
eq('monthly wins, losses, draws and focus totals are aggregated', [
  getMonthlyReport([base, zeroWinRate, draw], '2026-02').current.wins,
  getMonthlyReport([base, zeroWinRate, draw], '2026-02').current.losses,
  getMonthlyReport([base, zeroWinRate, draw], '2026-02').current.draws,
  getMonthlyReport([base, zeroWinRate, draw], '2026-02').current.totalFocusMinutes,
], [1, 1, 1, 150]);
const nonZeroBaseline = getMonthlyReport([base, prior], '2026-02');
eq('percentage change uses the immediately preceding month', [
  nonZeroBaseline.previous.totalFocusMinutes,
  nonZeroBaseline.changes.focusMinutes.difference,
  nonZeroBaseline.changes.focusMinutes.percentChange,
], [50, 0, 0]);

const progressGoals: PersonalGoals = {
  weeklyFocusTargetMinutes: 100,
  weeklySessionTarget: 3,
};
const weekSessions = [
  session('monday', '2026-02-02T00:00:00.000Z', 25),
  session('sunday', '2026-02-08T23:59:59.000Z', 25),
  session('outside', '2026-02-01T23:59:59.000Z', 50),
  session('incomplete', '2026-02-04T12:00:00.000Z', 50, false),
];
const weekProgress = getWeeklyGoalProgress(
  weekSessions,
  progressGoals,
  new Date('2026-02-08T23:59:59.000Z')
);
eq('weekly progress uses Monday UTC boundary and completed sessions only', [
  weekProgress.focusMinutes,
  weekProgress.completedSessions,
  weekProgress.focusMinutesRemaining,
  weekProgress.sessionsRemaining,
  weekProgress.focusPercentAchieved,
  weekProgress.sessionsPercentAchieved,
], [50, 2, 50, 1, 50, 67]);
eq('incomplete session contributes no weekly focus or session count', [
  weekProgress.focusMinutes,
  weekProgress.completedSessions,
], [50, 2]);
eq('new UTC week starts with zero activity', getWeeklyGoalProgress(
  weekSessions,
  progressGoals,
  new Date('2026-02-09T00:00:00.000Z')
).focusMinutes, 0);

eq('empty and incomplete history does not create a focus chart', buildFocusTrend([
  session('incomplete-chart', '2026-02-04T12:00:00.000Z', 25, false),
], '7d', new Date('2026-02-08T23:00:00.000Z')), []);
eq('focus chart deduplicates recorded sessions', buildFocusTrend([
  session('same', '2026-02-08T10:00:00.000Z', 25),
  session('same', '2026-02-08T10:00:00.000Z', 25),
], '7d', new Date('2026-02-08T23:00:00.000Z')).reduce((n, point) => n + point.focusMinutes, 0), 25);

storage.user.set('analytics-owner-a', 'personal_goals', progressGoals);
eq('goals remain scoped to their owner', [
  storage.user.get('analytics-owner-a', 'personal_goals', { weeklyFocusTargetMinutes: null, weeklySessionTarget: null }),
  storage.user.get('analytics-owner-b', 'personal_goals', { weeklyFocusTargetMinutes: null, weeklySessionTarget: null }),
], [progressGoals, { weeklyFocusTargetMinutes: null, weeklySessionTarget: null }]);
eq('browser storage availability probe cleans up after itself', storage.isAvailable() && !Array.from(mem.keys()).some((key) => key.includes('analytics_probe_')), true);

finish();
