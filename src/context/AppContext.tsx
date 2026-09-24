import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  AnonymousProfile,
  Match,
  MatchTask,
  FocusSession,
  MatchHistory,
  MatchmakingState,
} from '../types';
import { storage, UserScopedKey } from '../services/storage';
import { authService, AuthState } from '../services/authService';
import { matchmakingService } from '../services/matchmakingService';
import { activityService, ActivityEvent, MAX_ACTIVITY_EVENTS } from '../services/activityService';
import { matchService } from '../services/matchService';
import {
  isUser,
  isAnonProfile,
  isMatch,
  isMatchTask,
  isFocusSession,
  isMatchHistory,
  isActivityEvent,
  isString,
  isStringArray,
  nullable,
  oneOf,
} from '../services/validators';
import {
  PomodoroMode,
  PomodoroPersistedState,
  createPomodoroState,
  isPomodoroState,
  startPomodoro as startPomodoroRun,
  pausePomodoro as pausePomodoroRun,
  resetPomodoro as resetPomodoroRun,
  settlePomodoro,
} from '../utils/pomodoro';
import { normalizeHistory } from '../utils/stats';
import { createId } from '../utils/id';

export type { PomodoroPersistedState } from '../utils/pomodoro';
export type AuthStep = AuthState['authStep'];
export type ActiveView = 'dashboard' | 'active_match_workspace' | 'scorecard' | 'history' | 'settings';

export interface NotificationPrefs {
  matchFound: boolean;
  matchEndingSoon: boolean;
  matchResultsReady: boolean;
}

/** Simulated queue wait before an opponent is "found". */
const SEARCH_DURATION_MS = 3000;

type MatchmakingSession =
  | { status: 'searching'; startedAt: number }
  | { status: 'found'; startedAt: number; opponent: AnonymousProfile };

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  matchFound: true,
  matchEndingSoon: true,
  matchResultsReady: true,
};

const isAuthStep = oneOf<AuthStep>(['unauthenticated', 'awaiting_otp', 'identity_setup', 'authenticated']);
const isActiveView = oneOf<ActiveView>([
  'dashboard',
  'active_match_workspace',
  'scorecard',
  'history',
  'settings',
]);

const isNotificationPrefs = (v: unknown): v is NotificationPrefs => {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.matchFound === 'boolean' &&
    typeof p.matchEndingSoon === 'boolean' &&
    typeof p.matchResultsReady === 'boolean'
  );
};

const isMatchmakingSession = (v: unknown): v is MatchmakingSession => {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s.startedAt !== 'number') return false;
  if (s.status === 'searching') return true;
  return s.status === 'found' && isAnonProfile(s.opponent);
};

const addUniqueSession = (sessions: FocusSession[], session: FocusSession) =>
  sessions.some((s) => s.id === session.id) ? sessions : [...sessions, session];

const dedupeById = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
};

// ---------------------------------------------------------------------------
// User-scoped data: everything that belongs to one signed-in account.
// ---------------------------------------------------------------------------

interface UserData {
  matchHistory: MatchHistory[];
  /** Ids of matches that have been closed (completed or forfeited). Never re-opened, never re-counted. */
  completedMatchIds: string[];
  currentMatch: Match | null;
  matchTasks: MatchTask[];
  focusSessions: FocusSession[];
  activityEvents: ActivityEvent[];
  pomodoroState: PomodoroPersistedState;
  activeScorecard: MatchHistory | null;
  activeView: ActiveView;
  notificationPrefs: NotificationPrefs;
  matchmakingSession: MatchmakingSession | null;
}

const emptyUserData = (): UserData => ({
  matchHistory: [],
  completedMatchIds: [],
  currentMatch: null,
  matchTasks: [],
  focusSessions: [],
  activityEvents: [],
  pomodoroState: createPomodoroState(),
  activeScorecard: null,
  activeView: 'dashboard',
  notificationPrefs: DEFAULT_NOTIFICATION_PREFS,
  matchmakingSession: null,
});

