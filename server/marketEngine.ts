import {
  priceOptionBlackScholes,
  searchInstruments,
  type SearchCategoryFilter,
} from '../shared/derivatives.ts';
import { round2, roundTick, type ParsedLiveQuoteSnapshot } from '../shared/liveQuoteParser.ts';
import { evaluateTechnicalSummary } from '../shared/technicals.ts';
import type {
  Instrument,
  MarketDepthLevel,
  MarketQuote,
  OverallTechnicalRating,
  TechnicalSummary,
} from '../shared/types.ts';
import {
  CORE_LIVE_SYNC_TOKENS,
  INSTRUMENT_MAP,
  INSTRUMENTS,
  registerDynamicInstrument,
} from './instruments.ts';
import {
  fetchLiveMarketSnapshots,
  fetchSingleInstrumentSnapshot,
  searchYahooIndianInstruments,
} from './liveFeed.ts';

function buildDepth(
  ltp: number,
  tickSize: number,
  seed: number,
): { buy: MarketDepthLevel[]; sell: MarketDepthLevel[] } {
  const buy: MarketDepthLevel[] = [];
  const sell: MarketDepthLevel[] = [];
  for (let i = 0; i < 5; i++) {
    const spreadStep = (i + 1) * tickSize;
    const bidPrice = roundTick(Math.max(tickSize, ltp - spreadStep), tickSize);
    const askPrice = roundTick(ltp + spreadStep, tickSize);
    const bQty = Math.floor(25 + ((seed * (i + 3) * 17) % 640));
    const sQty = Math.floor(25 + ((seed * (i + 5) * 23) % 640));
    buy.push({
      price: bidPrice,
      orders: Math.max(1, (bQty % 14) + 1),
      quantity: bQty,
    });
    sell.push({
      price: askPrice,
      orders: Math.max(1, (sQty % 14) + 1),
      quantity: sQty,
    });
  }
  return { buy, sell };
}

export class MarketEngine {
  private quotes = new Map<number, MarketQuote>();
  private priceHistory = new Map<number, number[]>();
  private biases = new Map<number, number>();
  private liveSyncedTokens = new Set<number>();
  private activeInterestTokens = new Set<number>(CORE_LIVE_SYNC_TOKENS);
  private tickCounter = 0;
  private liveSynced = false;
  private marketOpen = false;

  constructor() {
    this.seedFallbackMarket();
  }

  public trackInterestTokens(tokens: number[]) {
    for (const token of tokens) {
      const inst = INSTRUMENT_MAP.get(token);
      if (!inst) continue;
      if (inst.yahooSymbol) {
        this.activeInterestTokens.add(token);
      } else if (inst.derivedFromToken) {
        this.activeInterestTokens.add(inst.derivedFromToken);
      }
    }
  }

  public isLiveSynced(): boolean {
    return this.liveSynced;
  }

  public isMarketOpen(): boolean {
    return this.marketOpen;
  }

