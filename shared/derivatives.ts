import { round2, roundTick, type ParsedLiveQuoteSnapshot } from './liveQuoteParser.ts';
import type { Instrument } from './types.ts';

export type SearchCategoryFilter = 'all' | 'eq' | 'fut' | 'opt';

/**
 * Standard normal cumulative distribution function (Abramowitz & Stegun 7.1.26).
 */
function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * absX);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * erf);
}

/**
 * Computes realistic European option premium using Black-Scholes pricing.
 */
export function priceOptionBlackScholes(params: {
  spot: number;
  strike: number;
  daysToExpiry: number;
  iv: number;
  optionType: 'CE' | 'PE';
  riskFreeRate?: number;
  tickSize?: number;
}): number {
  const {
    spot,
    strike,
    daysToExpiry,
    iv,
    optionType,
    riskFreeRate = 0.065,
    tickSize = 0.05,
  } = params;

  if (spot <= 0 || strike <= 0) return tickSize;
  const t = Math.max(daysToExpiry, 0.25) / 365;
  const sigma = Math.max(iv, 0.05);
  const sqrtT = Math.sqrt(t);

  const d1 =
    (Math.log(spot / strike) + (riskFreeRate + 0.5 * sigma * sigma) * t) /
    (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const discount = Math.exp(-riskFreeRate * t);

  const rawPrice =
    optionType === 'CE'
      ? spot * normCdf(d1) - strike * discount * normCdf(d2)
      : strike * discount * normCdf(-d2) - spot * normCdf(-d1);

  return Math.max(tickSize, roundTick(rawPrice, tickSize));
}

/**
 * Derives a complete live quote snapshot for an Option contract from its underlying spot snapshot.
 */
export function deriveOptionSnapshotFromSpot(
  optionInst: Instrument,
  spotSnapshot: ParsedLiveQuoteSnapshot,
): ParsedLiveQuoteSnapshot {
  const optionType = optionInst.instrumentType === 'PE' ? 'PE' : 'CE';
  const strike = optionInst.strike ?? spotSnapshot.ltp;
  const daysToExpiry = optionInst.daysToExpiry ?? 7;
  const iv = optionInst.optionIv ?? 0.15;
  const tick = optionInst.tickSize || 0.05;

  const priceAt = (spotVal: number) =>
    priceOptionBlackScholes({
      spot: spotVal,
      strike,
      daysToExpiry,
      iv,
      optionType,
      tickSize: tick,
    });

  const ltp = priceAt(spotSnapshot.ltp);
  const prevClose = priceAt(spotSnapshot.prevClose);
  const open = priceAt(spotSnapshot.open);
  const pHigh = priceAt(spotSnapshot.high);
  const pLow = priceAt(spotSnapshot.low);
  const high = Math.max(ltp, open, pHigh, pLow);
  const low = Math.max(tick, Math.min(ltp, open, pHigh, pLow));
  const change = round2(ltp - prevClose);
  const changePercent = prevClose > 0 ? round2((change / prevClose) * 100) : 0;

  // Higher liquidity near ATM strikes
  const moneynessDist = Math.abs(spotSnapshot.ltp - strike) / Math.max(spotSnapshot.ltp, 1);
  const liquidityFactor = Math.max(0.08, Math.exp(-moneynessDist * 22));
  const volume = Math.max(
    optionInst.lotSize * 15,
    Math.round(850000 * liquidityFactor),
  );

  // Sample up to 60 history points so option technicals work without unnecessary overhead
  const sourceHist = spotSnapshot.historyCloses;
  const stride = Math.max(1, Math.floor(sourceHist.length / 60));
  const historyCloses: number[] = [];
  for (let i = 0; i < sourceHist.length; i += stride) {
    historyCloses.push(priceAt(sourceHist[i]));
  }
  if (historyCloses.length === 0 || historyCloses[historyCloses.length - 1] !== ltp) {
    historyCloses.push(ltp);
  }

  return {
    token: optionInst.token,
    ltp,
    open,
    high,
    low,
    prevClose,
    change,
    changePercent,
    volume,
    averagePrice: roundTick((high + low + ltp) / 3, tick),
    week52High: roundTick(Math.max(high * 1.45, ltp * 1.6), tick),
    week52Low: Math.max(tick, roundTick(low * 0.35, tick)),
    timestamp: spotSnapshot.timestamp,
    isMarketOpen: spotSnapshot.isMarketOpen,
    historyCloses,
  };
}

/**
 * Splits a user search string into normalized tokens, handling joined forms like
 * "nifty25800ce", "25800pe", "niftyfut", "bank nifty 62000 call", etc.
 */
export function tokenizeSearchQuery(query: string): string[] {
  const cleaned = query
    .trim()
    .toLowerCase()
    .replace(/bank\s+nifty/g, 'banknifty')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z]{3,})(fut|ce|pe)$/g, '$1 $2');

  const rawTokens = cleaned.split(/[\s,:/_-]+/).filter(Boolean);
  return rawTokens.map((tok) => {
    if (tok === 'call' || tok === 'calls') return 'ce';
    if (tok === 'put' || tok === 'puts') return 'pe';
    if (tok === 'future' || tok === 'futures') return 'fut';
    if (tok === 'bn' || tok === 'bnf') return 'banknifty';
    return tok;
  });
}

