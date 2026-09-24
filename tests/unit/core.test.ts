/**
 * Core frontend logic: score formula, pomodoro engine, history stats,
 * match scoring integrity, opponent-result stability and storage robustness.
 * Built as a PRODUCTION bundle (import.meta.env.DEV = false).
 */
import { mem, eq, finish } from './setup';
import { calculateScore, getScoreBreakdown } from '../../src/utils/scoring';
import {
  createPomodoroState, startPomodoro, pausePomodoro, getRemainingSeconds, settlePomodoro, resetPomodoro, isPomodoroState,
} from '../../src/utils/pomodoro';
import { computeHistoryStats, normalizeHistory } from '../../src/utils/stats';
import { matchService } from '../../src/services/matchService';
import { matchmakingService } from '../../src/services/matchmakingService';
import { authService } from '../../src/services/authService';
import { storage } from '../../src/services/storage';
import { isMatchHistory } from '../../src/services/validators';


// ---- 5. Score engine ----
eq('score case 1 (100m, 3 tasks, 2 sessions) = 160', calculateScore(100, 3, 2), 160);
eq('score case 2 (0,0,0) = 0', calculateScore(0, 0, 0), 0);
eq('score case 3 (60m, 2 tasks, 1 session) = 100', calculateScore(60, 2, 1), 100);
eq('score half-point (25m, 0, 1) = 22.5', calculateScore(25, 0, 1), 22.5);
eq('breakdown case 1', getScoreBreakdown(100, 3, 2), { focusMinutes: 100, tasksCompleted: 3, sessionsCompleted: 2, focusPoints: 50, taskPoints: 90, sessionPoints: 20, finalScore: 160 });
eq('negative inputs clamp to 0', calculateScore(-5, -1, -2), 0);

const u = authService.generateAnonymousProfile('usr_me');
const opp = matchmakingService.generateSimulatedOpponent(u);
eq('win/loss/draw: win', matchService.determineOutcome(160, 100, 'a', 'b'), { isWinner: true, isDraw: false, winnerId: 'a' });
eq('win/loss/draw: loss', matchService.determineOutcome(100, 160, 'a', 'b'), { isWinner: false, isDraw: false, winnerId: 'b' });
eq('win/loss/draw: draw', matchService.determineOutcome(100, 100, 'a', 'b'), { isWinner: false, isDraw: true, winnerId: null });

// ---- Match scoring integrity ----
const match = matchmakingService.createMatch(u, opp);
const other = 'match_other';
const sess = (id: string, m: string, completed = true, mins = 25) => ({ id, matchId: m, userId: 'usr_me', startedAt: new Date().toISOString(), durationMinutes: mins, completed });
const task = (id: string, m: string, done: boolean) => ({ id, matchId: m, userId: 'usr_me', description: 't', isCompleted: done, createdAt: '' });
const res = matchService.calculateUserResult(match.id, 'usr_me',
  [sess('s1', match.id), sess('s1', match.id) /* duplicate id */, sess('s2', match.id, false) /* cancelled */, sess('s3', other) /* other match */, sess('s4', match.id, true, 50)],
  [task('t1', match.id, true), task('t2', match.id, false), task('t3', other, true)]);
eq('user result counts only completed, unique, same-match sessions/tasks', [res.totalFocusMinutes, res.sessionsCompleted, res.tasksCompleted, res.finalScore], [75, 2, 1, 37.5 + 30 + 20]);

// Opponent result persisted & stable
const o1 = matchService.getOrCreateOpponentResult(match);
const o2 = matchService.getOrCreateOpponentResult(match);
eq('opponent result stable across calls', o1, o2);
mem.delete(`focusmatch_opp_result_${match.id}`);
eq('opponent result deterministic even if cache lost', matchService.getOrCreateOpponentResult(match).finalScore, o1.finalScore);
eq('opponent score obeys formula', o1.finalScore, calculateScore(o1.totalFocusMinutes, o1.tasksCompleted, o1.sessionsCompleted));

const fin = matchService.finalizeMatch({ match, userProfile: u, focusSessions: [], matchTasks: [] });
eq('finalized history item passes validator', isMatchHistory(fin.historyItem), true);
eq('finalized match status completed', fin.completedMatch.status, 'completed');

