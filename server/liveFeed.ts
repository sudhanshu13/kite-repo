import { deriveOptionSnapshotFromSpot } from '../shared/derivatives.ts';
import {
  deriveFuturesSnapshotFromSpot,
  hashDynamicInstrumentToken,
  parseYahooChartResponse,
  parseYahooSearchQuotes,
  type ParsedLiveQuoteSnapshot,
  type YahooChartResponse,
  type YahooSearchResponse,
} from '../shared/liveQuoteParser.ts';
import type { Instrument } from '../shared/types.ts';

async function fetchYahooChart(
  symbol: string,
  interval: '1m' | '5m',
  range: '1d' | '5d',
  timeoutMs = 3500,
): Promise<YahooChartResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MarketFeed/1.0)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as YahooChartResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSingleInstrumentSnapshot(
  inst: Instrument,
  mode: 'full' | 'intraday' = 'intraday',
  timeoutMs = 3000,
): Promise<ParsedLiveQuoteSnapshot | null> {
  if (!inst.yahooSymbol) return null;
  const interval = mode === 'full' ? '5m' : '1m';
  const range = mode === 'full' ? '5d' : '1d';
  const raw = await fetchYahooChart(inst.yahooSymbol, interval, range, timeoutMs);
  if (!raw) return null;
  return parseYahooChartResponse(raw, inst);
}

const searchCache = new Map<string, { expiresAt: number; items: Instrument[] }>();
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Searches all NSE (.NS) and BSE (.BO) listed Indian stocks and ETFs via Yahoo Finance Search,
 * with a direct ticker probe fallback for exact symbol queries.
 */
export async function searchYahooIndianInstruments(
  query: string,
  timeoutMs = 2800,
): Promise<Instrument[]> {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return [];

  const cached = searchCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const runYahooSearch = async (searchText: string): Promise<Instrument[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        searchText,
      )}&quotesCount=20&newsCount=0&enableFuzzyQuery=true`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MarketFeed/1.0)',
          Accept: 'application/json',
        },
      });
      if (!res.ok) return [];
      const json = (await res.json()) as YahooSearchResponse;
      return parseYahooSearchQuotes(json);
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  };

  let items = await runYahooSearch(query.trim());

  // Yahoo Finance often returns 0 hits for pluralized Indian names (e.g. "india cements" vs "india cement")
  if (items.length === 0) {
    const singularized = query
      .trim()
      .split(/\s+/)
      .map((w) => (w.length >= 5 && /s$/i.test(w) ? w.slice(0, -1) : w))
      .join(' ');
    if (singularized.toLowerCase() !== normalized) {
      items = await runYahooSearch(singularized);
    }
  }

  // Fallback: if user typed an exact ticker (e.g. "SUZLON" or "TRIDENT") and search returned nothing,
  // probe <TICKER>.NS and <TICKER>.BO directly via chart endpoint
  const cleanTicker = query.trim().toUpperCase();
  if (items.length === 0 && /^[A-Z0-9&-]{2,16}$/.test(cleanTicker)) {
    const candidates: Array<{ exchange: 'NSE' | 'BSE'; yahooSymbol: string }> = [
      { exchange: 'NSE', yahooSymbol: `${cleanTicker}.NS` },
      { exchange: 'BSE', yahooSymbol: `${cleanTicker}.BO` },
    ];
    const probes = await Promise.all(
      candidates.map(async (c) => {
        const raw = await fetchYahooChart(c.yahooSymbol, '1m', '1d', 2200);
        const meta = raw?.chart?.result?.[0]?.meta;
        if (!meta || typeof meta.regularMarketPrice !== 'number' || meta.regularMarketPrice <= 0) {
          return null;
        }
        const inst: Instrument = {
          token: hashDynamicInstrumentToken(c.exchange, cleanTicker),
          symbol: cleanTicker,
          name: c.exchange === 'BSE' ? `${cleanTicker} (BSE)` : cleanTicker,
          exchange: c.exchange,
          lotSize: 1,
          tickSize: 0.05,
          basePrice: meta.regularMarketPrice,
          sector: 'Equity',
          instrumentType: 'EQ',
          underlying: cleanTicker,
          yahooSymbol: c.yahooSymbol,
        };
        return inst;
      }),
    );
    items = probes.filter((x): x is Instrument => x !== null);
  }

  searchCache.set(normalized, {
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    items,
  });
  if (searchCache.size > 250) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }

  return items;
}

export async function fetchLiveMarketSnapshots(
  instruments: Instrument[],
  mode: 'full' | 'intraday',
  priorityTokens?: Set<number>,
): Promise<ParsedLiveQuoteSnapshot[]> {
  const interval = mode === 'full' ? '5m' : '1m';
  const range = mode === 'full' ? '5d' : '1d';

  const directInstruments = instruments.filter(
    (inst) =>
      Boolean(inst.yahooSymbol) &&
      (!priorityTokens || priorityTokens.has(inst.token)),
  );
  const byToken = new Map<number, ParsedLiveQuoteSnapshot>();
  const concurrency = 12;

  for (let i = 0; i < directInstruments.length; i += concurrency) {
    const batch = directInstruments.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (inst) => {
        const raw = await fetchYahooChart(inst.yahooSymbol!, interval, range);
        if (!raw) return null;
        return parseYahooChartResponse(raw, inst);
      }),
    );
    for (const snap of results) {
      if (snap) {
        byToken.set(snap.token, snap);
      }
    }
  }

  // Derive futures, options, and cross-exchange prices from live underlying spot quotes
  for (const inst of instruments) {
    if (!inst.derivedFromToken) continue;
    const spotSnap = byToken.get(inst.derivedFromToken);
    if (!spotSnap) continue;
    if (inst.instrumentType === 'CE' || inst.instrumentType === 'PE') {
      byToken.set(inst.token, deriveOptionSnapshotFromSpot(inst, spotSnap));
    } else {
      byToken.set(inst.token, deriveFuturesSnapshotFromSpot(inst, spotSnap));
    }
  }

  return Array.from(byToken.values());
}
