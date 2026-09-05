import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { EventEmitter } from 'events';
import { config } from '../config/env.js';

export interface MarketTick {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number; // epoch ms
  source: string;
  isSpike?: boolean;
}

export interface CachedQuote {
  symbol: string;
  price: number;
  volume: number;
  timestamp: number;
  source: string;
  updatedAt: string; // ISO
  marketStatus: 'open' | 'closed';
  stale: boolean;
}

export class CacheService {
  private client: any;
  private subClient: any;
  private inMemoryEmitter = new EventEmitter();
  private isMock = false;

  constructor() {
    this.inMemoryEmitter.setMaxListeners(500);
  }

  async init(): Promise<void> {
    if (config.redisUrl) {
      try {
        console.log('[Redis] Connecting to Redis via REDIS_URL...');
        this.client = new Redis(config.redisUrl, { retryStrategy: () => null });
        this.subClient = new Redis(config.redisUrl, { retryStrategy: () => null });
        
        await this.client.ping();
        console.log('[Redis] Connected to Redis successfully.');
        this.isMock = false;

        this.subClient.on('message', (channel: string, message: string) => {
          this.inMemoryEmitter.emit(channel, message);
        });
        return;
      } catch (err) {
        console.warn('[Redis] Failed to connect to REDIS_URL, falling back to embedded Redis mock:', (err as Error).message);
      }
    }

    console.log('[Redis] Using high-performance embedded in-memory Redis store.');
    this.client = new RedisMock();
    this.subClient = null;
    this.isMock = true;
  }

  // Quote caching
  async setQuote(symbol: string, quote: CachedQuote): Promise<void> {
    const key = `quote:${symbol.toUpperCase()}`;
    await this.client.set(key, JSON.stringify(quote));
  }

  async getQuote(symbol: string): Promise<CachedQuote | null> {
    const key = `quote:${symbol.toUpperCase()}`;
    const data = await this.client.get(key);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async getMultiQuotes(symbols: string[]): Promise<Map<string, CachedQuote>> {
    const map = new Map<string, CachedQuote>();
    if (symbols.length === 0) return map;

    const keys = symbols.map(s => `quote:${s.toUpperCase()}`);
    const results = await this.client.mget(keys);

    results.forEach((item: string | null, idx: number) => {
      if (item) {
        try {
          map.set(symbols[idx].toUpperCase(), JSON.parse(item));
        } catch {
          // ignore corrupted entry
        }
      }
    });

    return map;
  }

  // Bounded rolling tick buffer for rolling volatility and volume averages
  async pushTick(symbol: string, tick: MarketTick, maxLen: number = 100): Promise<void> {
    const key = `ticks:${symbol.toUpperCase()}`;
    await this.client.lpush(key, JSON.stringify(tick));
    await this.client.ltrim(key, 0, maxLen - 1);
  }

  async getRecentTicks(symbol: string, limit: number = 20): Promise<MarketTick[]> {
    const key = `ticks:${symbol.toUpperCase()}`;
    const rawList = await this.client.lrange(key, 0, limit - 1);
    if (!rawList || rawList.length === 0) return [];
    
    return rawList.map((raw: string) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  // Pub / Sub fan-out
  async publish(channel: string, message: any): Promise<void> {
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    // Instant local dispatch
    this.inMemoryEmitter.emit(channel, payload);
    if (!this.isMock && this.client) {
      await this.client.publish(channel, payload);
    }
  }

  async subscribe(channel: string, handler: (message: any) => void): Promise<() => void> {
    if (!this.isMock && this.subClient) {
      await this.subClient.subscribe(channel);
    }
    
    const wrapper = (payload: string) => {
      try {
        handler(JSON.parse(payload));
      } catch {
        handler(payload);
      }
    };

    this.inMemoryEmitter.on(channel, wrapper);

    return () => {
      this.inMemoryEmitter.off(channel, wrapper);
    };
  }

  async close(): Promise<void> {
    try {
      if (this.client?.disconnect) await this.client.disconnect();
      if (this.subClient?.disconnect && this.subClient !== this.client) {
        await this.subClient.disconnect();
      }
    } catch {
      // ignore on shutdown
    }
  }
}

export const cache = new CacheService();
