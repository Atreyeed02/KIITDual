import { useEffect, useRef, useCallback } from 'react';

/**
 * useInteractionCounter — Silently counts browser interactions during a session.
 *
 * Tracks: keydown, mousedown, click, scroll, touchstart events.
 * Only active when `isActive` is true (i.e. a Pomodoro is running).
 *
 * This is NOT a surveillance tool — it does not record what was typed or
 * where the user clicked. It only counts how many events occurred so that
 * zero-interaction sessions can be flagged transparently to the user as
 * "unverified". No popup, no interruption to deep work.
 *
 * Design rationale:
 * - Deep work (reading, writing on paper) may produce very few interactions.
 *   That is fine — we don't penalise it. Only a session with ZERO interactions
 *   is flagged, since that strongly suggests the tab was left idle with the
 *   timer running.
 * - The count resets each time `isActive` transitions false → true.
 *
 * @param isActive  Start/stop counting based on session state.
 * @returns         `getCount` — call this when the session ends to get the total.
 */
export function useInteractionCounter(isActive: boolean): { getCount: () => number } {
  const countRef = useRef<number>(0);

  // Reset counter whenever a new session starts
  const prevActiveRef = useRef(isActive);
  useEffect(() => {
    if (!prevActiveRef.current && isActive) {
      // Transition: not running → running — new session starting
      countRef.current = 0;
    }
    prevActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const events: (keyof DocumentEventMap)[] = [
      'keydown',
      'mousedown',
      'click',
      'scroll',
      'touchstart',
    ];

    const handler = () => {
      countRef.current += 1;
    };

    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
    };
  }, [isActive]);

  const getCount = useCallback(() => countRef.current, []);
  return { getCount };
}