function loadUserData(userId: string): UserData {
  const u = storage.user;
  const matchHistory = normalizeHistory(u.getList(userId, 'match_history', isMatchHistory));
  const completedMatchIds = Array.from(
    new Set([
      ...u.get<string[]>(userId, 'completed_match_ids', [], isStringArray),
      ...matchHistory.map((h) => h.match.id),
    ])
  );

  let currentMatch = u.get<Match | null>(userId, 'current_match', null, nullable(isMatch));
  // A closed match can never become active again.
  if (currentMatch && (currentMatch.status !== 'active' || completedMatchIds.includes(currentMatch.id))) {
    currentMatch = null;
  }
  const matchId = currentMatch?.id;

  const matchTasks = matchId
    ? dedupeById(u.getList(userId, 'match_tasks', isMatchTask).filter((t) => t.matchId === matchId))
    : [];
  const focusSessions = matchId
    ? dedupeById(u.getList(userId, 'focus_sessions', isFocusSession).filter((s) => s.matchId === matchId))
    : [];

  let activityEvents = currentMatch
    ? u.getList(userId, 'activity_events', isActivityEvent).slice(0, MAX_ACTIVITY_EVENTS)
    : [];
  if (currentMatch && activityEvents.length === 0) {
    activityEvents = activityService.generateInitialActivities(currentMatch.user2Profile.anonUsername);
  }

  const pomodoroState = currentMatch
    ? u.get<PomodoroPersistedState>(userId, 'pomodoro_state', createPomodoroState(), isPomodoroState)
    : createPomodoroState();

  // Prefer the canonical history record so a reopened scorecard can never differ from history.
  const savedScorecard = u.get<MatchHistory | null>(userId, 'active_scorecard', null, nullable(isMatchHistory));
  const activeScorecard = savedScorecard
    ? matchHistory.find((h) => h.match.id === savedScorecard.match.id) ?? savedScorecard
    : null;

  const savedView = u.get<ActiveView>(userId, 'active_view', 'dashboard', isActiveView);
  let activeView: ActiveView = savedView;
  if (savedView === 'active_match_workspace' && !currentMatch) activeView = 'dashboard';
  if (savedView === 'scorecard' && !activeScorecard) activeView = 'dashboard';

  return {
    matchHistory,
    completedMatchIds,
    currentMatch,
    matchTasks,
    focusSessions,
    activityEvents,
    pomodoroState,
    activeScorecard,
    activeView,
    notificationPrefs: u.get(userId, 'notification_prefs', DEFAULT_NOTIFICATION_PREFS, isNotificationPrefs),
    matchmakingSession: currentMatch
      ? null
      : u.get<MatchmakingSession | null>(userId, 'matchmaking_session', null, nullable(isMatchmakingSession)),
  };
}

interface BootState {
  user: User | null;
  anonProfile: AnonymousProfile | null;
  authStep: AuthStep;
  pendingEmail: string;
  data: UserData;
}

function bootstrap(): BootState {
  let user = storage.get<User | null>('user', null, nullable(isUser));
  let anonProfile = storage.get<AnonymousProfile | null>('anon_profile', null, nullable(isAnonProfile));
  const pendingEmail = storage.get<string>('pending_email', '', isString);
  let authStep: AuthStep =
    storage.get<AuthStep | null>('auth_step', null, nullable(isAuthStep)) ??
    (user && anonProfile ? 'authenticated' : 'unauthenticated');

  // Repair inconsistent auth state instead of rendering a blank / broken screen.
  if ((authStep === 'identity_setup' || authStep === 'authenticated') && (!user || !anonProfile)) {
    authStep = 'unauthenticated';
  }
  if (authStep === 'awaiting_otp' && !pendingEmail) {
    authStep = 'unauthenticated';
  }
  if (authStep === 'unauthenticated' || authStep === 'awaiting_otp') {
    user = null;
    anonProfile = null;
  }

  let data = emptyUserData();
  if (user) {
    storage.migrateLegacyKeys(user.id);
    data = loadUserData(user.id);
  }

  return { user, anonProfile, authStep, pendingEmail, data };
}

