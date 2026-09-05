import React from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { RefreshCw } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#090d16]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-xs font-mono">Authenticating session...</p>
        </div>
      </div>
    );
  }

  return user ? <DashboardPage /> : <LoginPage />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
};

export default App;
