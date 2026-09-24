/**
 * KIITDual — Match Lifecycle & Completion Service
 * Handles match expiration checks, score calculation, opponent simulation persistence,
 * win/loss/draw evaluation, and idempotent match finalization.
 */

import { Match, MatchResult, MatchHistory, MatchTask, FocusSession, AnonymousProfile } from '../types';
import { calculateScore } from '../utils/scoring';
import { storage } from './storage';
import { isMatchResult } from './validators';
import { demoOutcome } from '../dev/demoOutcome';

export interface FinalizeMatchParams {
  match: Match;
  userProfile: AnonymousProfile;
  focusSessions: FocusSession[];
  matchTasks: MatchTask[];
}

export interface FinalizedMatchOutcome {
  completedMatch: Match;
  userResult: MatchResult;
  opponentResult: MatchResult;
  isWinner: boolean;
  isDraw: boolean;
  historyItem: MatchHistory;
}

export const matchService = {
  /**
   * Checks if a match has reached its 24-hour expiration time.
   * Based strictly on timestamps (currentTime >= match.endTime).
   */
  checkMatchExpiry(match: Match | null): boolean {
    if (!match || match.status !== 'active') return false;
    const endTimeMs = new Date(match.endTime).getTime();
    return Date.now() >= endTimeMs;
  },

  /**
   * Generates or retrieves a deterministically persisted opponent result for a match.
   * Guarantees that refreshing the page does not re-roll the opponent stats.
   */
  getOrCreateOpponentResult(match: Match): MatchResult {
    const cacheKey = `opp_result_${match.id}`;
    const cached = storage.get<MatchResult | null>(cacheKey, null, (v): v is MatchResult | null =>
      isMatchResult(v)
    );
    if (cached) {
      return cached;
    }

    // Generate realistic opponent stats deterministically from match id or seed
    let seed = 0;
    for (let i = 0; i < match.id.length; i++) {
      seed = (seed << 5) - seed + match.id.charCodeAt(i);
      seed |= 0;
    }
    const absSeed = Math.abs(seed);

    // Realistic range:
    // Focus Minutes: 50m to 150m (in 25m increments)
    const possibleFocus = [50, 75, 100, 125, 150, 175];
    const focusMinutes = possibleFocus[absSeed % possibleFocus.length];

    // Tasks: 2 to 4
    const tasksCompleted = 2 + (absSeed % 3);

    // Sessions: corresponding roughly to focus / 25
    const sessionsCompleted = Math.max(1, Math.floor(focusMinutes / 25));

    const finalScore = calculateScore(focusMinutes, tasksCompleted, sessionsCompleted);

    const opponentResult: MatchResult = {
      id: `res_opp_${match.id}`,
      matchId: match.id,
      userId: match.user2Id,
      totalFocusMinutes: focusMinutes,
      tasksCompleted,
      sessionsCompleted,
      finalScore,
    };

    storage.set(cacheKey, opponentResult);
    return opponentResult;
  },

  /**
   * Calculates the current user's completed match statistics.
   * Only strictly completed sessions and completed tasks are counted.
   */
  calculateUserResult(
    matchId: string,
    userId: string,
    focusSessions: FocusSession[],
    matchTasks: MatchTask[]
  ): MatchResult {
    // Only this match's completed sessions / tasks count, and each id counts once.
    const seen = new Set<string>();
    const completedSessions = focusSessions.filter((s) => {
      if (s.matchId !== matchId || !s.completed || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    const totalFocusMinutes = completedSessions.reduce((acc, curr) => acc + curr.durationMinutes, 0);
    const tasksCompleted = matchTasks.filter((t) => t.matchId === matchId && t.isCompleted).length;
    const sessionsCompleted = completedSessions.length;
    const finalScore = calculateScore(totalFocusMinutes, tasksCompleted, sessionsCompleted);

    return {
      id: `res_user_${matchId}`,
      matchId,
      userId,
      totalFocusMinutes,
      tasksCompleted,
      sessionsCompleted,
      finalScore,
    };
  },

  /**
   * Compares user score vs opponent score to determine match result.
   */
  determineOutcome(
    userScore: number,
    opponentScore: number,
    userId: string,
    opponentId: string
  ): { isWinner: boolean; isDraw: boolean; winnerId: string | null } {
    if (userScore > opponentScore) {
      return {
        isWinner: true,
        isDraw: false,
        winnerId: userId,
      };
    } else if (userScore < opponentScore) {
      return {
        isWinner: false,
        isDraw: false,
        winnerId: opponentId,
      };
    } else {
      return {
        isWinner: false,
        isDraw: true,
        winnerId: null,
      };
    }
  },

  /**
   * Finalizes a completed match. Returns the finalized domain models and history record.
   */
  finalizeMatch({
    match,
    userProfile,
    focusSessions,
    matchTasks,
  }: FinalizeMatchParams): FinalizedMatchOutcome {
    const userResult = this.calculateUserResult(
      match.id,
      userProfile.userId,
      focusSessions,
      matchTasks
    );
    // Dev builds may pin the demo outcome; production always uses the natural simulation.
    const opponentResult =
      demoOutcome.resolveOpponentResult(match, userResult) ?? this.getOrCreateOpponentResult(match);

    const outcome = this.determineOutcome(
      userResult.finalScore,
      opponentResult.finalScore,
      userProfile.userId,
      match.user2Id
    );

    const completedMatch: Match = {
      ...match,
      status: 'completed',
      winnerId: outcome.winnerId,
    };

    const historyItem: MatchHistory = {
      match: completedMatch,
      userResult,
      opponentResult,
      isWinner: outcome.isWinner,
      isDraw: outcome.isDraw,
      completedAt: new Date().toISOString(),
    };

    return {
      completedMatch,
      userResult,
      opponentResult,
      isWinner: outcome.isWinner,
      isDraw: outcome.isDraw,
      historyItem,
    };
  },
};
