import React, { useState } from 'react';
import { Activity, ShieldCheck, ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

export const LoginPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('Preksha.Deltra@gmail.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      if (!isRegister && (err.message.includes('Invalid') || err.message.includes('not found'))) {
        try {
          await signup(email, password);
          return;
        } catch (signupErr: any) {
          setError(err.message || 'Authentication failed');
        }
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-[#070a11] relative overflow-hidden">
      {/* Background ambient orbs */}
      <div className="fixed top-1/4 left-1/4 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 text-white shadow-xl shadow-sky-500/25 mb-4">
            <Activity className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-mono font-bold text-sky-400 mb-3">
            <span>FROM CHANGE TO SIGNAL</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Deltra
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
            Move beyond raw price spreadsheets. Instantly surface <strong className="text-white">what has meaningfully changed</strong> since you last checked.
          </p>
        </div>

        {/* Login Box */}
        <div className="glass-panel p-8 border-slate-700/80 shadow-2xl bg-[#0d1322]/90">
          <div className="flex border-b border-slate-800 mb-6">
            <button
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center transition-colors border-b-2 ${
                !isRegister
                  ? 'border-sky-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center transition-colors border-b-2 ${
                isRegister
                  ? 'border-sky-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Workstation Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:opacity-95 text-white font-bold text-sm transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Access Watchlist Terminal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2 flex-wrap">
          <span className="font-bold text-slate-300">Deltra</span>
          <span className="text-slate-600">.</span>
          <span>From change to signal</span>
          <span className="text-slate-600">.</span>
          <a
            href="https://www.linkedin.com/in/preksha-prakash-"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 font-semibold underline underline-offset-4 transition-colors"
          >
            Preksha
          </a>
          <span className="text-slate-600">.</span>
          <span className="text-base font-bold leading-none inline-block">&copy;</span>
          <span className="text-slate-600">.</span>
          <span>2026</span>
        </footer>
      </div>
    </div>
  );
};