/** Writes a user-scoped value whenever it (or the signed-in user) changes. */
function useUserPersist<T>(userId: string | null, key: UserScopedKey, value: T) {
  useEffect(() => {
    if (userId) storage.user.set(userId, key, value);
  }, [userId, key, value]);
}

interface AppContextType {
  // Authentication & Onboarding State
  user: User | null;
  anonProfile: AnonymousProfile | null;
  isAuthenticated: boolean;
  authStep: AuthStep;
  pendingEmail: string;

  // Navigation & View State
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Match & Queue State
  currentMatch: Match | null;
  matchmakingState: MatchmakingState;
  foundOpponent: AnonymousProfile | null;
  searchStartedAt: number | null;
  isMatchmakingModalOpen: boolean;

  // Active Workspace Data
  matchTasks: MatchTask[];
  focusSessions: FocusSession[];
  activityEvents: ActivityEvent[];
  pomodoroState: PomodoroPersistedState;

  // Scorecard & Finalization State
  activeScorecard: MatchHistory | null;

  // History & Metrics
  matchHistory: MatchHistory[];
  currentStreak: number;

  // Settings
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: (prefs: NotificationPrefs) => void;

  // Auth Actions
  requestOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (otp: string) => Promise<{ success: boolean; error?: string }>;
  confirmIdentity: () => void;
  regenerateIdentity: () => void;
  setPendingEmail: (email: string) => void;
  setAuthStep: (step: AuthStep) => void;
  logout: () => void;
  deleteAccount: () => void;

  // Matchmaking Actions
  openMatchmakingModal: () => void;
  closeMatchmakingModal: () => void;
  startSearch: () => void;
  cancelSearch: () => void;
  confirmMatch: () => void;
  forfeitCurrentMatch: () => void;

  // Workspace Actions
  addTask: (description: string) => boolean;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  sendReaction: (emoji: string, label: string) => void;
  simulateOpponentActivity: () => void;

  // Pomodoro Actions (timestamp based; completion is detected by the match tick)
  startPomodoro: () => void;
  pausePomodoro: () => void;
  resetPomodoro: () => void;
  selectPomodoroMode: (mode: PomodoroMode) => void;
  togglePomodoroDemoMode: () => void;

  // Lifecycle & Scorecard Actions
  finalizeCurrentMatch: () => void;
  fastForwardMatchExpiry: () => void;
  viewScorecard: (historyItem: MatchHistory) => void;
  returnToDashboard: () => void;
  findAnotherPartnerFromScorecard: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [boot] = useState(bootstrap);

  const [user, setUser] = useState<User | null>(boot.user);
  const [anonProfile, setAnonProfile] = useState<AnonymousProfile | null>(boot.anonProfile);
  const [authStep, setAuthStep] = useState<AuthStep>(boot.authStep);
  const [pendingEmail, setPendingEmail] = useState<string>(boot.pendingEmail);

  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>(boot.data.matchHistory);
  const [completedMatchIds, setCompletedMatchIds] = useState<string[]>(boot.data.completedMatchIds);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(boot.data.currentMatch);
  const [matchTasks, setMatchTasks] = useState<MatchTask[]>(boot.data.matchTasks);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>(boot.data.focusSessions);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(boot.data.activityEvents);
  const [pomodoroState, setPomodoroState] = useState<PomodoroPersistedState>(boot.data.pomodoroState);
  const [activeScorecard, setActiveScorecard] = useState<MatchHistory | null>(boot.data.activeScorecard);
  const [activeView, setActiveView] = useState<ActiveView>(boot.data.activeView);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(boot.data.notificationPrefs);
  const [matchmakingSession, setMatchmakingSession] = useState<MatchmakingSession | null>(
    boot.data.matchmakingSession
  );
  const [isMatchmakingModalOpen, setIsMatchmakingModalOpen] = useState<boolean>(
    !!boot.data.matchmakingSession && boot.authStep === 'authenticated'
  );

