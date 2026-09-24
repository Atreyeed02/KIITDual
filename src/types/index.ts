/**
 * FocusMatch — Strongly Typed Domain Models
 * Corresponding to the FocusMatch SRS & DB Schema Specification
 */

// User status and account representation
export interface User {
  id: string;
  collegeEmailHash: string; // Hash of verification email (e.g. @college.edu)
  isVerified: boolean;
  createdAt: string;
  currentStreak: number;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
}

// Anonymous Identity per user or per match
export interface AnonymousProfile {
  id: string;
  userId: string;
  anonUsername: string; // e.g. "QuietFalcon482", "SilentLynx901"
  avatarSeed: string;    // Seed used for deterministic SVG Identicon rendering
  rotatesPerMatch: boolean;
}

// Status enum for 24-hour Match Lifecycle
export type MatchStatus = 'queued' | 'active' | 'completed' | 'forfeited';

// Match domain entity
export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  user1Profile: AnonymousProfile;
  user2Profile: AnonymousProfile;
  status: MatchStatus;
  startTime: string; // ISO String timestamp
  endTime: string;   // ISO String timestamp (startTime + 24 hours)
  winnerId: string | null;
}

// Self-set goal/task item for a match
export interface MatchTask {
  id: string;
  matchId: string;
  userId: string;
  description: string;
  isCompleted: boolean;
  createdAt: string;
  completedAt?: string;
}

// Pomodoro Focus Session log
export interface FocusSession {
  id: string;
  matchId: string;
  userId: string;
  startedAt: string;
  durationMinutes: number; // e.g. 25 or 50
  completed: boolean;     // True if finished without cancelling early
}

// End-of-match calculated scorecard for a participant
export interface MatchResult {
  id: string;
  matchId: string;
  userId: string;
  totalFocusMinutes: number;
  tasksCompleted: number;
  sessionsCompleted: number;
  finalScore: number; // Formula: (0.5 * focus_mins) + (30 * tasks) + (10 * sessions)
}

// Historical record for user match log
export interface MatchHistory {
  match: Match;
  userResult: MatchResult;
  opponentResult: MatchResult;
  isWinner: boolean;
  isDraw: boolean;
  completedAt: string;
}

// Matchmaking Queue Status
export type MatchmakingState = 'idle' | 'searching' | 'matched';
