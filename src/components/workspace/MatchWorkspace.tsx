import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Identicon } from '../ui/Identicon';
import { PomodoroTimer } from './PomodoroTimer';
import { TaskManager } from './TaskManager';
import { OpponentSidebar } from './OpponentSidebar';
import { IdleWarningOverlay } from './IdleWarningOverlay';
import { matchService } from '../../services/matchService';
import { DevDemoPanel } from '../../dev/DevDemoPanel';
import { useIdleDetection } from '../../hooks/useIdleDetection';
import { useInteractionCounter } from '../../hooks/useInteractionCounter';
import {
  Zap,
  Clock,
  ArrowLeft,
  Trophy,
  Activity,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

// Format HH:MM:SS
const formatMatchTime = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

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
    pomodoroState,
    setActiveView,
    fastForwardMatchExpiry,
    idleWarningActive,
    triggerIdleWarning,
    dismissIdleWarning,
    registerInteractionCounter,
  } = useApp();

  // Passive interaction counter — tracks browser events silently, no interruptions.
  // getCount() is called by AppContext when a session completes to stamp the session record.
  const { getCount } = useInteractionCounter(pomodoroState.isRunning);

  // Register the counter with the context so it can read it on session completion.
  const getCountRef = useRef(getCount);
  getCountRef.current = getCount;
  useEffect(() => {
    registerInteractionCounter(() => getCountRef.current());
  }, [registerInteractionCounter]);

  // 15-minute browser-tab idle detection. Only fires if the user hasn't touched
  // the page at all — legitimate deep work won't trigger this.
  useIdleDetection(triggerIdleWarning, pomodoroState.isRunning, 15 * 60 * 1000);

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

  const liveResult = matchService.calculateUserResult(
    currentMatch.id,
    currentMatch.user1Id,
    focusSessions,
    matchTasks
  );

  // Sessions this match, most recent first.
  const matchSessions = [...focusSessions]
    .filter((s) => s.matchId === currentMatch.id && s.completed)
    .reverse();

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col">
      {/* Idle overlay — only shown when user has been away for 15+ minutes */}
      {idleWarningActive && (
        <IdleWarningOverlay
          onStillHere={() => dismissIdleWarning('resume')}
          onTakeBreak={() => dismissIdleWarning('break')}
          autoBreakSeconds={60}
        />
      )}

      {/* WORKSPACE HEADER */}
      <header className="border-b border-[#2A3348] bg-[#161D2D]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
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

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <button
              type="button"
              onClick={fastForwardMatchExpiry}
              className="text-[11px] font-mono px-2 sm:px-2.5 py-1 rounded-lg bg-[#FFB547]/10 hover:bg-[#FFB547]/20 border border-[#FFB547]/30 text-[#FFB547] transition-all flex items-center gap-1"
              title="Demo: fast-forward match expiration"
              aria-label="Demo: fast-forward match expiry"
            >
              <span aria-hidden="true">⚡</span>
              <span className="hidden lg:inline">Fast-Forward Expiry</span>
              <span className="hidden sm:inline lg:hidden">Expire</span>
            </button>
            <MatchCountdown endTime={currentMatch.endTime} />
            <div className="hidden sm:flex items-center gap-2 bg-[#1A2133] border border-[#3DD9B3]/30 px-3 py-1 rounded-full">
              <Identicon seed={opponent.avatarSeed} size={26} />
              <div className="text-left text-xs font-mono">
                <span className="text-[#3DD9B3] font-bold">{opponent.anonUsername}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6 sm:space-y-8 min-w-0">
            {/* Pomodoro Timer */}
            <Card variant="default" padding="lg" className="space-y-6 border-[#36425E]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2A3348] pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#3DD9B3]" aria-hidden="true" />
                  <h2 className="text-base font-bold text-[#F1F5F9] font-mono">
                    Pomodoro Focus Engine
                  </h2>
                </div>
                <Badge variant="teal" pulse>Active Session Logging</Badge>
              </div>
              <PomodoroTimer />
            </Card>

            {/* Live Progress */}
            <Card variant="default" padding="md" className="space-y-3 border-[#2A3348]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-[#FFB547]" aria-hidden="true" /> Your Active Progress
                </span>
                <span className="text-xs font-mono text-[#3DD9B3]">
                  Live score: {liveResult.finalScore} pts
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-[#222B42] border border-[#2A3348]">
                  <span className="text-[#94A3B8] text-[10px] block">Focus Time</span>
                  <span className="text-lg font-bold text-[#3DD9B3]">{liveResult.totalFocusMinutes}m</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#222B42] border border-[#2A3348]">
                  <span className="text-[#94A3B8] text-[10px] block">Sessions</span>
                  <span className="text-lg font-bold text-[#6C7CFF]">{liveResult.sessionsCompleted}</span>
                </div>
              </div>
              <p className="text-[10px] font-mono text-[#475569] text-center">
                Score = (1 × focus mins) + (15 × sessions)
              </p>
            </Card>

            {/* Session Log with interaction density flags */}
            {matchSessions.length > 0 && (
              <Card variant="default" padding="md" className="space-y-3 border-[#2A3348]">
                <div className="flex items-center justify-between border-b border-[#2A3348] pb-2">
                  <h2 className="text-xs font-mono font-bold text-[#F1F5F9] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#3DD9B3]" /> Completed Sessions
                  </h2>
                  <span className="text-[10px] font-mono text-[#475569]">
                    {matchSessions.length} session{matchSessions.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {matchSessions.map((session) => {
                    const isUnverified =
                      session.interactionCount === 0 ||
                      session.interactionCount === undefined;
                    return (
                      <div
                        key={session.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-mono border ${
                          isUnverified
                            ? 'bg-[#1A2133] border-[#FFB547]/20'
                            : 'bg-[#222B42] border-[#2A3348]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isUnverified ? (
                            <AlertTriangle
                              className="w-3.5 h-3.5 text-[#FFB547] shrink-0"
                              aria-label="Unverified session"
                            />
                          ) : (
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-[#3DD9B3] shrink-0"
                              aria-label="Verified session"
                            />
                          )}
                          <span className="text-[#F1F5F9]">
                            {session.durationMinutes}m session
                          </span>
                          {isUnverified && (
                            <span
                              className="text-[9px] font-mono text-[#FFB547] bg-[#FFB547]/10 border border-[#FFB547]/20 px-1.5 py-0.5 rounded-full"
                              title="No browser interactions detected. You may have been studying away from the screen — this is fine, but flagged transparently."
                            >
                              ⚠ unverified
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[#94A3B8]">
                          {session.interactionCount !== undefined && !isUnverified && (
                            <span className="text-[10px] text-[#475569]" title="Browser interactions logged">
                              {session.interactionCount} interactions
                            </span>
                          )}
                          <span className="text-[10px]">
                            {new Date(session.startedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Transparency note */}
                <p className="text-[10px] font-mono text-[#3C4B63] leading-relaxed border-t border-[#2A3348] pt-2">
                  ⚠ Unverified sessions had no browser activity detected. This may simply mean
                  you were reading or writing offline — sessions still count toward your score.
                  Only you can see this information.
                </p>
              </Card>
            )}

            {/* Task Manager */}
            <TaskManager />

            {/* Dev demo panel — floating, fixed bottom-right, null in production */}
            <DevDemoPanel />
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-8 min-w-0">
            <OpponentSidebar />
          </div>
        </div>
      </main>

      <footer className="border-t border-[#2A3348] py-6 text-center text-xs text-[#94A3B8] font-mono">
        KIITDual Platform &bull; Single-College 1v1 Active Match Workspace
      </footer>
    </div>
  );
};
