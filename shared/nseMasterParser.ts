import { hashDynamicInstrumentToken } from './liveQuoteParser.ts';
import type { Instrument } from './types.ts';

/**
 * Splits a single CSV line handling double-quoted fields containing commas.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses NSE official EQUITY_L.csv into NSE Equity Instrument records.
 * Header format: SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
 */
export function parseNseEquityCsv(csvText: string): Instrument[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const seen = new Set<string>();
  const results: Instrument[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const cols = parseCsvLine(raw);
    const symbol = (cols[0] ?? '').trim().toUpperCase();
    const companyName = (cols[1] ?? '').trim();
    const series = (cols[2] ?? '').trim().toUpperCase();

    if (!symbol || symbol.length > 24 || seen.has(symbol)) continue;
    // Keep standard tradable equity series (EQ, BE, BZ, SM, ST)
    if (series && !['EQ', 'BE', 'BZ', 'SM', 'ST', 'BL'].includes(series)) continue;

    seen.add(symbol);
    const parsedLot = Number(cols[5]);
    const lotSize = Number.isFinite(parsedLot) && parsedLot >= 1 ? Math.round(parsedLot) : 1;

    results.push({
      token: hashDynamicInstrumentToken('NSE', symbol),
      symbol,
      name: companyName || symbol,
      exchange: 'NSE',
      lotSize,
      tickSize: 0.05,
      basePrice: 100,
      sector: 'Equity',
      instrumentType: 'EQ',
      underlying: symbol,
      yahooSymbol: `${symbol}.NS`,
    });
  }

  return results;
}

/**
 * Parses NSE official eq_etfseclist.csv into NSE ETF Instrument records.
 * Header format: Symbol,Underlying Asset,SecurityName,DateofListing,MarketLot,...
 */
export function parseNseEtfCsv(csvText: string): Instrument[] {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const seen = new Set<string>();
  const results: Instrument[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;
    const cols = parseCsvLine(raw);
    const symbol = (cols[0] ?? '').trim().toUpperCase();
    const underlyingAsset = (cols[1] ?? '').trim();
    const securityName = (cols[2] ?? '').trim();

    if (!symbol || symbol.length > 24 || seen.has(symbol)) continue;
    seen.add(symbol);

    const parsedLot = Number(cols[4]);
    const lotSize = Number.isFinite(parsedLot) && parsedLot >= 1 ? Math.round(parsedLot) : 1;
    const displayName =
      underlyingAsset && securityName && !securityName.toLowerCase().includes(underlyingAsset.toLowerCase())
        ? `${securityName} (${underlyingAsset})`
        : securityName || underlyingAsset || symbol;

    results.push({
      token: hashDynamicInstrumentToken('NSE', symbol),
      symbol,
      name: displayName,
      exchange: 'NSE',
      lotSize,
      tickSize: 0.01,
      basePrice: 100,
      sector: 'ETF',
      instrumentType: 'EQ',
      underlying: symbol,
      yahooSymbol: `${symbol}.NS`,
    });
  }

  return results;
}
