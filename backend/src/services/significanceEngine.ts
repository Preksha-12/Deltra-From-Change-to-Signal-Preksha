import { config } from '../config/env.js';
import { MarketTick } from '../cache/redis.js';

export interface SymbolBaseline {
  lastSeenPrice?: number | null;
  lastSeenVolume?: number | null;
  lastSeenAt?: string | null;
}

export interface SignificanceBreakdown {
  priceZ: number;
  cappedPriceZ: number;
  priceZContribution: number;

  volumeRatio: number;
  cappedVolumeRatio: number;
  volumeContribution: number;

  levelBreak: number;
  levelBreakContribution: number;
  levelBreakType?: '52w_high' | '52w_low' | 'ma_cross' | null;

  score: number;
  isMeaningful: boolean;
  dominantSignal: 'price_move' | 'volume_spike' | 'level_break';
  reason: string;
}

export interface RollingStats {
  volatility: number;
  avgVolume20: number;
  high52w: number;
  low52w: number;
  sma50?: number;
}

/**
 * Pure calculation for standard deviation of percentage returns
 */
export function calculateRollingVolatility(ticks: MarketTick[], floor: number = config.volatilityFloor): number {
  if (ticks.length < 3) return floor;

  // Calculate percentage returns between adjacent ticks
  const returns: number[] = [];
  for (let i = 0; i < ticks.length - 1; i++) {
    const prev = ticks[i + 1].price;
    const curr = ticks[i].price;
    if (prev > 0) {
      returns.push(Math.abs((curr - prev) / prev) * 100);
    }
  }

  if (returns.length < 2) return floor;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  return Math.max(stdDev, floor);
}

/**
 * Calculates 20-period rolling average volume
 */
export function calculateAverageVolume(ticks: MarketTick[], count: number = 20): number {
  if (ticks.length === 0) return 1000;
  const slice = ticks.slice(0, count);
  const total = slice.reduce((acc, t) => acc + (t.volume || 0), 0);
  return Math.max(Math.round(total / slice.length), 1);
}

/**
 * Checks for structural breaks (52-week High/Low or Key Moving Average break)
 */
export function checkLevelBreaks(
  currentPrice: number,
  prevPrice: number,
  stats: { high52w: number; low52w: number; sma50?: number }
): { levelBreak: number; breakType: '52w_high' | '52w_low' | 'ma_cross' | null; description: string } {
  // Crossed 52-week High
  if (prevPrice <= stats.high52w && currentPrice > stats.high52w) {
    return {
      levelBreak: 1,
      breakType: '52w_high',
      description: `Crossed new 52-week High ($${currentPrice.toFixed(2)})`,
    };
  }

  // Crossed 52-week Low
  if (prevPrice >= stats.low52w && currentPrice < stats.low52w) {
    return {
      levelBreak: 1,
      breakType: '52w_low',
      description: `Crossed new 52-week Low ($${currentPrice.toFixed(2)})`,
    };
  }

  // Crossed 50 MA
  if (stats.sma50) {
    if ((prevPrice < stats.sma50 && currentPrice >= stats.sma50) || (prevPrice > stats.sma50 && currentPrice <= stats.sma50)) {
      const direction = currentPrice >= stats.sma50 ? 'above' : 'below';
      return {
        levelBreak: 1,
        breakType: 'ma_cross',
        description: `Crossed ${direction} key 50-period moving average ($${stats.sma50.toFixed(2)})`,
      };
    }
  }

  return { levelBreak: 0, breakType: null, description: '' };
}

/**
 * Core Significance Scoring Algorithm (Section 7)
 * price_z      = |pct_change_since_last_seen| / max(rolling_volatility, floor)
 * volume_ratio = current_volume / avg_volume_20
 * level_break  = 1 if crossed 52w high/low or key MA, else 0
 * 
 * score = 0.5 * min(price_z, 5)
 *       + 0.3 * min(volume_ratio, 3)
 *       + 0.2 * (level_break * 5)
 */