  private seedFallbackMarket() {
    const now = Date.now();
    INSTRUMENTS.forEach((inst, idx) => {
      // Keep startup fast & memory lean: only pre-seed core/curated/F&O instruments;
      // the ~3,000 NSE CSV master stocks seed/sync lazily on demand when searched, watched, or traded.
      if (inst.token >= 70_000_000 && !CORE_LIVE_SYNC_TOKENS.has(inst.token)) {
        return;
      }
      const isOption = inst.instrumentType === 'CE' || inst.instrumentType === 'PE';
      const bias = ((idx % 5) - 2) * 0.00025;
      this.biases.set(inst.token, bias);

      let ltp: number;
      let prevClose: number;
      let open: number;
      let high: number;
      let low: number;
      let history: number[];

      if (isOption && inst.derivedFromToken && this.quotes.has(inst.derivedFromToken)) {
        const spotQuote = this.quotes.get(inst.derivedFromToken)!;
        const spotHist = this.priceHistory.get(inst.derivedFromToken) ?? [spotQuote.ltp];
        const side = inst.instrumentType === 'PE' ? 'PE' : 'CE';
        const strike = inst.strike ?? spotQuote.ltp;
        const dte = inst.daysToExpiry ?? 7;
        const iv = inst.optionIv ?? 0.15;
        const priceAt = (s: number) =>
          priceOptionBlackScholes({
            spot: s,
            strike,
            daysToExpiry: dte,
            iv,
            optionType: side,
            tickSize: inst.tickSize,
          });

        ltp = priceAt(spotQuote.ltp);
        prevClose = priceAt(spotQuote.close);
        open = priceAt(spotQuote.open);
        const pH = priceAt(spotQuote.high);
        const pL = priceAt(spotQuote.low);
        high = Math.max(ltp, open, pH, pL);
        low = Math.max(inst.tickSize, Math.min(ltp, open, pH, pL));

        const stride = Math.max(1, Math.floor(spotHist.length / 55));
        history = [];
        for (let i = 0; i < spotHist.length; i += stride) {
          history.push(priceAt(spotHist[i]));
        }
        if (history.length === 0 || history[history.length - 1] !== ltp) {
          history.push(ltp);
        }
      } else {
        history = [];
        let p = inst.basePrice * (1 - bias * 60);
        for (let i = 0; i < 220; i++) {
          const wave = Math.sin((i + idx * 7) * 0.19) * 0.0012;
          const drift = bias + Math.cos((i + idx) * 0.07) * 0.0005;
          p = Math.max(inst.tickSize, p * (1 + drift + wave));
          history.push(roundTick(p, inst.tickSize));
        }

        ltp = roundTick(inst.basePrice, inst.tickSize);
        prevClose = roundTick(history[history.length - 18] || ltp, inst.tickSize);
        open = roundTick(history[history.length - 12] || prevClose, inst.tickSize);
        history[history.length - 1] = ltp;

        high = Math.max(open, ltp, prevClose);
        low = Math.min(open, ltp, prevClose);
      }

      const change = round2(ltp - prevClose);
      const changePercent = prevClose > 0 ? round2((change / prevClose) * 100) : 0;

      this.priceHistory.set(inst.token, history);
      this.quotes.set(inst.token, {
        token: inst.token,
        symbol: inst.symbol,
        exchange: inst.exchange,
        ltp,
        open,
        high: roundTick(high, inst.tickSize),
        low: roundTick(low, inst.tickSize),
        close: prevClose,
        change,
        changePercent,
        volume: inst.isIndex
          ? 0
          : isOption
            ? Math.max(inst.lotSize * 20, Math.floor(125000 + (idx % 17) * 32000))
            : Math.floor(450000 + idx * 135000),
        averagePrice: roundTick((high + low + ltp) / 3, inst.tickSize),
        lastQty: inst.isIndex ? 0 : Math.max(inst.lotSize, (idx % 9) * inst.lotSize),
        lowerCircuit: roundTick(prevClose * (isOption ? 0.05 : 0.9), inst.tickSize),
        upperCircuit: roundTick(prevClose * (isOption ? 2.5 : 1.1), inst.tickSize),
        week52High: roundTick(ltp * 1.18, inst.tickSize),
        week52Low: Math.max(inst.tickSize, roundTick(ltp * 0.76, inst.tickSize)),
        timestamp: now,
        direction: change >= 0 ? 'up' : 'down',
        depth: inst.isIndex ? { buy: [], sell: [] } : buildDepth(ltp, inst.tickSize, idx + 11),
      });
    });
  }

