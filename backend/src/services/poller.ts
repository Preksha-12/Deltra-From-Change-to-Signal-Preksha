import { getDbClient } from '../db/client.js';
import { cache, CachedQuote, MarketTick } from '../cache/redis.js';
import { marketSim } from '../sim/marketGenerator.js';
import {
  calculateRollingVolatility,
  calculateAverageVolume,
  calculateSignificance,
} from './significanceEngine.js';
import { config } from '../config/env.js';

export class MarketPoller {
  private pollTimer: NodeJS.Timeout | null = null;
  private snapshotTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastSnapshotTime = 0;

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Poller] Starting Market Poller (Cycle: ${config.pollIntervalMs}ms)...`);

    // Run initial tick immediately
    await this.pollCycle();

    // Schedule periodic polling
    this.pollTimer = setInterval(async () => {
      try {
        await this.pollCycle();
      } catch (err) {
        console.error('[Poller Error in cycle]:', err);
      }
    }, config.pollIntervalMs);

    // Schedule Postgres snapshot write (slower cadence e.g. 15s to prevent write amplification)
    this.snapshotTimer = setInterval(async () => {
      try {
        await this.flushSnapshotsToDb();
      } catch (err) {
        console.error('[Poller Error in snapshot flush]:', err);
      }
    }, config.snapshotIntervalMs);
  }

  public stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.isRunning = false;
    console.log('[Poller] Stopped.');
  }

  /**
   * Reads the distinct set of watched symbols from database dynamically.
   * A symbol added mid-cycle is picked up on the next tick without restarting!
   */
  private async getDistinctSymbols(): Promise<string[]> {
    try {
      const db = await getDbClient();
      const res = await db.query<{ symbol: string }>(
        `SELECT DISTINCT symbol FROM watchlist_items`
      );
      const dbSymbols = res.rows.map(r => r.symbol.toUpperCase());
      
      // Always ensure high-visibility market core symbols exist for reference
      const defaultCore = ['AAPL', 'NVDA', 'TSLA', 'MSFT'];
      const combined = Array.from(new Set([...defaultCore, ...dbSymbols]));
      return combined;
    } catch (err) {
      console.warn('[Poller] Could not fetch distinct symbols, using core:', (err as Error).message);
      return ['AAPL', 'NVDA', 'TSLA', 'MSFT'];
    }
  }

  /**
   * Main polling cycle
   */
  public async pollCycle(): Promise<void> {
    const symbols = await this.getDistinctSymbols();
    const isMarketOpen = marketSim.isMarketOpen();

    for (const symbol of symbols) {
      try {
        await this.processSymbolTick(symbol, isMarketOpen);
      } catch (err) {
        console.error(`[Poller] Error processing tick for ${symbol}:`, err);
      }
    }
  }

  private async processSymbolTick(symbol: string, isMarketOpen: boolean): Promise<void> {
    const upper = symbol.toUpperCase();
    const existingQuote = await cache.getQuote(upper);

    // Generate simulated tick
    const { tick, status } = marketSim.generateTick(upper);

    // 1. Handle Market Closed
    if (status === 'closed' || !isMarketOpen) {
      if (existingQuote) {
        // Mark market as closed without overwriting price
        existingQuote.marketStatus = 'closed';
        existingQuote.stale = false;
        await cache.setQuote(upper, existingQuote);
        await cache.publish(`symbol:${upper}`, { type: 'quote', quote: existingQuote });
      }
      return;
    }

    // 2. Handle Provider Lag / Data Unavailable (no tick generated)
    if (status === 'paused' || !tick) {
      if (existingQuote) {
        const timeSinceUpdate = Date.now() - existingQuote.timestamp;
        if (timeSinceUpdate > 8000) {
          // Flag as stale
          existingQuote.stale = true;
          await cache.setQuote(upper, existingQuote);
          await cache.publish(`symbol:${upper}`, { type: 'quote', quote: existingQuote });
        }
      }
      return;
    }

    // 3. Handle Out-Of-Order / Late-Arriving Ticks ("Apply if newer" rule)
    if (existingQuote && tick.timestamp <= existingQuote.timestamp) {
      console.warn(`[Poller] Dropped out-of-order tick for ${upper}: tick.ts (${tick.timestamp}) <= cached.ts (${existingQuote.timestamp})`);
      return;
    }

    // 4. Update Hot Redis Cache
    const newQuote: CachedQuote = {
      symbol: upper,
      price: tick.price,
      volume: tick.volume,
      timestamp: tick.timestamp,
      source: tick.source,
      updatedAt: new Date(tick.timestamp).toISOString(),
      marketStatus: 'open',
      stale: false,
    };
    await cache.setQuote(upper, newQuote);

    // Push into rolling buffer for volatility and volume stats
    await cache.pushTick(upper, tick, 100);

    // 5. Evaluate Significance Engine
    await this.evaluateSignificance(upper, tick, existingQuote);

    // 6. Publish quote update to Redis Pub/Sub for WebSocket fan-out
    await cache.publish(`symbol:${upper}`, { type: 'quote', quote: newQuote });
  }

  private async evaluateSignificance(
    symbol: string,
    currentTick: MarketTick,
    prevQuote: CachedQuote | null
  ): Promise<void> {
    const recentTicks = await cache.getRecentTicks(symbol, 30);
    const meta = marketSim.getSymbolMeta(symbol);

    const rollingVol = calculateRollingVolatility(recentTicks);
    const avgVol = calculateAverageVolume(recentTicks, 20);

    const stats52w = {
      high52w: meta?.high52w || currentTick.price * 1.3,
      low52w: meta?.low52w || currentTick.price * 0.7,
      sma50: meta?.sma50,
    };

    // Calculate baseline significance against previous tick or recent period
    const breakdown = calculateSignificance({
      currentPrice: currentTick.price,
      currentVolume: currentTick.volume,
      prevPrice: prevQuote ? prevQuote.price : currentTick.price,
      lastSeenPrice: prevQuote ? prevQuote.price : currentTick.price,
      rollingVolatility: rollingVol,
      avgVolume20: avgVol,
      stats52w,
    });

    // If score crosses the threshold, persist durable event and publish live alert
    if (breakdown.isMeaningful || currentTick.isSpike) {
      const db = await getDbClient();
      const eventType = breakdown.dominantSignal;
      const detail = {
        price: currentTick.price,
        prevPrice: prevQuote?.price,
        volume: currentTick.volume,
        avgVolume20: avgVol,
        rollingVolatility: rollingVol,
        priceZ: breakdown.priceZ,
        volumeRatio: breakdown.volumeRatio,
        levelBreakType: breakdown.levelBreakType,
        reason: breakdown.reason,
      };

      const res = await db.query<{ id: string }>(
        `INSERT INTO significance_events (symbol, event_type, score, detail, detected_at)
         VALUES ($1, $2, $3, $4, now())
         RETURNING id`,
        [symbol, eventType, breakdown.score, JSON.stringify(detail)]
      );

      const eventPayload = {
        type: 'significant_event',
        id: res.rows[0]?.id,
        symbol,
        score: breakdown.score,
        eventType,
        detail,
        reason: breakdown.reason,
        at: new Date().toISOString(),
      };

      await cache.publish(`symbol:${symbol}`, eventPayload);
    }
  }

  /**
   * Flushes in-memory quotes to durable PostgreSQL symbol_snapshots on slower cadence
   */
  private async flushSnapshotsToDb(): Promise<void> {
    const symbols = await this.getDistinctSymbols();
    const quotes = await cache.getMultiQuotes(symbols);
    if (quotes.size === 0) return;

    const db = await getDbClient();
    for (const [symbol, quote] of quotes.entries()) {
      await db.query(
        `INSERT INTO symbol_snapshots (symbol, last_price, last_volume, source, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (symbol) DO UPDATE SET
           last_price = EXCLUDED.last_price,
           last_volume = EXCLUDED.last_volume,
           source = EXCLUDED.source,
           updated_at = EXCLUDED.updated_at`,
        [symbol, quote.price, quote.volume, quote.source, quote.updatedAt]
      );
    }
  }
}

export const marketPoller = new MarketPoller();