  // Latest-state mirror for timers and guards (avoids stale closures and lets
  // actions reject a second call that arrives before React re-renders).
  const stateRef = useRef({ currentMatch, matchTasks, focusSessions, pomodoroState, matchHistory, completedMatchIds, matchmakingSession, anonProfile });
  stateRef.current = { currentMatch, matchTasks, focusSessions, pomodoroState, matchHistory, completedMatchIds, matchmakingSession, anonProfile };
  const closedMatchRef = useRef<string | null>(null);

  const applyUserData = (data: UserData) => {
    setMatchHistory(data.matchHistory);
    setCompletedMatchIds(data.completedMatchIds);
    setCurrentMatch(data.currentMatch);
    setMatchTasks(data.matchTasks);
    setFocusSessions(data.focusSessions);
    setActivityEvents(data.activityEvents);
    setPomodoroState(data.pomodoroState);
    setActiveScorecard(data.activeScorecard);
    setActiveView(data.activeView);
    setNotificationPrefs(data.notificationPrefs);
    setMatchmakingSession(data.matchmakingSession);
    setIsMatchmakingModalOpen(!!data.matchmakingSession);
  };

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  const userId = user?.id ?? null;

  useEffect(() => {
    storage.set('user', user);
    if (user) authService.saveUser(user);
  }, [user]);
  useEffect(() => {
    storage.set('anon_profile', anonProfile);
    if (user && anonProfile) authService.saveProfile(user, anonProfile);
    // Only re-save when the identity itself changes (not on every stats update).
  }, [anonProfile]);
  useEffect(() => { storage.set('auth_step', authStep); }, [authStep]);
  useEffect(() => { storage.set('pending_email', pendingEmail); }, [pendingEmail]);

  useUserPersist(userId, 'match_history', matchHistory);
  useUserPersist(userId, 'completed_match_ids', completedMatchIds);
  useUserPersist(userId, 'current_match', currentMatch);
  useUserPersist(userId, 'match_tasks', matchTasks);
  useUserPersist(userId, 'focus_sessions', focusSessions);
  useUserPersist(userId, 'activity_events', activityEvents);
  useUserPersist(userId, 'pomodoro_state', pomodoroState);
  useUserPersist(userId, 'active_scorecard', activeScorecard);
  useUserPersist(userId, 'active_view', activeView);
  useUserPersist(userId, 'notification_prefs', notificationPrefs);
  useUserPersist(userId, 'matchmaking_session', matchmakingSession);

  // ---------------------------------------------------------------------------
  // Auth Actions
  // ---------------------------------------------------------------------------
  const requestOtp = async (email: string) => {
    const res = await authService.requestOtp(email);
    if (res.success) {
      setPendingEmail(email.trim().toLowerCase());
      setAuthStep('awaiting_otp');
    }
    return res;
  };

  const verifyOtp = async (otp: string) => {
    const res = await authService.verifyOtp(pendingEmail, otp);
    if (res.success && res.user && res.profile) {
      setUser(res.user);
      setAnonProfile(res.profile);
      setAuthStep('identity_setup');
      // The plaintext email is only needed while the code is pending (privacy rule).
      setPendingEmail('');
      applyUserData(loadUserData(res.user.id));
      setIsMatchmakingModalOpen(false);
    }
    return res;
  };

  const confirmIdentity = () => {
    setAuthStep('authenticated');
    setActiveView('dashboard');
  };

  const regenerateIdentity = () => {
    if (!user) return;
    setAnonProfile(authService.generateAnonymousProfile(user.id));
  };

  const resetSession = () => {
    setUser(null);
    setAnonProfile(null);
    setPendingEmail('');
    setAuthStep('unauthenticated');
    applyUserData(emptyUserData());
  };

