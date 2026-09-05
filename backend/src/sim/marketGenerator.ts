import { MarketTick } from '../cache/redis.js';

export interface SymbolMeta {
  symbol: string;
  name: string;
  basePrice: number;
  currentPrice: number;
  currentVolume: number;
  avgDailyVolume: number;
  high52w: number;
  low52w: number;
  sma50: number;
  volatility: number; // expected % drift
}

export interface GeneratorChaosState {
  marketOpen: boolean;
  pausedSymbols: Set<string>; // simulates provider delay/offline for specific symbol
  priceJumps: Map<string, number>; // pending manual price shock %
  volumeSpikes: Map<string, number>; // pending manual volume multiplier
  outOfOrderTick: Map<string, MarketTick>; // pending out-of-order tick to emit
}

export class MarketDataSimulator {
  private symbols: Map<string, SymbolMeta> = new Map();
  private chaosState: GeneratorChaosState = {
    marketOpen: true,
    pausedSymbols: new Set(),
    priceJumps: new Map(),
    volumeSpikes: new Map(),
    outOfOrderTick: new Map(),
  };

  constructor() {
    this.seedDefaultUniverse();
  }

  private seedDefaultUniverse(): void {
    const universe: Array<Omit<SymbolMeta, 'currentPrice' | 'currentVolume'>> = [
      {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        basePrice: 228.50,
        avgDailyVolume: 52000,
        high52w: 237.23,
        low52w: 164.08,
        sma50: 224.10,
        volatility: 0.8,
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA Corporation',
        basePrice: 124.80,
        avgDailyVolume: 78000,
        high52w: 140.76,
        low52w: 45.12,
        sma50: 118.50,
        volatility: 2.1,
      },
      {
        symbol: 'TSLA',
        name: 'Tesla, Inc.',
        basePrice: 215.30,
        avgDailyVolume: 64000,
        high52w: 271.00,
        low52w: 138.80,
        sma50: 210.40,
        volatility: 2.6,
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        basePrice: 428.10,
        avgDailyVolume: 35000,
        high52w: 468.35,
        low52w: 309.45,
        sma50: 425.00,
        volatility: 0.9,
      },
      {
        symbol: 'AMZN',
        name: 'Amazon.com, Inc.',
        basePrice: 186.40,
        avgDailyVolume: 42000,
        high52w: 201.20,
        low52w: 118.35,
        sma50: 182.90,
        volatility: 1.2,
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet Inc.',
        basePrice: 168.20,
        avgDailyVolume: 28000,
        high52w: 191.75,
        low52w: 120.21,
        sma50: 169.50,
        volatility: 1.1,
      },
      {
        symbol: 'META',
        name: 'Meta Platforms, Inc.',
        basePrice: 512.60,
        avgDailyVolume: 31000,
        high52w: 544.23,
        low52w: 279.40,
        sma50: 504.00,
        volatility: 1.5,
      },
    ];

    for (const item of universe) {
      this.symbols.set(item.symbol, {
        ...item,
        currentPrice: item.basePrice,
        currentVolume: Math.round(item.avgDailyVolume / 390), // ~1-minute volume slice
      });
    }
  }

  public registerSymbolIfMissing(symbol: string): SymbolMeta {
    const upper = symbol.toUpperCase();
    if (this.symbols.has(upper)) {
      return this.symbols.get(upper)!;
    }

    // Generate realistic synthetic parameters for custom symbol
    const basePrice = Number((50 + Math.random() * 200).toFixed(2));
    const meta: SymbolMeta = {
      symbol: upper,
      name: `${upper} Corp`,
      basePrice,
      currentPrice: basePrice,
      currentVolume: 2500,
      avgDailyVolume: 40000,
      high52w: Number((basePrice * 1.35).toFixed(2)),
      low52w: Number((basePrice * 0.75).toFixed(2)),
      sma50: Number((basePrice * 0.98).toFixed(2)),
      volatility: 1.4,
    };
    this.symbols.set(upper, meta);
    return meta;
  }

  public getSymbolMeta(symbol: string): SymbolMeta | undefined {
    return this.symbols.get(symbol.toUpperCase());
  }

  public getAllKnownSymbols(): SymbolMeta[] {
    return Array.from(this.symbols.values());
  }