  private seedSingleFallbackInstrument(inst: Instrument, idx = 1) {
    if (this.quotes.has(inst.token)) return;
    const now = Date.now();
    const isOption = inst.instrumentType === 'CE' || inst.instrumentType === 'PE';
    const bias = ((idx % 5) - 2) * 0.00025;
    this.biases.set(inst.token, bias);

    const history: number[] = [];
    let p = Math.max(inst.tickSize, inst.basePrice) * (1 - bias * 60);
    for (let i = 0; i < 80; i++) {
      const wave = Math.sin((i + idx * 7) * 0.19) * 0.0012;
      const drift = bias + Math.cos((i + idx) * 0.07) * 0.0005;
      p = Math.max(inst.tickSize, p * (1 + drift + wave));
      history.push(roundTick(p, inst.tickSize));
    }
    const ltp = roundTick(Math.max(inst.tickSize, inst.basePrice), inst.tickSize);
    const prevClose = roundTick(history[history.length - 12] || ltp, inst.tickSize);
    const open = roundTick(history[history.length - 8] || prevClose, inst.tickSize);
    history[history.length - 1] = ltp;

    const high = Math.max(open, ltp, prevClose);
    const low = Math.min(open, ltp, prevClose);
    const change = round2(ltp - prevClose);
    const changePercent = prevClose > 0 ? round2((change / prevClose) * 100) : 0;

    this.priceHistory.set(inst.token, history);
    this.quotes.set(inst.token, {
      token: inst.token,
      symbol: inst.symbol,
      exchange: inst.exchange,
      ltp,
      open,
      high: roundTick(high, inst.tickSize),
      low: roundTick(low, inst.tickSize),
      close: prevClose,
      change,
      changePercent,
      volume: inst.isIndex ? 0 : Math.floor(150000 + (idx % 20) * 45000),
      averagePrice: roundTick((high + low + ltp) / 3, inst.tickSize),
      lastQty: inst.isIndex ? 0 : Math.max(inst.lotSize, 5),
      lowerCircuit: roundTick(prevClose * (isOption ? 0.05 : 0.9), inst.tickSize),
      upperCircuit: roundTick(prevClose * (isOption ? 2.5 : 1.1), inst.tickSize),
      week52High: roundTick(ltp * 1.18, inst.tickSize),
      week52Low: Math.max(inst.tickSize, roundTick(ltp * 0.76, inst.tickSize)),
      timestamp: now,
      direction: change >= 0 ? 'up' : 'down',
      depth: inst.isIndex ? { buy: [], sell: [] } : buildDepth(ltp, inst.tickSize, idx + 11),
    });
  }

  public async syncFromLiveFeed(mode: 'full' | 'intraday'): Promise<MarketQuote[]> {
    const snapshots = await fetchLiveMarketSnapshots(
      INSTRUMENTS,
      mode,
      this.activeInterestTokens,
    );
    if (snapshots.length === 0) {
      return [];
    }

    this.liveSynced = true;
    this.marketOpen = snapshots.some((s) => s.isMarketOpen);

    const updated: MarketQuote[] = [];
    for (const snap of snapshots) {
      this.liveSyncedTokens.add(snap.token);
      const q = this.applyLiveSnapshot(snap, mode === 'full');
      if (q) updated.push(q);
    }
    return updated;
  }

  public ensureQuoteExists(token: number): MarketQuote | undefined {
    const existing = this.quotes.get(token);
    if (existing) return existing;
    const inst = INSTRUMENT_MAP.get(token);
    if (!inst) return undefined;
    this.seedSingleFallbackInstrument(inst, token % 97);
    return this.quotes.get(token);
  }

  public async getOrFetchLiveQuote(token: number): Promise<MarketQuote | undefined> {
    const inst = INSTRUMENT_MAP.get(token);
    if (!inst) return undefined;
    this.trackInterestTokens([token]);
    await this.ensureLiveQuotes([token]);
    return this.ensureQuoteExists(token);
  }

  public async ensureLiveQuotes(tokens: number[]): Promise<MarketQuote[]> {
    const toFetch = tokens
      .map((t) => INSTRUMENT_MAP.get(t))
      .filter(
        (inst): inst is Instrument =>
          Boolean(inst && inst.yahooSymbol && !this.liveSyncedTokens.has(inst.token)),
      )
      .slice(0, 12);

    if (toFetch.length === 0) return [];

    const results = await Promise.all(
      toFetch.map(async (inst) => {
        const snap = await fetchSingleInstrumentSnapshot(inst, 'intraday', 2500);
        if (!snap) return null;
        this.liveSyncedTokens.add(inst.token);
        this.activeInterestTokens.add(inst.token);
        this.seedSingleFallbackInstrument(inst, inst.token % 97);
        return this.applyLiveSnapshot(snap, true);
      }),
    );
    return results.filter((q): q is MarketQuote => q !== null);
  }

