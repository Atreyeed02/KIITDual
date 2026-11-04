import React, { useEffect, useRef, useState } from 'react';
import { Coffee, Zap, Clock } from 'lucide-react';

interface IdleWarningOverlayProps {
  /** Called when the user clicks "Yes, I'm here!" — should resume the Pomodoro. */
  onStillHere: () => void;
  /** Called when the user clicks "Take a Break" or the auto-dismiss countdown expires. */
  onTakeBreak: () => void;
  /** Seconds to count down before auto-dismissing as a break. Default 60. */
  autoBreakSeconds?: number;
}

/**
 * IdleWarningOverlay — Netflix-style "Still Studying?" fullscreen modal.
 *
 * Shown when the user has been idle for several minutes while a Pomodoro
 * was running. The timer was already paused by the caller before mounting.
 *
 * Features:
 * - Animated entry with a glassmorphism card
 * - 60-second countdown ring that auto-triggers "Take a Break" on expiry
 * - Two clear action buttons
 */
export const IdleWarningOverlay: React.FC<IdleWarningOverlayProps> = ({
  onStillHere,
  onTakeBreak,
  autoBreakSeconds = 60,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(autoBreakSeconds);
  const [mounted, setMounted] = useState(false);
  const onTakeBreakRef = useRef(onTakeBreak);
  onTakeBreakRef.current = onTakeBreak;

  // Entry animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTakeBreakRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / autoBreakSeconds;
  const dashOffset = circumference * (1 - progress);

  const urgencyColor =
    secondsLeft > 30
      ? '#3DD9B3'   // teal — plenty of time
      : secondsLeft > 15
      ? '#FFB547'   // amber — getting close
      : '#FF7A7A';  // red — almost gone

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Are you still studying?"
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-500 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-[#0F1420]/85 backdrop-blur-md" />

      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#6C7CFF]/10 blur-[120px] pointer-events-none" />

      {/* Card */}
      <div
        className={`relative z-10 bg-[#161D2D]/95 border border-[#36425E] rounded-3xl shadow-2xl max-w-md w-full p-8 text-center transition-all duration-500 ${
          mounted ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Netflix-style pause icon with pulsing ring */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            {/* Countdown SVG ring */}
            <svg width="100" height="100" className="-rotate-90" aria-hidden="true">
              {/* Track */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="#2A3348"
                strokeWidth="8"
              />
              {/* Progress */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={urgencyColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
              />
            </svg>

            {/* Inner content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-2xl font-black font-mono tabular-nums"
                style={{ color: urgencyColor }}
              >
                {secondsLeft}
              </span>
              <span className="text-[9px] font-mono text-[#94A3B8] uppercase tracking-widest">
                secs
              </span>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-2">
          <span className="text-3xl" role="img" aria-label="sleeping face">😴</span>
        </div>
        <h1 className="text-2xl font-black text-[#F1F5F9] tracking-tight mb-2">
          Still studying?
        </h1>
        <p className="text-sm text-[#94A3B8] mb-1 leading-relaxed">
          Your focus session has been paused — we noticed you stepped away.
        </p>
        <p className="text-xs font-mono text-[#64748B] mb-8">
          Auto-ending session in{' '}
          <span style={{ color: urgencyColor }} className="font-bold">
            {secondsLeft}s
          </span>
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {/* Primary — still here */}
          <button
            id="idle-still-here-btn"
            type="button"
            onClick={onStillHere}
            className="flex items-center justify-center gap-2.5 w-full px-6 py-4 rounded-2xl bg-[#3DD9B3] hover:bg-[#2CC9A3] text-[#0F1420] font-bold text-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(61,217,179,0.4)] active:scale-[0.98]"
          >
            <Zap className="w-5 h-5 fill-current" aria-hidden="true" />
            Yes, I'm here — Resume!
          </button>

          {/* Secondary — take a break */}
          <button
            id="idle-take-break-btn"
            type="button"
            onClick={onTakeBreak}
            className="flex items-center justify-center gap-2.5 w-full px-6 py-3.5 rounded-2xl bg-[#1A2133] hover:bg-[#222B42] border border-[#2A3348] hover:border-[#36425E] text-[#94A3B8] hover:text-[#F1F5F9] font-medium text-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
          >
            <Coffee className="w-4 h-4" aria-hidden="true" />
            Take a break
          </button>
        </div>

        {/* Small privacy note */}
        <p className="mt-6 text-[11px] font-mono text-[#3C4B63] flex items-center justify-center gap-1.5">
          <Clock className="w-3 h-3" aria-hidden="true" />
          Unfinished sessions are not counted in your score
        </p>
      </div>
    </div>
  );
};