  /**
   * Generates a single tick for a symbol with realistic drift or active chaos injected
   */
  public generateTick(symbol: string): { tick: MarketTick | null; status: 'normal' | 'paused' | 'closed' | 'out_of_order' } {
    const meta = this.registerSymbolIfMissing(symbol);

    // 1. Market Closed state
    if (!this.chaosState.marketOpen) {
      return { tick: null, status: 'closed' };
    }

    // 2. Simulated Provider Failure / Lag for specific symbol
    if (this.chaosState.pausedSymbols.has(meta.symbol)) {
      return { tick: null, status: 'paused' };
    }

    // 3. Out-of-order tick pending
    if (this.chaosState.outOfOrderTick.has(meta.symbol)) {
      const oldTick = this.chaosState.outOfOrderTick.get(meta.symbol)!;
      this.chaosState.outOfOrderTick.delete(meta.symbol);
      return { tick: oldTick, status: 'out_of_order' };
    }

    // 4. Calculate Price Movement
    let priceMultiplier = 1;
    let isSpike = false;

    // Check if manual price shock was triggered
    if (this.chaosState.priceJumps.has(meta.symbol)) {
      const jumpPct = this.chaosState.priceJumps.get(meta.symbol)!;
      this.chaosState.priceJumps.delete(meta.symbol);
      priceMultiplier = 1 + jumpPct / 100;
      isSpike = true;
    } else {
      // Natural random-walk Gaussian-ish drift
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
      // Daily volatility scaled to tick frequency (~3s interval)
      const tickVol = (meta.volatility / 100) * 0.08;
      const drift = 0.00005; // slight positive bias
      priceMultiplier = 1 + (z * tickVol + drift);
    }

    const newPrice = Number((meta.currentPrice * priceMultiplier).toFixed(2));
    meta.currentPrice = Math.max(newPrice, 0.01);

    // 5. Calculate Volume
    let baseTickVolume = Math.round(meta.avgDailyVolume / 400 * (0.8 + Math.random() * 0.4));
    if (this.chaosState.volumeSpikes.has(meta.symbol)) {
      const volMultiplier = this.chaosState.volumeSpikes.get(meta.symbol)!;
      this.chaosState.volumeSpikes.delete(meta.symbol);
      baseTickVolume = Math.round(baseTickVolume * volMultiplier);
      isSpike = true;
    }
    meta.currentVolume = baseTickVolume;

    const tick: MarketTick = {
      symbol: meta.symbol,
      price: meta.currentPrice,
      volume: meta.currentVolume,
      timestamp: Date.now(),
      source: 'sim-engine-v1',
      isSpike,
    };

    return { tick, status: 'normal' };
  }

  // Chaos & Evaluator control methods
  public injectPriceShock(symbol: string, pct: number): void {
    const upper = symbol.toUpperCase();
    this.registerSymbolIfMissing(upper);
    this.chaosState.priceJumps.set(upper, pct);
  }

  public injectVolumeSpike(symbol: string, multiplier: number): void {
    const upper = symbol.toUpperCase();
    this.registerSymbolIfMissing(upper);
    this.chaosState.volumeSpikes.set(upper, multiplier);
  }

  public setSymbolPaused(symbol: string, paused: boolean): void {
    const upper = symbol.toUpperCase();
    if (paused) {
      this.chaosState.pausedSymbols.add(upper);
    } else {
      this.chaosState.pausedSymbols.delete(upper);
    }
  }

  public injectOutOfOrderTick(symbol: string): void {
    const upper = symbol.toUpperCase();
    const meta = this.registerSymbolIfMissing(upper);
    // Construct a tick stamped 2 minutes in the past with a stale price
    const pastTick: MarketTick = {
      symbol: upper,
      price: Number((meta.currentPrice * 0.96).toFixed(2)),
      volume: 1200,
      timestamp: Date.now() - 120000, // 2 minutes ago
      source: 'sim-delayed-channel',
    };
    this.chaosState.outOfOrderTick.set(upper, pastTick);
  }

  public setMarketOpen(isOpen: boolean): void {
    this.chaosState.marketOpen = isOpen;
  }

  public isMarketOpen(): boolean {
    return this.chaosState.marketOpen;
  }

  public getChaosStatus(): {
    marketOpen: boolean;
    pausedSymbols: string[];
    pendingPriceJumps: Record<string, number>;
    pendingVolumeSpikes: Record<string, number>;
  } {
    return {
      marketOpen: this.chaosState.marketOpen,
      pausedSymbols: Array.from(this.chaosState.pausedSymbols),
      pendingPriceJumps: Object.fromEntries(this.chaosState.priceJumps),
      pendingVolumeSpikes: Object.fromEntries(this.chaosState.volumeSpikes),
    };
  }
}

export const marketSim = new MarketDataSimulator();
