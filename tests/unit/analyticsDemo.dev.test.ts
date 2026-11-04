import { eq, finish } from './setup';
import { AnalyticsDemoState, AnonymousProfile, FocusSession, MatchHistory, PersonalGoals } from '../../src/types';
import {
  applyAnalyticsDemoDataset,
  createAnalyticsDemoDataset,
  isAnalyticsDemoAvailable,
  removeAnalyticsDemoDataset,
} from '../../src/dev/analyticsDemo';
import { getMonthlyReport, getWeeklyGoalProgress } from '../../src/utils/analytics';
import { storage } from '../../src/services/storage';

const now = new Date('2026-11-04T15:00:00.000Z');
const profile: AnonymousProfile = {
  id: 'profile-demo-user',
  userId: 'demo-user',
  anonUsername: 'FocusOtter246',
  avatarSeed: 'focus-otter',
  rotatesPerMatch: false,
};
const dataset = createAnalyticsDemoDataset(profile, now);
const originalGoals: PersonalGoals = {
  weeklyFocusTargetMinutes: 90,
  weeklySessionTarget: 2,
};
const copiedHistory = dataset.matchHistory[0];
const realHistory = [{
  ...copiedHistory,
  match: { ...copiedHistory.match, id: 'real-match' },
  userResult: { ...copiedHistory.userResult, id: 'real-user-result', matchId: 'real-match' },
  opponentResult: { ...copiedHistory.opponentResult, id: 'real-opponent-result', matchId: 'real-match' },
  completedAt: '2026-11-03T08:00:00.000Z',
  source: undefined,
}] as MatchHistory[];
const realSessions = [{
  id: 'real-session',
  matchId: 'real-match',
  userId: 'demo-user',
  startedAt: '2026-11-04T08:00:00.000Z',
  durationMinutes: 25,
  completed: true,
}] as FocusSession[];

eq('demo action is available only in the dev test bundle', isAnalyticsDemoAvailable(), true);

eq('demo data has 3 previous-month and 5 current-month matches', [
  getMonthlyReport(dataset.matchHistory, '2026-10').current.completedMatches,
  getMonthlyReport(dataset.matchHistory, '2026-11').current.completedMatches,
], [3, 5]);
eq('previous month synthetic outcomes and totals are explicit', [
  getMonthlyReport(dataset.matchHistory, '2026-10').current.wins,
  getMonthlyReport(dataset.matchHistory, '2026-10').current.losses,
  getMonthlyReport(dataset.matchHistory, '2026-10').current.draws,
  getMonthlyReport(dataset.matchHistory, '2026-10').current.totalFocusMinutes,
  getMonthlyReport(dataset.matchHistory, '2026-10').current.completedTasks,
], [1, 1, 1, 200, 6]);
eq('current month outcomes and comparison totals are explicit', [
  getMonthlyReport(dataset.matchHistory, '2026-11').current.wins,
  getMonthlyReport(dataset.matchHistory, '2026-11').current.losses,
  getMonthlyReport(dataset.matchHistory, '2026-11').current.draws,
  getMonthlyReport(dataset.matchHistory, '2026-11').current.totalFocusMinutes,
  getMonthlyReport(dataset.matchHistory, '2026-11').current.completedTasks,
  getMonthlyReport(dataset.matchHistory, '2026-11').changes.focusMinutes.difference,
], [2, 2, 1, 275, 8, 75]);
eq('sessions are complete, tagged synthetic and have varied durations', [
  dataset.focusSessions.length,
  dataset.focusSessions.every((session) => session.completed && session.source === 'demo'),
  [...new Set(dataset.focusSessions.map((session) => session.durationMinutes))].sort((a, b) => a - b),
], [14, true, [25, 50]]);
eq('all generated timestamps are not in the future', [
  dataset.matchHistory.every((item) => Date.parse(item.completedAt) <= now.getTime()),
  dataset.focusSessions.every((session) => Date.parse(session.startedAt) <= now.getTime()),
], [true, true]);
eq('demo includes current-week activity and a usable weekly goal', [
  getWeeklyGoalProgress(dataset.focusSessions, dataset.goals, now).focusMinutes,
  getWeeklyGoalProgress(dataset.focusSessions, dataset.goals, now).completedSessions,
  getWeeklyGoalProgress(dataset.focusSessions, dataset.goals, now).focusTargetMinutes,
  getWeeklyGoalProgress(dataset.focusSessions, dataset.goals, now).sessionTarget,
], [275, 8, 180, 4]);

const baseline = applyAnalyticsDemoDataset(
  realHistory,
  realSessions,
  originalGoals,
  null,
  dataset
);
const repeated = applyAnalyticsDemoDataset(
  baseline.matchHistory,
  baseline.focusSessions,
  baseline.goals,
  baseline.state,
  createAnalyticsDemoDataset(profile, now)
);
eq('reloading demo data does not duplicate records or overwrite original goal snapshot', [
  repeated.matchHistory.length,
  repeated.focusSessions.length,
  repeated.state.previousGoals,
], [9, 15, originalGoals]);
eq('loading demo data preserves non-demo activity', [
  repeated.matchHistory.filter((item) => item.source !== 'demo').map((item) => item.match.id),
  repeated.focusSessions.filter((session) => session.source !== 'demo').map((session) => session.id),
], [['real-match'], ['real-session']]);

storage.user.set('demo-user', 'analytics_demo_state', baseline.state);
storage.user.set('other-demo-user', 'analytics_demo_state', null);
storage.user.set('demo-user', 'match_history', baseline.matchHistory);
storage.user.set('other-demo-user', 'match_history', []);
eq('demo metadata stays scoped to the current simulated account', [
  storage.user.get('demo-user', 'analytics_demo_state', null),
  storage.user.get('other-demo-user', 'analytics_demo_state', null),
], [baseline.state, null]);
eq('demo activity remains private to its local account', [
  storage.user.getList('demo-user', 'match_history', (value): value is MatchHistory =>
    typeof value === 'object' && value !== null && 'match' in value
  ).length,
  storage.user.getList('other-demo-user', 'match_history', (value): value is MatchHistory =>
    typeof value === 'object' && value !== null && 'match' in value
  ).length,
], [9, 0]);

const reset = removeAnalyticsDemoDataset(
  repeated.matchHistory,
  repeated.focusSessions,
  repeated.goals,
  repeated.state as AnalyticsDemoState
);
eq('reset removes only synthetic activity and restores previous goals', [
  reset.matchHistory.length,
  reset.focusSessions.map((session) => session.id),
  reset.goals,
  reset.state,
], [1, ['real-session'], originalGoals, null]);
eq('reset preserves the original real match record', reset.matchHistory.map((item) => item.match.id), ['real-match']);

finish();
