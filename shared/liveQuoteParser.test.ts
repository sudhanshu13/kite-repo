import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveFuturesSnapshotFromSpot,
  parseYahooChartResponse,
} from './liveQuoteParser.ts';
import type { Instrument } from './types.ts';

const NIFTY_INST: Instrument = {
  token: 256265,
  symbol: 'NIFTY 50',
  name: 'NSE Nifty 50 Index',
  exchange: 'INDICES',
  lotSize: 1,
  tickSize: 0.05,
  basePrice: 25387.4,
  sector: 'Index',
  isIndex: true,
  yahooSymbol: '^NSEI',
};

const NIFTY_FUT_INST: Instrument = {
  token: 14893570,
  symbol: 'NIFTY NOV FUT',
  name: 'Nifty 50 November Futures',
  exchange: 'NFO',
  lotSize: 25,
  tickSize: 0.05,
  basePrice: 25450.0,
  sector: 'Derivatives',
  derivedFromToken: 256265,
  futuresBasisBps: 25,
};

test('parseYahooChartResponse uses fulldayChange to derive accurate prevClose for indices', () => {
  const payload = {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: 25387.4,
            previousClose: 25144.3, // intentionally stale 2-day-old close as returned by Yahoo for ^NSEI
            fulldayChange: 96.3,
            regularMarketDayHigh: 25501.35,
            regularMarketDayLow: 25267.3,
            regularMarketVolume: 0,
            regularMarketTime: 1794909667,
            fiftyTwoWeekHigh: 26373.2,
            fiftyTwoWeekLow: 22179.9,
            currentTradingPeriod: {
              regular: { start: 1794887100, end: 1794909600 },
            },
          },
          timestamp: [1794800000, 1794887100, 1794887400],
          indicators: {
            quote: [
              {
                open: [25100, 25277.3, 25300],
                high: [25150, 25310, 25501.35],
                low: [25080, 25267.3, 25290],
                close: [25144.3, 25295, 25387.4],
                volume: [0, 0, 0],
              },
            ],
          },
        },
      ],
    },
  };

  const parsed = parseYahooChartResponse(payload, NIFTY_INST, 1794910000 * 1000);
  assert.ok(parsed);
  assert.equal(parsed.ltp, 25387.4);
  assert.equal(parsed.prevClose, 25291.1);
  assert.equal(parsed.change, 96.3);
  assert.equal(parsed.changePercent, 0.38);
  assert.equal(parsed.open, 25277.3);
  assert.equal(parsed.high, 25501.35);
  assert.equal(parsed.low, 25267.3);
  assert.equal(parsed.isMarketOpen, false);
  assert.equal(parsed.historyCloses.length, 3);
});

test('deriveFuturesSnapshotFromSpot scales spot snapshot accurately by futures basis', () => {
  const spot = {
    token: 256265,
    ltp: 25387.4,
    open: 25277.3,
    high: 25501.35,
    low: 25267.3,
    prevClose: 25291.1,
    change: 96.3,
    changePercent: 0.38,
    volume: 0,
    averagePrice: 25385.35,
    week52High: 26373.2,
    week52Low: 22179.9,
    timestamp: 1794909667000,
    isMarketOpen: true,
    historyCloses: [25291.1, 25350, 25387.4],
  };

  const fut = deriveFuturesSnapshotFromSpot(NIFTY_FUT_INST, spot);
  assert.equal(fut.token, 14893570);
  assert.equal(fut.ltp, 25450.85);
  assert.equal(fut.prevClose, 25354.35);
  assert.equal(fut.isMarketOpen, true);
  assert.equal(fut.historyCloses.length, 3);
  assert.ok(fut.volume > 0);
});

test('parseYahooSearchQuotes parses NSE and BSE equities and ignores non-Indian listings', async () => {
  const { hashDynamicInstrumentToken, parseYahooSearchQuotes } = await import('./liveQuoteParser.ts');
  const parsed = parseYahooSearchQuotes({
    quotes: [
      {
        symbol: 'SUZLON.NS',
        longname: 'Suzlon Energy Limited',
        exchange: 'NSI',
        quoteType: 'EQUITY',
        sectorDisp: 'Industrials',
      },
      {
        symbol: 'SUZLON.BO',
        shortname: 'SUZLON ENERGY LTD.',
        exchange: 'BSE',
        quoteType: 'EQUITY',
      },
      {
        symbol: 'AAPL',
        longname: 'Apple Inc.',
        exchange: 'NMS',
        quoteType: 'EQUITY',
      },
    ],
  });

  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].symbol, 'SUZLON');
  assert.equal(parsed[0].exchange, 'NSE');
  assert.equal(parsed[0].yahooSymbol, 'SUZLON.NS');
  assert.equal(parsed[0].token, hashDynamicInstrumentToken('NSE', 'SUZLON'));
  assert.equal(parsed[1].symbol, 'SUZLON');
  assert.equal(parsed[1].exchange, 'BSE');
  assert.ok(parsed[1].name.includes('(BSE)'));
  assert.notEqual(parsed[0].token, parsed[1].token);
});

test('parseYahooChartResponse preserves 1-paisa precision for low-priced stocks and avoids stale 5d chartPreviousClose', () => {
  const pennyInst: Instrument = {
    token: 71234567,
    symbol: 'ANTGRAPHIC',
    name: 'Antarctica Limited',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 0.73,
    sector: 'Equity',
    yahooSymbol: 'ANTGRAPHIC.NS',
  };

  const payload = {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: 0.73,
            chartPreviousClose: 0.65, // 5 days ago
            regularMarketTime: 1794909667,
            currentTradingPeriod: {
              regular: { start: 1794887100, end: 1794909600 },
            },
          },
          timestamp: [1794700000, 1794820000, 1794887100, 1794887400],
          indicators: {
            quote: [
              {
                open: [0.68, 0.71, 0.72, 0.73],
                high: [0.7, 0.73, 0.74, 0.74],
                low: [0.67, 0.7, 0.72, 0.72],
                close: [0.69, 0.72, 0.73, 0.73],
                volume: [1000, 2000, 3000, 4000],
              },
            ],
          },
        },
      ],
    },
  };

  const parsed = parseYahooChartResponse(payload, pennyInst, 1794910000 * 1000);
  assert.ok(parsed);
  assert.equal(parsed.ltp, 0.73);
  assert.equal(parsed.prevClose, 0.72);
  assert.equal(parsed.change, 0.01);
  assert.equal(parsed.changePercent, 1.39);
});

