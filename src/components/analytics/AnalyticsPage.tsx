import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Clock3, Target, Trophy } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  AnalyticsRange,
  buildFocusTrend,
  buildOutcomeTrend,
  getMonthlyReport,
  getUtcMonthKey,
  getWeeklyGoalProgress,
} from '../../utils/analytics';
import { computeHistoryStats } from '../../utils/stats';
import { Card } from '../ui/Card';
import { Navbar } from '../navigation/Navbar';
import { Button } from '../ui/Button';
import { storage } from '../../services/storage';
import { isAnalyticsDemoAvailable } from '../../dev/analyticsDemo';

const RANGE_OPTIONS: { value: AnalyticsRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All history' },
];

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const formatChange = (difference: number, percentChange: number | null, unit: string) => {
  const amount = `${difference > 0 ? '+' : ''}${difference} ${unit}`;
  if (percentChange === null) return `${amount}; percentage change unavailable (previous value was 0)`;
  const percent = Math.round(percentChange);
  return `${amount} (${percent > 0 ? '+' : ''}${percent}% vs. previous month)`;
};

interface ChartSeries {
  key: 'focusMinutes' | 'wins' | 'losses';
  label: string;
  color: string;
}

interface ChartPoint {
  key: string;
  label: string;
  focusMinutes?: number;
  wins?: number;
  losses?: number;
}