  const logout = () => {
    // Keep this user's history / active match on disk for their next sign-in,
    // but never resume a half-finished queue search after re-login.
    if (user) storage.user.set(user.id, 'matchmaking_session', null);
    authService.logout();
    resetSession();
  };

  const deleteAccount = () => {
    storage.clearAll();
    resetSession();
  };

  // ---------------------------------------------------------------------------
  // Matchmaking (simulated queue; survives refresh; single cancellable timer)
  // ---------------------------------------------------------------------------
  const matchmakingState: MatchmakingState =
    matchmakingSession?.status === 'searching'
      ? 'searching'
      : matchmakingSession?.status === 'found'
      ? 'matched'
      : 'idle';
  const foundOpponent = matchmakingSession?.status === 'found' ? matchmakingSession.opponent : null;

  useEffect(() => {
    if (matchmakingSession?.status !== 'searching' || !anonProfile) return;
    const { startedAt } = matchmakingSession;
    const delay = Math.max(0, startedAt + SEARCH_DURATION_MS - Date.now());
    const timer = setTimeout(() => {
      const opponent = matchmakingService.generateSimulatedOpponent(anonProfile);
      setMatchmakingSession((prev) =>
        prev?.status === 'searching' && prev.startedAt === startedAt
          ? { status: 'found', startedAt, opponent }
          : prev
      );
    }, delay);
    return () => clearTimeout(timer);
  }, [matchmakingSession, anonProfile]);

  const openMatchmakingModal = () => {
    // Only one active match at a time: send the user back to it instead.
    if (stateRef.current.currentMatch) {
      setActiveView('active_match_workspace');
      return;
    }
    setIsMatchmakingModalOpen(true);
  };

  const closeMatchmakingModal = () => {
    if (stateRef.current.matchmakingSession?.status === 'searching') return;
    setIsMatchmakingModalOpen(false);
    setMatchmakingSession(null);
  };

  const startSearch = () => {
    const s = stateRef.current;
    if (s.currentMatch || !s.anonProfile || s.matchmakingSession?.status === 'searching') return;
    const session: MatchmakingSession = { status: 'searching', startedAt: Date.now() };
    stateRef.current = { ...s, matchmakingSession: session };
    setMatchmakingSession(session);
  };

  const cancelSearch = () => {
    setMatchmakingSession(null);
  };

  const confirmMatch = () => {
    const s = stateRef.current;
    if (s.currentMatch || !s.anonProfile || s.matchmakingSession?.status !== 'found') return;
    const opponent = s.matchmakingSession.opponent;
    const newMatch = matchmakingService.createMatch(s.anonProfile, opponent);
    // Guard against a double click landing before the next render.
    stateRef.current = { ...s, currentMatch: newMatch, matchmakingSession: null };

    const now = new Date().toISOString();
    setCurrentMatch(newMatch);
    setMatchmakingSession(null);
    setIsMatchmakingModalOpen(false);
    setActiveScorecard(null);
    setActiveView('active_match_workspace');
    setActivityEvents(activityService.generateInitialActivities(opponent.anonUsername));
    setMatchTasks([
      {
        id: createId('task'),
        matchId: newMatch.id,
        userId: s.anonProfile.userId,
        description: 'Review lecture notes & key formulas',
        isCompleted: false,
        createdAt: now,
      },
      {
        id: createId('task'),
        matchId: newMatch.id,
        userId: s.anonProfile.userId,
        description: 'Complete 1 full Pomodoro focus session',
        isCompleted: false,
        createdAt: now,
      },
    ]);
    setFocusSessions([]);
    setPomodoroState(createPomodoroState());
  };

  const clearActiveMatchState = () => {
    setCurrentMatch(null);
    setMatchTasks([]);
    setFocusSessions([]);
    setActivityEvents([]);
    setPomodoroState(createPomodoroState());
    setMatchmakingSession(null);
  };

