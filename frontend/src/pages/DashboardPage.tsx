import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client.js';
import { WatchlistSymbol, SignificanceEvent } from '../api/types.js';
import { useAuth } from '../hooks/useAuth.js';
import { useWatchlistSocket, LiveQuoteUpdate } from '../hooks/useWatchlistSocket.js';
import { Header } from '../components/Header.js';
import { MetricStatsRow } from '../components/MetricStatsRow.js';
import { AttentionFeed } from '../components/AttentionFeed.js';
import { WatchlistTable } from '../components/WatchlistTable.js';
import { AddSymbolModal } from '../components/AddSymbolModal.js';
import { DemoChaosBar } from '../components/DemoChaosBar.js';
import { RefreshCw } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<WatchlistSymbol[]>([]);
  const [feedEvents, setFeedEvents] = useState<SignificanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isChaosOpen, setIsChaosOpen] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [priceFlashes, setPriceFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const [marketOpen, setMarketOpen] = useState(true);

  const prevPricesRef = useRef<Record<string, number>>({});

  // 1. Initial Load: Fetch Watchlist, Feed, and Market Status
  const loadData = useCallback(async (commit = false) => {
    try {
      const [feedRes, watchlistRes, chaosRes] = await Promise.all([
        api.getAttentionFeed(),
        api.getWatchlist(commit),
        api.getChaosStatus(),
      ]);

      setFeedEvents(feedRes.feed || []);
      setItems(watchlistRes.items || []);
      setMarketOpen(chaosRes.status.marketOpen);

      // Track prices for flashing
      (watchlistRes.items || []).forEach(item => {
        prevPricesRef.current[item.symbol] = item.currentPrice;
      });
    } catch (err) {
      console.error('[Dashboard Error loading data]:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // 2. Real-time WebSocket handlers
  const handleLiveQuote = useCallback((quote: LiveQuoteUpdate) => {
    setItems(currentItems => {
      return currentItems.map(item => {
        if (item.symbol.toUpperCase() === quote.symbol.toUpperCase()) {
          const prevPrice = prevPricesRef.current[item.symbol] || item.currentPrice;

          // Flash visual effect
          if (quote.price > prevPrice) {
            setPriceFlashes(f => ({ ...f, [item.symbol]: 'up' }));
            setTimeout(() => setPriceFlashes(f => {
              const copy = { ...f };
              delete copy[item.symbol];
              return copy;
            }), 1000);
          } else if (quote.price < prevPrice) {
            setPriceFlashes(f => ({ ...f, [item.symbol]: 'down' }));
            setTimeout(() => setPriceFlashes(f => {
              const copy = { ...f };
              delete copy[item.symbol];
              return copy;
            }), 1000);
          }
          prevPricesRef.current[item.symbol] = quote.price;

          // Recompute delta since user last visited
          const baselinePrice = item.lastSeenPrice;
          let deltaSinceLastSeen = item.deltaSinceLastSeen;
          let pctSinceLastSeen = item.pctSinceLastSeen;
          if (baselinePrice && baselinePrice > 0) {
            deltaSinceLastSeen = Number((quote.price - baselinePrice).toFixed(2));
            pctSinceLastSeen = Number((((quote.price - baselinePrice) / baselinePrice) * 100).toFixed(2));
          }

          return {
            ...item,
            currentPrice: quote.price,
            currentVolume: quote.volume,
            updatedAt: quote.at,
            stale: quote.stale,
            marketStatus: quote.marketStatus,
            deltaSinceLastSeen,
            pctSinceLastSeen,
          };
        }
        return item;
      });
    });
  }, []);

  const handleSignificantEvent = useCallback((event: SignificanceEvent) => {
    setFeedEvents(prev => [event, ...prev.filter(e => e.id !== event.id)]);

    setItems(currentItems => {
      return currentItems.map(item => {
        if (item.symbol.toUpperCase() === event.symbol.toUpperCase()) {
          return {
            ...item,
            significanceScore: event.score,
            isMeaningful: true,
            dominantSignal: event.eventType as any,
            reason: event.reason,
          };
        }
        return item;
      });
    });
  }, []);

  const watchedSymbols = items.map(i => i.symbol);
  const { connected: wsConnected } = useWatchlistSocket(
    token,
    watchedSymbols,
    handleLiveQuote,
    handleSignificantEvent
  );

  // 3. User Actions
  const handleAcknowledgeAll = async () => {
    setIsAcknowledging(true);
    try {
      await api.ackWatchlist();
      await loadData(false);
    } catch (err) {
      console.error('[Ack Error]:', err);
    } finally {
      setIsAcknowledging(false);
    }
  };

  const handleAcknowledgeSymbol = async (symbol: string) => {
    try {
      await api.ackWatchlist([symbol]);
      await loadData(false);
    } catch (err) {
      console.error('[Ack Symbol Error]:', err);
    }
  };

  const handleAddSymbol = async (symbol: string) => {
    await api.addSymbol(symbol);
    await loadData(false);
  };

  const handleRemoveSymbol = async (symbol: string) => {
    try {
      await api.removeSymbol(symbol);
      setItems(items => items.filter(i => i.symbol.toUpperCase() !== symbol.toUpperCase()));
    } catch (err) {
      console.error('[Remove Error]:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070a11]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-9 h-9 text-sky-400 animate-spin" />
          <p className="text-xs font-mono font-bold tracking-wider uppercase text-slate-400">
            Initializing Signal Telemetry...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 1. Top Navbar & Live Ticker Ribbon */}
      <Header
        wsConnected={wsConnected}
        marketOpen={marketOpen}
        symbols={items}
        chaosOpen={isChaosOpen}
        onToggleChaos={() => setIsChaosOpen(!isChaosOpen)}
      />

      {/* 2. Interactive Chaos / Evaluator Lab Bar */}
      {isChaosOpen && (
        <DemoChaosBar
          watchedSymbols={watchedSymbols}
          onTriggerComplete={() => loadData(false)}
        />
      )}

      {/* 3. Metrics Stats Row */}
      <MetricStatsRow items={items} />

      {/* 4. Primary Hero Section: "Since You Last Checked" Ranked Attention Feed */}
      <AttentionFeed
        items={items}
        feedEvents={feedEvents}
        onAcknowledgeAll={handleAcknowledgeAll}
        onAcknowledgeSymbol={handleAcknowledgeSymbol}
        isAcknowledging={isAcknowledging}
      />

      {/* 5. Secondary Section: Full Watchlist Inventory Table */}
      <WatchlistTable
        items={items}
        priceFlashes={priceFlashes}
        onRemoveSymbol={handleRemoveSymbol}
        onOpenAddModal={() => setIsAddModalOpen(true)}
      />

      {/* 6. Add Symbol Modal */}
      <AddSymbolModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddSymbol}
        existingSymbols={watchedSymbols}
      />

      {/* 7. Footer */}
      <footer className="mt-12 py-6 border-t border-slate-800/80 text-center text-xs text-slate-400 font-mono flex items-center justify-center gap-2 flex-wrap">
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
  );
};
