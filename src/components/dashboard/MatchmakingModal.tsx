import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Identicon } from '../ui/Identicon';
import { Zap, ShieldCheck, Clock, Users, ArrowRight, X } from 'lucide-react';

export const MatchmakingModal: React.FC = () => {
  const {
    isMatchmakingModalOpen,
    closeMatchmakingModal,
    matchmakingState,
    startSearch,
    cancelSearch,
    foundOpponent,
    confirmMatch,
    anonProfile,
    searchStartedAt,
  } = useApp();

  const [now, setNow] = useState(() => Date.now());

  // Display-only wait counter derived from the persisted search start time
  // (stays correct after a refresh). Stops as soon as searching ends.
  useEffect(() => {
    if (searchStartedAt === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [searchStartedAt]);

  if (!isMatchmakingModalOpen || !anonProfile) return null;

  const searchElapsed =
    searchStartedAt === null ? 0 : Math.max(0, Math.floor((now - searchStartedAt) / 1000));
  const formatElapsed = (secs: number) =>
    `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;

  return (
    <Modal
      isOpen={isMatchmakingModalOpen}
      onClose={closeMatchmakingModal}
      maxWidth="md"
      ariaLabel="Find a focus partner"
    >
      {/* 1. READY STATE */}
      {matchmakingState === 'idle' && (
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <Badge variant="teal" pulse className="mx-auto mb-1">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Campus Match Queue
            </Badge>
            <h2 className="text-2xl font-extrabold text-[#F1F5F9]">Find a Focus Partner</h2>
            <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
              You'll be matched anonymously with another KIIT student who is ready to focus for the next 24 hours.
            </p>
          </div>

          {/* User Avatar & Identity Card */}
          <div className="p-4 gap-3 rounded-2xl bg-[#222B42] border border-[#2A3348] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Identicon seed={anonProfile.avatarSeed} size={44} hasGlow />
              <div className="text-left">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block">
                  Your Identity
                </span>
                <span className="text-sm font-mono font-bold text-[#F1F5F9]">
                  {anonProfile.anonUsername}
                </span>
              </div>
            </div>
            <Badge variant="indigo">Ready</Badge>
          </div>

          {/* Match Details List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left text-xs">
            <div className="p-3 rounded-xl bg-[#1A2133] border border-[#2A3348] space-y-1">
              <span className="font-semibold text-[#F1F5F9] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#FFB547]" /> 24-Hour Window
              </span>
              <p className="text-[#94A3B8] text-[11px]">Time-boxed study session accountability.</p>
            </div>
            <div className="p-3 rounded-xl bg-[#1A2133] border border-[#2A3348] space-y-1">
              <span className="font-semibold text-[#F1F5F9] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#3DD9B3]" /> 100% Private
              </span>
              <p className="text-[#94A3B8] text-[11px]">Results shown only to you two.</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <Button
              variant="teal"
              size="lg"
              fullWidth
              onClick={startSearch}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Start Matching
            </Button>
            <Button variant="ghost" size="sm" fullWidth onClick={closeMatchmakingModal}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* 2. SEARCHING STATE */}
      {matchmakingState === 'searching' && (
        <div className="space-y-6 text-center py-4" role="status">
          <div className="space-y-2">
            <Badge variant="indigo" pulse className="mx-auto mb-1">
              Searching KIIT Queue
            </Badge>
            <h2 className="text-xl font-bold text-[#F1F5F9]">Finding your focus partner...</h2>
            <p className="text-xs text-[#94A3B8]">
              Looking for an active student studying now.
            </p>
          </div>

          {/* Animated Searching Visual */}
          <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
            {/* Outer Pulsing Rings */}
            <div className="absolute inset-0 rounded-full border-2 border-[#6C7CFF]/40 animate-ping opacity-75" />
            <div className="absolute inset-2 rounded-full border-2 border-[#3DD9B3]/30 animate-pulse" />

            <div className="relative z-10 p-2 rounded-full bg-[#1A2133] border border-[#6C7CFF] shadow-[0_0_32px_rgba(108,124,255,0.4)]">
              <Identicon seed={anonProfile.avatarSeed} size={72} hasGlow />
            </div>
          </div>

          {/* Waiting Time Counter */}
          <div className="space-y-1">
            <span className="text-xs font-mono text-[#94A3B8]">Queue Wait Time</span>
            <div className="text-lg font-mono font-bold text-[#3DD9B3] tabular-nums">
              {formatElapsed(searchElapsed)}
            </div>
          </div>

          <Button
            variant="destructive"
            size="sm"
            onClick={cancelSearch}
            icon={<X className="w-4 h-4" />}
            autoFocus
          >
            Cancel Search
          </Button>
        </div>
      )}

      {/* 3. MATCH FOUND STATE */}
      {matchmakingState === 'matched' && foundOpponent && (
        <div className="space-y-6 text-center">
          <div className="space-y-2">
            <Badge variant="teal" pulse className="mx-auto mb-1">
              <Zap className="w-3.5 h-3.5 inline mr-1 text-[#3DD9B3]" />
              Match Established!
            </Badge>
            <h2 className="text-2xl font-extrabold text-[#F1F5F9]">Focus Partner Found</h2>
            <p className="text-xs text-[#94A3B8]">
              You have been paired for a 24-hour focus match.
            </p>
          </div>

          {/* Side-by-Side Avatar Comparison */}
          <div className="p-4 sm:p-6 gap-2 rounded-2xl bg-[#222B42] border border-[#3DD9B3]/40 shadow-[0_0_32px_rgba(61,217,179,0.15)] flex items-center justify-around relative overflow-hidden">
            {/* You */}
            <div className="flex flex-col items-center space-y-2">
              <Identicon seed={anonProfile.avatarSeed} size={64} hasGlow />
              <div className="text-center">
                <span className="text-[10px] font-mono text-[#94A3B8] uppercase block">You</span>
                <span className="text-xs font-mono font-bold text-[#F1F5F9]">
                  {anonProfile.anonUsername}
                </span>
              </div>
            </div>

            {/* VS Badge */}
            <div className="w-10 h-10 rounded-full bg-[#1A2133] border border-[#36425E] flex items-center justify-center font-mono font-bold text-xs text-[#FFB547] shadow-lg">
              VS
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center space-y-2">
              <Identicon seed={foundOpponent.avatarSeed} size={64} hasGlow />
              <div className="text-center">
                <span className="text-[10px] font-mono text-[#3DD9B3] uppercase block">Opponent</span>
                <span className="text-xs font-mono font-bold text-[#3DD9B3]">
                  {foundOpponent.anonUsername}
                </span>
              </div>
            </div>
          </div>

          {/* Match Terms */}
          <div className="p-3 bg-[#1A2133] border border-[#2A3348] rounded-xl text-xs text-[#94A3B8] flex flex-wrap gap-2 items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#FFB547]" /> Duration: 24 Hours
            </span>
            <span className="font-mono text-[#3DD9B3] font-semibold">Starts Immediately</span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <Button
              variant="teal"
              size="lg"
              fullWidth
              onClick={confirmMatch}
              icon={<ArrowRight className="w-4 h-4" />}
              autoFocus
            >
              Start Match Now
            </Button>
            <Button variant="ghost" size="sm" fullWidth onClick={closeMatchmakingModal}>
              Cancel &amp; Return to Dashboard
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