  // ---------------------------------------------------------------------------
  // Match lifecycle: idempotent finalization
  // ---------------------------------------------------------------------------
  const finalizeCurrentMatch = useCallback(() => {
    const s = stateRef.current;
    const match = s.currentMatch;
    if (!match || closedMatchRef.current === match.id) return;
    closedMatchRef.current = match.id;
    stateRef.current = { ...s, currentMatch: null };

    // Fast-forward ends the match "now"; natural expiry ends it at endTime.
    const endMs = Math.min(Date.now(), Date.parse(match.endTime));
    const endedMatch: Match = { ...match, endTime: new Date(endMs).toISOString() };

    // A pomodoro that finished before the match ended still counts (e.g. browser was closed).
    const settled = settlePomodoro(s.pomodoroState, endMs, match.id, match.user1Id);
    const sessions = settled.session ? addUniqueSession(s.focusSessions, settled.session) : s.focusSessions;

    const existing = s.matchHistory.find((h) => h.match.id === match.id);
    const alreadyCounted = !!existing || s.completedMatchIds.includes(match.id);

    let historyItem: MatchHistory;
    if (existing) {
      historyItem = existing;
    } else {
      const outcome = matchService.finalizeMatch({
        match: endedMatch,
        userProfile: match.user1Profile,
        focusSessions: sessions,
        matchTasks: s.matchTasks,
      });
      historyItem = { ...outcome.historyItem, completedAt: endedMatch.endTime };
      setMatchHistory((prev) => normalizeHistory([historyItem, ...prev]));
    }

    if (!alreadyCounted) {
      setCompletedMatchIds((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]));
      setUser((prev) =>
        prev
          ? {
              ...prev,
              totalMatches: prev.totalMatches + 1,
              totalWins: prev.totalWins + (historyItem.isWinner ? 1 : 0),
              totalLosses: prev.totalLosses + (!historyItem.isWinner && !historyItem.isDraw ? 1 : 0),
              totalDraws: prev.totalDraws + (historyItem.isDraw ? 1 : 0),
              // Streak = consecutive completed matches (win, loss or draw).
              currentStreak: prev.currentStreak + 1,
            }
          : prev
      );
    }

    clearActiveMatchState();
    setActiveScorecard(historyItem);
    setActiveView('scorecard');
  }, []);

  // One app-level tick while a match is active: detects 24h expiry (also on
  // reopen after the browser was closed) and pomodoro completion, even when
  // the workspace is not on screen. Stops as soon as the match is closed.
  const currentMatchId = currentMatch?.id ?? null;
  useEffect(() => {
    if (!currentMatchId) return;
    const tick = () => {
      const s = stateRef.current;
      const match = s.currentMatch;
      if (!match || match.id !== currentMatchId) return;
      if (matchService.checkMatchExpiry(match)) {
        finalizeCurrentMatch();
        return;
      }
      const settled = settlePomodoro(s.pomodoroState, Date.now(), match.id, match.user1Id);
      if (settled.finished) {
        stateRef.current = { ...s, pomodoroState: settled.next };
        setPomodoroState(settled.next);
        const session = settled.session;
        if (session) setFocusSessions((prev) => addUniqueSession(prev, session));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentMatchId, finalizeCurrentMatch]);

  const fastForwardMatchExpiry = () => finalizeCurrentMatch();

  const forfeitCurrentMatch = () => {
    const match = stateRef.current.currentMatch;
    if (!match || closedMatchRef.current === match.id) return;
    closedMatchRef.current = match.id;
    stateRef.current = { ...stateRef.current, currentMatch: null };
    setCompletedMatchIds((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]));
    // Leaving early breaks the consecutive-completed-matches streak.
    setUser((prev) => (prev ? { ...prev, currentStreak: 0 } : prev));
    clearActiveMatchState();
    setActiveView('dashboard');
  };

  const viewScorecard = (historyItem: MatchHistory) => {
    setActiveScorecard(matchHistory.find((h) => h.match.id === historyItem.match.id) ?? historyItem);
    setActiveView('scorecard');
  };

  const returnToDashboard = () => {
    setActiveScorecard(null);
    setActiveView('dashboard');
  };

  const findAnotherPartnerFromScorecard = () => {
    setActiveScorecard(null);
    if (stateRef.current.currentMatch) {
      setActiveView('active_match_workspace');
      return;
    }
    setActiveView('dashboard');
    setIsMatchmakingModalOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Workspace Actions
  // ---------------------------------------------------------------------------
  const addTask = (description: string) => {
    const text = description.trim().slice(0, 200);
    const match = stateRef.current.currentMatch;
    if (!text || !match) return false;
    const newTask: MatchTask = {
      id: createId('task'),
      matchId: match.id,
      userId: match.user1Id,
      description: text,
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    setMatchTasks((prev) => [newTask, ...prev]);
    return true;
  };

  const toggleTask = (taskId: string) => {
    const now = new Date().toISOString();
    setMatchTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, isCompleted: !t.isCompleted, completedAt: t.isCompleted ? undefined : now }
          : t
      )
    );
  };

  const deleteTask = (taskId: string) => {
    setMatchTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const appendActivity = (event: ActivityEvent) => {
    setActivityEvents((prev) => [event, ...prev].slice(0, MAX_ACTIVITY_EVENTS));
  };

  const sendReaction = (emoji: string, label: string) => {
    if (!stateRef.current.currentMatch) return;
    appendActivity({
      id: createId('react'),
      opponentUsername: 'You',
      message: `sent reaction: ${emoji} ${label}`,
      timestamp: new Date().toISOString(),
      type: 'reaction',
    });
  };

  const simulateOpponentActivity = () => {
    const match = stateRef.current.currentMatch;
    if (!match) return;
    appendActivity(activityService.generateRandomEvent(match.user2Profile.anonUsername));
  };

  const startPomodoro = () => {
    if (!stateRef.current.currentMatch) return;
    const now = Date.now();
    setPomodoroState((prev) => startPomodoroRun(prev, now));
  };

  const pausePomodoro = () => {
    const now = Date.now();
    setPomodoroState((prev) => pausePomodoroRun(prev, now));
  };

  const resetPomodoro = () => {
    setPomodoroState((prev) => resetPomodoroRun(prev));
  };

  const selectPomodoroMode = (mode: PomodoroMode) => {
    setPomodoroState((prev) => (prev.isRunning ? prev : createPomodoroState(mode, !!prev.demoMode)));
  };

  const togglePomodoroDemoMode = () => {
    setPomodoroState((prev) => (prev.isRunning ? prev : createPomodoroState(prev.mode, !prev.demoMode)));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        anonProfile,
        isAuthenticated: authStep === 'authenticated' && !!user,
        authStep,
        pendingEmail,
        activeView,
        setActiveView,
        currentMatch,
        matchmakingState,
        foundOpponent,
        searchStartedAt: matchmakingSession?.status === 'searching' ? matchmakingSession.startedAt : null,
        isMatchmakingModalOpen,
        matchTasks,
        focusSessions,
        activityEvents,
        pomodoroState,
        activeScorecard,
        matchHistory,
        currentStreak: user?.currentStreak ?? 0,
        notificationPrefs,
        setNotificationPrefs,
        requestOtp,
        verifyOtp,
        confirmIdentity,
        regenerateIdentity,
        setPendingEmail,
        setAuthStep,
        logout,
        deleteAccount,
        openMatchmakingModal,
        closeMatchmakingModal,
        startSearch,
        cancelSearch,
        confirmMatch,
        forfeitCurrentMatch,
        finalizeCurrentMatch,
        fastForwardMatchExpiry,
        viewScorecard,
        returnToDashboard,
        findAnotherPartnerFromScorecard,
        addTask,
        toggleTask,
        deleteTask,
        sendReaction,
        simulateOpponentActivity,
        startPomodoro,
        pausePomodoro,
        resetPomodoro,
        selectPomodoroMode,
        togglePomodoroDemoMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
