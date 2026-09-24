/**
 * KIITDual — Weighted Score Engine Utility
 * Exact SRS Scoring Formula:
 *
 * Final Score =
 *   (0.5 × Total Focus Minutes)
 *   + (30 × Tasks Completed)
 *   + (10 × Sessions Completed)
 *
 * Pure, strongly typed, deterministic, and independently testable.
 */

export interface ScoreBreakdown {
  focusMinutes: number;
  tasksCompleted: number;
  sessionsCompleted: number;
  focusPoints: number;     // 0.5 * focusMinutes
  taskPoints: number;      // 30 * tasksCompleted
  sessionPoints: number;   // 10 * sessionsCompleted
  finalScore: number;      // Total weighted points
}

/**
 * Calculates the final weighted score based on completed focus metrics.
 * Incomplete focus sessions and incomplete tasks MUST NOT be counted.
 *
 * @param focusMinutes Total completed focus duration in minutes (>= 0)
 * @param tasksCompleted Number of verified completed tasks (>= 0)
 * @param sessionsCompleted Number of completed pomodoro sessions (>= 0)
 * @returns Total final score rounded to 1 decimal place or whole number
 */
export function calculateScore(
  focusMinutes: number,
  tasksCompleted: number,
  sessionsCompleted: number
): number {
  const safeFocus = Math.max(0, focusMinutes);
  const safeTasks = Math.max(0, tasksCompleted);
  const safeSessions = Math.max(0, sessionsCompleted);

  const focusPoints = 0.5 * safeFocus;
  const taskPoints = 30 * safeTasks;
  const sessionPoints = 10 * safeSessions;

  const total = focusPoints + taskPoints + sessionPoints;
  // Round to nearest integer if whole, or 1 decimal point if half-minute present
  return Math.round(total * 10) / 10;
}

/**
 * Provides a detailed breakdown of how the final score was computed.
 */
export function getScoreBreakdown(
  focusMinutes: number,
  tasksCompleted: number,
  sessionsCompleted: number
): ScoreBreakdown {
  const safeFocus = Math.max(0, focusMinutes);
  const safeTasks = Math.max(0, tasksCompleted);
  const safeSessions = Math.max(0, sessionsCompleted);

  const focusPoints = Math.round(0.5 * safeFocus * 10) / 10;
  const taskPoints = 30 * safeTasks;
  const sessionPoints = 10 * safeSessions;
  const finalScore = calculateScore(safeFocus, safeTasks, safeSessions);

  return {
    focusMinutes: safeFocus,
    tasksCompleted: safeTasks,
    sessionsCompleted: safeSessions,
    focusPoints,
    taskPoints,
    sessionPoints,
    finalScore,
  };
}
