import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Identicon } from '../ui/Identicon';
import { ShieldCheck, Flame, LogOut, AlertTriangle } from 'lucide-react';

/** Simulated opponent activity cadence (ms). Runs only while the workspace is mounted. */
const ACTIVITY_MIN_DELAY_MS = 35000;
const ACTIVITY_MAX_DELAY_MS = 75000;

export const OpponentSidebar: React.FC = () => {
  const { currentMatch, activityEvents, sendReaction, forfeitCurrentMatch, simulateOpponentActivity } =
    useApp();
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [reactionFeedback, setReactionFeedback] = useState<string | null>(null);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulateRef = useRef(simulateOpponentActivity);
  simulateRef.current = simulateOpponentActivity;
  const matchId = currentMatch?.id;

  // Frontend-only opponent activity simulation: a single self-rescheduling
  // timeout, cleared when leaving the workspace or when the match ends.
  useEffect(() => {
    if (!matchId) return;
    let timeout: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay =
        ACTIVITY_MIN_DELAY_MS + Math.random() * (ACTIVITY_MAX_DELAY_MS - ACTIVITY_MIN_DELAY_MS);
      timeout = setTimeout(() => {
        simulateRef.current();
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, [matchId]);

  useEffect(
    () => () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    },
    []
  );

  if (!currentMatch) return null;
  const opponent = currentMatch.user2Profile;

  const reactions = [
    { emoji: '🔥', label: 'Keep pushing!' },
    { emoji: '💧', label: 'Hydrate break' },
    { emoji: '🎯', label: 'Focus mode on' },
    { emoji: '💪', label: "You've got this" },
  ];

  const handleSendReaction = (emoji: string, label: string) => {
    sendReaction(emoji, label);
    setReactionFeedback(`Sent ${emoji} ${label}`);
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => setReactionFeedback(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Opponent Card & Status */}
      <Card variant="default" padding="md" className="space-y-4 border-[#36425E]">
        <div className="flex items-center gap-3">
          <Identicon seed={opponent.avatarSeed} size={50} hasGlow />
          <div>
            <span className="text-[10px] font-mono text-[#94A3B8] uppercase block">
              Opponent Partner
            </span>
            <h2 className="text-base font-bold font-mono text-[#3DD9B3] break-all">
              {opponent.anonUsername}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#3DD9B3] animate-pulse-dot" />
              <span className="text-xs text-[#3DD9B3] font-medium">Focusing now</span>
            </div>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="p-2.5 bg-[#222B42] border border-[#2A3348] rounded-xl text-[11px] text-[#94A3B8] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#3DD9B3] shrink-0" />
          <span>Real identity &amp; contact info remain 100% private</span>
        </div>
      </Card>

      {/* Anonymous Reaction Bar */}
      <Card variant="default" padding="md" className="space-y-3 border-[#36425E]">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-mono font-bold text-[#F1F5F9] uppercase tracking-wider flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#FFB547]" aria-hidden="true" /> Send Encouragement
          </h2>
          <span className="text-[10px] font-mono text-[#3DD9B3]" aria-live="polite">
            {reactionFeedback && <span className="animate-fade-in">{reactionFeedback}</span>}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {reactions.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendReaction(r.emoji, r.label)}
              aria-label={`Send reaction: ${r.label}`}
              className="p-2 rounded-xl bg-[#222B42] border border-[#2A3348] hover:border-[#6C7CFF] hover:bg-[#1A2133] transition-all text-left flex items-center gap-2 text-xs text-[#F1F5F9] group"
            >
              <span className="text-base group-hover:scale-125 transition-transform" aria-hidden="true">
                {r.emoji}
              </span>
              <span className="truncate text-[11px]">{r.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Opponent Activity Stream */}
      <Card variant="default" padding="md" className="space-y-3 border-[#36425E]">
        <div className="flex items-center justify-between border-b border-[#2A3348] pb-2">
          <h2 className="text-xs font-mono font-bold text-[#F1F5F9] uppercase tracking-wider">
            Live Activity Stream
          </h2>
          <Badge variant="indigo" pulse className="text-[10px]">Live</Badge>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1" role="log" aria-label="Opponent activity">
          {activityEvents.length === 0 && (
            <p className="text-xs text-[#94A3B8] text-center py-4">No activity yet.</p>
          )}
          {activityEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-2.5 rounded-xl bg-[#222B42] border border-[#2A3348] text-xs space-y-0.5"
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-mono text-[#3DD9B3] font-bold">{evt.opponentUsername}</span>
                <span className="text-[#8A96AB]">
                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[#F1F5F9] text-xs">{evt.message}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Forfeit Match Button */}
      <div className="pt-2">
        <Button
          variant="destructive"
          size="sm"
          fullWidth
          onClick={() => setIsLeaveModalOpen(true)}
          icon={<LogOut className="w-4 h-4" />}
        >
          Leave / Forfeit Match
        </Button>
      </div>

      {/* Leave Match Confirmation Modal */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Leave Focus Match?"
        subtitle="Confirmation Required"
      >
        <div className="space-y-4 text-sm text-[#94A3B8]">
          <div className="p-4 bg-[rgba(255,122,122,0.1)] border border-[rgba(255,122,122,0.2)] rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#FF7A7A] shrink-0 mt-0.5" />
            <p className="text-xs text-[#FF7A7A] leading-relaxed">
              Leaving the match early will end your current 24-hour accountability session. Your opponent will be notified safely without penalty.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsLeaveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={forfeitCurrentMatch}>
              Confirm Leave
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
