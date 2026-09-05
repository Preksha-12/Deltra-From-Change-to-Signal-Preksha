import React from 'react';
import { Clock, AlertTriangle, Moon, CheckCircle2 } from 'lucide-react';

interface StalenessBadgeProps {
  stale: boolean;
  marketStatus: 'open' | 'closed';
  updatedAt: string;
}

export const StalenessBadge: React.FC<StalenessBadgeProps> = ({
  stale,
  marketStatus,
  updatedAt,
}) => {
  const timeFormatted = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--';

  // Case 1: Market Closed (Distinct from stale/unavailable)
  if (marketStatus === 'closed') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60" title={`Market is currently closed. Showing closing snapshot as of ${timeFormatted}`}>
        <Moon className="w-3 h-3 text-slate-400" />
        <span>Closed</span>
        <span className="text-slate-500 font-mono text-[10px]">({timeFormatted})</span>
      </div>
    );
  }

  // Case 2: Stale / Provider Delay
  if (stale) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/40 text-amber-300 border border-amber-500/40" title={`Data provider delay or dropped ticks. Showing last-known-good price as of ${timeFormatted}`}>
        <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />
        <span>Delayed / Stale</span>
        <span className="text-amber-400/70 font-mono text-[10px]">({timeFormatted})</span>
      </div>
    );
  }

  // Case 3: Live
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/30 text-emerald-300 border border-emerald-500/30" title={`Live quote timestamp: ${timeFormatted}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
      <span>Live</span>
      <span className="text-emerald-400/60 font-mono text-[10px]">({timeFormatted})</span>
    </div>
  );
};
