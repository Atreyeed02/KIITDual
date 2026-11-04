/**
 * KIITDual — Matchmaking Service (Supabase Realtime-backed)
 * Handles real queue management and live pairing between two real users.
 * Falls back to bot pairing only if Supabase is unavailable.
 */

import { Match, AnonymousProfile } from '../types';
import { INITIAL_ANON_USERNAMES } from '../data/mockData';
import { createId } from '../utils/id';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─── Types matching our DB schema ────────────────────────────────────────────

interface QueueRow {
  user_id: string;
  anon_profile: AnonymousProfile;
  inserted_at: string;
}

interface MatchRow {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_profile: AnonymousProfile;
  user2_profile: AnonymousProfile;
  status: string;
  start_time: string;
  end_time: string;
  winner_id: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a DB match row into the local Match domain object. */
function rowToMatch(row: MatchRow): Match {
  return {
    id: row.id,
    user1Id: row.user1_id,
    user2Id: row.user2_id,
    user1Profile: row.user1_profile,
    user2Profile: row.user2_profile,
    status: row.status as Match['status'],
    startTime: row.start_time,
    endTime: row.end_time,
    winnerId: row.winner_id,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const matchmakingService = {
  /**
   * Insert the current user into the matchmaking queue.
   * Also tries to pair immediately if a partner is already waiting.
   */
  async joinQueue(
    userId: string,
    anonProfile: AnonymousProfile
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.from('matchmaking_queue').upsert({
      user_id: userId,
      anon_profile: anonProfile,
    });

    if (error) {
      console.error('[matchmaking] joinQueue error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  /**
   * Remove the current user from the matchmaking queue.
   */
  async leaveQueue(userId: string): Promise<void> {
    await supabase.from('matchmaking_queue').delete().eq('user_id', userId);
  },

  /**
   * Subscribe to the matchmaking_queue table changes.
   * Calls `onQueueChange` whenever a row is inserted or deleted.
   * Returns the channel so the caller can unsubscribe.
   */
  subscribeToQueue(onQueueChange: (rows: QueueRow[]) => void): RealtimeChannel {
    const channel = supabase
      .channel('matchmaking_queue_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matchmaking_queue' },
        async () => {
          // Re-fetch the full queue on any change
          const { data } = await supabase
            .from('matchmaking_queue')
            .select('*')
            .order('inserted_at', { ascending: true });
          onQueueChange((data as QueueRow[]) ?? []);
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Subscribe to the matches table for a specific user.
   * Fires `onMatch` with the Match object when a new row appears for this user.
   * Returns the channel so the caller can unsubscribe.
   */
  subscribeToMatches(userId: string, onMatch: (match: Match) => void): RealtimeChannel {
    const channel = supabase
      .channel(`matches_user_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `user1_id=eq.${userId}`,
        },
        (payload) => onMatch(rowToMatch(payload.new as MatchRow))
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `user2_id=eq.${userId}`,
        },
        (payload) => onMatch(rowToMatch(payload.new as MatchRow))
      )
      .subscribe();

    return channel;
  },

  /**
   * Try to pair two users from the queue.
   * The client that is "first" in the queue (earliest inserted_at) runs this
   * after a small random jitter to reduce race conditions.
   * 
   * If successful, inserts a match row and removes both users from the queue.
   * The Realtime subscription on `matches` will notify both clients.
   */
  async attemptPairing(
    currentUserId: string,
    queueRows: QueueRow[]
  ): Promise<{ paired: boolean }> {
    if (queueRows.length < 2) return { paired: false };

    // Only the first user in the queue attempts pairing to avoid races
    const [first, second] = queueRows;
    if (first.user_id !== currentUserId) return { paired: false };

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);

    // Insert the match
    const { error: matchError } = await supabase.from('matches').insert({
      user1_id: first.user_id,
      user2_id: second.user_id,
      user1_profile: first.anon_profile,
      user2_profile: second.anon_profile,
      status: 'active',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      winner_id: null,
    });

    if (matchError) {
      console.error('[matchmaking] attemptPairing INSERT error:', {
        message: matchError.message,
        code: (matchError as any).code,
        details: (matchError as any).details,
        hint: (matchError as any).hint,
      });
      return { paired: false };
    }

    console.log('[matchmaking] Match inserted successfully between', first.user_id, 'and', second.user_id);

    // Clean up both queue rows
    const { error: deleteError } = await supabase
      .from('matchmaking_queue')
      .delete()
      .in('user_id', [first.user_id, second.user_id]);

    if (deleteError) {
      console.warn('[matchmaking] Queue cleanup error (non-fatal):', deleteError.message);
    }

    return { paired: true };
  },

  /**
   * Poll the matches table directly for a match involving this user.
   * Used as a reliable fallback when Realtime events are delayed or misconfigured.
   */
  async pollForMatch(userId: string): Promise<Match | null> {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq('status', 'active')
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[matchmaking] pollForMatch error:', error.message);
      return null;
    }
    if (!data) return null;
    return rowToMatch(data as MatchRow);
  },

  /**
   * Generates a simulated anonymous opponent profile (used for bot fallback / dev).
   */
  generateSimulatedOpponent(currentUserProfile?: AnonymousProfile): AnonymousProfile {
    const filterUsernames = INITIAL_ANON_USERNAMES.filter(
      (name) => !currentUserProfile || !name.startsWith(currentUserProfile.anonUsername.slice(0, 5))
    );
    const randomIndex = Math.floor(Math.random() * filterUsernames.length);
    const baseName = filterUsernames[randomIndex] || 'QuietFalcon482';
    const randomNum = Math.floor(100 + Math.random() * 899);

    const anonUsername = `${baseName.replace(/\d+$/, '')}${randomNum}`;
    const avatarSeed = `opp_${anonUsername}_${Date.now()}`;

    return {
      id: createId('opp_prof'),
      userId: createId('opp_usr'),
      anonUsername,
      avatarSeed,
      rotatesPerMatch: false,
    };
  },

  /**
   * Creates an active 24-hour Match entity (used locally after pairing confirmation).
   */
  createMatch(userProfile: AnonymousProfile, opponentProfile: AnonymousProfile): Match {
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      id: createId('match'),
      user1Id: userProfile.userId,
      user2Id: opponentProfile.userId,
      user1Profile: userProfile,
      user2Profile: opponentProfile,
      status: 'active',
      startTime,
      endTime,
      winnerId: null,
    };
  },
};
