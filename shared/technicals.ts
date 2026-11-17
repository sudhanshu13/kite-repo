import type {
  Exchange,
  IndicatorSignal,
  OverallTechnicalRating,
  PivotLevelRow,
  TechnicalIndicatorRow,
  TechnicalSummary,
} from './types.ts';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeSMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  const slice = prices.slice(-period);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return round2(sum / slice.length);
}

export function computeEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length <= period) {
    return computeSMA(prices, prices.length);
  }
  const k = 2 / (period + 1);
  let ema = computeSMA(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return round2(ema);
}

export function computeRSI(prices: number[], period = 14): number {
  if (prices.length < 2) return 50;
  const lookback = Math.min(period, prices.length - 1);
  let gains = 0;
  let losses = 0;
  const startIdx = prices.length - lookback;

  for (let i = startIdx; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  const avgGain = gains / lookback;
  const avgLoss = losses / lookback;
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return round2(100 - 100 / (1 + rs));
}

export function computeMACD(prices: number[]): {
  macd: number;
  signal: number;
  histogram: number;
} {
  if (prices.length < 2) {
    return { macd: 0, signal: 0, histogram: 0 };
  }
  const ema12Series: number[] = [];
  const ema26Series: number[] = [];

  let ema12 = prices[0];
  let ema26 = prices[0];
  const k12 = 2 / 13;
  const k26 = 2 / 27;

  for (let i = 0; i < prices.length; i++) {
    ema12 = prices[i] * k12 + ema12 * (1 - k12);
    ema26 = prices[i] * k26 + ema26 * (1 - k26);
    ema12Series.push(ema12);
    ema26Series.push(ema26);
  }

  const macdSeries = ema12Series.map((v, idx) => v - ema26Series[idx]);
  let signalLine = macdSeries[0];
  const k9 = 2 / 10;
  for (let i = 1; i < macdSeries.length; i++) {
    signalLine = macdSeries[i] * k9 + signalLine * (1 - k9);
  }

  const macd = macdSeries[macdSeries.length - 1];
  return {
    macd: round2(macd),
    signal: round2(signalLine),
    histogram: round2(macd - signalLine),
  };
}

export function computeStochasticK(prices: number[], period = 14): number {
  if (prices.length === 0) return 50;
  const window = prices.slice(-period);
  const high = Math.max(...window);
  const low = Math.min(...window);
  const current = prices[prices.length - 1];
  if (high === low) return 50;
  return round2(((current - low) / (high - low)) * 100);
}

export function computeCCI(prices: number[], period = 20): number {
  if (prices.length < 2) return 0;
  const window = prices.slice(-period);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const meanDeviation =
    window.reduce((acc, p) => acc + Math.abs(p - mean), 0) / window.length;
  if (meanDeviation === 0) return 0;
  const current = window[window.length - 1];
  return round2((current - mean) / (0.015 * meanDeviation));
}

export function computeWilliamsR(prices: number[], period = 14): number {
  if (prices.length === 0) return -50;
  const window = prices.slice(-period);
  const high = Math.max(...window);
  const low = Math.min(...window);
  const current = prices[prices.length - 1];
  if (high === low) return -50;
  return round2(((high - current) / (high - low)) * -100);
}

export function computeMomentum(prices: number[], period = 10): number {
  if (prices.length <= period) {
    return prices.length > 1
      ? round2(prices[prices.length - 1] - prices[0])
      : 0;
  }
  return round2(prices[prices.length - 1] - prices[prices.length - 1 - period]);
}

export function computePivotPoints(
  high: number,
  low: number,
  close: number,
): PivotLevelRow[] {
  const pivot = (high + low + close) / 3;
  const range = high - low;

  const classic: PivotLevelRow = {
    method: 'Classic',
    s3: round2(low - 2 * (high - pivot)),
    s2: round2(pivot - range),
    s1: round2(2 * pivot - high),
    pivot: round2(pivot),
    r1: round2(2 * pivot - low),
    r2: round2(pivot + range),
    r3: round2(high + 2 * (pivot - low)),
  };

  const fibonacci: PivotLevelRow = {
    method: 'Fibonacci',
    s3: round2(pivot - 1.0 * range),
    s2: round2(pivot - 0.618 * range),
    s1: round2(pivot - 0.382 * range),
    pivot: round2(pivot),
    r1: round2(pivot + 0.382 * range),
    r2: round2(pivot + 0.618 * range),
    r3: round2(pivot + 1.0 * range),
  };

  const camarilla: PivotLevelRow = {
    method: 'Camarilla',
    s3: round2(close - (range * 1.1) / 4),
    s2: round2(close - (range * 1.1) / 6),
    s1: round2(close - (range * 1.1) / 12),
    pivot: round2(pivot),
    r1: round2(close + (range * 1.1) / 12),
    r2: round2(close + (range * 1.1) / 6),
    r3: round2(close + (range * 1.1) / 4),
  };

  return [classic, fibonacci, camarilla];
}

function maSignal(ltp: number, ma: number): IndicatorSignal {
  const threshold = ltp * 0.0005;
  if (ltp - ma > threshold) return 'Buy';
  if (ma - ltp > threshold) return 'Sell';
  return 'Neutral';
}

export function rateOverallSignal(
  buyCount: number,
  sellCount: number,
  total: number,
): OverallTechnicalRating {
  if (total === 0) return 'Neutral';
  const net = (buyCount - sellCount) / total;
  if (net >= 0.45) return 'Strong Buy';
  if (net >= 0.15) return 'Buy';
  if (net <= -0.45) return 'Strong Sell';
  if (net <= -0.15) return 'Sell';
  return 'Neutral';
}

export function evaluateTechnicalSummary(params: {
  token: number;
  symbol: string;
  exchange: Exchange;
  prices: number[];
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  timestamp: number;
}): TechnicalSummary {
  const { token, symbol, exchange, prices, dayHigh, dayLow, prevClose, timestamp } =
    params;
  const ltp = prices.length > 0 ? prices[prices.length - 1] : prevClose;

  const rsi = computeRSI(prices, 14);
  const stochK = computeStochasticK(prices, 14);
  const cci = computeCCI(prices, 20);
  const macdData = computeMACD(prices);
  const williamsR = computeWilliamsR(prices, 14);
  const momentum = computeMomentum(prices, 10);

  const rsiSignal: IndicatorSignal =
    rsi < 35 ? 'Buy' : rsi > 65 ? 'Sell' : 'Neutral';
  const stochSignal: IndicatorSignal =
    stochK < 25 ? 'Buy' : stochK > 75 ? 'Sell' : 'Neutral';
  const cciSignal: IndicatorSignal =
    cci < -100 ? 'Buy' : cci > 100 ? 'Sell' : 'Neutral';
  const macdSignal: IndicatorSignal =
    macdData.histogram > 0.05
      ? 'Buy'
      : macdData.histogram < -0.05
        ? 'Sell'
        : 'Neutral';
  const williamsSignal: IndicatorSignal =
    williamsR < -80 ? 'Buy' : williamsR > -20 ? 'Sell' : 'Neutral';
  const momentumSignal: IndicatorSignal =
    momentum > ltp * 0.001
      ? 'Buy'
      : momentum < -ltp * 0.001
        ? 'Sell'
        : 'Neutral';

  const oscillators: TechnicalIndicatorRow[] = [
    { name: 'RSI (14)', value: rsi.toFixed(2), numericValue: rsi, signal: rsiSignal },
    {
      name: 'Stochastic %K (14, 3, 3)',
      value: stochK.toFixed(2),
      numericValue: stochK,
      signal: stochSignal,
    },
    { name: 'CCI (20)', value: cci.toFixed(2), numericValue: cci, signal: cciSignal },
    {
      name: 'MACD Level (12, 26)',
      value: macdData.macd.toFixed(2),
      numericValue: macdData.macd,
      signal: macdSignal,
    },
    {
      name: 'Williams %R (14)',
      value: williamsR.toFixed(2),
      numericValue: williamsR,
      signal: williamsSignal,
    },
    {
      name: 'Momentum (10)',
      value: momentum.toFixed(2),
      numericValue: momentum,
      signal: momentumSignal,
    },
  ];

  const maPeriods = [5, 10, 20, 50, 200];
  const movingAverages: TechnicalIndicatorRow[] = [];
  for (const period of maPeriods) {
    const sma = computeSMA(prices, period);
    const ema = computeEMA(prices, period);
    movingAverages.push({
      name: `SMA (${period})`,
      value: sma.toFixed(2),
      numericValue: sma,
      signal: maSignal(ltp, sma),
    });
    movingAverages.push({
      name: `EMA (${period})`,
      value: ema.toFixed(2),
      numericValue: ema,
      signal: maSignal(ltp, ema),
    });
  }

  const allSignals = [...oscillators, ...movingAverages];
  const buyCount = allSignals.filter((s) => s.signal === 'Buy').length;
  const neutralCount = allSignals.filter((s) => s.signal === 'Neutral').length;
  const sellCount = allSignals.filter((s) => s.signal === 'Sell').length;

  return {
    token,
    symbol,
    exchange,
    ltp: round2(ltp),
    timestamp,
    overallSignal: rateOverallSignal(buyCount, sellCount, allSignals.length),
    buyCount,
    neutralCount,
    sellCount,
    oscillators,
    movingAverages,
    pivots: computePivotPoints(dayHigh, dayLow, prevClose),
  };
}