  public async searchInstrumentsWithLiveDiscovery(
    query: string,
    options?: { category?: SearchCategoryFilter; limit?: number; live?: boolean },
  ): Promise<{ instruments: Instrument[]; quotes: MarketQuote[] }> {
    const category = options?.category ?? 'all';
    const limit = options?.limit ?? 50;
    const trimmed = query.trim();
    if (!trimmed) {
      return { instruments: [], quotes: [] };
    }

    // Check if query looks purely like an F&O derivative search (skip remote equity lookup)
    const lower = trimmed.toLowerCase();
    const isDerivativeOnly =
      category === 'fut' ||
      category === 'opt' ||
      /\b(fut|future|futures|ce|pe|call|put|nfo|bfo)\b/.test(lower) ||
      /\d{4,5}\s*(ce|pe)?$/i.test(lower);

    if (options?.live && !isDerivativeOnly && trimmed.length >= 2) {
      const remoteMatches = await searchYahooIndianInstruments(trimmed);
      for (const candidate of remoteMatches) {
        registerDynamicInstrument(candidate);
      }
    }

    const matched = searchInstruments(INSTRUMENTS, trimmed, { category, limit });

    // Fetch live quotes for top matching NSE/BSE equities that haven't synced yet
    if (options?.live) {
      const equityTokens = matched
        .filter((i) => i.yahooSymbol && !this.liveSyncedTokens.has(i.token))
        .slice(0, 10)
        .map((i) => i.token);
      if (equityTokens.length > 0) {
        await this.ensureLiveQuotes(equityTokens);
      }
    }

    const matchedQuotes: MarketQuote[] = [];
    for (const inst of matched) {
      const q = this.quotes.get(inst.token);
      if (q) matchedQuotes.push(q);
    }

    return { instruments: matched, quotes: matchedQuotes };
  }

  private applyLiveSnapshot(
    snap: ParsedLiveQuoteSnapshot,
    replaceHistory: boolean,
  ): MarketQuote | null {
    const inst = INSTRUMENT_MAP.get(snap.token);
    const prev = this.quotes.get(snap.token);
    if (!inst || !prev) return null;

    const direction: 'up' | 'down' | 'flat' =
      snap.ltp > prev.ltp
        ? 'up'
        : snap.ltp < prev.ltp
          ? 'down'
          : snap.change >= 0
            ? 'up'
            : 'down';

    const changed =
      !this.liveSynced ||
      snap.ltp !== prev.ltp ||
      snap.prevClose !== prev.close ||
      snap.high !== prev.high ||
      snap.low !== prev.low ||
      snap.volume !== prev.volume;

    const nextQuote: MarketQuote = {
      token: inst.token,
      symbol: inst.symbol,
      exchange: inst.exchange,
      ltp: snap.ltp,
      open: snap.open,
      high: snap.high,
      low: snap.low,
      close: snap.prevClose,
      change: snap.change,
      changePercent: snap.changePercent,
      volume: snap.volume,
      averagePrice: snap.averagePrice,
      lastQty: inst.isIndex ? 0 : Math.max(1, prev.lastQty || 12),
      lowerCircuit: roundTick(snap.prevClose * 0.9, inst.tickSize),
      upperCircuit: roundTick(snap.prevClose * 1.1, inst.tickSize),
      week52High: snap.week52High,
      week52Low: snap.week52Low,
      timestamp: snap.timestamp,
      direction,
      depth: inst.isIndex
        ? { buy: [], sell: [] }
        : buildDepth(snap.ltp, inst.tickSize, this.tickCounter + inst.token),
    };

    this.quotes.set(inst.token, nextQuote);

    if (replaceHistory && snap.historyCloses.length >= 30) {
      this.priceHistory.set(inst.token, snap.historyCloses);
    } else {
      const history = this.priceHistory.get(inst.token) ?? [];
      if (history.length === 0 || history[history.length - 1] !== snap.ltp) {
        history.push(snap.ltp);
        if (history.length > 260) history.shift();
        this.priceHistory.set(inst.token, history);
      }
    }

    return changed ? nextQuote : null;
  }

