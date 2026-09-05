import React, { useState } from 'react';
import { X, Plus, AlertCircle, TrendingUp, Search, Check } from 'lucide-react';

interface AddSymbolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (symbol: string) => Promise<void>;
  existingSymbols: string[];
}

const POPULAR_SUGGESTIONS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 229.0 },
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: 125.1 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 213.5 },
  { symbol: 'MSFT', name: 'Microsoft Corp', price: 427.1 },
  { symbol: 'AMZN', name: 'Amazon.com', price: 186.8 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 168.2 },
  { symbol: 'META', name: 'Meta Platforms', price: 512.6 },
];

export const AddSymbolModal: React.FC<AddSymbolModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  existingSymbols,
}) => {
  const [symbolInput, setSymbolInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (symToAdd: string) => {
    const cleanSym = symToAdd.trim().toUpperCase();
    if (!cleanSym) return;

    if (existingSymbols.map(s => s.toUpperCase()).includes(cleanSym)) {
      setError(`${cleanSym} is already in your watchlist`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onAdd(cleanSym);
      setSymbolInput('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add symbol');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-lg p-6 border-slate-700/80 shadow-2xl relative bg-[#0d1424]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-5">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            MARKET UNIVERSE
          </span>
          <h3 className="text-xl font-extrabold text-white mt-1.5 tracking-tight">Track New Equity</h3>
          <p className="text-xs text-slate-400 mt-1">
            Add any ticker symbol to initialize baseline state tracking and signal detection.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={e => {
            e.preventDefault();
            handleSubmit(symbolInput);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Enter Symbol
            </label>
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="e.g. AMD, PLTR, NFLX, COIN"
                  value={symbolInput}
                  onChange={e => setSymbolInput(e.target.value.toUpperCase())}
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 uppercase font-mono font-bold"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !symbolInput.trim()}
                className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{loading ? 'Adding...' : 'Add Symbol'}</span>
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Suggested Market Leaders:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {POPULAR_SUGGESTIONS.map(item => {
                const isAlreadyAdded = existingSymbols.map(s => s.toUpperCase()).includes(item.symbol);
                return (
                  <button
                    key={item.symbol}
                    type="button"
                    disabled={isAlreadyAdded || loading}
                    onClick={() => handleSubmit(item.symbol)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isAlreadyAdded
                        ? 'border-slate-800 bg-slate-950/60 opacity-50 cursor-not-allowed'
                        : 'border-slate-700/80 hover:border-sky-500/60 bg-slate-900/60 hover:bg-slate-800/80 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-mono font-bold text-sm text-white">
                        {item.symbol}
                      </span>
                      {isAlreadyAdded ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <span className="font-mono text-[11px] text-slate-400">
                          ${item.price.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 truncate">
                      {isAlreadyAdded ? 'Already Tracked' : item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
