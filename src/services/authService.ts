/**
 * KIITDual — Auth Service (Supabase-backed)
 * Handles email OTP request/verify via Supabase Auth.
 * The OTP is a real 6-digit code sent to the user's inbox.
 */

import { User, AnonymousProfile } from '../types';
import { storage } from './storage';
import { validateCollegeEmail } from '../data/collegeConfig';
import { INITIAL_ANON_USERNAMES } from '../data/mockData';
import { isUser, isAnonProfile } from './validators';
import { createId } from '../utils/id';
import { supabase } from '../lib/supabase';

export interface AuthState {
  user: User | null;
  anonProfile: AnonymousProfile | null;
  pendingEmail: string | null;
  authStep: 'unauthenticated' | 'awaiting_otp' | 'identity_setup' | 'authenticated';
}

export const authService = {
  /**
   * Request a real email OTP via Supabase Auth.
   * Supabase sends a 6-digit code to the supplied address.
   */
  async requestOtp(email: string): Promise<{ success: boolean; error?: string }> {
    const validation = validateCollegeEmail(email);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    const trimmedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        // Do not auto-create sessions from magic-link clicks — we only want OTP flow.
        shouldCreateUser: true,
      },
    });

    if (error) {
      // Surface a friendlier message for the most common errors
      if (error.message.includes('rate')) {
        return {
          success: false,
          error: 'Too many requests. Please wait a moment before requesting another code.',
        };
      }
      return { success: false, error: error.message };
    }

    storage.set('pending_otp_email', trimmedEmail);
    return { success: true };
  },

  /**
   * Verify the 6-digit OTP code entered by the user.
   * On success, Supabase returns a session whose user.id we use as the stable identity.
   */
  async verifyOtp(
    email: string,
    otp: string
  ): Promise<{ success: boolean; error?: string; user?: User; profile?: AnonymousProfile }> {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp,
      type: 'email',
    });

    if (error || !data.session) {
      return {
        success: false,
        error: error?.message ?? 'Verification failed. Please check the code and try again.',
      };
    }

    const supabaseUserId = data.session.user.id;

    // Look up any existing local profile keyed by Supabase user ID
    const readUser = (key: string) =>
      storage.get<User | null>(`user_${key}`, null, (v): v is User | null => isUser(v));
    const readProfile = (key: string) =>
      storage.get<AnonymousProfile | null>(
        `profile_${key}`,
        null,
        (v): v is AnonymousProfile | null => isAnonProfile(v)
      );

    let user = readUser(supabaseUserId);
    let profile = readProfile(supabaseUserId);

    if (!user) {
      user = {
        id: supabaseUserId,
        collegeEmailHash: supabaseUserId, // Supabase hashes email on its side
        isVerified: true,
        createdAt: new Date().toISOString(),
        currentStreak: 0,
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
      };
      storage.set(`user_${supabaseUserId}`, user);
    }

    if (!profile) {
      profile = this.generateAnonymousProfile(user.id);
      storage.set(`profile_${supabaseUserId}`, profile);
    }

    // Clear pending state
    storage.remove('pending_otp_email');

    // Save active user & profile
    storage.set('user', user);
    storage.set('anon_profile', profile);

    return { success: true, user, profile };
  },

  /**
   * Generate a random anonymous profile for a given user ID.
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
    storage.set(`user_${user.id}`, user);
  },

  /**
   * Persists the anonymous identity for this account.
   */
  saveProfile(user: User, profile: AnonymousProfile): void {
    storage.set(`profile_${user.id}`, profile);
  },

  /**
   * Logout current user — clears Supabase session and local state.
   */
  async logout(): Promise<void> {
    await supabase.auth.signOut();
    storage.remove('user');
    storage.remove('anon_profile');
    storage.remove('auth_step');
    storage.remove('pending_otp_email');
  },
};