  public stepTick(): MarketQuote[] {
    this.tickCounter++;

    // When synced to live market feed, never drift prices randomly away from real NSE/BSE prices.
    // During open market hours, refresh order-book depth cleanly while waiting for live quote polls.
    if (this.liveSynced) {
      if (!this.marketOpen) {
        return [];
      }
      const now = Date.now();
      const depthUpdated: MarketQuote[] = [];
      INSTRUMENTS.forEach((inst, idx) => {
        if (inst.isIndex) return;
        const isOption = inst.instrumentType === 'CE' || inst.instrumentType === 'PE';
        const modulus = isOption ? 24 : 3;
        if ((idx + this.tickCounter) % modulus !== 0) return;
        const prev = this.quotes.get(inst.token);
        if (!prev) return;
        const nextQuote: MarketQuote = {
          ...prev,
          timestamp: now,
          depth: buildDepth(prev.ltp, inst.tickSize, this.tickCounter + inst.token),
        };
        this.quotes.set(inst.token, nextQuote);
        depthUpdated.push(nextQuote);
      });
      return depthUpdated;
    }

    // Offline fallback simulation when external live market feed is unreachable
    const now = Date.now();
    const updated: MarketQuote[] = [];

    INSTRUMENTS.forEach((inst, idx) => {
      const isOption = inst.instrumentType === 'CE' || inst.instrumentType === 'PE';
      const isFuture = inst.instrumentType === 'FUT';
      const shouldStep = isOption
        ? (idx + this.tickCounter) % 24 === 0
        : isFuture
          ? (idx + this.tickCounter) % 4 === 0
          : inst.isIndex || (inst.token + this.tickCounter) % 2 === 0;
      if (!shouldStep) return;

      const prev = this.quotes.get(inst.token);
      if (!prev) return;

      let nextLtp: number;
      if (isOption && inst.derivedFromToken && this.quotes.has(inst.derivedFromToken)) {
        const spot = this.quotes.get(inst.derivedFromToken)!.ltp;
        nextLtp = priceOptionBlackScholes({
          spot,
          strike: inst.strike ?? spot,
          daysToExpiry: inst.daysToExpiry ?? 7,
          iv: inst.optionIv ?? 0.15,
          optionType: inst.instrumentType === 'PE' ? 'PE' : 'CE',
          tickSize: inst.tickSize,
        });
      } else if (isFuture && inst.derivedFromToken && this.quotes.has(inst.derivedFromToken)) {
        const spot = this.quotes.get(inst.derivedFromToken)!.ltp;
        const basisFactor = 1 + (inst.futuresBasisBps ?? 25) / 10000;
        nextLtp = roundTick(spot * basisFactor, inst.tickSize);
      } else {
        const bias = this.biases.get(inst.token) ?? 0;
        const meanPull = ((inst.basePrice - prev.ltp) / inst.basePrice) * 0.015;
        const noise = (Math.random() - 0.5) * 0.0028;
        const pctMove = bias * 0.35 + meanPull + noise;

        nextLtp = roundTick(
          Math.max(inst.tickSize, prev.ltp * (1 + pctMove)),
          inst.tickSize,
        );
        if (nextLtp < prev.lowerCircuit) nextLtp = prev.lowerCircuit;
        if (nextLtp > prev.upperCircuit) nextLtp = prev.upperCircuit;
      }

      const direction: 'up' | 'down' | 'flat' =
        nextLtp > prev.ltp ? 'up' : nextLtp < prev.ltp ? 'down' : 'flat';

      const nextHigh = Math.max(prev.high, nextLtp);
      const nextLow = Math.min(prev.low, nextLtp);
      const change = round2(nextLtp - prev.close);
      const changePercent =
        prev.close > 0 ? round2((change / prev.close) * 100) : 0;
      const addedQty = inst.isIndex
        ? 0
        : Math.max(inst.lotSize, (Math.floor(Math.random() * 5) + 1) * inst.lotSize);

      const nextQuote: MarketQuote = {
        ...prev,
        ltp: nextLtp,
        high: nextHigh,
        low: nextLow,
        change,
        changePercent,
        volume: prev.volume + addedQty,
        averagePrice: roundTick((prev.averagePrice * 9 + nextLtp) / 10, inst.tickSize),
        lastQty: addedQty,
        timestamp: now,
        direction,
        depth: inst.isIndex
          ? { buy: [], sell: [] }
          : buildDepth(nextLtp, inst.tickSize, this.tickCounter + inst.token),
      };

      this.quotes.set(inst.token, nextQuote);

      const history = this.priceHistory.get(inst.token) ?? [];
      history.push(nextLtp);
      if (history.length > 260) history.shift();
      this.priceHistory.set(inst.token, history);

      updated.push(nextQuote);
    });

    return updated;
  }

