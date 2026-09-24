import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingIndicator } from '../ui/LoadingIndicator';
import { ShieldCheck, ArrowLeft, RefreshCw, AlertCircle, Info } from 'lucide-react';

export const OtpVerification: React.FC = () => {
  const { pendingEmail, verifyOtp, requestOtp, setAuthStep } = useApp();
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  const handleChange = (index: number, value: string) => {
    // Only accept numeric inputs
    if (value && !/^\d+$/.test(value)) return;

    const newValues = [...otpValues];
    // If pasted string contains multiple digits
    if (value.length > 1) {
      const digits = value.slice(0, 6).split('');
      digits.forEach((digit, i) => {
        if (i < 6) newValues[i] = digit;
      });
      setOtpValues(newValues);
      const nextIndex = Math.min(digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    newValues[index] = value;
    setOtpValues(newValues);

    // Auto-advance focus to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      // Focus previous input on backspace if current input is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtpValues(digits);
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpValues.join('');
    if (fullOtp.length < 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await verifyOtp(fullOtp);
      if (!res.success) {
        setError(res.error || 'Verification failed');
      }
    } catch {
      setError('An error occurred during verification');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);

    try {
      const res = await requestOtp(pendingEmail);
      if (!res.success) {
        setError(res.error || 'Could not resend the code. Please try again.');
        return;
      }
      setResendCooldown(30);
      setOtpValues(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } catch {
      setError('Could not resend the code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-[#3DD9B3]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Top Back Navigation */}
        <button
          type="button"
          onClick={() => setAuthStep('unauthenticated')}
          className="inline-flex items-center gap-2 text-xs font-mono text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Change Email Address</span>
        </button>

        {/* Verification Card */}
        <Card variant="elevated" padding="lg" className="space-y-6 border-[#36425E]">
          <div className="space-y-2 text-center">
            <Badge variant="indigo" className="mx-auto mb-2">
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
              Security Check
            </Badge>
            <h2 className="text-xl font-bold text-[#F1F5F9]">Verification Code</h2>
            <p className="text-xs text-[#94A3B8]">
              We sent a 6-digit code to{' '}
              <span className="font-mono text-[#6C7CFF] font-semibold break-all">{pendingEmail}</span>
            </p>
          </div>

          {/* Dev Simulated OTP Notice Banner */}
          <div className="p-3 bg-[rgba(108,124,255,0.1)] border border-[#6C7CFF]/30 rounded-xl text-xs text-[#6C7CFF] flex items-center gap-2.5">
            <Info className="w-4 h-4 shrink-0 text-[#6C7CFF]" />
            <div>
              <span className="font-semibold block">Simulated OTP Code:</span>
              <span className="font-mono text-sm tracking-wider font-bold text-[#F1F5F9]">123456</span>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            {/* 6-Digit OTP Inputs */}
            <div
              className="flex justify-between gap-1.5 sm:gap-2"
              onPaste={handlePaste}
              role="group"
              aria-label="6-digit verification code"
            >
              {otpValues.map((value, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${index + 1}`}
                  aria-invalid={!!error}
                  maxLength={1}
                  value={value}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`flex-1 min-w-0 max-w-[3rem] h-12 sm:h-14 text-center text-xl font-mono font-bold bg-[#1A2133] border ${
                    error ? 'border-[#FF7A7A]' : value ? 'border-[#3DD9B3]' : 'border-[#2A3348]'
                  } rounded-xl text-[#F1F5F9] focus:outline-none focus:border-[#6C7CFF] focus:ring-2 focus:ring-[#6C7CFF]/30 transition-all`}
                  disabled={isLoading}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div role="alert" className="flex items-center gap-2 p-3 bg-[rgba(255,122,122,0.1)] border border-[rgba(255,122,122,0.2)] rounded-xl text-xs text-[#FF7A7A]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="teal"
              size="lg"
              fullWidth
              disabled={isLoading || otpValues.join('').length < 6}
            >
              {isLoading ? <LoadingIndicator size="sm" variant="teal" /> : 'Verify Code'}
            </Button>
          </form>

          {/* Resend Controls */}
          <div className="pt-4 border-t border-[#2A3348] flex flex-wrap gap-2 items-center justify-between text-xs text-[#94A3B8]">
            <span>Didn't receive code?</span>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isResending}
              className={`inline-flex items-center gap-1.5 font-mono ${
                resendCooldown > 0
                  ? 'text-[#475569] cursor-not-allowed'
                  : 'text-[#3DD9B3] hover:underline cursor-pointer'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
