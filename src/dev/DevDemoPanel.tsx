import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DemoOutcome, DEMO_OUTCOMES, demoOutcome, isDevBuild } from './demoOutcome';
import {
  FlaskConical,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Trophy,
  Clock,
  Zap,
  SkipForward,
  Eye,
} from 'lucide-react';

/**
 * DevDemoPanel — Floating, collapsible dev-only control panel.
 *
 * Renders only in development builds (isDevBuild = import.meta.env.DEV).
 * Zero footprint in production: the entire component tree is stripped by Vite.
 *
 * Purpose: lets the developer walk an evaluator through all app features
 * without waiting for real timers:
 *  - Complete a session instantly (verified or unverified)
 *  - Skip the 90-second anti-spam cooldown
 *  - Trigger the idle warning overlay on demand
 *  - Choose match outcome before ending
 *  - Fast-forward match expiry to reach the Scorecard
 */
export const DevDemoPanel: React.FC = () => {
  const {
    pomodoroState,
    sessionCooldownEndsAt,
    idleWarningActive,
    devCompleteSession,
    devSkipCooldown,
    triggerIdleWarning,
    dismissIdleWarning,
    fastForwardMatchExpiry,
    currentMatch,
  } = useApp();

  const [isOpen, setIsOpen] = useState(true);
  const [outcome, setOutcome] = useState<DemoOutcome>(() => demoOutcome.get());
  const [lastAction, setLastAction] = useState<string | null>(null);

  if (!isDevBuild) return null;

  const toast = (msg: string) => {
    setLastAction(msg);
    setTimeout(() => setLastAction(null), 2500);
  };

  const canCompleteSession = pomodoroState.isRunning;
  const isCoolingDown = sessionCooldownEndsAt !== null && Date.now() < sessionCooldownEndsAt;

  const handleOutcomeChange = (value: DemoOutcome) => {
    setOutcome(value);
    demoOutcome.set(value);
    toast(`Outcome set → ${value.toUpperCase()}`);
  };

  return (
    <div
      className="fixed bottom-5 right-5 z-[9998] w-72 font-mono text-xs"
      aria-label="Developer demo control panel"
      role="complementary"
    >
      {/* Panel header / toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#1A1030] border border-[#6C7CFF]/60 rounded-t-xl text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
          <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
          Dev Demo Panel
        </span>
        <span className="flex items-center gap-1 text-[10px] text-[#6C7CFF]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6C7CFF] animate-pulse" />
          DEV ONLY
          {isOpen ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronUp className="w-3 h-3 ml-1" />}
        </span>
      </button>

      {/* Panel body */}
      {isOpen && (
        <div className="bg-[#12101E] border border-t-0 border-[#6C7CFF]/40 rounded-b-xl shadow-2xl overflow-hidden">
          {/* Feedback toast */}
          {lastAction && (
            <div className="px-3 py-1.5 bg-[#6C7CFF]/20 text-[#A78BFA] text-[10px] text-center animate-fade-in border-b border-[#6C7CFF]/20">
              ✓ {lastAction}
            </div>
          )}

          <div className="p-3 space-y-3">
            {/* ─── Section 1: Session Controls ──────────────────────────── */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#6C7CFF] mb-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Session Controls
              </p>
              <div className="space-y-1.5">
                {/* Complete verified session */}
                <button
                  type="button"
                  id="dev-complete-verified"
                  disabled={!canCompleteSession}
                  onClick={() => {
                    devCompleteSession(52); // realistic interaction count
                    toast('Session completed — verified (52 interactions)');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#1A2133] hover:bg-[#222B42] border border-[#2A3348] hover:border-[#3DD9B3]/50 text-[#3DD9B3] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-left"
                  title={canCompleteSession ? undefined : 'Start a Pomodoro first'}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Complete Session <span className="text-[#475569]">(✅ verified)</span></span>
                </button>

                {/* Complete unverified session */}
                <button
                  type="button"
                  id="dev-complete-unverified"
                  disabled={!canCompleteSession}
                  onClick={() => {
                    devCompleteSession(0); // 0 interactions → unverified flag
                    toast('Session completed — unverified (0 interactions)');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#1A2133] hover:bg-[#222B42] border border-[#2A3348] hover:border-[#FFB547]/50 text-[#FFB547] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-left"
                  title={canCompleteSession ? undefined : 'Start a Pomodoro first'}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Complete Session <span className="text-[#475569]">(⚠ unverified)</span></span>
                </button>

                {/* Skip cooldown */}
                <button
                  type="button"
                  id="dev-skip-cooldown"
                  disabled={!isCoolingDown}
                  onClick={() => {
                    devSkipCooldown();
                    toast('Cooldown skipped');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#1A2133] hover:bg-[#222B42] border border-[#2A3348] hover:border-[#94A3B8]/50 text-[#94A3B8] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-left"
                  title={isCoolingDown ? undefined : 'No active cooldown'}
                >
                  <SkipForward className="w-3.5 h-3.5 shrink-0" />
                  Skip 90s Cooldown
                </button>
              </div>
            </div>

            <div className="border-t border-[#2A3348]" />

            {/* ─── Section 2: UI State Demos ────────────────────────────── */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#6C7CFF] mb-1.5 flex items-center gap-1">
                <Eye className="w-3 h-3" /> UI Demos
              </p>
              <div className="space-y-1.5">
                {/* Show idle warning */}
                <button
                  type="button"
                  id="dev-show-idle-warning"
                  disabled={idleWarningActive}
                  onClick={() => {
                    triggerIdleWarning();
                    toast('Idle warning overlay triggered');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#1A2133] hover:bg-[#222B42] border border-[#2A3348] hover:border-[#A78BFA]/50 text-[#A78BFA] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-left"
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  {idleWarningActive ? 'Idle Overlay Active…' : 'Show Idle Warning Overlay'}
                </button>

                {idleWarningActive && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => { dismissIdleWarning('resume'); toast('Idle: resumed'); }}
                      className="flex-1 py-1.5 rounded-lg bg-[#3DD9B3]/10 border border-[#3DD9B3]/30 text-[#3DD9B3] hover:bg-[#3DD9B3]/20 transition-all text-[10px]"
                    >
                      Dismiss: Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => { dismissIdleWarning('break'); toast('Idle: break taken'); }}
                      className="flex-1 py-1.5 rounded-lg bg-[#FF7A7A]/10 border border-[#FF7A7A]/30 text-[#FF7A7A] hover:bg-[#FF7A7A]/20 transition-all text-[10px]"
                    >
                      Dismiss: Break
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#2A3348]" />

            {/* ─── Section 3: Match End ─────────────────────────────────── */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#6C7CFF] mb-1.5 flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Match End
              </p>

              {/* Outcome picker */}
              <div className="flex items-center gap-2 mb-1.5">
                <label htmlFor="dev-outcome-select" className="text-[#94A3B8] shrink-0">
                  Outcome:
                </label>
                <select
                  id="dev-outcome-select"
                  value={outcome}
                  onChange={(e) => handleOutcomeChange(e.target.value as DemoOutcome)}
                  className="flex-1 bg-[#1A2133] border border-[#2A3348] rounded-lg px-2 py-1 text-[#F1F5F9] focus:outline-none focus:border-[#6C7CFF] text-[11px]"
                >
                  {DEMO_OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {o === 'natural' ? 'Natural (simulated)' : `Force ${o.toUpperCase()}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fast-forward to scorecard */}
              <button
                type="button"
                id="dev-fast-forward-match"
                disabled={!currentMatch}
                onClick={() => {
                  fastForwardMatchExpiry();
                  toast('Match ended → Scorecard');
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#FF7A7A]/10 hover:bg-[#FF7A7A]/20 border border-[#FF7A7A]/30 hover:border-[#FF7A7A]/60 text-[#FF7A7A] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <SkipForward className="w-3.5 h-3.5 shrink-0" />
                End Match → Go to Scorecard
              </button>

              {outcome === 'win' && (
                <p className="text-[10px] text-[#FFB547] mt-1">
                  ⚠ WIN needs score &gt; 0 — complete at least one session first.
                </p>
              )}
            </div>

            {/* Footer note */}
            <p className="text-[9px] text-[#3C4B63] text-center border-t border-[#2A3348] pt-2">
              Hidden in production builds · Vite dead-code elimination
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
