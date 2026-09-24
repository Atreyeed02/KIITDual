/**
 * FocusMatch — Local Storage Persistence Service Abstraction
 * Wraps localStorage operations with type safety and error handling.
 *
 * - Every read is JSON-parsed safely; malformed values fall back to the default
 *   and the corrupted key is removed so it cannot break later sessions.
 * - Optional runtime guards validate the *shape* of stored data.
 * - User-owned data lives under per-user scoped keys so that one account's
 *   history / active match never leaks into another account on the same browser.
 */

const STORAGE_PREFIX = 'focusmatch_';

export type Guard<T> = (value: unknown) => value is T;

/** Keys whose data belongs to a single signed-in user. */
export type UserScopedKey =
  | 'match_history'
  | 'completed_match_ids'
  | 'current_match'
  | 'match_tasks'
  | 'focus_sessions'
  | 'activity_events'
  | 'pomodoro_state'
  | 'active_scorecard'
  | 'active_view'
  | 'notification_prefs'
  | 'matchmaking_session';

const USER_SCOPED_KEYS: UserScopedKey[] = [
  'match_history',
  'completed_match_ids',
  'current_match',
  'match_tasks',
  'focus_sessions',
  'activity_events',
  'pomodoro_state',
  'active_scorecard',
  'active_view',
  'notification_prefs',
  'matchmaking_session',
];

const scopedKey = (userId: string, key: UserScopedKey) => `u_${userId}_${key}`;

export const storage = {
  get<T>(key: string, defaultValue: T, guard?: Guard<T>): T {
    try {
      const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (item === null) return defaultValue;
      const parsed: unknown = JSON.parse(item);
      if (guard && !guard(parsed)) {
        console.warn(`[storage] Discarding malformed value for key "${key}"`);
        storage.remove(key);
        return defaultValue;
      }
      return parsed as T;
    } catch (error) {
      console.warn(`[storage] Error reading key "${key}":`, error);
      storage.remove(key);
      return defaultValue;
    }
  },

  /** Reads an array, keeping only the items that pass the guard. */
  getList<T>(key: string, itemGuard: Guard<T>): T[] {
    const raw = storage.get<unknown>(key, []);
    if (!Array.isArray(raw)) {
      storage.remove(key);
      return [];
    }
    return raw.filter(itemGuard);
  },

  has(key: string): boolean {
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}${key}`) !== null;
    } catch {
      return false;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`[storage] Error setting key "${key}":`, error);
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (error) {
      console.error(`[storage] Error removing key "${key}":`, error);
    }
  },

  clearAll(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error('[storage] Error clearing storage:', error);
    }
  },

  /** Per-user scoped accessors. */
  user: {
    key: scopedKey,
    get<T>(userId: string, key: UserScopedKey, defaultValue: T, guard?: Guard<T>): T {
      return storage.get(scopedKey(userId, key), defaultValue, guard);
    },
    getList<T>(userId: string, key: UserScopedKey, itemGuard: Guard<T>): T[] {
      return storage.getList(scopedKey(userId, key), itemGuard);
    },
    set<T>(userId: string, key: UserScopedKey, value: T): void {
      storage.set(scopedKey(userId, key), value);
    },
  },

  /**
   * One-time migration: earlier builds stored user data under unscoped keys
   * (e.g. `focusmatch_match_history`). Move them under the given user's scope.
   */
  migrateLegacyKeys(userId: string): void {
    USER_SCOPED_KEYS.forEach((key) => {
      if (!storage.has(key)) return;
      const target = scopedKey(userId, key);
      if (!storage.has(target)) {
        try {
          const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
          if (raw !== null) localStorage.setItem(`${STORAGE_PREFIX}${target}`, raw);
        } catch (error) {
          console.warn(`[storage] Failed to migrate key "${key}":`, error);
        }
      }
      storage.remove(key);
    });
  },
};
