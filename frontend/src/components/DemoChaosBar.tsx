import React, { useState } from 'react';
import { Sliders, Zap, AlertTriangle, RefreshCw, Moon, Sun, ChevronDown, ChevronUp, Terminal, Play, ShieldAlert } from 'lucide-react';
import { api } from '../api/client.js';

interface DemoChaosBarProps {
  watchedSymbols: string[];
  onTriggerComplete: () => void;
}

export const DemoChaosBar: React.FC<DemoChaosBarProps> = ({
  watchedSymbols,
  onTriggerComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(watchedSymbols[0] || 'AAPL');
  const [isMarketOpen, setIsMarketOpen] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; text: string; success: boolean }>>([]);

  const activeSymbol = watchedSymbols.includes(selectedSymbol) ? selectedSymbol : watchedSymbols[0] || 'AAPL';

  const triggerAction = async (actionName: string, callFn: () => Promise<{ message: string }>) => {
    setLoadingAction(actionName);
    try {
      const res = await callFn();
      const newEntry = {
        time: new Date().toLocaleTimeString(),
        text: res.message,
        success: true,
      };
      setLogs(prev => [newEntry, ...prev.slice(0, 4)]);
      onTriggerComplete();
    } catch (err: any) {
      const newEntry = {
        time: new Date().toLocaleTimeString(),
        text: `Error: ${err.message}`,
        success: false,
      };
      setLogs(prev => [newEntry, ...prev.slice(0, 4)]);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-sky-500/30 bg-[#0a101e]/90 backdrop-blur-xl shadow-xl overflow-hidden transition-all">
      {/* Top Banner Header */}
      <div className="px-5 py-3.5 flex items-center justify-between bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-purple-950/40 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-bold shadow-sm">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                Resilience & Chaos Testing Lab
              </span>
              <span className="px-2 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                EVALUATOR INTERACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Edge cases: price shock, volume surge, provider lag, out-of-order drop, market close.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
        >
          <span>{isOpen ? 'Close Lab' : 'Open Lab Controls'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="p-5 space-y-4 animate-fade-in bg-[#080d1a]">
          {/* Controls row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-300">Select Target Symbol:</span>
              <select
                value={activeSymbol}
                onChange={e => setSelectedSymbol(e.target.value)}
                className="text-xs font-mono font-bold bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500"
              >
                {watchedSymbols.map(sym => (
                  <option key={sym} value={sym}>
                    {sym}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              Changes propagate to WebSocket stream in &lt;100ms
            </span>
          </div>

          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Price Shock */}
            <button
              disabled={loadingAction !== null}
              onClick={() =>
                triggerAction('price_shock', () =>
                  api.triggerChaos({ action: 'price_shock', symbol: activeSymbol, pct: 4.8 })
                )
              }
              className="p-3 rounded-xl text-left bg-gradient-to-b from-emerald-950/40 to-slate-900 border border-emerald-500/30 hover:border-emerald-400/60 transition-all active:scale-98 disabled:opacity-50 group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  +4.8% Shock
                </span>
                <span className="text-[9px] font-mono text-emerald-400/70 uppercase">Score Spike</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Simulates price jump on {activeSymbol} to test significance engine & feed ranking.
              </p>
            </button>

            {/* 2. Volume Spike */}
            <button
              disabled={loadingAction !== null}
              onClick={() =>
                triggerAction('volume_spike', () =>
                  api.triggerChaos({ action: 'volume_spike', symbol: activeSymbol, multiplier: 3.8 })
                )
              }
              className="p-3 rounded-xl text-left bg-gradient-to-b from-sky-950/40 to-slate-900 border border-sky-500/30 hover:border-sky-400/60 transition-all active:scale-98 disabled:opacity-50 group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-sky-300 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  3.8x Volume
                </span>
                <span className="text-[9px] font-mono text-sky-400/70 uppercase">Anomaly</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Simulates institutional volume burst to trigger volume-dominant reason tag.
              </p>
            </button>

            {/* 3. Provider Lag / Stale */}
            <button
              disabled={loadingAction !== null}
              onClick={() => {
                const next = !isPaused;
                setIsPaused(next);
                triggerAction('pause_symbol', () =>
                  api.triggerChaos({ action: 'pause_symbol', symbol: activeSymbol, paused: next })
                );
              }}
              className="p-3 rounded-xl text-left bg-gradient-to-b from-amber-950/40 to-slate-900 border border-amber-500/30 hover:border-amber-400/60 transition-all active:scale-98 disabled:opacity-50 group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  {isPaused ? 'Resume Ticks' : 'Lag Provider'}
                </span>
                <span className="text-[9px] font-mono text-amber-400/70 uppercase">Staleness</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Pauses ticks for {activeSymbol} to verify "Delayed/Stale" badge without affecting others.
              </p>
            </button>

            {/* 4. Out of Order */}
            <button
              disabled={loadingAction !== null}
              onClick={() =>
                triggerAction('out_of_order', () =>
                  api.triggerChaos({ action: 'out_of_order', symbol: activeSymbol })
                )
              }
              className="p-3 rounded-xl text-left bg-gradient-to-b from-purple-950/40 to-slate-900 border border-purple-500/30 hover:border-purple-400/60 transition-all active:scale-98 disabled:opacity-50 group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                  Out-of-Order
                </span>
                <span className="text-[9px] font-mono text-purple-400/70 uppercase">Drop Rule</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Sends tick stamped 2m ago; verifies "apply if newer" rule drops stale packet.
              </p>
            </button>

            {/* 5. Market Toggle */}
            <button
              disabled={loadingAction !== null}
              onClick={() => {
                const next = !isMarketOpen;
                setIsMarketOpen(next);
                triggerAction('market_toggle', () =>
                  api.triggerChaos({ action: 'market_toggle', open: next })
                );
              }}
              className="p-3 rounded-xl text-left bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 hover:border-slate-500 transition-all active:scale-98 disabled:opacity-50 group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                  {isMarketOpen ? <Moon className="w-3.5 h-3.5 text-slate-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
                  {isMarketOpen ? 'Close Market' : 'Open Market'}
                </span>
                <span className="text-[9px] font-mono text-slate-400 uppercase">State Check</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Verifies "Market Closed" is cleanly distinguished from provider fault.
              </p>
            </button>
          </div>

          {/* Telemetry Output Log Terminal */}
          {logs.length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-black/80 border border-slate-800 font-mono text-xs">
              <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-500 mb-1.5">
                <Terminal className="w-3 h-3 text-sky-400" />
                <span>Simulation Event Log</span>
              </div>
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-slate-500">{log.time}</span>
                    <span className={log.success ? 'text-emerald-400' : 'text-rose-400'}>
                      {log.success ? '✓' : '✗'}
                    </span>
                    <span className="text-slate-200">{log.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
