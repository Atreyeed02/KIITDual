/**
 * KIITDual — DEVELOPMENT-ONLY demo outcome control.
 *
 * Lets a developer rehearse WIN / LOSS / DRAW scorecards without waiting for a
 * natural result. It never changes the scoring formula: it only chooses the
 * simulated opponent's *stats* (focus minutes, tasks, sessions), and the
 * opponent's score is still computed by `calculateScore()`.
 *
 * In production builds (`import.meta.env.DEV === false`) every function here is
 * inert, the stored setting is ignored, and the natural opponent simulation runs.
 */

import { Match, MatchResult } from '../types';
import { calculateScore } from '../utils/scoring';
import { storage } from '../services/storage';
import { oneOf } from '../services/validators';

export type DemoOutcome = 'natural' | 'win' | 'loss' | 'draw';

export const DEMO_OUTCOMES: DemoOutcome[] = ['natural', 'win', 'loss', 'draw'];

const STORAGE_KEY = 'dev_demo_outcome';
const isDemoOutcome = oneOf<DemoOutcome>(DEMO_OUTCOMES);

// Statically replaced by Vite (`false` in production), so the minifier strips the dev paths.
export const isDevBuild: boolean = import.meta.env.DEV;

export const demoOutcome = {
  get(): DemoOutcome {
    if (!isDevBuild) return 'natural';
    return storage.get<DemoOutcome>(STORAGE_KEY, 'natural', isDemoOutcome);
  },

  set(outcome: DemoOutcome): void {
    if (!isDevBuild) return;
    storage.set(STORAGE_KEY, outcome);
  },

  /**
   * Returns an opponent result that produces the requested outcome for this
   * user result, or null to use the natural opponent simulation.
   * WIN cannot be forced at 0 points (no valid opponent can score below 0).
   */
  resolveOpponentResult(match: Match, userResult: MatchResult): MatchResult | null {
    const mode = demoOutcome.get();
    if (mode === 'natural') return null;

    const { totalFocusMinutes: focus, tasksCompleted: tasks, sessionsCompleted: sessions } = userResult;
    let stats: [number, number, number];
    switch (mode) {
      case 'draw':
        // Identical stats => identical score under the same formula.
        stats = [focus, tasks, sessions];
        break;
      case 'loss':
        // One more completed task than the user => exactly +30 pts.
        stats = [focus, tasks + 1, sessions];
        break;
      case 'win':
        if (userResult.finalScore <= 0) return null;
        // Half of each stat (rounded down) is strictly lower for any score > 0.
        stats = [Math.floor(focus / 2), Math.floor(tasks / 2), Math.floor(sessions / 2)];
        break;
    }

    const [oppFocus, oppTasks, oppSessions] = stats;
    const result: MatchResult = {
      id: `res_opp_${match.id}`,
      matchId: match.id,
      userId: match.user2Id,
      totalFocusMinutes: oppFocus,
      tasksCompleted: oppTasks,
      sessionsCompleted: oppSessions,
      finalScore: calculateScore(oppFocus, oppTasks, oppSessions),
    };
    // Same cache as the natural simulation, so refreshes / reopened scorecards stay identical.
    storage.set(`opp_result_${match.id}`, result);
    return result;
  },
};
