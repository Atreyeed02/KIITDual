/**
 * DEV-only WIN/LOSS/DRAW demo control. Built with import.meta.env.DEV = true.
 * Verifies outcomes are produced purely by choosing opponent stats — the
 * scoring formula itself is never bypassed.
 */
import { mem, eq, finish } from './setup';
import { demoOutcome, isDevBuild } from '../../src/dev/demoOutcome';
import { matchService } from '../../src/services/matchService';
import { matchmakingService } from '../../src/services/matchmakingService';
import { authService } from '../../src/services/authService';
import { calculateScore } from '../../src/utils/scoring';


const me = authService.generateAnonymousProfile('usr_me');
const sess = (id: string, m: string, mins: number) => ({ id, matchId: m, userId: 'usr_me', startedAt: '', durationMinutes: mins, completed: true });
const task = (id: string, m: string) => ({ id, matchId: m, userId: 'usr_me', description: 't', isCompleted: true, createdAt: '' });

const finalize = (sessions: number, tasks: number) => {
  const match = matchmakingService.createMatch(me, matchmakingService.generateSimulatedOpponent(me));
  const s = Array.from({ length: sessions }, (_, i) => sess(`s${i}`, match.id, 25));
  const t = Array.from({ length: tasks }, (_, i) => task(`t${i}`, match.id));
  return { match, out: matchService.finalizeMatch({ match, userProfile: me, focusSessions: s, matchTasks: t }) };
};
const verdict = (o: { isWinner: boolean; isDraw: boolean }) => (o.isDraw ? 'DRAW' : o.isWinner ? 'WIN' : 'LOSS');
const formulaHolds = (r: any) => r.finalScore === calculateScore(r.totalFocusMinutes, r.tasksCompleted, r.sessionsCompleted);

eq('dev build flag', isDevBuild, true);
eq('default mode is natural', demoOutcome.get(), 'natural');

for (const [mode, expected] of [['win', 'WIN'], ['loss', 'LOSS'], ['draw', 'DRAW']] as const) {
  demoOutcome.set(mode);
  for (const [s, t] of [[1, 1], [3, 0], [0, 2], [2, 5]]) {
    const { match, out } = finalize(s, t);
    eq(`force ${mode} (sessions=${s}, tasks=${t}) -> ${expected}`, verdict(out), expected);
    eq(`  opponent score uses the formula`, formulaHolds(out.opponentResult), true);
    eq(`  user score uses the formula`, out.userResult.finalScore, calculateScore(25 * s, t, s));
    eq(`  result cached for refresh stability`, JSON.parse(mem.get(`focusmatch_opp_result_${match.id}`)!), out.opponentResult);
  }
}
demoOutcome.set('win');
eq('force WIN at 0 points falls back to natural (no negative opponent)', finalize(0, 0).out.opponentResult.finalScore >= 105, true);

demoOutcome.set('natural');
const nat = finalize(1, 1);
eq('natural mode = deterministic natural simulation', nat.out.opponentResult, matchService.getOrCreateOpponentResult(nat.match));

// Corrupted setting
mem.set('focusmatch_dev_demo_outcome', '"banana"');
eq('invalid stored mode -> natural', demoOutcome.get(), 'natural');

finish();
