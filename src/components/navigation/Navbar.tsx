import React from 'react';
import { useApp } from '../../context/AppContext';
import { ActiveView } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Identicon } from '../ui/Identicon';
import {
  Zap,
  Flame,
  LogOut,
  LayoutDashboard,
  History,
  Settings as SettingsIcon,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    currentStreak,
    anonProfile,
    activeView,
    setActiveView,
    logout,
  } = useApp();

  const navItems: { id: ActiveView; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      shortLabel: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" aria-hidden="true" />,
    },
    {
      id: 'history',
      label: 'Match History',
      shortLabel: 'History',
      icon: <History className="w-4 h-4" aria-hidden="true" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      shortLabel: 'Settings',
      icon: <SettingsIcon className="w-4 h-4" aria-hidden="true" />,
    },
  ];

  return (
    <header className="border-b border-[#2A3348] bg-[#161D2D]/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        {/* Brand logo */}
        <div className="flex items-center gap-6 min-w-0">
          <button
            type="button"
            className="flex items-center gap-2.5 cursor-pointer rounded-xl text-left"
            onClick={() => setActiveView('dashboard')}
            aria-label="KIITDual — go to Dashboard"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6C7CFF] to-[#3DD9B3] p-0.5 flex items-center justify-center shadow-[0_0_16px_rgba(108,124,255,0.4)]">
              <div className="w-full h-full bg-[#0F1420] rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-[#6C7CFF]" />
              </div>
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-[#F1F5F9]">
                KIIT<span className="text-[#6C7CFF]">Dual</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-[rgba(61,217,179,0.15)] text-[#3DD9B3] border border-[#3DD9B3]/30">
                1v1 Focus
              </span>
            </div>
          </button>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all ${
                    isActive
                      ? 'bg-[#222B42] text-[#3DD9B3] border border-[#3DD9B3]/40 font-bold'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1A2133]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span title="Consecutive completed matches">
            <Badge variant="amber" pulse>
              <Flame className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
              Streak: {currentStreak}
            </Badge>
          </span>

          {anonProfile && (
            <button
              type="button"
              className="hidden sm:flex items-center gap-2 bg-[#1A2133] border border-[#2A3348] pl-2 pr-3 py-1 rounded-full cursor-pointer hover:border-[#6C7CFF]/50 transition-colors"
              onClick={() => setActiveView('settings')}
              title="Identity settings"
              aria-label={`Identity settings for ${anonProfile.anonUsername}`}
            >
              <Identicon seed={anonProfile.avatarSeed} size={24} />
              <span className="text-xs font-mono font-medium text-[#F1F5F9]">
                {anonProfile.anonUsername}
              </span>
            </button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            icon={<LogOut className="w-4 h-4 text-[#FF7A7A]" />}
            title="Logout"
            aria-label="Logout"
          >
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>

      {/* Mobile nav bar row */}
      <nav
        className="md:hidden border-t border-[#2A3348]/60 bg-[#111726]/90 px-2 sm:px-4 py-2 flex items-center justify-around gap-1"
        aria-label="Main"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-mono ${
                isActive
                  ? 'bg-[#222B42] text-[#3DD9B3] font-bold border border-[#3DD9B3]/40'
                  : 'text-[#94A3B8]'
              }`}
            >
              {item.icon}
              {item.shortLabel}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
