/**
 * KIITDual — Runtime shape guards for persisted data.
 * localStorage can hold stale data from older builds or be edited by hand;
 * these guards keep malformed records from crashing the UI.
 */

import {
  User,
  AnonymousProfile,
  Match,
  MatchTask,
  FocusSession,
  MatchResult,
  MatchHistory,
} from '../types';
import type { ActivityEvent } from './activityService';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isDateStr = (v: unknown): v is string => isStr(v) && !Number.isNaN(new Date(v).getTime());

export const isString = (v: unknown): v is string => isStr(v);

export const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

export const isUser = (v: unknown): v is User =>
  isRec(v) &&
  isStr(v.id) &&
  isStr(v.collegeEmailHash) &&
  isNum(v.currentStreak) &&
  isNum(v.totalMatches) &&
  isNum(v.totalWins) &&
  isNum(v.totalLosses) &&
  isNum(v.totalDraws);

export const isAnonProfile = (v: unknown): v is AnonymousProfile =>
  isRec(v) && isStr(v.id) && isStr(v.userId) && isStr(v.anonUsername) && isStr(v.avatarSeed);

export const isMatch = (v: unknown): v is Match =>
  isRec(v) &&
  isStr(v.id) &&
  isStr(v.user1Id) &&
  isStr(v.user2Id) &&
  isAnonProfile(v.user1Profile) &&
  isAnonProfile(v.user2Profile) &&
  isStr(v.status) &&
  isDateStr(v.startTime) &&
  isDateStr(v.endTime);

export const isMatchTask = (v: unknown): v is MatchTask =>
  isRec(v) && isStr(v.id) && isStr(v.matchId) && isStr(v.description) && isBool(v.isCompleted);

export const isFocusSession = (v: unknown): v is FocusSession =>
  isRec(v) &&
  isStr(v.id) &&
  isStr(v.matchId) &&
  isNum(v.durationMinutes) &&
  isBool(v.completed);

export const isMatchResult = (v: unknown): v is MatchResult =>
  isRec(v) &&
  isStr(v.matchId) &&
  isNum(v.totalFocusMinutes) &&
  isNum(v.tasksCompleted) &&
  isNum(v.sessionsCompleted) &&
  isNum(v.finalScore);

export const isMatchHistory = (v: unknown): v is MatchHistory =>
  isRec(v) &&
  isMatch(v.match) &&
  isMatchResult(v.userResult) &&
  isMatchResult(v.opponentResult) &&
  isBool(v.isWinner) &&
  isBool(v.isDraw) &&
  isDateStr(v.completedAt);

export const isActivityEvent = (v: unknown): v is ActivityEvent =>
  isRec(v) && isStr(v.id) && isStr(v.opponentUsername) && isStr(v.message) && isDateStr(v.timestamp);

export const nullable =
  <T,>(guard: (v: unknown) => v is T) =>
  (v: unknown): v is T | null =>
    v === null || guard(v);

export const oneOf =
  <T extends string>(values: readonly T[]) =>
  (v: unknown): v is T =>
    isStr(v) && (values as readonly string[]).includes(v);
