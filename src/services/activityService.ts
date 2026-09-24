/**
 * KIITDual — Frontend Simulated Opponent Activity Service
 * Generates privacy-preserving simulated opponent activity events and status updates.
 * Backend-ready abstraction (can be replaced by Socket.io event listeners later).
 */

export interface ActivityEvent {
  id: string;
  opponentUsername: string;
  message: string;
  timestamp: string;
  type: 'session' | 'task' | 'reaction' | 'status';
}

/** Keep the persisted feed bounded. */
export const MAX_ACTIVITY_EVENTS = 30;

const SIMULATED_MESSAGES = [
  'started a 25m focus session',
  'completed a 25m focus session',
  'checked off a study task',
  'is deep in focus mode',
  'sent a quick encouragement 🔥',
  'took a short 5m break',
];

export const activityService = {
  /**
   * Generates initial recent activity events for the opponent
   */
  generateInitialActivities(opponentUsername: string): ActivityEvent[] {
    const now = Date.now();
    return [
      {
        id: `act_${now}_join`,
        opponentUsername,
        message: 'joined the 24h match',
        timestamp: new Date(now - 120000).toISOString(),
        type: 'status',
      },
      {
        id: `act_${now}_sess`,
        opponentUsername,
        // 25 min × 0.5 + 1 session × 10 = 22.5 pts
        message: 'completed a 25m focus session (+22.5 pts)',
        timestamp: new Date(now - 60000).toISOString(),
        type: 'session',
      },
    ];
  },

  /**
   * Returns a random periodic activity event
   */
  generateRandomEvent(opponentUsername: string): ActivityEvent {
    const randomIndex = Math.floor(Math.random() * SIMULATED_MESSAGES.length);
    const msg = SIMULATED_MESSAGES[randomIndex];

    return {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      opponentUsername,
      message: msg,
      timestamp: new Date().toISOString(),
      type: msg.includes('session') ? 'session' : msg.includes('task') ? 'task' : 'status',
    };
  },
};
