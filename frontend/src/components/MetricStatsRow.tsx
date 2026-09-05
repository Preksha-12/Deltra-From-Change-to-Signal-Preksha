import React from 'react';
import { Layers, AlertCircle, TrendingUp, Cpu, ShieldCheck } from 'lucide-react';
import { WatchlistSymbol } from '../api/types.js';

interface MetricStatsRowProps {
  items: WatchlistSymbol[];
}

export const MetricStatsRow: React.FC<MetricStatsRowProps> = ({ items }) => {
  const actionableCount = items.filter(i => i.isMeaningful || i.significanceScore >= 1.5).length;
  
  // Find top mover
  const sortedByAbsMove = [...items].sort(
    (a, b) => Math.abs(b.pctSinceLastSeen) - Math.abs(a.pctSinceLastSeen)
  );
  const topMover = sortedByAbsMove[0];

  const avgVol = items.length > 0
    ? (items.reduce((acc, i) => acc + (i.breakdown?.rollingVolatility || 1.2), 0) / items.length).toFixed(1)
    : '1.2';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
      {/* 1. Tracked Assets */}
      <div className="glass-card p-4 border-slate-800">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Watched Assets</span>
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-extrabold text-white">
            {items.length}
          </span>
          <span className="text-xs text-slate-400 font-medium">Equities Active</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">Single global poller polling once</div>
      </div>

      {/* 2. Attention Signals */}
      <div className={`glass-card p-4 border-slate-800 ${actionableCount > 0 ? 'border-sky-500/30 bg-sky-950/20' : ''}`}>
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Attention Queue</span>
          <div className={`p-1.5 rounded-lg ${actionableCount > 0 ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400'}`}>
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-mono text-2xl font-extrabold ${actionableCount > 0 ? 'text-sky-300' : 'text-slate-300'}`}>
            {actionableCount}
          </span>
          <span className="text-xs text-slate-400 font-medium">Significant Shifts</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {actionableCount > 0 ? 'Filtered signal above 1.5 threshold' : 'All assets within normal range'}
        </div>
      </div>

      {/* 3. Top Move */}
      <div className="glass-card p-4 border-slate-800">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Top Delta</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          {topMover ? (
            <>
              <span className="font-mono text-xl font-extrabold text-white">{topMover.symbol}</span>
              <span className={`font-mono text-sm font-bold ${topMover.deltaSinceLastSeen >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {topMover.deltaSinceLastSeen >= 0 ? '+' : ''}{topMover.pctSinceLastSeen.toFixed(1)}%
              </span>
            </>
          ) : (
            <span className="text-sm text-slate-500">None</span>
          )}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">Relative to your last visit</div>
      </div>

      {/* 4. Volatility Baseline */}
      <div className="glass-card p-4 border-slate-800">
        <div className="flex items-center justify-between text-slate-400 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider">Market Noise Floor</span>
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-2xl font-extrabold text-white">
            {avgVol}%
          </span>
          <span className="text-xs text-slate-400 font-medium">Avg Rolling σ</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-1">Dynamic normalization active</div>
      </div>
    </div>
  );
};
