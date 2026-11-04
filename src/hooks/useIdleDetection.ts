import { useEffect, useRef, useCallback } from 'react';

/**
 * useIdleDetection — Browser-tab idle watcher for the study workspace.
 *
 * IMPORTANT — SCOPE: This hook only detects activity WITHIN THE BROWSER TAB.
 * Writing in another app, reading a textbook, or typing in VS Code will NOT
 * reset this timer. For that reason we use a longer default timeout (15 min)
 * so legitimate study habits (reading, handwriting notes) are not penalised.
 *
 * The main anti-gaming mechanism is NOT this hook — it is the random
 * mid-session check-in scheduled by AppContext when a session starts.
 * That fires at an unpredictable time inside the session, making it impossible
 * to game by starting a timer and walking away.
 *
 * @param onIdle           Callback when inactivity threshold is reached.
 * @param isActive         Hook is a no-op when false (e.g. no session running).
 * @param idleTimeoutMs    Time (ms) of inactivity before onIdle fires. Default 15 min.
 */
export function useIdleDetection(
  onIdle: () => void,
  isActive: boolean,
  idleTimeoutMs: number = 15 * 60 * 1000  // 15 minutes default
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onIdleRef.current(), idleTimeoutMs);
  }, [idleTimeoutMs]);

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Events that indicate the user is actively using the browser tab.
    // System-wide activity (other apps, physical writing) is invisible to the browser.
    const events: (keyof DocumentEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    const handler = () => resetTimer();
    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));

    resetTimer(); // Start the clock immediately

    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, resetTimer]);
}
