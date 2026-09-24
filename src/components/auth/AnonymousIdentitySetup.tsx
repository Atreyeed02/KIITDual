import React from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Identicon } from '../ui/Identicon';
import { ShieldCheck, RefreshCw, ArrowRight, UserCheck } from 'lucide-react';

export const AnonymousIdentitySetup: React.FC = () => {
  const { anonProfile, confirmIdentity, regenerateIdentity, setAuthStep } = useApp();

  if (!anonProfile) {
    return (
      <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex items-center justify-center p-4">
        <Card variant="elevated" padding="lg" className="text-center space-y-4 max-w-md">
          <p className="text-sm text-[#94A3B8]">Your session expired. Please sign in again.</p>
          <Button variant="primary" onClick={() => setAuthStep('unauthenticated')}>
            Back to Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-[#6C7CFF]/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <Card variant="elevated" padding="lg" className="space-y-6 border-[#36425E] text-center">
          <div className="space-y-2">
            <Badge variant="indigo" className="mx-auto mb-2">
              <UserCheck className="w-3.5 h-3.5 inline mr-1" />
              Anonymous Profile Assigned
            </Badge>
            <h2 className="text-2xl font-extrabold text-[#F1F5F9]">Your Study Identity</h2>
            <p className="text-xs text-[#94A3B8]">
              Your opponent will only see this anonymous identity. Your real name and email remain completely private.
            </p>
          </div>

          {/* Large Identicon Avatar Display */}
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <div className="p-3 rounded-full bg-[#1A2133] border border-[#36425E] shadow-[0_0_32px_rgba(108,124,255,0.3)]">
              <Identicon seed={anonProfile.avatarSeed} size={110} hasGlow />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono uppercase tracking-widest text-[#94A3B8]">
                Assigned Username
              </span>
              <h3 className="text-2xl font-bold font-mono tracking-tight text-[#6C7CFF] break-all">
                {anonProfile.anonUsername}
              </h3>
            </div>
          </div>

          {/* Anonymity Shield Box */}
          <div className="p-3.5 bg-[#1A2133] border border-[#2A3348] rounded-2xl flex items-start gap-3 text-left">
            <ShieldCheck className="w-5 h-5 text-[#3DD9B3] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-semibold text-[#F1F5F9] block">100% Privacy Guarantee</span>
              <p className="text-[#94A3B8] leading-relaxed">
                Matches are 1v1 and time-boxed. Scorecards are shown strictly to you and your opponent—never on public feeds.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={confirmIdentity}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Enter KIITDual
            </Button>

            <Button
              variant="ghost"
              size="sm"
              fullWidth
              onClick={regenerateIdentity}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Shuffle Username &amp; Avatar
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
