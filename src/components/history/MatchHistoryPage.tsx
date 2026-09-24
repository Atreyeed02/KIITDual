import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Identicon } from '../ui/Identicon';
import { Navbar } from '../navigation/Navbar';
import {
  History,
  Trophy,
  Flame,
  Clock,
  Target,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowRight,
  Filter,
  Search,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { computeHistoryStats, getOutcome } from '../../utils/stats';

export const MatchHistoryPage: React.FC = () => {
  const {
    matchHistory,
    currentMatch,
    currentStreak,
    viewScorecard,
    openMatchmakingModal,
  } = useApp();

  const [filterResult, setFilterResult] = useState<'all' | 'win' | 'loss' | 'draw'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Computed summary metrics (shared with the Dashboard)
  const { wins, losses, draws, winRate, totalFocusMinutes: totalFocusMins, totalFocusHours, totalTasks } =
    useMemo(() => computeHistoryStats(matchHistory), [matchHistory]);

  // Filtered list based on search and result type filter
  const filteredHistory = useMemo(() => {
    return matchHistory.filter((item) => {
      // Result filter
      if (filterResult !== 'all' && getOutcome(item) !== filterResult) return false;

      // Search query (opponent username or date string)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const opponentName = item.match.user2Profile.anonUsername.toLowerCase();
        const dateStr = new Date(item.completedAt).toLocaleDateString().toLowerCase();
        if (!opponentName.includes(query) && !dateStr.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [matchHistory, filterResult, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Page Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2A3348] pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#3DD9B3] mb-1">
              <History className="w-4 h-4" />
              <span>COMPLETED MATCH LOGS</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#F1F5F9]">
              Match History & Archives
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
              Review detailed private scorecards, study efficiency, and head-to-head performance.
            </p>
          </div>

          <Button
            variant="teal"
            size="md"
            onClick={openMatchmakingModal}
            icon={<Sparkles className="w-4 h-4" />}
          >
            {currentMatch ? 'Resume Active Match' : 'New Focus Match'}
          </Button>
        </div>

        {/* Analytics & Streak Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card variant="default" padding="sm" className="space-y-1">
            <span className="text-xs text-[#94A3B8] font-mono flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-[#FFB547]" /> Win Rate
            </span>
            <div className="text-2xl font-bold font-mono text-[#3DD9B3]">{winRate}%</div>
            <span className="text-[10px] text-[#94A3B8] block font-mono">
              {wins}W - {losses}L - {draws}D
            </span>
          </Card>

          <Card variant="default" padding="sm" className="space-y-1">
            <span className="text-xs text-[#94A3B8] font-mono flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#6C7CFF]" /> Total Focus
            </span>
            <div className="text-2xl font-bold font-mono text-[#F1F5F9]">{totalFocusHours}h</div>
            <span className="text-[10px] text-[#94A3B8] block font-mono">
              {totalFocusMins} total minutes
            </span>
          </Card>

          <Card variant="default" padding="sm" className="space-y-1">
            <span className="text-xs text-[#94A3B8] font-mono flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-[#3DD9B3]" /> Tasks Completed
            </span>
            <div className="text-2xl font-bold font-mono text-[#6C7CFF]">{totalTasks}</div>
            <span className="text-[10px] text-[#94A3B8] block font-mono">across all matches</span>
          </Card>

          <Card variant="default" padding="sm" className="space-y-1">
            <span className="text-xs text-[#94A3B8] font-mono flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-[#FFB547]" /> Active Streak
            </span>
            <div className="text-2xl font-bold font-mono text-[#FFB547]">{currentStreak}</div>
            <span className="text-[10px] text-[#94A3B8] block font-mono">Consecutive completed matches</span>
          </Card>
        </div>

        {/* Filters & Search Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#161D2D] p-4 rounded-2xl border border-[#2A3348]">
          {/* Result Filter Tabs */}
          <div
            role="group"
            aria-label="Filter by result"
            className="flex items-center gap-1 bg-[#0F1420] p-1 rounded-xl border border-[#2A3348] w-full sm:w-auto"
          >
            {(['all', 'win', 'loss', 'draw'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterResult(type)}
                aria-pressed={filterResult === type}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-mono transition-all capitalize ${
                  filterResult === type
                    ? 'bg-[#222B42] text-[#3DD9B3] font-bold border border-[#3DD9B3]/40'
                    : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
              >
                {type === 'all' ? 'All' : type === 'loss' ? 'losses' : type + 's'}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              aria-label="Search by partner username or date"
              placeholder="Search partner username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0F1420] border border-[#2A3348] rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-[#F1F5F9] focus:outline-none focus:border-[#6C7CFF] focus:ring-1 focus:ring-[#6C7CFF]"
            />
          </div>
        </div>

        {/* Match History Cards Grid / Empty State */}
        {filteredHistory.length === 0 ? (
          <Card variant="default" padding="lg" className="text-center py-16 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#1A2133] border border-[#2A3348] flex items-center justify-center mx-auto text-[#94A3B8]">
              <Filter className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#F1F5F9]">No match history found</h3>
              <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
                {matchHistory.length === 0
                  ? "You haven't completed any 1v1 focus matches yet. Start a search to challenge a study partner!"
                  : "No completed matches matched your active search filters."}
              </p>
            </div>
            {matchHistory.length === 0 ? (
              <Button variant="teal" size="md" onClick={openMatchmakingModal}>
                {currentMatch ? 'Resume Active Match' : 'Find a Focus Partner'}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilterResult('all');
                  setSearchQuery('');
                }}
              >
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHistory.map((item) => (
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
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Identicon seed={item.match.user2Profile.avatarSeed} size={36} />
                    <div>
                      <span className="text-xs font-mono font-bold text-[#F1F5F9] block">
                        {item.match.user2Profile.anonUsername}
                      </span>
                      <span className="text-[10px] text-[#94A3B8] flex items-center gap-1">
                        <Calendar className="w-3 h-3 inline" />
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

                {/* Score comparison pill */}
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

                {/* Performance stats row */}
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

                {/* Footer hint */}
                <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-[#6C7CFF] group-hover:text-[#3DD9B3] transition-colors border-t border-[#2A3348]/60">
                  <span>View Full Scorecard</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-[#2A3348] py-6 text-center text-xs text-[#94A3B8] font-mono mt-auto">
        KIITDual Platform &bull; Match History Archives
      </footer>
    </div>
  );
};
