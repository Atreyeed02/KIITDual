/**
 * KIITDual — Frontend Simulated Matchmaking Service
 * Handles queue management, opponent pairing simulation, and match entity creation.
 * Isolated and backend-ready (can be swapped for Socket.io / REST backend later).
 */

import { Match, AnonymousProfile } from '../types';
import { INITIAL_ANON_USERNAMES } from '../data/mockData';
import { createId } from '../utils/id';

export const matchmakingService = {
  /**
   * Generates a simulated anonymous opponent profile
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
   * Creates an active 24-hour Match entity using existing domain models
   */
  createMatch(userProfile: AnonymousProfile, opponentProfile: AnonymousProfile): Match {
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +24 hours

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