  public applyExternalQuote(token: number, externalLtp: number, volume?: number): MarketQuote | null {
    const inst = INSTRUMENT_MAP.get(token);
    const prev = this.quotes.get(token);
    if (!inst || !prev || externalLtp <= 0) return null;

    const nextLtp = roundTick(externalLtp, inst.tickSize);
    const direction: 'up' | 'down' | 'flat' =
      nextLtp > prev.ltp ? 'up' : nextLtp < prev.ltp ? 'down' : 'flat';
    const change = round2(nextLtp - prev.close);
    const changePercent = prev.close > 0 ? round2((change / prev.close) * 100) : 0;

    const nextQuote: MarketQuote = {
      ...prev,
      ltp: nextLtp,
      high: Math.max(prev.high, nextLtp),
      low: Math.min(prev.low, nextLtp),
      change,
      changePercent,
      volume: volume ?? prev.volume,
      timestamp: Date.now(),
      direction,
      depth: inst.isIndex
        ? { buy: [], sell: [] }
        : buildDepth(nextLtp, inst.tickSize, this.tickCounter + token),
    };

    this.quotes.set(token, nextQuote);
    const history = this.priceHistory.get(token) ?? [];
    history.push(nextLtp);
    if (history.length > 260) history.shift();
    this.priceHistory.set(token, history);

    return nextQuote;
  }

  public getQuote(token: number): MarketQuote | undefined {
    return this.quotes.get(token);
  }

  public getAllQuotes(): MarketQuote[] {
    return Array.from(this.quotes.values());
  }

  public getInstruments(): Instrument[] {
    return INSTRUMENTS;
  }

  public getTechnicalSummary(token: number): TechnicalSummary | null {
    const inst = INSTRUMENT_MAP.get(token);
    if (!inst) return null;
    this.ensureQuoteExists(token);
    const quote = this.quotes.get(token);
    const prices = this.priceHistory.get(token);
    if (!quote || !prices) return null;

    return evaluateTechnicalSummary({
      token: inst.token,
      symbol: inst.symbol,
      exchange: inst.exchange,
      prices,
      dayHigh: quote.high,
      dayLow: quote.low,
      prevClose: quote.close,
      timestamp: quote.timestamp,
    });
  }

  public getWatchlistSignals(tokens: number[]): Record<number, OverallTechnicalRating> {
    const signals: Record<number, OverallTechnicalRating> = {};
    for (const token of tokens) {
      const summary = this.getTechnicalSummary(token);
      if (summary) {
        signals[token] = summary.overallSignal;
      }
    }
    return signals;
  }
}