const TrendChart: React.FC<{
  id: string;
  title: string;
  points: ChartPoint[];
  series: ChartSeries[];
  emptyMessage: string;
}> = ({ id, title, points, series, emptyMessage }) => {
  const hasRecordedValues = points.some((point) =>
    series.some((item) => (point[item.key] ?? 0) > 0)
  );
  const width = 720;
  const height = 250;
  const left = 42;
  const right = 18;
  const top = 20;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(1, ...points.flatMap((point) => series.map((item) => point[item.key] ?? 0)));
  const x = (index: number) =>
    left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => top + plotHeight - (value / maxValue) * plotHeight;
  const labelIndexes = points.length <= 5
    ? points.map((_, index) => index)
    : Array.from(new Set([0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1]));

  return (
    <Card variant="default" padding="md" className="space-y-4 min-w-0">
      <div>
        <h2 className="font-bold text-[#F1F5F9]">{title}</h2>
        <p className="text-xs text-[#94A3B8]">Dates and week starts use UTC.</p>
      </div>
      {!hasRecordedValues ? (
        <p className="rounded-xl border border-dashed border-[#36425E] p-6 text-sm text-[#94A3B8]" role="status">
          {emptyMessage}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-[#CBD5E1]" aria-label={`${title} legend`}>
            {series.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </div>
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto"
              role="img"
              aria-labelledby={id}
              aria-describedby={`${id}-description`}
            >
              <title id={id}>{title} trend chart</title>
              <desc id={`${id}-description`}>
                {series.map((item) => item.label).join(' and ')} by UTC date or week. Labels along the horizontal axis are dates; the vertical axis shows recorded amounts.
              </desc>
              {[0, 0.5, 1].map((fraction) => {
                const lineY = top + plotHeight * fraction;
                return (
                  <g key={fraction}>
                    <line x1={left} x2={width - right} y1={lineY} y2={lineY} stroke="#2A3348" />
                    <text x={left - 8} y={lineY + 4} textAnchor="end" fill="#94A3B8" fontSize="11">
                      {Math.round(maxValue * (1 - fraction))}
                    </text>
                  </g>
                );
              })}
              {series.map((item) => (
                <polyline
                  key={item.key}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={points.map((point, index) => `${x(index)},${y(point[item.key] ?? 0)}`).join(' ')}
                />
              ))}
              {labelIndexes.map((index) => (
                <text
                  key={points[index].key}
                  x={x(index)}
                  y={height - 10}
                  textAnchor="middle"
                  fill="#94A3B8"
                  fontSize="11"
                >
                  {points[index].label}
                </text>
              ))}
            </svg>
          </div>
        </>
      )}
    </Card>
  );
};

const ProgressItem: React.FC<{
  label: string;
  actual: number;
  target: number | null;
  remaining: number | null;
  percent: number | null;
  unit: string;
}> = ({ label, actual, target, remaining, percent, unit }) => {
  if (target === null || percent === null || remaining === null) {
    return (
      <div className="rounded-xl bg-[#0F1420] border border-[#2A3348] p-4">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-[#94A3B8] mt-1">No weekly target set</p>
        <p className="text-xs text-[#CBD5E1] mt-3">{actual} {unit} completed this week</p>
      </div>
    );
  }
  const achieved = remaining === 0;
  return (
    <div className="rounded-xl bg-[#0F1420] border border-[#2A3348] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold">{label}</p>
        <span className={`text-[10px] uppercase font-mono ${achieved ? 'text-[#3DD9B3]' : 'text-[#FFB547]'}`}>
          {achieved ? 'Achieved' : 'In progress'}
        </span>
      </div>
      <p className="text-sm font-mono text-[#F1F5F9]">
        {actual} / {target} {unit}
      </p>
      <div
        role="progressbar"
        aria-label={`${label} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        aria-valuetext={`${percent}% achieved`}
        className="h-2 rounded-full bg-[#2A3348] overflow-hidden"
      >
        <div
          className="h-full rounded-full bg-[#3DD9B3] transition-[width]"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <p className="text-xs text-[#94A3B8]">
        {percent}% achieved · {remaining} {unit} remaining
      </p>
    </div>
  );
};

export const AnalyticsPage: React.FC = () => {
  const {
    matchHistory,
    focusSessions,
    focusSessionHistory,
    personalGoals,
    updatePersonalGoals,
    isDemoDataLoaded,
    loadAnalyticsDemoData,
    resetAnalyticsDemoData,
  } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(getUtcMonthKey());
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [focusTarget, setFocusTarget] = useState(
    personalGoals.weeklyFocusTargetMinutes?.toString() ?? ''
  );
  const [sessionTarget, setSessionTarget] = useState(
    personalGoals.weeklySessionTarget?.toString() ?? ''
  );
  const [goalMessage, setGoalMessage] = useState('');
  const [demoMessage, setDemoMessage] = useState('');
  const [storageStatus, setStorageStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setStorageStatus(storage.isAvailable() ? 'ready' : 'error');
  }, []);

  useEffect(() => {
    setFocusTarget(personalGoals.weeklyFocusTargetMinutes?.toString() ?? '');
    setSessionTarget(personalGoals.weeklySessionTarget?.toString() ?? '');
  }, [personalGoals]);

  const sessions = useMemo(
    () => [...focusSessionHistory, ...focusSessions],
    [focusSessionHistory, focusSessions]
  );
  const report = useMemo(
    () => getMonthlyReport(matchHistory, selectedMonth),
    [matchHistory, selectedMonth]
  );
  const weeklyProgress = useMemo(
    () => getWeeklyGoalProgress(sessions, personalGoals),
    [sessions, personalGoals]
  );
  const focusTrend = useMemo(
    () => buildFocusTrend(sessions, range),
    [sessions, range]
  );
  const outcomeTrend = useMemo(
    () => buildOutcomeTrend(matchHistory, range),
    [matchHistory, range]
  );
  const overall = useMemo(() => computeHistoryStats(matchHistory), [matchHistory]);

  const saveGoals = () => {
    const parseTarget = (value: string): number | null | undefined => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    };
    const focus = parseTarget(focusTarget);
    const count = parseTarget(sessionTarget);
    if (focus === undefined || count === undefined) {
      setGoalMessage('Targets must be positive whole numbers, or left blank to remove them.');
      return;
    }
    if (!updatePersonalGoals({
      weeklyFocusTargetMinutes: focus,
      weeklySessionTarget: count,
    })) {
      setGoalMessage('Could not save these targets. Please check the values and try again.');
      return;
    }
    setGoalMessage('Weekly targets saved on this device for your current account.');
  };

  const loadDemoData = () => {
    setDemoMessage(
      loadAnalyticsDemoData()
        ? 'Synthetic demo activity loaded for this account. Existing non-demo activity was preserved.'
        : 'Demo data could not be loaded. Check browser storage and try again.'
    );
  };

  const resetDemoData = () => {
    setDemoMessage(
      resetAnalyticsDemoData()
        ? 'Synthetic demo activity removed. Your prior activity and pre-demo weekly goals were preserved.'
        : 'Demo data could not be reset. Check browser storage and try again.'
    );
  };

  const monthMetrics = [
    {
      label: 'Focus time',
      value: `${(report.current.totalFocusMinutes / 60).toFixed(1)}h`,
      detail: formatChange(report.changes.focusMinutes.difference, report.changes.focusMinutes.percentChange, 'min'),
      icon: <Clock3 className="w-4 h-4 text-[#3DD9B3]" aria-hidden="true" />,
    },
    {
      label: 'Completed matches',
      value: report.current.completedMatches,
      detail: formatChange(report.changes.completedMatches.difference, report.changes.completedMatches.percentChange, 'matches'),
      icon: <Trophy className="w-4 h-4 text-[#FFB547]" aria-hidden="true" />,
    },
    {
      label: 'Completed sessions',
      value: report.current.completedSessions,
      detail: formatChange(report.changes.completedSessions.difference, report.changes.completedSessions.percentChange, 'sessions'),
      icon: <BarChart3 className="w-4 h-4 text-[#6C7CFF]" aria-hidden="true" />,
    },
    {
      label: 'Completed tasks',
      value: report.current.completedTasks,
      detail: formatChange(report.changes.completedTasks.difference, report.changes.completedTasks.percentChange, 'tasks'),
      icon: <Target className="w-4 h-4 text-[#3DD9B3]" aria-hidden="true" />,
    },
  ];

  if (storageStatus !== 'ready') {
    return (
      <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
          <Card variant="default" padding="lg" role={storageStatus === 'error' ? 'alert' : 'status'}>
            {storageStatus === 'loading'
              ? 'Loading your device-local analytics…'
              : 'Browser storage is unavailable. Personal reports and weekly goals cannot be read or saved on this device.'}
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8">
        <header className="border-b border-[#2A3348] pb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-[#3DD9B3] mb-1">
            <BarChart3 className="w-4 h-4" aria-hidden="true" />
            <span>PERSONAL ACTIVITY</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Growth & Monthly Report</h1>
          <p className="text-sm text-[#94A3B8] mt-2">
            Personal activity is stored in this browser under your local account; it is not shared with other users.
          </p>
          {isAnalyticsDemoAvailable() && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={loadDemoData}>
                Load Demo Data
              </Button>
              {isDemoDataLoaded && (
                <Button variant="destructive" size="sm" onClick={resetDemoData}>
                  Reset Demo Data
                </Button>
              )}
              {demoMessage && <p role="status" className="text-xs text-[#CBD5E1]">{demoMessage}</p>}
            </div>
          )}
        </header>

        {isDemoDataLoaded && (
          <div className="rounded-xl border border-[#FFB547]/40 bg-[rgba(255,181,71,0.08)] p-4 text-sm text-[#FFB547]" role="status">
            Synthetic DEMO data is included in the charts and reports below. It is local to this signed-in browser account and is not shared.
          </div>
        )}

        <section aria-labelledby="monthly-report-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 id="monthly-report-heading" className="text-lg font-bold">Monthly report</h2>
              <p className="text-xs text-[#94A3B8]">UTC calendar months · compared with the immediately preceding month</p>
            </div>
            <label className="text-xs text-[#CBD5E1] flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#6C7CFF]" aria-hidden="true" />
              <span className="sr-only">Select report month</span>
              <input
                type="month"
                max={getUtcMonthKey()}
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="rounded-lg border border-[#36425E] bg-[#161D2D] px-3 py-2 text-sm text-[#F1F5F9]"
              />
            </label>
          </div>
          <p className="text-sm font-mono text-[#3DD9B3]">{formatMonth(selectedMonth)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {monthMetrics.map((metric) => (
              <Card key={metric.label} variant="default" padding="sm" className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                  {metric.icon}
                  {metric.label}
                </div>
                <p className="text-2xl font-bold font-mono">{metric.value}</p>
                <p className="text-[11px] leading-relaxed text-[#94A3B8]">{metric.detail}</p>
              </Card>
            ))}
          </div>
          <Card variant="default" padding="md" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[#94A3B8]">Wins / losses / draws</p>
              <p className="font-mono font-bold mt-1">{report.current.wins} / {report.current.losses} / {report.current.draws}</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Win rate</p>
              <p className="font-mono font-bold mt-1">{report.current.winRate === null ? '—' : `${report.current.winRate}%`}</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Average session</p>
              <p className="font-mono font-bold mt-1">{report.current.averageSessionMinutes === null ? '—' : `${report.current.averageSessionMinutes}m`}</p>
            </div>
            <div>
              <p className="text-xs text-[#94A3B8]">Previous month</p>
              <p className="font-mono font-bold mt-1">{formatMonth(shiftMonth(selectedMonth, -1))}</p>
            </div>
          </Card>
        </section>

        <section aria-labelledby="growth-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 id="growth-heading" className="text-lg font-bold">Progress over time</h2>
              <p className="text-xs text-[#94A3B8]">
                {overall.totalMatches} recorded matches · {overall.totalSessions} completed sessions
              </p>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Select chart date range">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={range === option.value}
                  onClick={() => setRange(option.value)}
                  className={`rounded-lg px-3 py-2 text-xs font-mono border ${
                    range === option.value
                      ? 'border-[#3DD9B3]/50 bg-[#222B42] text-[#3DD9B3]'
                      : 'border-[#2A3348] text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-[#94A3B8]">
            Session-level focus charts include recorded session timestamps from this release onward. Older match records only contain monthly/match totals, so unavailable daily history is not reconstructed.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
            <TrendChart
              id="focus-trend"
              title="Focus time"
              points={focusTrend}
              series={[{ key: 'focusMinutes', label: 'Focus minutes', color: '#3DD9B3' }]}
              emptyMessage="No completed focus sessions are recorded in this date range."
            />
            <TrendChart
              id="outcome-trend"
              title="Match outcomes"
              points={outcomeTrend}
              series={[
                { key: 'wins', label: 'Wins', color: '#3DD9B3' },
                { key: 'losses', label: 'Losses', color: '#FF7A7A' },
              ]}
              emptyMessage="No completed match outcomes are recorded in this date range."
            />
          </div>
        </section>

        <section aria-labelledby="goals-heading" className="space-y-4">
          <div>
            <h2 id="goals-heading" className="text-lg font-bold">Weekly goals</h2>
            <p className="text-xs text-[#94A3B8]">
              Week runs Monday to Sunday in UTC. Progress resets by date; activity history is kept.
              Current week began {new Date(weeklyProgress.weekStartsAt).toLocaleDateString(undefined, { timeZone: 'UTC' })}.
            </p>
          </div>
          <Card variant="default" padding="md" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1">
                <span className="block text-xs text-[#CBD5E1]">Weekly focus-time target (minutes)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={focusTarget}
                  onChange={(event) => setFocusTarget(event.target.value)}
                  placeholder="Leave blank to remove"
                  aria-label="Weekly focus-time target in minutes"
                  className="w-full rounded-lg border border-[#36425E] bg-[#0F1420] px-3 py-2 text-sm text-[#F1F5F9]"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-xs text-[#CBD5E1]">Weekly completed-session target (optional)</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={sessionTarget}
                  onChange={(event) => setSessionTarget(event.target.value)}
                  placeholder="Leave blank to remove"
                  aria-label="Weekly completed-session target"
                  className="w-full rounded-lg border border-[#36425E] bg-[#0F1420] px-3 py-2 text-sm text-[#F1F5F9]"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="teal" size="sm" onClick={saveGoals}>Save weekly targets</Button>
              {goalMessage && <p role="status" className="text-xs text-[#94A3B8]">{goalMessage}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProgressItem
                label="Focus time"
                actual={weeklyProgress.focusMinutes}
                target={weeklyProgress.focusTargetMinutes}
                remaining={weeklyProgress.focusMinutesRemaining}
                percent={weeklyProgress.focusPercentAchieved}
                unit="minutes"
              />
              <ProgressItem
                label="Completed sessions"
                actual={weeklyProgress.completedSessions}
                target={weeklyProgress.sessionTarget}
                remaining={weeklyProgress.sessionsRemaining}
                percent={weeklyProgress.sessionsPercentAchieved}
                unit="sessions"
              />
            </div>
          </Card>
        </section>

        <aside className="rounded-xl border border-[#36425E] bg-[#161D2D] p-4 text-xs text-[#94A3B8]" role="note">
          Matchmaking and results in this build are simulated and stored locally. No global leaderboard is shown because there is no connected shared data service; a real leaderboard requires an authenticated, privacy-limited backend endpoint.
        </aside>
      </main>
    </div>
  );
};

const shiftMonth = (month: string, offset: number) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};
