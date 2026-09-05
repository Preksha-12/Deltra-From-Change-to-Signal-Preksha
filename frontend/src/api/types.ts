export interface User {
  id: string;
  email: string;
}

export interface WatchlistSymbol {
  symbol: string;
  name: string;
  currentPrice: number;
  currentVolume: number;
  updatedAt: string;
  stale: boolean;
  marketStatus: 'open' | 'closed';
  lastSeenPrice: number | null;
  lastSeenAt: string | null;
  hasBaseline: boolean;
  deltaSinceLastSeen: number;
  pctSinceLastSeen: number;
  significanceScore: number;
  isMeaningful: boolean;
  dominantSignal: 'price_move' | 'volume_spike' | 'level_break';
  reason: string;
  breakdown?: {
    priceZ: number;
    volumeRatio: number;
    levelBreak: number;
    rollingVolatility: number;
  };
}

export interface SignificanceEvent {
  id: string;
  symbol: string;
  eventType: 'price_move' | 'volume_spike' | 'level_break' | 'composite';
  score: number;
  detectedAt: string;
  reason: string;
  detail: {
    price: number;
    prevPrice?: number;
    volume: number;
    avgVolume20?: number;
    rollingVolatility?: number;
    priceZ?: number;
    volumeRatio?: number;
    levelBreakType?: string | null;
    reason?: string;
  };
  userLastSeenAt?: string | null;
  userLastSeenPrice?: number | null;
}

export interface ChaosStatus {
  marketOpen: boolean;
  pausedSymbols: string[];
  pendingPriceJumps: Record<string, number>;
  pendingVolumeSpikes: Record<string, number>;
}
