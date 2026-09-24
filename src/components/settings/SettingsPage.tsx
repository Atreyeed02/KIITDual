import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Identicon } from '../ui/Identicon';
import { Navbar } from '../navigation/Navbar';
import { Modal } from '../ui/Modal';
import {
  Settings as SettingsIcon,
  RotateCw,
  Bell,
  Trash2,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const {
    anonProfile,
    notificationPrefs,
    setNotificationPrefs,
    regenerateIdentity,
    deleteAccount,
  } = useApp();

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [identityRegeneratedToast, setIdentityRegeneratedToast] = useState<boolean>(false);

  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    },
    []
  );

  const handleRegenerate = () => {
    regenerateIdentity();
    setIdentityRegeneratedToast(true);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setIdentityRegeneratedToast(false), 3000);
  };

  const togglePref = (key: keyof typeof notificationPrefs) => {
    setNotificationPrefs({
      ...notificationPrefs,
      [key]: !notificationPrefs[key],
    });
  };

  return (
    <div className="min-h-screen bg-[#0F1420] text-[#F1F5F9] flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="border-b border-[#2A3348] pb-6 space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#6C7CFF]">
            <SettingsIcon className="w-4 h-4" />
            <span>ACCOUNT & PRIVACY SETTINGS</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#F1F5F9]">
            Preferences & Identity
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8]">
            Manage your anonymous persona, notification alerts, and account lifecycle.
          </p>
        </div>

        {/* 1. ANONYMOUS IDENTITY MANAGEMENT */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A3348] pb-2">
            <h2 className="text-base font-bold text-[#F1F5F9] uppercase tracking-wider font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#3DD9B3]" />
              Anonymous Identity Persona
            </h2>
            <Badge variant="teal">
              {anonProfile?.rotatesPerMatch ? 'ROTATES PER MATCH' : 'PERSISTENT PER ACCOUNT'}
            </Badge>
          </div>

          <Card variant="default" padding="lg" className="space-y-6 bg-[#161D2D]">
            {anonProfile && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4 rounded-2xl bg-[#1A2133] border border-[#2A3348]">
                <div className="flex items-center gap-4 min-w-0">
                  <Identicon seed={anonProfile.avatarSeed} size={56} hasGlow />
                  <div className="space-y-1 min-w-0">
                    <span className="text-[10px] font-mono text-[#94A3B8] uppercase block">
                      Active Anon Alias
                    </span>
                    <span className="text-xl font-bold font-mono text-[#3DD9B3] break-all">
                      {anonProfile.anonUsername}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#94A3B8]">
                      <span className="break-all">Seed: {anonProfile.avatarSeed}</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleRegenerate}
                  icon={<RotateCw className="w-4 h-4 text-[#6C7CFF]" />}
                >
                  Regenerate Identity
                </Button>
              </div>
            )}

            {identityRegeneratedToast && (
              <div role="status" className="p-3 rounded-xl bg-[rgba(61,217,179,0.15)] border border-[#3DD9B3]/40 text-[#3DD9B3] font-mono text-xs flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>New anonymous handle and Identicon generated for future matches!</span>
              </div>
            )}

            <div className="p-4 rounded-xl bg-[#0F1420]/60 border border-[#2A3348] space-y-2 text-xs text-[#94A3B8]">
              <div className="flex items-center gap-2 font-mono text-[#F1F5F9] font-bold">
                <Lock className="w-3.5 h-3.5 text-[#3DD9B3]" />
                Identity Privacy Assurance
              </div>
              <p>
                Your college email is hashed client-side before storage. Peer study partners in your 1v1 matches will ONLY see your anonymous alias and Identicon.
              </p>
            </div>
          </Card>
        </section>

        {/* 2. NOTIFICATION PREFERENCES */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A3348] pb-2">
            <h2 className="text-base font-bold text-[#F1F5F9] uppercase tracking-wider font-mono flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#6C7CFF]" />
              Notification Alerts
            </h2>
            <span className="text-xs text-[#94A3B8] font-mono">SIMULATED LOCAL ALERTS</span>
          </div>

          <Card variant="default" padding="md" className="space-y-4 bg-[#161D2D]">
            <div className="divide-y divide-[#2A3348]">
              {/* Toggle 1 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-bold text-[#F1F5F9] block">Match Found Alerts</span>
                  <span className="text-xs text-[#94A3B8]">
                    Notify when an opponent is paired in the queue.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationPrefs.matchFound}
                  aria-label="Match Found Alerts"
                  onClick={() => togglePref('matchFound')}
                  className={`w-12 h-6 shrink-0 rounded-full transition-colors p-1 flex items-center ${
                    notificationPrefs.matchFound ? 'bg-[#3DD9B3]' : 'bg-[#2A3348]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-[#0F1420] transition-transform ${
                      notificationPrefs.matchFound ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 2 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-bold text-[#F1F5F9] block">
                    Match Expiry Warning
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    Alert 1 hour before the 24-hour focus window closes.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationPrefs.matchEndingSoon}
                  aria-label="Match Expiry Warning"
                  onClick={() => togglePref('matchEndingSoon')}
                  className={`w-12 h-6 shrink-0 rounded-full transition-colors p-1 flex items-center ${
                    notificationPrefs.matchEndingSoon ? 'bg-[#3DD9B3]' : 'bg-[#2A3348]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-[#0F1420] transition-transform ${
                      notificationPrefs.matchEndingSoon ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 3 */}
              <div className="py-3 flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-bold text-[#F1F5F9] block">Scorecard Ready</span>
                  <span className="text-xs text-[#94A3B8]">
                    Alert when final weighted match scorecard is published.
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationPrefs.matchResultsReady}
                  aria-label="Scorecard Ready"
                  onClick={() => togglePref('matchResultsReady')}
                  className={`w-12 h-6 shrink-0 rounded-full transition-colors p-1 flex items-center ${
                    notificationPrefs.matchResultsReady ? 'bg-[#3DD9B3]' : 'bg-[#2A3348]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-[#0F1420] transition-transform ${
                      notificationPrefs.matchResultsReady ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </Card>
        </section>

        {/* 3. DANGER ZONE / ACCOUNT MANAGEMENT */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#FF7A7A]/30 pb-2">
            <h2 className="text-base font-bold text-[#FF7A7A] uppercase tracking-wider font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Danger Zone
            </h2>
          </div>

          <Card variant="default" padding="lg" className="border-[#FF7A7A]/30 bg-[#161D2D]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-sm font-bold text-[#F1F5F9] block">Clear Data & Reset Account</span>
                <span className="text-xs text-[#94A3B8]">
                  Permanently deletes local session data, history, identity, and resets the app state.
                </span>
              </div>
              <Button
                variant="destructive"
                size="md"
                onClick={() => setIsDeleteModalOpen(true)}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Delete Local Account
              </Button>
            </div>
          </Card>
        </section>
      </main>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Account & Data Reset"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(255,122,122,0.1)] border border-[#FF7A7A]/30 text-[#FF7A7A] text-xs font-mono">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>This action will reset all stored local data and redirect to sign in.</span>
          </div>

          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Are you sure you want to delete your anonymous profile, active match, and local match history?
          </p>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2A3348]">
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setIsDeleteModalOpen(false);
                deleteAccount();
              }}
              icon={<Trash2 className="w-4 h-4" />}
            >
              Reset All Data
            </Button>
          </div>
        </div>
      </Modal>

      <footer className="border-t border-[#2A3348] py-6 text-center text-xs text-[#94A3B8] font-mono mt-auto">
        KIITDual Platform &bull; Account & Identity Settings
      </footer>
    </div>
  );
};
