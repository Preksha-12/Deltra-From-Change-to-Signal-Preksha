import React from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, Award } from 'lucide-react';

interface ReasonChipProps {
  reason: string;
  dominantSignal?: 'price_move' | 'volume_spike' | 'level_break' | 'composite';
  score?: number;
}

export const ReasonChip: React.FC<ReasonChipProps> = ({
  reason,
  dominantSignal = 'price_move',
  score,
}) => {
  let icon = <Activity className="w-3.5 h-3.5" />;
  let colorClasses = 'bg-sky-950/40 text-sky-300 border-sky-500/30';

  if (dominantSignal === 'level_break' || reason.toLowerCase().includes('52-week') || reason.toLowerCase().includes('moving average')) {
    icon = <Award className="w-3.5 h-3.5 text-purple-400" />;
    colorClasses = 'bg-purple-950/40 text-purple-300 border-purple-500/30';
  } else if (dominantSignal === 'volume_spike' || reason.toLowerCase().includes('volume')) {
    icon = <Zap className="w-3.5 h-3.5 text-amber-400" />;
    colorClasses = 'bg-amber-950/40 text-amber-300 border-amber-500/30';
  } else if (reason.includes('+')) {
    icon = <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
    colorClasses = 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30';
  } else if (reason.includes('-')) {
    icon = <TrendingDown className="w-3.5 h-3.5 text-rose-400" />;
    colorClasses = 'bg-rose-950/40 text-rose-300 border-rose-500/30';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${colorClasses}`}>
      {icon}
      <span>{reason}</span>
      {score !== undefined && (
        <span className="ml-1 px-1.5 py-0.2 rounded bg-white/10 font-mono text-[10px] text-white/80">
          ★ {score.toFixed(1)}
        </span>
      )}
    </div>
  );
};
