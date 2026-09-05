import { WebSocket } from 'ws';
import { cache } from '../cache/redis.js';
import { getDbClient } from '../db/client.js';

interface ClientSession {
  userId: string;
  socket: WebSocket;
  subscribedSymbols: Set<string>;
  unsubscribes: Map<string, () => void>;
}

export class WebSocketManager {
  private clients: Map<WebSocket, ClientSession> = new Map();

  public registerClient(socket: WebSocket, userId: string): void {
    const session: ClientSession = {
      userId,
      socket,
      subscribedSymbols: new Set(),
      unsubscribes: new Map(),
    };
    this.clients.set(socket, session);

    socket.on('message', async (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleClientMessage(session, message);
      } catch (err) {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON payload' }));
      }
    });

    socket.on('close', () => {
      this.cleanupSession(session);
      this.clients.delete(socket);
    });

    socket.on('error', () => {
      this.cleanupSession(session);
      this.clients.delete(socket);
    });

    // Send connection confirmation
    socket.send(JSON.stringify({ type: 'connected', userId, timestamp: new Date().toISOString() }));
  }

  private async handleClientMessage(session: ClientSession, message: any): Promise<void> {
    if (message.type === 'subscribe') {
      const symbols: string[] = Array.isArray(message.symbols) ? message.symbols : [];
      await this.subscribeSymbols(session, symbols);
    } else if (message.type === 'unsubscribe') {
      const symbols: string[] = Array.isArray(message.symbols) ? message.symbols : [];
      this.unsubscribeSymbols(session, symbols);
    } else if (message.type === 'ping') {
      session.socket.send(JSON.stringify({ type: 'pong', at: Date.now() }));
    }
  }

  /**
   * Only allows user to subscribe to symbols currently in their watchlist
   */
  private async subscribeSymbols(session: ClientSession, requestedSymbols: string[]): Promise<void> {
    if (requestedSymbols.length === 0) return;

    const db = await getDbClient();
    const res = await db.query<{ symbol: string }>(
      `SELECT symbol FROM watchlist_items WHERE user_id = $1`,
      [session.userId]
    );
    const authorizedSymbols = new Set(res.rows.map(r => r.symbol.toUpperCase()));

    for (const raw of requestedSymbols) {
      const sym = raw.toUpperCase();
      // Enforce: Clients subscribe only to symbols in their own watchlist
      if (!authorizedSymbols.has(sym)) {
        continue;
      }

      if (session.subscribedSymbols.has(sym)) {
        continue;
      }

      session.subscribedSymbols.add(sym);

      // Send latest known quote immediately on subscription
      const latest = await cache.getQuote(sym);
      if (latest && session.socket.readyState === WebSocket.OPEN) {
        session.socket.send(JSON.stringify({
          type: 'quote',
          symbol: latest.symbol,
          price: latest.price,
          volume: latest.volume,
          at: latest.updatedAt,
          stale: latest.stale,
          marketStatus: latest.marketStatus,
        }));
      }

      // Subscribe to Redis PubSub channel for real-time tick and alert fanout
      const channel = `symbol:${sym}`;
      const unsub = await cache.subscribe(channel, (payload: any) => {
        if (session.socket.readyState === WebSocket.OPEN) {
          session.socket.send(JSON.stringify(payload));
        }
      });

      session.unsubscribes.set(sym, unsub);
    }
  }

  private unsubscribeSymbols(session: ClientSession, symbols: string[]): void {
    for (const sym of symbols) {
      const upper = sym.toUpperCase();
      session.subscribedSymbols.delete(upper);
      const unsub = session.unsubscribes.get(upper);
      if (unsub) {
        unsub();
        session.unsubscribes.delete(upper);
      }
    }
  }

  private cleanupSession(session: ClientSession): void {
    for (const unsub of session.unsubscribes.values()) {
      try {
        unsub();
      } catch {
        // ignore
      }
    }
    session.unsubscribes.clear();
    session.subscribedSymbols.clear();
  }
}

export const wsManager = new WebSocketManager();