// ---- 12. Pomodoro engine ----
const T0 = Date.parse('2026-09-24T10:00:00Z');
let p = createPomodoroState('standard');
eq('standard duration 25m', p.durationSeconds, 1500);
eq('deep duration 50m', createPomodoroState('deep').durationSeconds, 3000);
eq('break duration 5m', createPomodoroState('break').durationSeconds, 300);
p = startPomodoro(p, T0);
eq('remaining after 10 min', getRemainingSeconds(p, T0 + 600_000), 900);
eq('start while running is no-op', startPomodoro(p, T0 + 5000), p);
p = pausePomodoro(p, T0 + 600_000);
eq('paused keeps 900s', [p.isRunning, p.pausedSecondsLeft, getRemainingSeconds(p, T0 + 9_999_999)], [false, 900, 900]);
p = startPomodoro(p, T0 + 3_600_000); // resume an hour later
eq('resume continues from 900s (not full 1500s)', getRemainingSeconds(p, T0 + 3_600_000), 900);
eq('after resume + 5 min = 600s', getRemainingSeconds(p, T0 + 3_600_000 + 300_000), 600);
// "refresh": JSON round trip of persisted state
const refreshed = JSON.parse(JSON.stringify(p));
eq('refreshed state valid', isPomodoroState(refreshed), true);
eq('timer recovers after refresh via timestamps', getRemainingSeconds(refreshed, T0 + 3_600_000 + 300_000), 600);
eq('not finished before end', settlePomodoro(p, T0 + 3_600_000 + 899_000, 'm1', 'usr').finished, false);
const s1 = settlePomodoro(p, T0 + 3_600_000 + 900_000, 'm1', 'usr');
const s2 = settlePomodoro(p, T0 + 3_600_000 + 950_000, 'm1', 'usr');
eq('finishes at end, logs 25m session', [s1.finished, s1.session?.durationMinutes, s1.session?.completed], [true, 25, true]);
eq('settling same run twice yields same session id (dedupe key)', s1.session?.id, s2.session?.id);
eq('after settle the timer is idle & reset', [s1.next.isRunning, s1.next.durationSeconds], [false, 1500]);
const br = settlePomodoro(startPomodoro(createPomodoroState('break'), T0), T0 + 300_000, 'm1', 'usr');
eq('break completion logs no focus session', [br.finished, br.session], [true, null]);
const reset = resetPomodoro(startPomodoro(createPomodoroState('deep'), T0));
eq('reset discards run (not counted)', [reset.isRunning, reset.startedAt, settlePomodoro(reset, T0 + 9e9, 'm', 'u').session], [false, null, null]);
const demo = startPomodoro(createPomodoroState('deep', true), T0);
const demoDone = settlePomodoro(demo, T0 + 10_000, 'm1', 'usr');
eq('demo 10s simulates a full 50m session', [demo.durationSeconds, demoDone.session?.durationMinutes], [10, 50]);

// ---- Stats (single source for Dashboard + History) ----
const mk = (id: string, w: boolean, d: boolean, f: number, t: number, s: number, at: string) => ({
  ...fin.historyItem, match: { ...fin.historyItem.match, id }, isWinner: w, isDraw: d, completedAt: at,
  userResult: { ...fin.historyItem.userResult, totalFocusMinutes: f, tasksCompleted: t, sessionsCompleted: s },
});
const hist = normalizeHistory([
  mk('a', true, false, 100, 3, 4, '2026-09-20T00:00:00Z'),
  mk('b', false, false, 50, 1, 2, '2026-09-22T00:00:00Z'),
  mk('a', true, false, 100, 3, 4, '2026-09-20T00:00:00Z'), // duplicate
  mk('c', false, true, 0, 0, 0, '2026-09-21T00:00:00Z'),
]);
eq('history deduped & newest first', hist.map((h) => h.match.id), ['b', 'c', 'a']);
eq('stats', computeHistoryStats(hist), { totalMatches: 3, wins: 1, losses: 1, draws: 1, winRate: 33, totalFocusMinutes: 150, totalFocusHours: '2.5', totalTasks: 4, totalSessions: 6, avgSessionMinutes: 25 });
eq('empty stats', computeHistoryStats([]).avgSessionMinutes + computeHistoryStats([]).winRate, 0);

// ---- 8. Storage robustness ----
mem.set('focusmatch_bad_json', '{not json');
eq('malformed JSON -> default', storage.get('bad_json', 'dflt'), 'dflt');
eq('malformed key removed', mem.has('focusmatch_bad_json'), false);
mem.set('focusmatch_u_x_match_history', JSON.stringify({ not: 'an array' }));
eq('non-array list -> []', storage.user.getList('x', 'match_history', isMatchHistory), []);
mem.set('focusmatch_u_x_match_history', JSON.stringify([fin.historyItem, { junk: true }, null]));
eq('invalid list items dropped, valid kept', storage.user.getList('x', 'match_history', isMatchHistory).length, 1);
mem.set('focusmatch_match_history', JSON.stringify([fin.historyItem]));
storage.migrateLegacyKeys('usr_legacy');
eq('legacy key migrated to user scope', [mem.has('focusmatch_match_history'), storage.user.getList('usr_legacy', 'match_history', isMatchHistory).length], [false, 1]);
mem.set('other_app_key', 'keep');
storage.clearAll();
eq('clearAll removes only focusmatch_ keys', Array.from(mem.keys()), ['other_app_key']);

finish();