export function calculateSignificance(params: {
  currentPrice: number;
  currentVolume: number;
  lastSeenPrice?: number | null;
  prevPrice?: number;
  rollingVolatility: number;
  avgVolume20: number;
  stats52w: { high52w: number; low52w: number; sma50?: number };
  threshold?: number;
}): SignificanceBreakdown {
  const {
    currentPrice,
    currentVolume,
    lastSeenPrice,
    prevPrice = currentPrice,
    rollingVolatility,
    avgVolume20,
    stats52w,
    threshold = config.significanceThreshold,
  } = params;

  // 1. Price Significance
  let pctChange = 0;
  let priceZ = 0;
  if (lastSeenPrice && lastSeenPrice > 0) {
    pctChange = ((currentPrice - lastSeenPrice) / lastSeenPrice) * 100;
    const volFloor = Math.max(rollingVolatility, config.volatilityFloor);
    priceZ = Math.abs(pctChange) / volFloor;
  }
  const cappedPriceZ = Math.min(priceZ, 5);
  const priceZContribution = 0.5 * cappedPriceZ;

  // 2. Volume Anomaly
  const safeAvgVol = Math.max(avgVolume20, 1);
  const volumeRatio = currentVolume / safeAvgVol;
  const cappedVolumeRatio = Math.min(volumeRatio, 3);
  const volumeContribution = 0.3 * cappedVolumeRatio;

  // 3. Structural Level Break
  const breakInfo = checkLevelBreaks(currentPrice, prevPrice, stats52w);
  const levelBreak = breakInfo.levelBreak;
  const levelBreakContribution = 0.2 * (levelBreak * 5);

  // Total Score (0 to 4.4 max theoretical with weights)
  const totalScore = Number((priceZContribution + volumeContribution + levelBreakContribution).toFixed(2));
  const isMeaningful = totalScore >= threshold;

  // Determine Dominant Signal & Deterministic Reason String
  let dominantSignal: 'price_move' | 'volume_spike' | 'level_break' = 'price_move';
  const maxContrib = Math.max(priceZContribution, volumeContribution, levelBreakContribution);

  if (maxContrib === levelBreakContribution && levelBreak > 0) {
    dominantSignal = 'level_break';
  } else if (maxContrib === volumeContribution && volumeRatio > 1.5) {
    dominantSignal = 'volume_spike';
  } else {
    dominantSignal = 'price_move';
  }

  // Template-based deterministic reason string (no non-deterministic LLM output)
  let reason = 'Steady within typical volatility range';
  const directionSign = pctChange >= 0 ? '+' : '';

  if (isMeaningful) {
    if (dominantSignal === 'level_break' && breakInfo.description) {
      reason = breakInfo.description;
    } else if (dominantSignal === 'volume_spike') {
      reason = `Volume spike: ${volumeRatio.toFixed(1)}x 20-period average (${directionSign}${pctChange.toFixed(1)}% price move)`;
    } else {
      reason = `Price moved ${directionSign}${pctChange.toFixed(1)}% (${priceZ.toFixed(1)}σ vs normal ${rollingVolatility.toFixed(1)}% volatility)`;
    }
  } else if (lastSeenPrice && Math.abs(pctChange) > 0.05) {
    reason = `Shifted ${directionSign}${pctChange.toFixed(2)}% since last visit (within normal range)`;
  } else if (!lastSeenPrice) {
    reason = 'Initial baseline established';
  }

  return {
    priceZ: Number(priceZ.toFixed(2)),
    cappedPriceZ: Number(cappedPriceZ.toFixed(2)),
    priceZContribution: Number(priceZContribution.toFixed(2)),

    volumeRatio: Number(volumeRatio.toFixed(2)),
    cappedVolumeRatio: Number(cappedVolumeRatio.toFixed(2)),
    volumeContribution: Number(volumeContribution.toFixed(2)),

    levelBreak,
    levelBreakContribution: Number(levelBreakContribution.toFixed(2)),
    levelBreakType: breakInfo.breakType,

    score: totalScore,
    isMeaningful,
    dominantSignal,
    reason,
  };
}
