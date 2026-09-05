import assert from 'assert';
import {
  calculateSignificance,
  calculateRollingVolatility,
  calculateAverageVolume,
  checkLevelBreaks,
} from '../src/services/significanceEngine.js';
import { MarketTick } from '../src/cache/redis.js';

console.log('🧪 Starting Smart Watchlist Engine Verification Tests...\n');

let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// 1. Rolling Volatility Math
it('calculateRollingVolatility applies volatility floor on low-volatility inputs', () => {
  const flatTicks: MarketTick[] = [
    { symbol: 'FLAT', price: 100, volume: 1000, timestamp: 1, source: 'test' },
    { symbol: 'FLAT', price: 100.01, volume: 1000, timestamp: 2, source: 'test' },
    { symbol: 'FLAT', price: 100, volume: 1000, timestamp: 3, source: 'test' },
  ];
  const vol = calculateRollingVolatility(flatTicks, 0.2);
  assert.strictEqual(vol, 0.2, 'Expected volatility to be floored at 0.2%');
});

it('calculateRollingVolatility calculates actual stddev for moving stock', () => {
  const movingTicks: MarketTick[] = [
    { symbol: 'TEST', price: 100, volume: 1000, timestamp: 1, source: 'test' },
    { symbol: 'TEST', price: 105, volume: 1000, timestamp: 2, source: 'test' },
    { symbol: 'TEST', price: 98, volume: 1000, timestamp: 3, source: 'test' },
    { symbol: 'TEST', price: 104, volume: 1000, timestamp: 4, source: 'test' },
  ];
  const vol = calculateRollingVolatility(movingTicks, 0.2);
  assert.ok(vol > 0.5, `Expected vol > 0.5, got ${vol}`);
});

// 2. Volume Average
it('calculateAverageVolume correctly averages 20 periods', () => {
  const ticks: MarketTick[] = Array.from({ length: 20 }, (_, i) => ({
    symbol: 'XYZ',
    price: 50,
    volume: 1000 * (i + 1),
    timestamp: i,
    source: 'test',
  }));
  const avg = calculateAverageVolume(ticks, 20);
  assert.strictEqual(avg, 10500);
});

// 3. Level Breaks
it('checkLevelBreaks detects crossing 52w high', () => {
  const res = checkLevelBreaks(152, 149, { high52w: 150, low52w: 90 });
  assert.strictEqual(res.levelBreak, 1);
  assert.strictEqual(res.breakType, '52w_high');
  assert.ok(res.description.includes('52-week High'));
});

it('checkLevelBreaks detects crossing 52w low', () => {
  const res = checkLevelBreaks(88, 91, { high52w: 150, low52w: 90 });
  assert.strictEqual(res.levelBreak, 1);
  assert.strictEqual(res.breakType, '52w_low');
});

// 4. Core Significance Algorithm & Capping
it('calculateSignificance caps extreme outlier spikes to protect against bad data', () => {
  // Extreme 50% spike with 10x volume
  const result = calculateSignificance({
    currentPrice: 150,
    currentVolume: 100000,
    lastSeenPrice: 100,
    prevPrice: 100,
    rollingVolatility: 1.0,
    avgVolume20: 10000,
    stats52w: { high52w: 200, low52w: 80 },
    threshold: 1.5,
  });

  assert.strictEqual(result.cappedPriceZ, 5, 'price_z should be capped at 5');
  assert.strictEqual(result.cappedVolumeRatio, 3, 'volume_ratio should be capped at 3');
  assert.strictEqual(result.priceZContribution, 2.5); // 0.5 * 5
  assert.strictEqual(result.volumeContribution, 0.9); // 0.3 * 3
  assert.strictEqual(result.score, 3.4); // 2.5 + 0.9
  assert.strictEqual(result.isMeaningful, true);
  assert.ok(result.reason.includes('Price moved'));
});

it('calculateSignificance correctly flags quiet price move within normal range as non-meaningful', () => {
  const result = calculateSignificance({
    currentPrice: 100.20,
    currentVolume: 1000,
    lastSeenPrice: 100.00,
    prevPrice: 100.00,
    rollingVolatility: 1.0,
    avgVolume20: 1000,
    stats52w: { high52w: 150, low52w: 80 },
    threshold: 1.5,
  });

  assert.strictEqual(result.isMeaningful, false, 'Tiny move should not be flagged as meaningful');
  assert.ok(result.score < 1.0, `Score should be low, got ${result.score}`);
});

it('calculateSignificance generates deterministic template-based reason strings', () => {
  const result = calculateSignificance({
    currentPrice: 108,
    currentVolume: 35000,
    lastSeenPrice: 100,
    prevPrice: 100,
    rollingVolatility: 1.2,
    avgVolume20: 10000,
    stats52w: { high52w: 120, low52w: 80 },
    threshold: 1.5,
  });

  assert.strictEqual(result.isMeaningful, true);
  assert.ok(result.reason.startsWith('Price moved +8.0%') || result.reason.startsWith('Volume spike'));
});

console.log(`\n--------------------------------------------`);
console.log(`Test Results: ${passed} passed, ${failed} failed.`);
console.log(`--------------------------------------------\n`);

if (failed > 0) {
  process.exit(1);
}
