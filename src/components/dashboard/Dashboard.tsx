import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Identicon } from '../ui/Identicon';
import { Navbar } from '../navigation/Navbar';
import { computeHistoryStats } from '../../utils/stats';
import {
  Zap,
  Flame,
  Clock,
  Trophy,
  Target,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Sparkles,
} from 'lucide-react';

const RECENT_MATCH_LIMIT = 6;

export const Dashboard: React.FC = () => {
  const {
    currentStreak,
    currentMatch,
    matchHistory,
    openMatchmakingModal,
    setActiveView,
    viewScorecard,
  } = useApp();


  // Same shared calculation as the History / analytics page.
  const stats = useMemo(() => computeHistoryStats(matchHistory), [matchHistory]);
  const recentMatches = matchHistory.slice(0, RECENT_MATCH_LIMIT);

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col">
      {/* 1. HEADER / NAVBAR */}
      <Navbar />


      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-8 space-y-8">
        {/* 2. HERO / MATCHMAKING SECTION */}
        {currentMatch ? (
          /* ACTIVE MATCH BANNER */
          <Card variant="activeMatch" padding="lg" className="relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-xl">
                <Badge variant="teal" pulse>
                  <Zap className="w-3.5 h-3.5 inline mr-1" />
                  Active 24h Focus Match Running
                </Badge>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#F1F5F9] tracking-tight">
                  Your Focus Match is Active!
                </h2>
                <p className="text-xs sm:text-sm text-[#94A3B8]">
                  You are paired with{' '}
                  <span className="font-mono text-[#3DD9B3] font-bold">
                    {currentMatch.user2Profile.anonUsername}
                  </span>
                  . Log focus sessions and check off tasks to build your score.
                </p>
              </div>

              {/* Opponent Card & Enter Button */}
              <div className="flex items-center gap-4 bg-[#1A2133]/90 border border-[#6C7CFF]/30 p-4 rounded-2xl shrink-0 min-w-0">
                <Identicon seed={currentMatch.user2Profile.avatarSeed} size={54} hasGlow />
                <div className="space-y-2 min-w-0">
                  <div className="text-xs font-mono text-[#94A3B8] break-all">
                    Opponent: <span className="text-[#F1F5F9]">{currentMatch.user2Profile.anonUsername}</span>
                  </div>
                  <Button
                    variant="teal"
                    size="md"
                    onClick={() => setActiveView('active_match_workspace')}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Enter Match
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          /* NO ACTIVE MATCH HERO */
          <Card variant="default" padding="lg" className="relative overflow-hidden border-[#36425E]">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#6C7CFF]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl">
                <Badge variant="teal" pulse>
                  <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                  Anonymous 1v1 Peer Accountability
                </Badge>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-[#F1F5F9] tracking-tight leading-tight">
                  Ready to focus?
                </h1>
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  Find an anonymous KIIT study partner and make your next 24 hours count. Time-boxed goals, zero social pressure, private scorecards.
                </p>
              </div>

              <div className="shrink-0">
                <Button
                  variant="teal"
                  size="lg"
                  onClick={openMatchmakingModal}
                  icon={<Sparkles className="w-5 h-5 text-[#0F1420]" />}
                  className="shadow-[0_0_24px_rgba(61,217,179,0.3)] hover:scale-105"
                >
                  Find a Focus Partner
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* 3. STUDENT STATISTICS BAR */}
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between border-b border-[#2A3348] pb-2">
            <h2 className="text-base font-bold text-[#F1F5F9] uppercase tracking-wider font-mono flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#FFB547]" aria-hidden="true" />
              Study Performance Metrics
            </h2>
            <span className="text-xs text-[#94A3B8] font-mono">CAMPUS PILOT STATS</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card variant="default" padding="sm" className="space-y-1">
              <span className="text-xs text-[#94A3B8] font-mono block">Match Streak</span>
              <div className="text-2xl font-bold font-mono text-[#FFB547] flex items-center gap-1">
                <Flame className="w-5 h-5 text-[#FFB547]" aria-hidden="true" />
                {currentStreak}
              </div>
            </Card>

            <Card variant="default" padding="sm" className="space-y-1">
              <span className="text-xs text-[#94A3B8] font-mono block">Focus Hours</span>
              <div className="text-2xl font-bold font-mono text-[#3DD9B3] flex items-center gap-1">
                <Clock className="w-5 h-5 text-[#3DD9B3]" aria-hidden="true" />
                {stats.totalFocusHours}h
              </div>
            </Card>

            <Card variant="default" padding="sm" className="space-y-1">
              <span className="text-xs text-[#94A3B8] font-mono block">Total Matches</span>
              <div className="text-2xl font-bold font-mono text-[#6C7CFF]">
                {stats.totalMatches}
              </div>
            </Card>

            <Card variant="default" padding="sm" className="space-y-1">
              <span className="text-xs text-[#94A3B8] font-mono block">Wins</span>
              <div className="text-2xl font-bold font-mono text-[#3DD9B3]">
                {stats.wins}
              </div>
            </Card>

            <Card variant="default" padding="sm" className="space-y-1">
              <span className="text-xs text-[#94A3B8] font-mono block">Losses / Draws</span>
              <div className="text-2xl font-bold font-mono text-[#94A3B8]">
                {stats.losses} / {stats.draws}
              </div>
            </Card>

            <Card variant="default" padding="sm" className="space-y-1">
              <span className="text-xs text-[#94A3B8] font-mono block">Avg Session</span>
              <div className="text-2xl font-bold font-mono text-[#F1F5F9] flex items-center gap-1">
                <Target className="w-4 h-4 text-[#6C7CFF]" aria-hidden="true" />
                {stats.totalSessions > 0 ? `${stats.avgSessionMinutes}m` : '—'}
              </div>
            </Card>
          </div>
        </section>

        {/* 4. RECENT MATCH HISTORY */}
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between border-b border-[#2A3348] pb-2">
            <h2 className="text-base font-bold text-[#F1F5F9] uppercase tracking-wider font-mono flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6C7CFF]" aria-hidden="true" />
              Recent Match History
            </h2>
            {matchHistory.length > RECENT_MATCH_LIMIT ? (
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className="text-xs text-[#6C7CFF] hover:text-[#3DD9B3] font-mono inline-flex items-center gap-1 rounded"
              >
                View all {matchHistory.length} <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : (
              <span className="text-xs text-[#94A3B8] font-mono">PRIVATE SCORECARDS</span>
            )}
          </div>

          {matchHistory.length === 0 ? (
            <Card variant="default" padding="lg" className="text-center py-12 space-y-3">
              <Clock className="w-8 h-8 text-[#475569] mx-auto" />
              <p className="text-sm text-[#94A3B8]">No matches completed yet.</p>
              <p className="text-xs text-[#94A3B8]">
                {currentMatch
                  ? 'Your first result will appear here when the active match ends.'
                  : 'Click "Find a Focus Partner" above to get started!'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentMatches.map((item) => (
                <Card
                  variant="interactive"
                  padding="md"
                  key={item.match.id}
                  className="space-y-4 cursor-pointer hover:border-[#6C7CFF]/60 group transition-all"
                  onClick={() => viewScorecard(item)}
                  aria-label={`View scorecard vs ${item.match.user2Profile.anonUsername}: ${
                    item.isWinner ? 'Victory' : item.isDraw ? 'Draw' : 'Defeat'
                  }, ${item.userResult.finalScore} to ${item.opponentResult.finalScore}`}
                >
                  {/* Card Top Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Identicon seed={item.match.user2Profile.avatarSeed} size={36} />
                      <div>
                        <span className="text-xs font-mono font-bold text-[#F1F5F9] block">
                          {item.match.user2Profile.anonUsername}
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                          {new Date(item.completedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Result Badge */}
                    {item.isWinner ? (
                      <Badge variant="teal" className="flex items-center gap-1 font-mono">
                        <CheckCircle2 className="w-3 h-3 text-[#3DD9B3]" /> Victory
                      </Badge>
                    ) : item.isDraw ? (
                      <Badge variant="neutral" className="flex items-center gap-1 font-mono">
                        <MinusCircle className="w-3 h-3 text-[#94A3B8]" /> Draw
                      </Badge>
                    ) : (
                      <Badge variant="coral" className="flex items-center gap-1 font-mono">
                        <XCircle className="w-3 h-3 text-[#FF7A7A]" /> Defeat
                      </Badge>
                    )}
                  </div>

                  {/* Score Summary */}
                  <div className="p-3 rounded-xl bg-[#222B42] border border-[#2A3348] flex items-center justify-between font-mono text-xs">
                    <div>
                      <span className="text-[#94A3B8] block text-[10px]">Your Score</span>
                      <span className="text-base font-bold text-[#3DD9B3]">
                        {item.userResult.finalScore} pts
                      </span>
                    </div>

                    <span className="text-[#475569]">vs</span>

                    <div className="text-right">
                      <span className="text-[#94A3B8] block text-[10px]">Opponent</span>
                      <span className="text-base font-bold text-[#94A3B8]">
                        {item.opponentResult.finalScore} pts
                      </span>
                    </div>
                  </div>

                  {/* Metric Chips */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono text-[#94A3B8]">
                    <div className="p-1.5 rounded-lg bg-[#1A2133] border border-[#2A3348]">
                      <span className="block text-[#F1F5F9] font-bold">
                        {item.userResult.totalFocusMinutes}m
                      </span>
                      <span>Focus</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#1A2133] border border-[#2A3348]">
                      <span className="block text-[#F1F5F9] font-bold">
                        {item.userResult.tasksCompleted}
                      </span>
                      <span>Tasks</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#1A2133] border border-[#2A3348]">
                      <span className="block text-[#F1F5F9] font-bold">
                        {item.userResult.sessionsCompleted}
                      </span>
                      <span>Sessions</span>
                    </div>
                  </div>

                  {/* View Scorecard Footer Hint */}
                  <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-[#6C7CFF] group-hover:text-[#3DD9B3] transition-colors border-t border-[#2A3348]/60">
                    <span>View Private Scorecard</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>


      {/* Footer */}
      <footer className="border-t border-[#2A3348] py-6 text-center text-xs text-[#94A3B8] font-mono">
        KIITDual Platform &bull; Single-College 1v1 Pilot Dashboard
      </footer>
    </div>
  );
};
