import {
  deriveFuturesSnapshotFromSpot,
  parseYahooChartResponse,
  type ParsedLiveQuoteSnapshot,
  type YahooChartResponse,
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
        'User-Agent': 'Mozilla/5.0 (compatible; KiteSandbox/1.0)',
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

export async function fetchLiveMarketSnapshots(
  instruments: Instrument[],
  mode: 'full' | 'intraday',
): Promise<ParsedLiveQuoteSnapshot[]> {
  const interval = mode === 'full' ? '5m' : '1m';
  const range = mode === 'full' ? '5d' : '1d';

  const directInstruments = instruments.filter((inst) => Boolean(inst.yahooSymbol));
  const byToken = new Map<number, ParsedLiveQuoteSnapshot>();
  const concurrency = 10;

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

  // Derive futures prices from live underlying index spot quotes
  for (const inst of instruments) {
    if (!inst.derivedFromToken) continue;
    const spotSnap = byToken.get(inst.derivedFromToken);
    if (spotSnap) {
      byToken.set(inst.token, deriveFuturesSnapshotFromSpot(inst, spotSnap));
    }
  }

  return Array.from(byToken.values());
}
