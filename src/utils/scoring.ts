/**
 * KIITDual — Weighted Score Engine Utility
 * Scoring Formula v2.0 (tasks removed per product decision):
 *
 * Final Score =
 *   (1.0 × Total Focus Minutes)
 *   + (15 × Sessions Completed)
 *
 * Tasks are kept as personal organisation tools in the workspace
 * but carry zero weight in the competitive formula.
 *
 * Pure, strongly typed, deterministic, and independently testable.
 */

export interface ScoreBreakdown {
  focusMinutes: number;
  sessionsCompleted: number;
  focusPoints: number;     // 1.0 * focusMinutes
  sessionPoints: number;   // 15 * sessionsCompleted
  finalScore: number;      // Total weighted points
}

/**
 * Calculates the final weighted score based on completed focus metrics.
 * Incomplete focus sessions MUST NOT be counted.
 *
 * @param focusMinutes      Total completed focus duration in minutes (>= 0)
 * @param sessionsCompleted Number of completed pomodoro sessions (>= 0)
 * @returns Total final score (integer or 1 decimal place)
 */
export function calculateScore(
  focusMinutes: number,
  sessionsCompleted: number
): number {
  const safeFocus = Math.max(0, focusMinutes);
  const safeSessions = Math.max(0, sessionsCompleted);

  const focusPoints = 1.0 * safeFocus;
  const sessionPoints = 15 * safeSessions;

  const total = focusPoints + sessionPoints;
  return Math.round(total * 10) / 10;
}

/**
 * Provides a detailed breakdown of how the final score was computed.
 */
export function getScoreBreakdown(
  focusMinutes: number,
  sessionsCompleted: number
): ScoreBreakdown {
  const safeFocus = Math.max(0, focusMinutes);
  const safeSessions = Math.max(0, sessionsCompleted);

  const focusPoints = Math.round(safeFocus * 10) / 10;
  const sessionPoints = 15 * safeSessions;
  const finalScore = calculateScore(safeFocus, safeSessions);

  return {
    focusMinutes: safeFocus,
    sessionsCompleted: safeSessions,
    focusPoints,
    sessionPoints,
    finalScore,
  };
}
