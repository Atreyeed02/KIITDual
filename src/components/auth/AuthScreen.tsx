import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { KIIT_COLLEGE_CONFIG, validateCollegeEmail } from '../../data/collegeConfig';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingIndicator } from '../ui/LoadingIndicator';
import { Zap, Shield, Lock, ArrowRight, AlertCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { requestOtp } = useApp();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateCollegeEmail(email);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await requestOtp(email);
      if (!result.success) {
        setError(result.error || 'Failed to send OTP code');
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#6C7CFF]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-[#3DD9B3]/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6C7CFF] to-[#3DD9B3] p-0.5 shadow-[0_0_24px_rgba(108,124,255,0.4)]">
            <div className="w-full h-full bg-[#0F1420] rounded-[14px] flex items-center justify-center">
              <Zap className="w-7 h-7 text-[#6C7CFF]" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#F1F5F9]">
            KIIT<span className="text-[#6C7CFF]">Dual</span>
          </h1>
          <p className="text-sm text-[#94A3B8]">
            1v1 Anonymous Study Match System for College Peer Accountability
          </p>
        </div>

        {/* Login Card */}
        <Card variant="elevated" padding="lg" className="space-y-6 border-[#36425E]">
          <div className="space-y-1.5 text-center">
            <Badge variant="teal" className="mx-auto mb-2">
              <Shield className="w-3.5 h-3.5 inline mr-1" />
              Verified College Sign-In
            </Badge>
            <h2 className="text-xl font-bold text-[#F1F5F9]">Enter College Email</h2>
            <p className="text-xs text-[#94A3B8]">
              Verify your campus identity to start matching with study partners.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-mono font-medium text-[#94A3B8] uppercase">
                Student Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={KIIT_COLLEGE_CONFIG.emailPlaceholder}
                  className={`w-full px-4 py-3 bg-[#1A2133] border ${
                    error ? 'border-[#FF7A7A]' : 'border-[#2A3348] focus:border-[#6C7CFF]'
                  } rounded-xl text-[#F1F5F9] placeholder-[#475569] text-sm focus:outline-none focus:ring-2 focus:ring-[#6C7CFF]/30 transition-all font-mono`}
                  disabled={isLoading}
                  autoComplete="email"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'email-error' : undefined}
                  autoFocus
                />
              </div>

              {/* Validation Error Message */}
              {error && (
                <div
                  id="email-error"
                  role="alert"
                  className="flex items-center gap-2 p-3 bg-[rgba(255,122,122,0.1)] border border-[rgba(255,122,122,0.2)] rounded-xl text-xs text-[#FF7A7A] animate-shake"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={isLoading || !email.trim()}
              icon={isLoading ? undefined : <ArrowRight className="w-4 h-4" />}
            >
              {isLoading ? <LoadingIndicator size="sm" variant="indigo" /> : 'Continue with Email'}
            </Button>
          </form>

          {/* Privacy Note */}
          <div className="pt-2 border-t border-[#2A3348] flex items-center justify-center gap-2 text-xs text-[#94A3B8] text-center">
            <Lock className="w-3.5 h-3.5 text-[#3DD9B3]" />
            <span>Email is hashed &amp; never visible to opponents</span>
          </div>
        </Card>

        {/* Feature Pills */}
        <div className="grid grid-cols-3 gap-3 text-center text-xs text-[#94A3B8]">
          <div className="p-2.5 rounded-xl bg-[#1A2133]/60 border border-[#2A3348]">
            <span className="block font-semibold text-[#F1F5F9]">100% Private</span>
            <span className="text-[10px]">No public feeds</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#1A2133]/60 border border-[#2A3348]">
            <span className="block font-semibold text-[#3DD9B3]">24h Matches</span>
            <span className="text-[10px]">Time-boxed goals</span>
          </div>
          <div className="p-2.5 rounded-xl bg-[#1A2133]/60 border border-[#2A3348]">
            <span className="block font-semibold text-[#FFB547]">Anon Avatars</span>
            <span className="text-[10px]">Zero social risk</span>
          </div>
        </div>
      </div>
    </div>
  );
};
