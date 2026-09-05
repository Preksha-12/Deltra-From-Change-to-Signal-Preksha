import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDbClient } from '../db/client.js';
import { cache } from '../cache/redis.js';
import { marketSim } from '../sim/marketGenerator.js';
import {
  calculateRollingVolatility,
  calculateAverageVolume,
  calculateSignificance,
} from '../services/significanceEngine.js';

const AddSymbolSchema = z.object({
  symbol: z.string().min(1).max(10).trim(),
});

export const watchlistRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /watchlist
  fastify.get('/watchlist', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const db = await getDbClient();
    const queryParams = request.query as { commit?: string };
    const shouldCommit = queryParams.commit !== 'false';

    // 1. Get user's watchlist items
    const watchlistRes = await db.query<{ symbol: string; added_at: string }>(
      `SELECT symbol, added_at FROM watchlist_items WHERE user_id = $1 ORDER BY added_at ASC`,
      [userId]
    );
    const symbols = watchlistRes.rows.map(r => r.symbol.toUpperCase());

    if (symbols.length === 0) {
      return reply.send({ items: [], count: 0 });
    }

    // 2. Fetch user's previous "last seen" cursor states
    const stateRes = await db.query<{
      symbol: string;
      last_seen_price: string | null;
      last_seen_at: string | null;
      last_seen_volume: string | null;
    }>(
      `SELECT symbol, last_seen_price, last_seen_at, last_seen_volume
       FROM user_symbol_state
       WHERE user_id = $1 AND symbol = ANY($2)`,
      [userId, symbols]
    );
    const stateMap = new Map<string, { lastSeenPrice: number | null; lastSeenAt: string | null }>();
    stateRes.rows.forEach(r => {
      stateMap.set(r.symbol.toUpperCase(), {
        lastSeenPrice: r.last_seen_price ? parseFloat(r.last_seen_price) : null,
        lastSeenAt: r.last_seen_at,
      });
    });

    // 3. Fetch latest quotes from Redis cache
    const quotes = await cache.getMultiQuotes(symbols);

    // 4. Build enriched response with significance score & deterministic reason string
    const items = [];
    const updatesToCommit: Array<{ symbol: string; price: number; volume: number }> = [];

    for (const item of watchlistRes.rows) {
      const sym = item.symbol.toUpperCase();
      let quote = quotes.get(sym);

      // If not yet in cache, fetch metadata or generate initial tick
      if (!quote) {
        const meta = marketSim.registerSymbolIfMissing(sym);
        quote = {
          symbol: sym,
          price: meta.currentPrice,
          volume: meta.currentVolume,
          timestamp: Date.now(),
          source: 'sim-engine-v1',
          updatedAt: new Date().toISOString(),
          marketStatus: marketSim.isMarketOpen() ? 'open' : 'closed',
          stale: false,
        };
      }

      const meta = marketSim.getSymbolMeta(sym);
      const userState = stateMap.get(sym);
      const hasBaseline = userState && userState.lastSeenPrice !== null;
      const baselinePrice = hasBaseline ? userState.lastSeenPrice! : null;

      // Price delta since this specific user last visited
      let deltaSinceLastSeen = 0;
      let pctSinceLastSeen = 0;
      if (hasBaseline && baselinePrice && baselinePrice > 0) {
        deltaSinceLastSeen = Number((quote.price - baselinePrice).toFixed(2));
        pctSinceLastSeen = Number((((quote.price - baselinePrice) / baselinePrice) * 100).toFixed(2));
      }

      // Compute rolling stats for significance
      const recentTicks = await cache.getRecentTicks(sym, 20);
      const rollingVol = calculateRollingVolatility(recentTicks);
      const avgVol = calculateAverageVolume(recentTicks, 20);
      const stats52w = {
        high52w: meta?.high52w || quote.price * 1.3,
        low52w: meta?.low52w || quote.price * 0.7,
        sma50: meta?.sma50,
      };

      const significance = calculateSignificance({
        currentPrice: quote.price,
        currentVolume: quote.volume,
        lastSeenPrice: baselinePrice,
        prevPrice: baselinePrice || quote.price,
        rollingVolatility: rollingVol,
        avgVolume20: avgVol,
        stats52w,
      });

      items.push({
        symbol: sym,
        name: meta?.name || `${sym} Corp`,
        currentPrice: quote.price,
        currentVolume: quote.volume,
        updatedAt: quote.updatedAt,
        stale: quote.stale,
        marketStatus: quote.marketStatus,
        lastSeenPrice: baselinePrice,
        lastSeenAt: userState?.lastSeenAt || null,
        hasBaseline,
        deltaSinceLastSeen,
        pctSinceLastSeen,
        significanceScore: significance.score,
        isMeaningful: significance.isMeaningful,
        dominantSignal: significance.dominantSignal,
        reason: significance.reason,
        breakdown: {
          priceZ: significance.priceZ,
          volumeRatio: significance.volumeRatio,
          levelBreak: significance.levelBreak,
          rollingVolatility: rollingVol,
        },
      });

      updatesToCommit.push({
        symbol: sym,
        price: quote.price,
        volume: quote.volume,
      });
    }

    // Side effect: update user_symbol_state to "now" (viewing IS marking as seen)
    if (shouldCommit) {
      for (const u of updatesToCommit) {
        await db.query(
          `INSERT INTO user_symbol_state (user_id, symbol, last_seen_price, last_seen_at, last_seen_volume)
           VALUES ($1, $2, $3, now(), $4)
           ON CONFLICT (user_id, symbol) DO UPDATE SET
             last_seen_price = EXCLUDED.last_seen_price,
             last_seen_at = EXCLUDED.last_seen_at,
             last_seen_volume = EXCLUDED.last_seen_volume`,
          [userId, u.symbol, u.price, u.volume]
        );
      }
    }

    return reply.send({ items, count: items.length });
  });

  // POST /watchlist (Add symbol)
  fastify.post('/watchlist', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const parseResult = AddSymbolSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid symbol format',
        details: parseResult.error.errors.map(e => e.message),
      });
    }

    const rawSymbol = parseResult.data.symbol.toUpperCase();
    const userId = (request as any).user.userId;
    const db = await getDbClient();

    // Validate ticker (alphanumeric, 1-8 chars)
    if (!/^[A-Z0-9.\-]{1,8}$/.test(rawSymbol)) {
      return reply.status(400).send({ error: `Invalid ticker symbol format: "${rawSymbol}"` });
    }

    // Check duplicate
    const existing = await db.query(
      `SELECT id FROM watchlist_items WHERE user_id = $1 AND symbol = $2`,
      [userId, rawSymbol]
    );
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: `Symbol ${rawSymbol} is already in your watchlist` });
    }

    // Register ticker with market generator
    const meta = marketSim.registerSymbolIfMissing(rawSymbol);

    // Insert into watchlist
    await db.query(
      `INSERT INTO watchlist_items (user_id, symbol, added_at) VALUES ($1, $2, now())`,
      [userId, rawSymbol]
    );

    // Seed current price into user_symbol_state so first view starts from here
    await db.query(
      `INSERT INTO user_symbol_state (user_id, symbol, last_seen_price, last_seen_at, last_seen_volume)
       VALUES ($1, $2, $3, now(), $4)
       ON CONFLICT (user_id, symbol) DO NOTHING`,
      [userId, rawSymbol, meta.currentPrice, meta.currentVolume]
    );

    return reply.status(201).send({
      message: `Added ${rawSymbol} to watchlist`,
      symbol: rawSymbol,
      name: meta.name,
      currentPrice: meta.currentPrice,
    });
  });

  // DELETE /watchlist/:symbol (Remove symbol)
  fastify.delete('/watchlist/:symbol', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const upper = symbol.toUpperCase();
    const userId = (request as any).user.userId;
    const db = await getDbClient();

    const res = await db.query(
      `DELETE FROM watchlist_items WHERE user_id = $1 AND symbol = $2 RETURNING id`,
      [userId, upper]
    );

    if (res.rowCount === 0) {
      return reply.status(404).send({ error: `Symbol ${upper} was not found on your watchlist` });
    }

    // Also clean up user_symbol_state for this symbol
    await db.query(
      `DELETE FROM user_symbol_state WHERE user_id = $1 AND symbol = $2`,
      [userId, upper]
    );

    return reply.send({ message: `Removed ${upper} from watchlist`, symbol: upper });
  });

  // GET /watchlist/feed (Ranked "Since you last checked" feed)
  fastify.get('/watchlist/feed', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const db = await getDbClient();

    // 1. Get user's watched symbols and per-symbol last_seen_at
    const userSymbolsRes = await db.query<{
      symbol: string;
      last_seen_at: string | null;
      last_seen_price: string | null;
    }>(
      `SELECT w.symbol, s.last_seen_at, s.last_seen_price
       FROM watchlist_items w
       LEFT JOIN user_symbol_state s ON w.user_id = s.user_id AND w.symbol = s.symbol
       WHERE w.user_id = $1`,
      [userId]
    );

    if (userSymbolsRes.rows.length === 0) {
      return reply.send({ feed: [], count: 0 });
    }

    const feedEvents: any[] = [];

    // Query events for each watched symbol since the user's per-symbol last_seen_at
    for (const item of userSymbolsRes.rows) {
      const sym = item.symbol.toUpperCase();
      // If no last_seen_at, show events from last 2 hours
      const sinceTime = item.last_seen_at || new Date(Date.now() - 2 * 3600 * 1000).toISOString();

      const eventsRes = await db.query<{
        id: string;
        symbol: string;
        event_type: string;
        score: string;
        detail: any;
        detected_at: string;
      }>(
        `SELECT id, symbol, event_type, score, detail, detected_at
         FROM significance_events
         WHERE symbol = $1 AND detected_at > $2
         ORDER BY score DESC, detected_at DESC
         LIMIT 10`,
        [sym, sinceTime]
      );

      for (const ev of eventsRes.rows) {
        const detail = typeof ev.detail === 'string' ? JSON.parse(ev.detail) : ev.detail;
        feedEvents.push({
          id: ev.id,
          symbol: ev.symbol,
          eventType: ev.event_type,
          score: parseFloat(ev.score),
          detectedAt: ev.detected_at,
          detail,
          reason: detail?.reason || `${ev.event_type.replace('_', ' ')} detected`,
          userLastSeenAt: item.last_seen_at,
          userLastSeenPrice: item.last_seen_price ? parseFloat(item.last_seen_price) : null,
        });
      }
    }

    // Sort feed across all symbols by significance score DESC
    feedEvents.sort((a, b) => b.score - a.score);

    return reply.send({ feed: feedEvents, count: feedEvents.length });
  });

  // POST /watchlist/ack (Explicit acknowledgment of attention feed / cursor reset)
  fastify.post('/watchlist/ack', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = (request as any).user.userId;
    const body = (request.body as { symbols?: string[] }) || {};
    const db = await getDbClient();

    let symbolsToAck: string[] = [];
    if (Array.isArray(body.symbols) && body.symbols.length > 0) {
      symbolsToAck = body.symbols.map(s => s.toUpperCase());
    } else {
      // Ack all symbols on user's watchlist
      const res = await db.query<{ symbol: string }>(
        `SELECT symbol FROM watchlist_items WHERE user_id = $1`,
        [userId]
      );
      symbolsToAck = res.rows.map(r => r.symbol.toUpperCase());
    }

    const quotes = await cache.getMultiQuotes(symbolsToAck);

    for (const sym of symbolsToAck) {
      const quote = quotes.get(sym);
      const price = quote?.price || 100;
      const volume = quote?.volume || 1000;

      await db.query(
        `INSERT INTO user_symbol_state (user_id, symbol, last_seen_price, last_seen_at, last_seen_volume)
         VALUES ($1, $2, $3, now(), $4)
         ON CONFLICT (user_id, symbol) DO UPDATE SET
           last_seen_price = EXCLUDED.last_seen_price,
           last_seen_at = EXCLUDED.last_seen_at,
           last_seen_volume = EXCLUDED.last_seen_volume`,
        [userId, sym, price, volume]
      );
    }

    return reply.send({ message: `Acknowledged ${symbolsToAck.length} symbols`, symbols: symbolsToAck });
  });
};
