import type { Instrument } from './types.ts';

export interface YahooChartMeta {
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  fulldayChange?: number;
  regularMarketChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  regularMarketTime?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  currentTradingPeriod?: {
    regular?: {
      start?: number;
      end?: number;
    };
  };
}

export interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: YahooChartMeta;
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
}

export interface ParsedLiveQuoteSnapshot {
  token: number;
  ltp: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  averagePrice: number;
  week52High: number;
  week52Low: number;
  timestamp: number;
  isMarketOpen: boolean;
  historyCloses: number[];
}

export function roundTick(price: number, tickSize = 0.05): number {
  const inv = Math.round(1 / tickSize);
  return Math.round(price * inv) / inv;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function parseYahooChartResponse(
  payload: YahooChartResponse,
  instrument: Instrument,
  nowMs = Date.now(),
): ParsedLiveQuoteSnapshot | null {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number' || meta.regularMarketPrice <= 0) {
    return null;
  }

  const tickSize = instrument.tickSize || 0.05;
  const ltp = roundTick(meta.regularMarketPrice, tickSize);

  let rawPrevClose: number | undefined;
  if (
    typeof meta.fulldayChange === 'number' &&
    Number.isFinite(meta.fulldayChange) &&
    meta.regularMarketPrice - meta.fulldayChange > 0
  ) {
    rawPrevClose = meta.regularMarketPrice - meta.fulldayChange;
  } else if (typeof meta.previousClose === 'number' && meta.previousClose > 0) {
    rawPrevClose = meta.previousClose;
  } else if (typeof meta.chartPreviousClose === 'number' && meta.chartPreviousClose > 0) {
    rawPrevClose = meta.chartPreviousClose;
  } else {
    rawPrevClose = ltp;
  }

  const prevClose = roundTick(rawPrevClose, tickSize);
  const change = round2(ltp - prevClose);
  const changePercent = prevClose > 0 ? round2((change / prevClose) * 100) : 0;

  const timestamps = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const opens = q.open ?? [];
  const highs = q.high ?? [];
  const lows = q.low ?? [];
  const closes = q.close ?? [];
  const volumes = q.volume ?? [];

  const historyCloses: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    if (typeof c === 'number' && Number.isFinite(c) && c > 0) {
      historyCloses.push(roundTick(c, tickSize));
    }
  }
  if (historyCloses.length > 0 && historyCloses[historyCloses.length - 1] !== ltp) {
    historyCloses.push(ltp);
  }

  const regStart = meta.currentTradingPeriod?.regular?.start;
  const regEnd = meta.currentTradingPeriod?.regular?.end;
  const nowSec = Math.floor(nowMs / 1000);
  const isMarketOpen =
    typeof regStart === 'number' && typeof regEnd === 'number'
      ? nowSec >= regStart && nowSec <= regEnd
      : false;

  // Today's session window starts at regular.start (or last day if unavailable)
  let todayOpen: number | undefined;
  let todayHigh = ltp;
  let todayLow = ltp;
  let pvSum = 0;
  let vSum = 0;

  for (let i = 0; i < timestamps.length; i++) {
    const ts = timestamps[i];
    if (typeof regStart === 'number' && ts < regStart) continue;
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i];

    if (todayOpen === undefined && typeof o === 'number' && Number.isFinite(o) && o > 0) {
      todayOpen = roundTick(o, tickSize);
    }
    if (typeof h === 'number' && Number.isFinite(h) && h > 0) {
      todayHigh = Math.max(todayHigh, h);
    }
    if (typeof l === 'number' && Number.isFinite(l) && l > 0) {
      todayLow = Math.min(todayLow, l);
    }
    if (
      typeof c === 'number' &&
      Number.isFinite(c) &&
      typeof v === 'number' &&
      Number.isFinite(v) &&
      v > 0
    ) {
      const typical =
        typeof h === 'number' && typeof l === 'number' ? (h + l + c) / 3 : c;
      pvSum += typical * v;
      vSum += v;
    }
  }

  const high = roundTick(
    typeof meta.regularMarketDayHigh === 'number' && meta.regularMarketDayHigh > 0
      ? Math.max(meta.regularMarketDayHigh, ltp)
      : todayHigh,
    tickSize,
  );
  const low = roundTick(
    typeof meta.regularMarketDayLow === 'number' && meta.regularMarketDayLow > 0
      ? Math.min(meta.regularMarketDayLow, ltp)
      : todayLow,
    tickSize,
  );
  const open = todayOpen ?? prevClose;
  const volume = instrument.isIndex
    ? 0
    : Math.max(0, Math.round(meta.regularMarketVolume ?? vSum ?? 0));
  const averagePrice =
    vSum > 0
      ? roundTick(pvSum / vSum, tickSize)
      : roundTick((high + low + ltp) / 3, tickSize);

  const week52High = roundTick(
    typeof meta.fiftyTwoWeekHigh === 'number' && meta.fiftyTwoWeekHigh > 0
      ? Math.max(meta.fiftyTwoWeekHigh, high)
      : Math.max(high, ltp * 1.15),
    tickSize,
  );
  const week52Low = roundTick(
    typeof meta.fiftyTwoWeekLow === 'number' && meta.fiftyTwoWeekLow > 0
      ? Math.min(meta.fiftyTwoWeekLow, low)
      : Math.min(low, ltp * 0.8),
    tickSize,
  );

  return {
    token: instrument.token,
    ltp,
    open,
    high,
    low,
    prevClose,
    change,
    changePercent,
    volume,
    averagePrice,
    week52High,
    week52Low,
    timestamp:
      typeof meta.regularMarketTime === 'number' && meta.regularMarketTime > 0
        ? meta.regularMarketTime * 1000
        : nowMs,
    isMarketOpen,
    historyCloses: historyCloses.slice(-260),
  };
}

export function deriveFuturesSnapshotFromSpot(
  futuresInst: Instrument,
  spotSnapshot: ParsedLiveQuoteSnapshot,
): ParsedLiveQuoteSnapshot {
  const basisFactor = 1 + (futuresInst.futuresBasisBps ?? 25) / 10000;
  const tick = futuresInst.tickSize || 0.05;
  const ltp = roundTick(spotSnapshot.ltp * basisFactor, tick);
  const prevClose = roundTick(spotSnapshot.prevClose * basisFactor, tick);
  const change = round2(ltp - prevClose);
  const changePercent = prevClose > 0 ? round2((change / prevClose) * 100) : 0;

  return {
    token: futuresInst.token,
    ltp,
    open: roundTick(spotSnapshot.open * basisFactor, tick),
    high: roundTick(spotSnapshot.high * basisFactor, tick),
    low: roundTick(spotSnapshot.low * basisFactor, tick),
    prevClose,
    change,
    changePercent,
    volume: spotSnapshot.volume > 0 ? spotSnapshot.volume : 1245800,
    averagePrice: roundTick(spotSnapshot.averagePrice * basisFactor, tick),
    week52High: roundTick(spotSnapshot.week52High * basisFactor, tick),
    week52Low: roundTick(spotSnapshot.week52Low * basisFactor, tick),
    timestamp: spotSnapshot.timestamp,
    isMarketOpen: spotSnapshot.isMarketOpen,
    historyCloses: spotSnapshot.historyCloses.map((c) => roundTick(c * basisFactor, tick)),
  };
}
