import React from 'react';
import { Sparkles, CheckCheck, Clock, TrendingUp, TrendingDown, Check, ShieldCheck, Zap, Award, Activity } from 'lucide-react';
import { WatchlistSymbol, SignificanceEvent } from '../api/types.js';
import { ReasonChip } from './ReasonChip.js';
import { Sparkline } from './Sparkline.js';

interface AttentionFeedProps {
  items: WatchlistSymbol[];
  feedEvents: SignificanceEvent[];
  onAcknowledgeAll: () => void;
  onAcknowledgeSymbol?: (symbol: string) => void;
  isAcknowledging: boolean;
}

export const AttentionFeed: React.FC<AttentionFeedProps> = ({
  items,
  feedEvents,
  onAcknowledgeAll,
  onAcknowledgeSymbol,
  isAcknowledging,
}) => {
  // Filter symbols with meaningful change or high significance score
  const attentionItems = items
    .filter(item => item.isMeaningful || item.significanceScore >= 1.5)
    .sort((a, b) => b.significanceScore - a.significanceScore);

  return (
    <section className="glass-panel p-6 mb-8 border border-sky-500/25 bg-gradient-to-b from-[#0e172e]/90 via-[#0a0f1d]/95 to-[#070a13] relative overflow-hidden shadow-2xl">
      {/* Background ambient mesh glow */}
      <div className="absolute top-0 right-1/3 w-[500px] h-40 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-gradient-to-r from-sky-500/20 to-indigo-500/20 text-sky-300 border border-sky-500/40">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Prioritized Attention Engine
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 text-[10px] font-mono font-semibold border border-slate-700">
              Threshold: &gt;1.5
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <span>Signals Worth Watching</span>
            {attentionItems.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-sky-500 text-slate-950">
                {attentionItems.length}
              </span>
            )}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
            Prioritized changes across your watchlist.
          </p>
        </div>

        {attentionItems.length > 0 && (
          <button
            onClick={onAcknowledgeAll}
            disabled={isAcknowledging}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
            title="Reset read baseline for all assets to current prices"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{isAcknowledging ? 'Acknowledging...' : 'Acknowledge All & Reset Baseline'}</span>
          </button>
        )}
      </div>

      {/* Feed Content */}
      {attentionItems.length === 0 ? (
        <div className="relative z-10 py-10 px-6 rounded-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/70 border border-slate-800/90 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3.5 shadow-lg shadow-emerald-500/10">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white tracking-tight">
            Noise Filter Active: No Significant Anomalies
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mt-1.5 leading-relaxed">
            All watched assets are trading within their normal rolling volatility bands.
            No false alarms triggered. Use the <strong>Chaos Lab</strong> above to simulate a price spike or volume surge.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
          {attentionItems.map((item, idx) => {
            const isPositive = item.deltaSinceLastSeen >= 0;
            const deltaSign = isPositive ? '+' : '';
            const lastCheckTime = item.lastSeenAt
              ? new Date(item.lastSeenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Initial Check';

            // Generate synthetic recent trend points around baseline and current price
            const sparkPoints = [
              item.lastSeenPrice || item.currentPrice,
              (item.lastSeenPrice || item.currentPrice) * (1 + (isPositive ? 0.005 : -0.005)),
              (item.lastSeenPrice || item.currentPrice) * (1 + (isPositive ? 0.012 : -0.012)),
              (item.lastSeenPrice || item.currentPrice) * (1 + (isPositive ? 0.008 : -0.008)),
              item.currentPrice,
            ];

            // Badge gradient
            let scoreBorderClass = 'border-sky-500/40 bg-sky-950/40 text-sky-300';
            if (item.significanceScore >= 3.0) {
              scoreBorderClass = 'border-purple-500/60 bg-gradient-to-br from-purple-950/60 to-pink-950/60 text-purple-200 shadow-lg shadow-purple-500/20';
            } else if (item.significanceScore >= 2.0) {
              scoreBorderClass = 'border-amber-500/50 bg-gradient-to-br from-amber-950/50 to-orange-950/50 text-amber-200';
            }

            return (
              <div
                key={item.symbol}
                className="glass-card-attention rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 group relative"
              >
                <div>
                  {/* Top Line: Ticker, Name, Significance Pill */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-mono font-bold text-white text-base shadow-sm">
                        {item.symbol.substring(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-lg font-extrabold text-white tracking-tight">
                            {item.symbol}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-400">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                          {item.name}
                        </div>
                      </div>
                    </div>

                    {/* Significance Score Badge */}
                    <div
                      className={`flex flex-col items-end px-3 py-1 rounded-xl border ${scoreBorderClass}`}
                      title={`Significance Score: ${item.significanceScore.toFixed(2)}`}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                        Score
                      </span>
                      <span className="font-mono text-base font-black">
                        {item.significanceScore.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  {/* Middle Box: Price Delta & Mini Sparkline */}
                  <div className="my-3 p-3.5 rounded-xl bg-[#090d17]/80 border border-slate-800/90 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                        Move Since Last Visit
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span
                          className={`font-mono text-xl font-black flex items-center ${
                            isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                          {deltaSign}${Math.abs(item.deltaSinceLastSeen).toFixed(2)}
                        </span>
                        <span
                          className={`font-mono text-xs font-bold ${
                            isPositive ? 'text-emerald-400/90' : 'text-rose-400/90'
                          }`}
                        >
                          ({deltaSign}{item.pctSinceLastSeen.toFixed(2)}%)
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Baseline: ${item.lastSeenPrice?.toFixed(2) || item.currentPrice.toFixed(2)} ({lastCheckTime})</span>
                      </div>
                    </div>

                    {/* Mini Sparkline trend */}
                    <div className="shrink-0">
                      <Sparkline data={sparkPoints} isPositive={isPositive} width={80} height={32} />
                    </div>
                  </div>

                  {/* Deterministic Reason Chip */}
                  <div className="mt-2">
                    <ReasonChip
                      reason={item.reason}
                      dominantSignal={item.dominantSignal}
                      score={item.significanceScore}
                    />
                  </div>
                </div>

                {/* Card Footer: Mathematical Breakdown Telemetry */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  {item.breakdown && (
                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                      <span title="Price deviation divided by rolling volatility">
                        z: <strong className="text-slate-200">{item.breakdown.priceZ}σ</strong>
                      </span>
                      <span title="Volume ratio vs 20-period average">
                        vol: <strong className="text-slate-200">{item.breakdown.volumeRatio}x</strong>
                      </span>
                      <span title="Stock 30-tick rolling volatility">
                        σ: <strong className="text-slate-200">{item.breakdown.rollingVolatility.toFixed(1)}%</strong>
                      </span>
                    </div>
                  )}

                  {onAcknowledgeSymbol && (
                    <button
                      onClick={() => onAcknowledgeSymbol(item.symbol)}
                      className="p-1 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-sky-950/40 transition-colors"
                      title="Acknowledge this asset and reset baseline"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
