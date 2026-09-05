import React from 'react';
import { Activity, LogOut, Radio, User, Sliders, Moon, Sun, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { WatchlistSymbol } from '../api/types.js';

interface HeaderProps {
  wsConnected: boolean;
  marketOpen: boolean;
  symbols: WatchlistSymbol[];
  chaosOpen: boolean;
  onToggleChaos: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wsConnected,
  marketOpen,
  symbols,
  chaosOpen,
  onToggleChaos,
}) => {
  const { user, logout } = useAuth();

  return (
    <header className="mb-6 space-y-3">
      {/* Top Navbar */}
      <div className="glass-panel px-5 py-3.5 border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/25">
              <Activity className="w-5 h-5" />
            </div>
            {wsConnected && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#090d16] beacon-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-tight">
                Deltra
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              From Change to Signal
            </p>
          </div>
        </div>

        {/* Telemetry & Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Chaos / Evaluator Lab Button */}
          <button
            onClick={onToggleChaos}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              chaosOpen
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20'
                : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-300'
            }`}
            title="Toggle Evaluator Lab to test price shocks, volume surges, provider lags, and out-of-order ticks"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Chaos Lab</span>
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold">
              DEMO
            </span>
          </button>

          {/* Market Status */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
              marketOpen
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-900/80 text-slate-400 border-slate-700/60'
            }`}
          >
            {marketOpen ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
            <span className="font-semibold">{marketOpen ? 'Market Open' : 'Market Closed'}</span>
          </div>

          {/* WebSocket Status */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
              wsConnected
                ? 'bg-sky-950/40 text-sky-300 border-sky-500/30'
                : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'animate-pulse text-sky-400' : 'text-rose-400'}`} />
            <span className="font-semibold">{wsConnected ? 'Live Stream' : 'Reconnecting'}</span>
          </div>

          {/* User & Logout */}
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate max-w-[130px]">{user.email}</span>
              </div>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Ticker Ribbon */}
      {symbols.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/60 py-1.5 px-3">
          <div className="flex items-center gap-5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 shrink-0">
              Hot Quotes
            </span>
            {symbols.map(sym => {
              const isUp = sym.deltaSinceLastSeen >= 0;
              return (
                <div key={sym.symbol} className="flex items-center gap-2 shrink-0 text-xs font-mono">
                  <span className="font-bold text-white">{sym.symbol}</span>
                  <span className="text-slate-200">${sym.currentPrice.toFixed(2)}</span>
                  <span className={`flex items-center text-[11px] font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {isUp ? '+' : ''}{sym.pctSinceLastSeen.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
