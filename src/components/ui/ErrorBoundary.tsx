import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort guard so an unexpected render error never leaves a blank page.
 * Local data is untouched; reloading re-hydrates (and self-repairs) from storage.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[KIITDual] Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex items-center justify-center p-4">
        <div
          role="alert"
          className="max-w-md w-full bg-[#1A2133] border border-[#FF7A7A]/30 rounded-2xl shadow-xl p-6 sm:p-8 text-center space-y-4"
        >
          <AlertTriangle className="w-8 h-8 text-[#FF7A7A] mx-auto" aria-hidden="true" />
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-[#94A3B8]">
            KIITDual hit an unexpected error. Your matches and history are saved on this device.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 font-semibold rounded-full text-sm px-5 py-2.5 bg-[#6C7CFF] text-[#F1F5F9] hover:bg-[#7E8EFF] transition-all"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" />
            Reload KIITDual
          </button>
        </div>
      </div>
    );
  }
}