function getEffectiveType(inst: Instrument): 'EQ' | 'INDEX' | 'FUT' | 'CE' | 'PE' {
  if (inst.instrumentType) return inst.instrumentType;
  if (inst.isIndex || inst.exchange === 'INDICES') return 'INDEX';
  if (inst.symbol.endsWith(' FUT')) return 'FUT';
  if (inst.symbol.endsWith(' CE')) return 'CE';
  if (inst.symbol.endsWith(' PE')) return 'PE';
  return 'EQ';
}

function buildSearchCorpus(inst: Instrument): {
  symbolLower: string;
  underlyingLower: string;
  exchangeLower: string;
  typeLower: string;
  strikeStr: string;
  words: string[];
  fullText: string;
} {
  const symbolLower = inst.symbol.toLowerCase();
  const nameLower = inst.name.toLowerCase();
  const exchangeLower = inst.exchange.toLowerCase();
  const sectorLower = inst.sector.toLowerCase();
  const underlyingLower = (inst.underlying ?? '').toLowerCase();
  const expiryLower = (inst.expiry ?? '').toLowerCase();
  const effType = getEffectiveType(inst);
  const typeLower = effType.toLowerCase();
  const strikeStr = inst.strike !== undefined ? String(inst.strike) : '';

  const extraTags: string[] = [];
  if (effType === 'CE' || effType === 'PE') {
    extraTags.push('opt', 'option', 'options', 'fno', 'fo');
  } else if (effType === 'FUT') {
    extraTags.push('fut', 'future', 'futures', 'fno', 'fo');
  } else if (effType === 'INDEX') {
    extraTags.push('index', 'idx');
  } else {
    extraTags.push('eq', 'equity', 'stock');
  }
  if (underlyingLower === 'banknifty' || symbolLower === 'nifty bank') {
    extraTags.push('banknifty', 'bank', 'nifty');
  }

  const fullText = [
    symbolLower,
    nameLower,
    exchangeLower,
    sectorLower,
    underlyingLower,
    expiryLower,
    typeLower,
    strikeStr,
    ...extraTags,
  ]
    .filter(Boolean)
    .join(' ');

  const words = fullText.split(/[\s,:/_-]+/).filter(Boolean);

  return {
    symbolLower,
    underlyingLower,
    exchangeLower,
    typeLower,
    strikeStr,
    words,
    fullText,
  };
}

/**
 * Multi-token smart search & relevance ranking across Equities, Indices, Futures, and Option Strikes.
 */
