import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ProgressRing } from '../ui/ProgressRing';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Play, Pause, RotateCcw, CheckCircle } from 'lucide-react';
import { PomodoroMode, MODE_MINUTES, getRemainingSeconds } from '../../utils/pomodoro';
import { calculateScore } from '../../utils/scoring';

export type TimerMode = PomodoroMode;

const MODES: { id: PomodoroMode; label: string; activeClass: string }[] = [
  {
    id: 'standard',
    label: '25m Standard',
    activeClass: 'bg-[#3DD9B3] text-[#0F1420] font-bold shadow-[0_0_12px_rgba(61,217,179,0.3)]',
  },
  {
    id: 'deep',
    label: '50m Deep',
    activeClass: 'bg-[#6C7CFF] text-[#F1F5F9] font-bold shadow-[0_0_12px_rgba(108,124,255,0.3)]',
  },
  {
    id: 'break',
    label: '5m Break',
    activeClass: 'bg-[#FFB547] text-[#0F1420] font-bold shadow-[0_0_12px_rgba(255,181,71,0.3)]',
  },
];

export const PomodoroTimer: React.FC = () => {
  const {
    pomodoroState,
    focusSessions,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    selectPomodoroMode,
    togglePomodoroDemoMode,
  } = useApp();
  const [now, setNow] = useState(() => Date.now());
  const [completionNotice, setCompletionNotice] = useState<string | null>(null);

  // Display-only tick. Remaining time is always derived from timestamps, and
  // completion is detected centrally by the match lifecycle tick.
  useEffect(() => {
    if (!pomodoroState.isRunning) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pomodoroState.isRunning, pomodoroState.startedAt]);

  // Success feedback when a new focus session is logged.
  const lastSession = focusSessions.length ? focusSessions[focusSessions.length - 1] : null;
  const lastSessionId = lastSession?.id ?? null;
  const lastSessionMinutes = lastSession?.durationMinutes ?? 0;
  const prevSessionId = useRef(lastSessionId);
  useEffect(() => {
    if (!lastSessionId || lastSessionId === prevSessionId.current) return;
    prevSessionId.current = lastSessionId;
    const pts = calculateScore(lastSessionMinutes, 0, 1);
    setCompletionNotice(`Session complete — ${lastSessionMinutes}m logged (+${pts} pts)`);
    const timeout = setTimeout(() => setCompletionNotice(null), 4000);
    return () => clearTimeout(timeout);
  }, [lastSessionId, lastSessionMinutes]);

  const secondsLeft = getRemainingSeconds(pomodoroState, now);
  const isDemo = !!pomodoroState.demoMode;
  const isPaused = !pomodoroState.isRunning && pomodoroState.pausedSecondsLeft !== null;

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalDuration = pomodoroState.durationSeconds;
  const progressPercent = Math.round(((totalDuration - secondsLeft) / totalDuration) * 100);

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Mode Selector Tabs */}
      <div
        role="group"
        aria-label="Timer mode"
        className="flex flex-wrap justify-center items-center gap-1 sm:gap-1.5 p-1 bg-[#1A2133] border border-[#2A3348] rounded-full max-w-full"
      >
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => selectPomodoroMode(mode.id)}
            disabled={pomodoroState.isRunning}
            aria-pressed={pomodoroState.mode === mode.id}
            title={pomodoroState.isRunning ? 'Pause or reset the timer to switch modes' : undefined}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-mono font-medium transition-all disabled:cursor-not-allowed ${
              pomodoroState.mode === mode.id
                ? mode.activeClass
                : 'text-[#94A3B8] hover:text-[#F1F5F9] disabled:hover:text-[#94A3B8] disabled:opacity-60'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Main Progress Ring & Timer */}
      <div className="py-2 relative">
        <ProgressRing
          progress={progressPercent}
          size={250}
          strokeWidth={10}
          variant={pomodoroState.mode === 'deep' ? 'indigo' : pomodoroState.mode === 'break' ? 'amber' : 'teal'}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-widest block">
              {pomodoroState.mode === 'break' ? 'Break Time' : 'Focus Mode'}
            </span>
            <div
              className="text-4xl font-extrabold font-mono text-[#F1F5F9] tracking-tight tabular-nums"
              role="timer"
              aria-label={`${Math.floor(secondsLeft / 60)} minutes ${secondsLeft % 60} seconds remaining`}
            >
              {formatTime(secondsLeft)}
            </div>
            {pomodoroState.isRunning ? (
              <Badge variant="teal" pulse className="mx-auto text-[10px]">
                {pomodoroState.mode === 'break' ? 'On Break' : 'Focusing Now'}
              </Badge>
            ) : (
              <span className="text-[10px] text-[#94A3B8] font-mono block">
                {isPaused ? 'Paused' : 'Ready'}
              </span>
            )}
          </div>
        </ProgressRing>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap justify-center items-center gap-3">
        {pomodoroState.isRunning ? (
          <Button
            variant="secondary"
            size="md"
            onClick={pausePomodoro}
            icon={<Pause className="w-4 h-4 text-[#FFB547]" />}
          >
            Pause
          </Button>
        ) : (
          <Button
            variant={pomodoroState.mode === 'deep' ? 'primary' : 'teal'}
            size="md"
            onClick={startPomodoro}
            icon={<Play className="w-4 h-4 fill-current" />}
          >
            {isPaused ? 'Resume' : pomodoroState.mode === 'break' ? 'Start Break' : 'Start Focus'}
          </Button>
        )}

        <Button
          variant="ghost"
          size="md"
          onClick={resetPomodoro}
          icon={<RotateCcw className="w-4 h-4" />}
          title="Reset timer (an unfinished session is not counted)"
        >
          Reset
        </Button>
      </div>

      {/* Session logged feedback */}
      <div aria-live="polite" className="min-h-[1.25rem]">
        {completionNotice && (
          <span className="text-xs font-mono text-[#3DD9B3] flex items-center gap-1.5 animate-fade-in">
            <CheckCircle className="w-4 h-4" aria-hidden="true" />
            {completionNotice}
          </span>
        )}
      </div>

      {/* Fast Test Mode Toggle */}
      <div className="text-center space-y-1">
        <button
          type="button"
          onClick={togglePomodoroDemoMode}
          disabled={pomodoroState.isRunning}
          aria-pressed={isDemo}
          className={`text-[11px] font-mono px-3 py-1 rounded-full border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isDemo
              ? 'bg-[#FFB547]/20 border-[#FFB547] text-[#FFB547]'
              : 'border-[#2A3348] text-[#94A3B8] hover:text-[#F1F5F9]'
          }`}
        >
          ⚡ {isDemo ? 'Fast 10s Demo Mode Active' : 'Enable 10s Demo Timer'}
        </button>
        {isDemo && pomodoroState.mode !== 'break' && (
          <p className="text-[10px] font-mono text-[#94A3B8]">
            Demo: 10s simulates one full {MODE_MINUTES[pomodoroState.mode]}m session
          </p>
        )}
      </div>
    </div>
  );
};
