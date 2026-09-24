/**
 * KIITDual — Frontend Simulated Auth Service
 * Manages frontend authentication operations, OTP validation, and identity generation.
 * Isolated and backend-ready (can be swapped for REST API client in the future).
 */

import { User, AnonymousProfile } from '../types';
import { storage } from './storage';
import { validateCollegeEmail } from '../data/collegeConfig';
import { INITIAL_ANON_USERNAMES } from '../data/mockData';
import { isUser, isAnonProfile } from './validators';
import { createId } from '../utils/id';

const DEFAULT_DEV_OTP = '123456';

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * One-way hash of the normalized college email (SIMULATION ONLY — the real
 * backend must hash server-side). SHA-256 via Web Crypto; `crypto.subtle` is
 * unavailable on insecure origins (e.g. http://<LAN-IP>), so fall back to a
 * non-cryptographic FNV-1a hash there — still not reversible like base64.
 */
async function hashEmail(normalizedEmail: string): Promise<string> {
  const input = `kiitdual:${normalizedEmail}`;
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(input));
    return toHex(new Uint8Array(digest));
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return `fnv_${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/** Key format used by earlier builds: a reversible base64 prefix (not a hash). */
function legacyEmailKey(normalizedEmail: string): string | null {
  try {
    return btoa(normalizedEmail).substring(0, 16);
  } catch {
    return null;
  }
}

export interface AuthState {
  user: User | null;
  anonProfile: AnonymousProfile | null;
  pendingEmail: string | null;
  authStep: 'unauthenticated' | 'awaiting_otp' | 'identity_setup' | 'authenticated';
}

export const authService = {
  /**
   * Request OTP for a college email
   */
  async requestOtp(email: string): Promise<{ success: boolean; error?: string }> {
    // Simulate short network latency
    await new Promise((resolve) => setTimeout(resolve, 600));

    const validation = validateCollegeEmail(email);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const trimmedEmail = email.trim().toLowerCase();
    
    // Store pending OTP state in storage for session resilience
    storage.set('pending_otp_email', trimmedEmail);
    storage.set('simulated_otp', DEFAULT_DEV_OTP);

    return { success: true };
  },

  /**
   * Verify the 6-digit OTP
   */
  async verifyOtp(
    email: string,
    otp: string
  ): Promise<{ success: boolean; error?: string; user?: User; profile?: AnonymousProfile }> {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const pendingEmail = storage.get<string | null>('pending_otp_email', null);
    const expectedOtp = storage.get<string>('simulated_otp', DEFAULT_DEV_OTP);

    if (email.trim().toLowerCase() !== pendingEmail) {
      return { success: false, error: 'Email mismatch. Please request a new OTP.' };
    }

    if (otp !== expectedOtp) {
      return { success: false, error: 'Invalid 6-digit verification code. (Hint: Use 123456)' };
    }

    // Check if user already exists in storage for this email
    const normalizedEmail = email.trim().toLowerCase();
    const emailHash = await hashEmail(normalizedEmail);
    const readUser = (key: string) => storage.get<User | null>(`user_${key}`, null, (v): v is User | null => isUser(v));
    const readProfile = (key: string) =>
      storage.get<AnonymousProfile | null>(`profile_${key}`, null, (v): v is AnonymousProfile | null =>
        isAnonProfile(v)
      );
    let user = readUser(emailHash);
    let profile = readProfile(emailHash);

    // Migrate accounts created by earlier builds (reversible base64 key) to the hashed key.
    // The user id is unchanged, so all per-user data (history, active match) is preserved.
    const legacyKey = legacyEmailKey(normalizedEmail);
    if (!user && legacyKey) {
      const legacyUser = readUser(legacyKey);
      if (legacyUser) {
        user = { ...legacyUser, collegeEmailHash: emailHash };
        profile = profile ?? readProfile(legacyKey);
        storage.set(`user_${emailHash}`, user);
        if (profile) storage.set(`profile_${emailHash}`, profile);
        storage.remove(`user_${legacyKey}`);
        storage.remove(`profile_${legacyKey}`);
      }
    }

    if (!user) {
      user = {
        id: createId('usr'),
        collegeEmailHash: emailHash,
        isVerified: true,
        createdAt: new Date().toISOString(),
        currentStreak: 0, // consecutive completed matches
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
      };
      storage.set(`user_${emailHash}`, user);
    }

    if (!profile) {
      profile = this.generateAnonymousProfile(user.id);
      storage.set(`profile_${emailHash}`, profile);
    }

    // Clear pending OTP state
    storage.remove('pending_otp_email');
    storage.remove('simulated_otp');

    // Save active user & profile
    storage.set('user', user);
    storage.set('anon_profile', profile);

    return { success: true, user, profile };
  },

  /**
   * Generate a deterministic / random anonymous profile
   */
  generateAnonymousProfile(userId: string, seedPrefix?: string): AnonymousProfile {
    const randomIndex = Math.floor(Math.random() * INITIAL_ANON_USERNAMES.length);
    const baseUsername = INITIAL_ANON_USERNAMES[randomIndex];
    const randomNum = Math.floor(100 + Math.random() * 899);
    
    const anonUsername = seedPrefix || `${baseUsername.replace(/\d+$/, '')}${randomNum}`;
    const avatarSeed = `${anonUsername}_${Date.now()}`;

    return {
      id: createId('prof'),
      userId,
      anonUsername,
      avatarSeed,
      rotatesPerMatch: false,
    };
  },

  /**
   * Persists the account record (stats / streak) so it survives logout & re-login.
   */
  saveUser(user: User): void {
    storage.set(`user_${user.collegeEmailHash}`, user);
  },

  /**
   * Persists the anonymous identity for this account.
   */
  saveProfile(user: User, profile: AnonymousProfile): void {
    storage.set(`profile_${user.collegeEmailHash}`, profile);
  },

  /**
   * Logout current user
   */
  logout(): void {
    storage.remove('user');
    storage.remove('anon_profile');
    storage.remove('auth_step');
    storage.remove('pending_otp_email');
    storage.remove('simulated_otp');
  },
};
