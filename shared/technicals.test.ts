import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCCI,
  computeEMA,
  computeMACD,
  computePivotPoints,
  computeRSI,
  computeSMA,
  evaluateTechnicalSummary,
} from './technicals.ts';

test('computeSMA computes accurate simple moving average', () => {
  assert.equal(computeSMA([10, 20, 30, 40, 50], 5), 30);
  assert.equal(computeSMA([10, 20, 30, 40, 50], 3), 40);
});

test('computeEMA responds more heavily to recent prices in an uptrend', () => {
  const prices = [100, 102, 104, 106, 108, 112, 118];
  const sma5 = computeSMA(prices, 5);
  const ema5 = computeEMA(prices, 5);
  assert.ok(ema5 > sma5, `expected EMA (${ema5}) > SMA (${sma5}) in accelerating uptrend`);
});

test('computeRSI returns > 70 on strictly rising series and < 30 on falling series', () => {
  const rising = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
  const falling = Array.from({ length: 20 }, (_, i) => 200 - i * 2);
  assert.equal(computeRSI(rising, 14), 100);
  assert.equal(computeRSI(falling, 14), 0);
});

test('computeMACD returns positive histogram on strong rally', () => {
  const rally = Array.from({ length: 40 }, (_, i) => 100 + i * 1.5 + (i > 30 ? (i - 30) * 2 : 0));
  const macd = computeMACD(rally);
  assert.ok(macd.macd > 0);
  assert.ok(macd.histogram > 0);
});

test('computeCCI returns 0 when all prices are identical', () => {
  assert.equal(computeCCI([100, 100, 100, 100, 100], 5), 0);
});

test('computePivotPoints returns Classic, Fibonacci, and Camarilla levels ordered around pivot', () => {
  const pivots = computePivotPoints(110, 90, 100);
  assert.equal(pivots.length, 3);
  const classic = pivots[0];
  assert.equal(classic.method, 'Classic');
  assert.equal(classic.pivot, 100);
  assert.equal(classic.r1, 110);
  assert.equal(classic.s1, 90);
  assert.ok(classic.r3 > classic.r2 && classic.r2 > classic.r1);
  assert.ok(classic.s3 < classic.s2 && classic.s2 < classic.s1);
});

test('evaluateTechnicalSummary classifies a strong uptrend as Buy or Strong Buy', () => {
  const prices = Array.from({ length: 210 }, (_, i) => 1000 + i * 2.5);
  const summary = evaluateTechnicalSummary({
    token: 738561,
    symbol: 'RELIANCE',
    exchange: 'NSE',
    prices,
    dayHigh: 1530,
    dayLow: 1500,
    prevClose: 1505,
    timestamp: Date.now(),
  });
  assert.ok(
    summary.overallSignal === 'Strong Buy' || summary.overallSignal === 'Buy',
    `expected Strong Buy or Buy, got ${summary.overallSignal}`,
  );
  assert.equal(summary.oscillators.length, 6);
  assert.equal(summary.movingAverages.length, 10);
  assert.equal(summary.pivots.length, 3);
});
