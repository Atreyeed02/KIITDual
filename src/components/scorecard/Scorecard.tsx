import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Identicon } from '../ui/Identicon';
import {
  Trophy,
  Flame,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  ListChecks,
  Activity,
  Sparkles,
  LayoutDashboard,
  Lock,
} from 'lucide-react';
import { getScoreBreakdown } from '../../utils/scoring';

export const Scorecard: React.FC = () => {
  const {
    activeScorecard,
    currentMatch,
    currentStreak,
    returnToDashboard,
    findAnotherPartnerFromScorecard,
  } = useApp();

  // Multi-step animated reveal state
  const [animationStep, setAnimationStep] = useState<number>(0);
  const [displayUserScore, setDisplayUserScore] = useState<number>(0);
  const [displayOppScore, setDisplayOppScore] = useState<number>(0);
  const [displayUserFocus, setDisplayUserFocus] = useState<number>(0);
  const [displayOppFocus, setDisplayOppFocus] = useState<number>(0);

  const scorecard = activeScorecard;

  useEffect(() => {
    let counter: ReturnType<typeof setInterval> | null = null;
    setAnimationStep(0);

    // Step 1: Initial Reveal
    const t1 = setTimeout(() => setAnimationStep(1), 200);

    // Step 2: Animate numbers upward
    const t2 = setTimeout(() => {
      setAnimationStep(2);

      if (scorecard) {
        const targetUserScore = scorecard.userResult.finalScore;
        const targetOppScore = scorecard.opponentResult.finalScore;
        const targetUserFocus = scorecard.userResult.totalFocusMinutes;
        const targetOppFocus = scorecard.opponentResult.totalFocusMinutes;

        const durationMs = 1200;
        const steps = 30;
        const intervalMs = durationMs / steps;
        let currentStep = 0;

        counter = setInterval(() => {
          currentStep++;
          const progress = Math.min(1, currentStep / steps);
          const easeOutQuad = 1 - (1 - progress) * (1 - progress);

          setDisplayUserScore(Math.round(targetUserScore * easeOutQuad * 10) / 10);
          setDisplayOppScore(Math.round(targetOppScore * easeOutQuad * 10) / 10);
          setDisplayUserFocus(Math.round(targetUserFocus * easeOutQuad));
          setDisplayOppFocus(Math.round(targetOppFocus * easeOutQuad));

          if (progress >= 1) {
            if (counter) clearInterval(counter);
            setDisplayUserScore(targetUserScore);
            setDisplayOppScore(targetOppScore);
            setDisplayUserFocus(targetUserFocus);
            setDisplayOppFocus(targetOppFocus);
          }
        }, intervalMs);
      }
    }, 600);

    // Step 3: Reveal Final Verdict & Streak
    const t3 = setTimeout(() => setAnimationStep(3), 1900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (counter) clearInterval(counter);
    };
  }, [scorecard]);

  if (!scorecard) {
    return (
      <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex items-center justify-center p-4">
        <Card variant="default" padding="lg" className="text-center space-y-4 max-w-md">
          <p className="text-sm text-[#94A3B8]">No completed match scorecard found.</p>
          <Button variant="primary" onClick={returnToDashboard}>
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const { match, userResult, opponentResult, isWinner, isDraw } = scorecard;
  const opponent = match.user2Profile;
  // The identity used in *this* match (stays correct after regenerating identity).
  const me = match.user1Profile;
  const myHandle = me.anonUsername || 'You';

  // Subtotals from the single score engine
  const userBreakdown = getScoreBreakdown(
    userResult.totalFocusMinutes,
    userResult.tasksCompleted,
    userResult.sessionsCompleted
  );
  const oppBreakdown = getScoreBreakdown(
    opponentResult.totalFocusMinutes,
    opponentResult.tasksCompleted,
    opponentResult.sessionsCompleted
  );
  const userFocusPoints = userBreakdown.focusPoints;
  const oppFocusPoints = oppBreakdown.focusPoints;
  const userTaskPoints = userBreakdown.taskPoints;
  const oppTaskPoints = oppBreakdown.taskPoints;
  const userSessionPoints = userBreakdown.sessionPoints;
  const oppSessionPoints = oppBreakdown.sessionPoints;

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div
        className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none transition-opacity duration-1000 ${
          isWinner
            ? 'bg-[#3DD9B3]/15'
            : isDraw
            ? 'bg-[#FFB547]/15'
            : 'bg-[#FF7A7A]/15'
        }`}
      />

      <div className="max-w-3xl w-full space-y-6 relative z-10">
        {/* TOP PRIVACY & STATUS BAR */}
        <div className="flex flex-wrap gap-2 items-center justify-between px-2">
          <div className="flex items-center gap-2 text-xs font-mono text-[#94A3B8] bg-[#1A2133] border border-[#2A3348] px-3 py-1.5 rounded-full">
            <Lock className="w-3.5 h-3.5 text-[#3DD9B3]" />
            <span>Private Match Result</span>
          </div>

          <span className="text-xs font-mono text-[#94A3B8]">
            {new Date(scorecard.completedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>

        {/* MAIN SCORECARD CONTAINER */}
        <Card
          variant="default"
          padding="lg"
          className="space-y-8 border-[#36425E] shadow-2xl backdrop-blur-xl bg-[#161D2D]/90"
        >
          {/* 1. VERDICT BANNER */}
          <div
            className={`text-center space-y-3 transition-all duration-700 ${
              animationStep >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            {isWinner ? (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[rgba(61,217,179,0.15)] border border-[#3DD9B3] text-[#3DD9B3] font-mono text-xs font-bold animate-pulse-teal">
                  <Sparkles className="w-3.5 h-3.5" />
                  MATCH VICTORY
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#F1F5F9] font-sans">
                  Outstanding Focus!
                </h1>
                <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                  You outpaced your accountability partner and won the 24-hour match.
                </p>
              </div>
            ) : isDraw ? (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[rgba(255,181,71,0.15)] border border-[#FFB547] text-[#FFB547] font-mono text-xs font-bold">
                  <MinusCircle className="w-3.5 h-3.5" />
                  DEAD HEAT DRAW
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#F1F5F9] font-sans">
                  Evenly Matched!
                </h1>
                <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                  Both participants finished with identical weighted focus scores.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[rgba(255,122,122,0.15)] border border-[#FF7A7A] text-[#FF7A7A] font-mono text-xs font-bold">
                  <XCircle className="w-3.5 h-3.5" />
                  MATCH COMPLETE
                </div>
                <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-[#F1F5F9] font-sans">
                  Great Effort!
                </h1>
                <p className="text-xs sm:text-sm text-[#94A3B8] max-w-md mx-auto">
                  Every minute spent studying counts toward your personal mastery.
                </p>
              </div>
            )}
          </div>

          {/* 2. HEAD-TO-HEAD TOTAL SCORE COMPARISON */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* YOU CARD */}
            <div
              className={`p-6 rounded-2xl border transition-all duration-500 ${
                isWinner
                  ? 'bg-gradient-to-b from-[#222B42] to-[#1A2133] border-[#3DD9B3] shadow-[0_0_24px_rgba(61,217,179,0.2)]'
                  : 'bg-[#1A2133] border-[#2A3348]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Identicon seed={me.avatarSeed} size={42} />
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase text-[#94A3B8] block">
                      You (Participant 1)
                    </span>
                    <span className="text-sm font-bold font-mono text-[#F1F5F9] break-all">{myHandle}</span>
                  </div>
                </div>
                {isWinner && (
                  <Badge variant="teal" className="flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Winner
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono text-[#94A3B8]">Final Weighted Score</span>
                <div className="text-4xl sm:text-5xl font-black font-mono text-[#3DD9B3] tracking-tight tabular-nums">
                  {animationStep >= 2 ? displayUserScore : 0}{' '}
                  <span className="text-lg font-normal text-[#94A3B8]">pts</span>
                </div>
              </div>
            </div>

            {/* OPPONENT CARD */}
            <div
              className={`p-6 rounded-2xl border transition-all duration-500 ${
                !isWinner && !isDraw
                  ? 'bg-gradient-to-b from-[#222B42] to-[#1A2133] border-[#FFB547] shadow-[0_0_24px_rgba(255,181,71,0.2)]'
                  : 'bg-[#1A2133] border-[#2A3348]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Identicon seed={opponent.avatarSeed} size={42} />
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase text-[#94A3B8] block">
                      Opponent (Participant 2)
                    </span>
                    <span className="text-sm font-bold font-mono text-[#94A3B8] break-all">
                      {opponent.anonUsername}
                    </span>
                  </div>
                </div>
                {!isWinner && !isDraw && (
                  <Badge variant="amber" className="flex items-center gap-1 font-mono">
                    <Trophy className="w-3.5 h-3.5" /> Winner
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono text-[#94A3B8]">Final Weighted Score</span>
                <div className="text-4xl sm:text-5xl font-black font-mono text-[#F1F5F9] tracking-tight tabular-nums">
                  {animationStep >= 2 ? displayOppScore : 0}{' '}
                  <span className="text-lg font-normal text-[#94A3B8]">pts</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. DETAILED METRIC BREAKDOWN TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#2A3348] pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-[#94A3B8] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#6C7CFF]" />
                Detailed Performance Breakdown
              </h3>
              <span className="text-[11px] font-mono text-[#475569]">SRS FORMULA v1.0</span>
            </div>

            <div className="divide-y divide-[#2A3348] border border-[#2A3348] rounded-xl overflow-hidden bg-[#1A2133]">
              {/* Row 1: Focus Minutes */}
              <div className="grid grid-cols-3 p-3.5 text-xs font-mono items-center hover:bg-[#222B42]/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#3DD9B3]" />
                  <div>
                    <span className="text-[#F1F5F9] block font-medium">Focus Minutes</span>
                    <span className="text-[10px] text-[#94A3B8]">0.5 pts / min</span>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-[#3DD9B3]">
                    {animationStep >= 2 ? displayUserFocus : 0}m
                  </span>
                  <span className="text-[10px] text-[#94A3B8] block">+{userFocusPoints} pts</span>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-[#94A3B8]">
                    {animationStep >= 2 ? displayOppFocus : 0}m
                  </span>
                  <span className="text-[10px] text-[#8A96AB] block">+{oppFocusPoints} pts</span>
                </div>
              </div>

              {/* Row 2: Tasks Completed */}
              <div className="grid grid-cols-3 p-3.5 text-xs font-mono items-center hover:bg-[#222B42]/50 transition-colors">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-[#6C7CFF]" />
                  <div>
                    <span className="text-[#F1F5F9] block font-medium">Tasks Completed</span>
                    <span className="text-[10px] text-[#94A3B8]">30 pts / task</span>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-[#6C7CFF]">
                    {userResult.tasksCompleted}
                  </span>
                  <span className="text-[10px] text-[#94A3B8] block">+{userTaskPoints} pts</span>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-[#94A3B8]">
                    {opponentResult.tasksCompleted}
                  </span>
                  <span className="text-[10px] text-[#8A96AB] block">+{oppTaskPoints} pts</span>
                </div>
              </div>

              {/* Row 3: Completed Pomodoro Sessions */}
              <div className="grid grid-cols-3 p-3.5 text-xs font-mono items-center hover:bg-[#222B42]/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#FFB547]" />
                  <div>
                    <span className="text-[#F1F5F9] block font-medium">Focus Sessions</span>
                    <span className="text-[10px] text-[#94A3B8]">10 pts / session</span>
                  </div>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-[#FFB547]">
                    {userResult.sessionsCompleted}
                  </span>
                  <span className="text-[10px] text-[#94A3B8] block">+{userSessionPoints} pts</span>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-[#94A3B8]">
                    {opponentResult.sessionsCompleted}
                  </span>
                  <span className="text-[10px] text-[#8A96AB] block">+{oppSessionPoints} pts</span>
                </div>
              </div>

              {/* Total Summary Row */}
              <div className="grid grid-cols-3 p-4 text-xs font-mono items-center bg-[#222B42]/80">
                <div className="font-bold text-[#F1F5F9]">Total Final Score</div>
                <div className="text-center font-bold text-base text-[#3DD9B3]">
                  {userResult.finalScore} pts
                </div>
                <div className="text-center font-bold text-base text-[#94A3B8]">
                  {opponentResult.finalScore} pts
                </div>
              </div>
            </div>
          </div>

          {/* 4. STREAK BADGE & PRIVACY GUARANTEE */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-[#1A2133] border border-[#2A3348]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFB547]/15 border border-[#FFB547]/30 flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-[#FFB547]" />
              </div>
              <div>
                <span className="text-xs font-mono text-[#94A3B8] block">Study Streak</span>
                <span className="text-sm font-bold font-mono text-[#FFB547]">
                  {currentStreak} Consecutive {currentStreak === 1 ? 'Match' : 'Matches'} Completed
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#94A3B8] sm:text-right">
              <ShieldCheck className="w-4 h-4 text-[#3DD9B3] shrink-0" />
              <span>Only you and {opponent.anonUsername} can see this result.</span>
            </div>
          </div>

          {/* 5. ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={returnToDashboard}
              icon={<LayoutDashboard className="w-4 h-4" />}
            >
              Back to Dashboard
            </Button>

            <Button
              variant="teal"
              size="lg"
              onClick={findAnotherPartnerFromScorecard}
              icon={<ArrowRight className="w-4 h-4" />}
              className="shadow-[0_0_20px_rgba(61,217,179,0.3)] hover:scale-105"
            >
              {currentMatch ? 'Return to Active Match' : 'Find Another Focus Partner'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
