import React, { useState } from 'react';
import { Trash2, TrendingUp, TrendingDown, Search, Plus, ArrowUpDown, Filter, Sparkles } from 'lucide-react';
import { WatchlistSymbol } from '../api/types.js';
import { StalenessBadge } from './StalenessBadge.js';
import { ReasonChip } from './ReasonChip.js';
import { Sparkline } from './Sparkline.js';

interface WatchlistTableProps {
  items: WatchlistSymbol[];
  priceFlashes: Record<string, 'up' | 'down'>;
  onRemoveSymbol: (symbol: string) => void;
  onOpenAddModal: () => void;
}

export const WatchlistTable: React.FC<WatchlistTableProps> = ({
  items,
  priceFlashes,
  onRemoveSymbol,
  onOpenAddModal,
}) => {
  const [filterText, setFilterText] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'actionable' | 'gainers' | 'losers'>('all');
  const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'delta' | 'score'>('score');
  const [sortAsc, setSortAsc] = useState(false);

  // Tab Filtering
  const tabFiltered = items.filter(item => {
    if (activeTab === 'actionable') return item.isMeaningful || item.significanceScore >= 1.5;
    if (activeTab === 'gainers') return item.deltaSinceLastSeen > 0;
    if (activeTab === 'losers') return item.deltaSinceLastSeen < 0;
    return true;
  });

  // Text Filtering and Sorting
  const displayedItems = tabFiltered
    .filter(
      item =>
        item.symbol.toLowerCase().includes(filterText.toLowerCase()) ||
        item.name.toLowerCase().includes(filterText.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'symbol') comparison = a.symbol.localeCompare(b.symbol);
      else if (sortBy === 'price') comparison = a.currentPrice - b.currentPrice;
      else if (sortBy === 'delta') comparison = a.pctSinceLastSeen - b.pctSinceLastSeen;
      else if (sortBy === 'score') comparison = a.significanceScore - b.significanceScore;
      return sortAsc ? comparison : -comparison;
    });

  const handleSort = (field: 'symbol' | 'price' | 'delta' | 'score') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <section className="glass-panel p-6 border-slate-800/90 shadow-2xl">
      {/* Top Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>Watchlist Inventory</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-800 text-slate-300">
              {displayedItems.length} of {items.length}
            </span>
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Your watchlist, live and ready to act on.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Segment Filter Pills */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'all' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('actionable')}
              className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                activeTab === 'actionable' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Actionable</span>
            </button>
            <button
              onClick={() => setActiveTab('gainers')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'gainers' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gainers
            </button>
            <button
              onClick={() => setActiveTab('losers')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                activeTab === 'losers' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Losers
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ticker or name..."
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 w-44 sm:w-52 transition-colors"
            />
          </div>

          {/* Add Asset Button */}
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* Modern Table Container */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-[11px] uppercase bg-slate-900/90 text-slate-400 border-b border-slate-800 font-bold tracking-wider">
            <tr>
              <th
                onClick={() => handleSort('symbol')}
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Asset</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleSort('price')}
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Price</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                onClick={() => handleSort('delta')}
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Delta (Since Last Visit)</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3.5 px-4">Recent Trend</th>
              <th
                onClick={() => handleSort('score')}
                className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Significance</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3.5 px-4">Signal Reason</th>
              <th className="py-3.5 px-4">Telemetry</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
            {displayedItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-500">
                  {filterText ? 'No matching assets found.' : 'No items match the selected segment.'}
                </td>
              </tr>
            ) : (
              displayedItems.map(item => {
                const flash = priceFlashes[item.symbol];
                const flashClass = flash === 'up' ? 'tick-flash-up' : flash === 'down' ? 'tick-flash-down' : '';
                const isPositive = item.deltaSinceLastSeen >= 0;
                const deltaSign = isPositive ? '+' : '';

                const sparkPoints = [
                  item.lastSeenPrice || item.currentPrice,
                  (item.lastSeenPrice || item.currentPrice) * (1 + (isPositive ? 0.003 : -0.003)),
                  (item.lastSeenPrice || item.currentPrice) * (1 + (isPositive ? 0.009 : -0.009)),
                  (item.lastSeenPrice || item.currentPrice) * (1 + (isPositive ? 0.006 : -0.006)),
                  item.currentPrice,
                ];

                return (
                  <tr
                    key={item.symbol}
                    className={`hover:bg-slate-800/40 transition-colors ${flashClass}`}
                  >
                    {/* Symbol & Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/80 flex items-center justify-center font-mono font-bold text-white text-xs">
                          {item.symbol.substring(0, 2)}
                        </div>
                        <div>
                          <span className="font-mono font-extrabold text-white text-sm block">
                            {item.symbol}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate max-w-[120px] block">
                            {item.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Current Price */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-base font-bold text-white">
                        ${item.currentPrice.toFixed(2)}
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Vol: {item.currentVolume.toLocaleString()}
                      </div>
                    </td>

                    {/* Delta Since Last Seen */}
                    <td className="py-3 px-4">
                      {item.hasBaseline ? (
                        <div>
                          <div
                            className={`font-mono font-bold text-xs flex items-center gap-1 ${
                              isPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            <span>
                              {deltaSign}${Math.abs(item.deltaSinceLastSeen).toFixed(2)} ({deltaSign}{item.pctSinceLastSeen.toFixed(2)}%)
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            from ${item.lastSeenPrice?.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Initial baseline</span>
                      )}
                    </td>

                    {/* Sparkline */}
                    <td className="py-3 px-4">
                      <Sparkline data={sparkPoints} isPositive={isPositive} width={75} height={24} />
                    </td>

                    {/* Significance Score */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-bold ${
                            item.significanceScore >= 2.0
                              ? 'bg-purple-950/70 text-purple-300 border border-purple-500/50'
                              : item.significanceScore >= 1.5
                              ? 'bg-sky-950/70 text-sky-300 border border-sky-500/50'
                              : 'bg-slate-800/70 text-slate-400 border border-slate-700/50'
                          }`}
                        >
                          {item.significanceScore.toFixed(1)}
                        </div>
                        {item.isMeaningful && (
                          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" title="Actionable shift" />
                        )}
                      </div>
                    </td>

                    {/* Reason Chip */}
                    <td className="py-3 px-4">
                      <ReasonChip
                        reason={item.reason}
                        dominantSignal={item.dominantSignal}
                      />
                    </td>

                    {/* Staleness / Status */}
                    <td className="py-3 px-4">
                      <StalenessBadge
                        stale={item.stale}
                        marketStatus={item.marketStatus}
                        updatedAt={item.updatedAt}
                      />
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onRemoveSymbol(item.symbol)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        title={`Remove ${item.symbol} from watchlist`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