export function searchInstruments(
  instruments: Instrument[],
  query: string,
  options?: {
    category?: SearchCategoryFilter;
    limit?: number;
  },
): Instrument[] {
  const category = options?.category ?? 'all';
  const limit = options?.limit ?? 25;
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return [];

  const normalizedQuery = tokens.join(' ');
  const queryHasDerivativeHint = tokens.some(
    (t) =>
      t === 'fut' ||
      t === 'ce' ||
      t === 'pe' ||
      t === 'opt' ||
      t === 'option' ||
      t === 'options' ||
      t === 'nfo' ||
      t === 'bfo' ||
      t === 'fno' ||
      t === 'nov' ||
      t === 'dec' ||
      t === 'jan' ||
      /^\d{3,5}$/.test(t),
  );

  const scored: Array<{ inst: Instrument; score: number }> = [];

  for (const inst of instruments) {
    const effType = getEffectiveType(inst);
    if (category === 'eq' && effType !== 'EQ' && effType !== 'INDEX') continue;
    if (category === 'fut' && effType !== 'FUT') continue;
    if (category === 'opt' && effType !== 'CE' && effType !== 'PE') continue;

    const corpus = buildSearchCorpus(inst);

    let allMatched = true;
    let score = 0;

    for (const tok of tokens) {
      const isNumericStrike = /^\d{3,5}$/.test(tok);
      if (isNumericStrike) {
        if (corpus.strikeStr === tok) {
          score += 120;
        } else if (corpus.strikeStr.startsWith(tok)) {
          score += 75;
        } else if (corpus.fullText.includes(tok)) {
          score += 20;
        } else {
          allMatched = false;
          break;
        }
        continue;
      }

      if (tok === 'ce' || tok === 'pe' || tok === 'fut') {
        if (corpus.typeLower === tok) {
          score += 90;
        } else {
          allMatched = false;
          break;
        }
        continue;
      }

      if (tok === 'nse' || tok === 'bse' || tok === 'nfo' || tok === 'bfo') {
        if (corpus.exchangeLower === tok) {
          score += 80;
        } else {
          allMatched = false;
          break;
        }
        continue;
      }

      if (corpus.symbolLower === tok || corpus.underlyingLower === tok) {
        score += 110;
      } else if (
        corpus.symbolLower.startsWith(tok) ||
        corpus.underlyingLower.startsWith(tok)
      ) {
        score += 70;
      } else if (corpus.words.some((w) => w.startsWith(tok))) {
        score += 45;
      } else if (corpus.fullText.includes(tok)) {
        score += 20;
      } else {
        allMatched = false;
        break;
      }
    }

    if (!allMatched) continue;

    if (corpus.symbolLower === normalizedQuery) {
      score += 300;
    } else if (corpus.symbolLower.startsWith(normalizedQuery)) {
      score += 120;
    }

    // Prioritize near-expiry derivatives slightly over far-expiry when scores tie
    if (effType === 'FUT' || effType === 'CE' || effType === 'PE') {
      const dte = inst.daysToExpiry ?? 30;
      score += Math.max(0, 25 - Math.min(25, Math.round(dte / 3)));
      // Prefer exact underlying match over substring (e.g. NIFTY ahead of BANKNIFTY when searching "nifty fut")
      if (tokens[0] === corpus.underlyingLower) {
        score += 45;
      }
    }

    // When user types a plain stock/index name without strike/fut/ce/pe, rank EQ/INDEX & near FUT first
    if (!queryHasDerivativeHint && category === 'all') {
      if (effType === 'EQ' || effType === 'INDEX') {
        score += 95;
      } else if (effType === 'FUT') {
        score += 55;
      }
    }

    scored.push({ inst, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tie-breaker: near expiry first, then strike ascending, then CE before PE
    const dteDiff = (a.inst.daysToExpiry ?? 0) - (b.inst.daysToExpiry ?? 0);
    if (dteDiff !== 0) return dteDiff;
    const strikeDiff = (a.inst.strike ?? 0) - (b.inst.strike ?? 0);
    if (strikeDiff !== 0) return strikeDiff;
    return a.inst.symbol.localeCompare(b.inst.symbol);
  });

  return scored.slice(0, limit).map((s) => s.inst);
}
