import React from 'react';
import { useApp } from './context/AppContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { OtpVerification } from './components/auth/OtpVerification';
import { AnonymousIdentitySetup } from './components/auth/AnonymousIdentitySetup';
import { Dashboard } from './components/dashboard/Dashboard';
import { MatchmakingModal } from './components/dashboard/MatchmakingModal';
import { MatchWorkspace } from './components/workspace/MatchWorkspace';
import { Scorecard } from './components/scorecard/Scorecard';
import { MatchHistoryPage } from './components/history/MatchHistoryPage';
import { SettingsPage } from './components/settings/SettingsPage';

const AuthenticatedView: React.FC = () => {
  const { activeView } = useApp();
  switch (activeView) {
    case 'active_match_workspace':
      return <MatchWorkspace />;
    case 'scorecard':
      return <Scorecard />;
    case 'history':
      return <MatchHistoryPage />;
    case 'settings':
      return <SettingsPage />;
    default:
      return <Dashboard />;
  }
};

export const AppContent: React.FC = () => {
  const { authStep } = useApp();

  switch (authStep) {
    case 'awaiting_otp':
      return <OtpVerification />;
    case 'identity_setup':
      return <AnonymousIdentitySetup />;
    case 'authenticated':
      return (
        <>
          <AuthenticatedView />
          {/* App-level so "Find a Focus Partner" works from every screen, not just the Dashboard. */}
          <MatchmakingModal />
        </>
      );
    default:
      return <AuthScreen />;
  }
};

export const App: React.FC = () => {
  return <AppContent />;
};

export default App;
