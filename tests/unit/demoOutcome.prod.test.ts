/**
 * Production isolation of the dev demo-outcome control.
 * Built with import.meta.env.DEV = false: a stale "Force WIN" left in storage
 * must be ignored and the natural opponent simulation must be used.
 */
import { mem, eq, finish } from './setup';
import { demoOutcome, isDevBuild } from '../../src/dev/demoOutcome';
import { matchService } from '../../src/services/matchService';
import { matchmakingService } from '../../src/services/matchmakingService';
import { authService } from '../../src/services/authService';

mem.set('focusmatch_dev_demo_outcome', '"win"');

const me = authService.generateAnonymousProfile('usr_me');
const match = matchmakingService.createMatch(me, matchmakingService.generateSimulatedOpponent(me));
const tasks = [{ id: 't', matchId: match.id, userId: 'usr_me', description: 'x', isCompleted: true, createdAt: '' }];
const out = matchService.finalizeMatch({ match, userProfile: me, focusSessions: [], matchTasks: tasks });

eq('production build flag is false', isDevBuild, false);
eq('stored dev outcome is ignored (reads as natural)', demoOutcome.get(), 'natural');
eq('natural opponent used (>= 105 pts, user loses with 30)', [out.opponentResult.finalScore >= 105, out.isWinner], [true, false]);
demoOutcome.set('draw');
eq('set() is a no-op in production', mem.get('focusmatch_dev_demo_outcome'), '"win"');

finish();
