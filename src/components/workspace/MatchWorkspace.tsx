import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Identicon } from '../ui/Identicon';
import { PomodoroTimer } from './PomodoroTimer';
import { TaskManager } from './TaskManager';
import { OpponentSidebar } from './OpponentSidebar';
import { matchService } from '../../services/matchService';
import { DevOutcomeControl } from '../../dev/DevOutcomeControl';
import { isDevBuild } from '../../dev/demoOutcome';
import {
  Zap,
  Clock,
  ArrowLeft,
  Trophy,
  Activity,
} from 'lucide-react';

// Format HH:MM:SS
const formatMatchTime = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/**
 * Display-only 24h countdown. Kept in its own component so the per-second
 * tick re-renders just this pill, not the whole workspace. Expiry itself is
 * detected once, centrally, by the match lifecycle tick in AppContext.
 */
const MatchCountdown: React.FC<{ endTime: string }> = ({ endTime }) => {
  const endMs = Date.parse(endTime);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((endMs - Date.now()) / 1000))
  );

  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.floor((endMs - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endMs]);

  return (
    <div className="flex items-center gap-2 bg-[#1A2133] border border-[#2A3348] px-2.5 sm:px-3 py-1.5 rounded-xl">
      <Clock className="w-4 h-4 text-[#FFB547] shrink-0" aria-hidden="true" />
      <span className="text-xs text-[#94A3B8] font-mono hidden md:inline">24h Match:</span>
      <span
        className="text-sm sm:text-base font-bold font-mono text-[#FFB547] tracking-tight tabular-nums"
        role="timer"
        aria-label="Time remaining in match"
      >
        {formatMatchTime(secondsLeft)}
      </span>
    </div>
  );
};

export const MatchWorkspace: React.FC = () => {
  const {
    currentMatch,
    anonProfile,
    focusSessions,
    matchTasks,
    setActiveView,
    fastForwardMatchExpiry,
  } = useApp();

  if (!currentMatch || !anonProfile) {
    return (
      <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex items-center justify-center p-4">
        <Card variant="default" padding="lg" className="text-center space-y-4 max-w-md">
          <p className="text-sm text-[#94A3B8]">No active match session found.</p>
          <Button variant="primary" onClick={() => setActiveView('dashboard')}>
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const opponent = currentMatch.user2Profile;

  // Live progress uses exactly the same rules as the final score engine.
  const liveResult = matchService.calculateUserResult(
    currentMatch.id,
    currentMatch.user1Id,
    focusSessions,
    matchTasks
  );

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col">
      {/* 1. WORKSPACE HEADER */}
      <header className="border-b border-[#2A3348] bg-[#161D2D]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Back Navigation & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setActiveView('dashboard')}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#F1F5F9] transition-colors p-1.5 rounded-lg hover:bg-[#222B42] shrink-0"
              title="Return to Dashboard"
              aria-label="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <div className="h-4 w-px bg-[#2A3348] hidden sm:block" />

            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-5 h-5 text-[#6C7CFF] shrink-0" aria-hidden="true" />
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#F1F5F9] truncate">
                KIIT<span className="text-[#6C7CFF]">Dual</span>
                <span className="hidden sm:inline"> Workspace</span>
              </span>
            </div>
          </div>

          {/* Opponent & 24h Countdown & Dev Fast Forward */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Demo fast-forward trigger (compact on small screens) */}
            <button
              type="button"
              onClick={fastForwardMatchExpiry}
              className="text-[11px] font-mono px-2 sm:px-2.5 py-1 rounded-lg bg-[#FFB547]/10 hover:bg-[#FFB547]/20 border border-[#FFB547]/30 text-[#FFB547] transition-all flex items-center gap-1"
              title="Demo: fast-forward match expiration to view the Scorecard immediately"
              aria-label="Demo: fast-forward match expiry"
            >
              <span aria-hidden="true">⚡</span>
              <span className="hidden lg:inline">Fast-Forward Expiry</span>
              <span className="hidden sm:inline lg:hidden">Expire</span>
            </button>

            {/* 24h Chronometer */}
            <MatchCountdown endTime={currentMatch.endTime} />

            {/* Opponent Identity Pill */}
            <div className="hidden sm:flex items-center gap-2 bg-[#1A2133] border border-[#3DD9B3]/30 px-3 py-1 rounded-full">
              <Identicon seed={opponent.avatarSeed} size={26} />
              <div className="text-left text-xs font-mono">
                <span className="text-[#3DD9B3] font-bold">{opponent.anonUsername}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* MAIN LEFT COLUMN (Pomodoro & Task Manager) */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8 min-w-0">
            {/* Pomodoro Focus Timer Card */}
            <Card variant="default" padding="lg" className="space-y-6 border-[#36425E]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A3348] pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#3DD9B3]" aria-hidden="true" />
                  <h2 className="text-base font-bold text-[#F1F5F9] font-mono">
                    Pomodoro Focus Engine
                  </h2>
                </div>
                <Badge variant="teal" pulse>
                  Active Session Logging
                </Badge>
              </div>

              <PomodoroTimer />
            </Card>

            {/* Personal Match Progress Card */}
            <Card variant="default" padding="md" className="space-y-3 border-[#2A3348]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-[#FFB547]" aria-hidden="true" /> Your Active Progress
                </span>
                <span className="text-xs font-mono text-[#3DD9B3]">
                  Live score: {liveResult.finalScore} pts
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#222B42] border border-[#2A3348]">
                  <span className="text-[#94A3B8] text-[10px] block">Focus Time</span>
                  <span className="text-lg font-bold text-[#3DD9B3]">{liveResult.totalFocusMinutes}m</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#222B42] border border-[#2A3348]">
                  <span className="text-[#94A3B8] text-[10px] block">Sessions</span>
                  <span className="text-lg font-bold text-[#6C7CFF]">{liveResult.sessionsCompleted}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#222B42] border border-[#2A3348]">
                  <span className="text-[#94A3B8] text-[10px] block">Goals Met</span>
                  <span className="text-lg font-bold text-[#FFB547]">{liveResult.tasksCompleted}</span>
                </div>
              </div>
            </Card>

            {/* Task Manager Component */}
            <TaskManager />

            {/* Development-only demo outcome picker (absent from production builds) */}
            {isDevBuild && <DevOutcomeControl />}
          </div>

          {/* RIGHT SIDEBAR COLUMN (Opponent Info, Activity & Reactions) */}
          <div className="space-y-8 min-w-0">
            <OpponentSidebar />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A3348] py-6 text-center text-xs text-[#94A3B8] font-mono">
        KIITDual Platform &bull; Single-College 1v1 Active Match Workspace
      </footer>
    </div>
  );
};
