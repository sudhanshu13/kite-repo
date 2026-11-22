import { priceOptionBlackScholes } from '../shared/derivatives.ts';
import type { Exchange, Instrument } from '../shared/types.ts';

export const NIFTY_TOKEN = 256265;
export const SENSEX_TOKEN = 265;
export const BANKNIFTY_TOKEN = 260105;

const BASE_INSTRUMENTS: Instrument[] = [
  {
    token: NIFTY_TOKEN,
    symbol: 'NIFTY 50',
    name: 'NSE Nifty 50 Index',
    exchange: 'INDICES',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 25387.4,
    sector: 'Index',
    isIndex: true,
    instrumentType: 'INDEX',
    underlying: 'NIFTY',
    yahooSymbol: '^NSEI',
  },
  {
    token: SENSEX_TOKEN,
    symbol: 'SENSEX',
    name: 'BSE Sensex 30 Index',
    exchange: 'INDICES',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 82696.8,
    sector: 'Index',
    isIndex: true,
    instrumentType: 'INDEX',
    underlying: 'SENSEX',
    yahooSymbol: '^BSESN',
  },
  {
    token: BANKNIFTY_TOKEN,
    symbol: 'NIFTY BANK',
    name: 'NSE Nifty Bank Index',
    exchange: 'INDICES',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 62273.25,
    sector: 'Index',
    isIndex: true,
    instrumentType: 'INDEX',
    underlying: 'BANKNIFTY',
    yahooSymbol: '^NSEBANK',
  },
  {
    token: 738561,
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1367.0,
    sector: 'Energy',
    instrumentType: 'EQ',
    underlying: 'RELIANCE',
    yahooSymbol: 'RELIANCE.NS',
  },
  {
    token: 2953217,
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 2406.6,
    sector: 'IT',
    instrumentType: 'EQ',
    underlying: 'TCS',
    yahooSymbol: 'TCS.NS',
  },
  {
    token: 408065,
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1130.0,
    sector: 'IT',
    instrumentType: 'EQ',
    underlying: 'INFY',
    yahooSymbol: 'INFY.NS',
  },
  {
    token: 341249,
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 814.95,
    sector: 'Banking',
    instrumentType: 'EQ',
    underlying: 'HDFCBANK',
    yahooSymbol: 'HDFCBANK.NS',
  },
  {
    token: 1270529,
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1598.7,
    sector: 'Banking',
    instrumentType: 'EQ',
    underlying: 'ICICIBANK',
    yahooSymbol: 'ICICIBANK.NS',
  },
  {
    token: 779521,
    symbol: 'SBIN',
    name: 'State Bank of India',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1108.6,
    sector: 'Banking',
    instrumentType: 'EQ',
    underlying: 'SBIN',
    yahooSymbol: 'SBIN.NS',
  },
  {
    token: 2714625,
    symbol: 'BHARTIARTL',
    name: 'Bharti Airtel Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 2138.3,
    sector: 'Telecom',
    instrumentType: 'EQ',
    underlying: 'BHARTIARTL',
    yahooSymbol: 'BHARTIARTL.NS',
  },
  {
    token: 424961,
    symbol: 'ITC',
    name: 'ITC Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 293.3,
    sector: 'FMCG',
    instrumentType: 'EQ',
    underlying: 'ITC',
    yahooSymbol: 'ITC.NS',
  },
  {
    token: 2939649,
    symbol: 'LT',
    name: 'Larsen & Toubro Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 4155.5,
    sector: 'Infrastructure',
    instrumentType: 'EQ',
    underlying: 'LT',
    yahooSymbol: 'LT.NS',
  },
  {
    token: 969473,
    symbol: 'WIPRO',
    name: 'Wipro Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 189.9,
    sector: 'IT',
    instrumentType: 'EQ',
    underlying: 'WIPRO',
    yahooSymbol: 'WIPRO.NS',
  },
  {
    token: 884737,
    symbol: 'TMPV',
    name: 'Tata Motors Passenger Vehicles Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 259.2,
    sector: 'Auto',
    instrumentType: 'EQ',
    underlying: 'TMPV',
    yahooSymbol: 'TMPV.NS',
  },
  {
    token: 2815745,
    symbol: 'MARUTI',
    name: 'Maruti Suzuki India Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 12625.0,
    sector: 'Auto',
    instrumentType: 'EQ',
    underlying: 'MARUTI',
    yahooSymbol: 'MARUTI.NS',
  },
  {
    token: 1510401,
    symbol: 'AXISBANK',
    name: 'Axis Bank Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1369.0,
    sector: 'Banking',
    instrumentType: 'EQ',
    underlying: 'AXISBANK',
    yahooSymbol: 'AXISBANK.NS',
  },
  {
    token: 857857,
    symbol: 'SUNPHARMA',
    name: 'Sun Pharmaceutical Industries Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1870.0,
    sector: 'Pharma',
    instrumentType: 'EQ',
    underlying: 'SUNPHARMA',
    yahooSymbol: 'SUNPHARMA.NS',
  },
  {
    token: 81153,
    symbol: 'BAJFINANCE',
    name: 'Bajaj Finance Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1121.1,
    sector: 'NBFC',
    instrumentType: 'EQ',
    underlying: 'BAJFINANCE',
    yahooSymbol: 'BAJFINANCE.NS',
  },
  {
    token: 60417,
    symbol: 'ASIANPAINT',
    name: 'Asian Paints Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 2625.0,
    sector: 'Consumer',
    instrumentType: 'EQ',
    underlying: 'ASIANPAINT',
    yahooSymbol: 'ASIANPAINT.NS',
  },
  {
    token: 897537,
    symbol: 'TITAN',
    name: 'Titan Company Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 4908.0,
    sector: 'Consumer',
    instrumentType: 'EQ',
    underlying: 'TITAN',
    yahooSymbol: 'TITAN.NS',
  },
  {
    token: 492033,
    symbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 497.25,
    sector: 'Banking',
    instrumentType: 'EQ',
    underlying: 'KOTAKBANK',
    yahooSymbol: 'KOTAKBANK.NS',
  },
  {
    token: 1850625,
    symbol: 'HCLTECH',
    name: 'HCL Technologies Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1355.7,
    sector: 'IT',
    instrumentType: 'EQ',
    underlying: 'HCLTECH',
    yahooSymbol: 'HCLTECH.NS',
  },
  {
    token: 1304833,
    symbol: 'ETERNAL',
    name: 'Eternal Ltd. (Zomato)',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 375.05,
    sector: 'Internet',
    instrumentType: 'EQ',
    underlying: 'ETERNAL',
    yahooSymbol: 'ETERNAL.NS',
  },
  {
    token: 502785,
    symbol: 'TRENT',
    name: 'Trent Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 3176.3,
    sector: 'Retail',
    instrumentType: 'EQ',
    underlying: 'TRENT',
    yahooSymbol: 'TRENT.NS',
  },
  {
    token: 6401,
    symbol: 'ADANIENT',
    name: 'Adani Enterprises Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 2745.1,
    sector: 'Conglomerate',
    instrumentType: 'EQ',
    underlying: 'ADANIENT',
    yahooSymbol: 'ADANIENT.NS',
  },
  {
    token: 589569,
    symbol: 'HAL',
    name: 'Hindustan Aeronautics Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 4727.0,
    sector: 'Defence',
    instrumentType: 'EQ',
    underlying: 'HAL',
    yahooSymbol: 'HAL.NS',
  },
  {
    token: 98049,
    symbol: 'BEL',
    name: 'Bharat Electronics Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 399.55,
    sector: 'Defence',
    instrumentType: 'EQ',
    underlying: 'BEL',
    yahooSymbol: 'BEL.NS',
  },
  // BSE Cash Equities
  {
    token: 128028676,
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd. (BSE)',
    exchange: 'BSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1368.95,
    sector: 'Energy',
    instrumentType: 'EQ',
    underlying: 'RELIANCE',
    yahooSymbol: 'RELIANCE.BO',
  },
  {
    token: 136330244,
    symbol: 'TCS',
    name: 'Tata Consultancy Services Ltd. (BSE)',
    exchange: 'BSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 2411.0,
    sector: 'IT',
    instrumentType: 'EQ',
    underlying: 'TCS',
    yahooSymbol: 'TCS.BO',
  },
  {
    token: 128028678,
    symbol: 'INFY',
    name: 'Infosys Ltd. (BSE)',
    exchange: 'BSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1130.5,
    sector: 'IT',
    instrumentType: 'EQ',
    underlying: 'INFY',
    derivedFromToken: 408065,
    futuresBasisBps: 2,
  },
  {
    token: 128028679,
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd. (BSE)',
    exchange: 'BSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 815.1,
    sector: 'Banking',
    instrumentType: 'EQ',
    underlying: 'HDFCBANK',
    derivedFromToken: 341249,
    futuresBasisBps: 2,
  },
  {
    token: 128028680,
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd. (BSE)',
    exchange: 'BSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1599.0,
    sector: 'Banking',
    instrumentType: 'EQ',
    underlying: 'ICICIBANK',
    derivedFromToken: 1270529,
    futuresBasisBps: 2,
  },
  {
    token: 128028681,
    symbol: 'SBIN',
    name: 'State Bank of India (BSE)',
    exchange: 'BSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1108.8,
    sector: 'Banking',
    instrumentType: 'EQ',
    underlying: 'SBIN',
    derivedFromToken: 779521,
    futuresBasisBps: 2,
  },
  // Existing seeded NFO Futures (preserve exact token IDs)
  {
    token: 14893570,
    symbol: 'NIFTY NOV FUT',
    name: 'Nifty 50 November Futures',
    exchange: 'NFO',
    lotSize: 25,
    tickSize: 0.05,
    basePrice: 25450.85,
    sector: 'Derivatives',
    instrumentType: 'FUT',
    underlying: 'NIFTY',
    expiry: '26 NOV',
    daysToExpiry: 5,
    derivedFromToken: NIFTY_TOKEN,
    futuresBasisBps: 25,
  },
  {
    token: 14894082,
    symbol: 'BANKNIFTY NOV FUT',
    name: 'Bank Nifty November Futures',
    exchange: 'NFO',
    lotSize: 15,
    tickSize: 0.05,
    basePrice: 62428.95,
    sector: 'Derivatives',
    instrumentType: 'FUT',
    underlying: 'BANKNIFTY',
    expiry: '26 NOV',
    daysToExpiry: 5,
    derivedFromToken: BANKNIFTY_TOKEN,
    futuresBasisBps: 25,
  },
];

function buildDerivativeInstruments(): Instrument[] {
  const derivatives: Instrument[] = [];
  let nextToken = 50000001;

  // Additional Index Futures (Next & Far month + Sensex BFO Futures)
  const extraIndexFutures: Array<{
    symbol: string;
    name: string;
    exchange: Exchange;
    lotSize: number;
    underlying: string;
    expiry: string;
    daysToExpiry: number;
    derivedFromToken: number;
    baseSpot: number;
    futuresBasisBps: number;
  }> = [
    {
      symbol: 'NIFTY DEC FUT',
      name: 'Nifty 50 December Futures',
      exchange: 'NFO',
      lotSize: 25,
      underlying: 'NIFTY',
      expiry: '24 DEC',
      daysToExpiry: 33,
      derivedFromToken: NIFTY_TOKEN,
      baseSpot: 25387.4,
      futuresBasisBps: 55,
    },
    {
      symbol: 'NIFTY JAN FUT',
      name: 'Nifty 50 January Futures',
      exchange: 'NFO',
      lotSize: 25,
      underlying: 'NIFTY',
      expiry: '28 JAN',
      daysToExpiry: 68,
      derivedFromToken: NIFTY_TOKEN,
      baseSpot: 25387.4,
      futuresBasisBps: 85,
    },
    {
      symbol: 'BANKNIFTY DEC FUT',
      name: 'Bank Nifty December Futures',
      exchange: 'NFO',
      lotSize: 15,
      underlying: 'BANKNIFTY',
      expiry: '24 DEC',
      daysToExpiry: 33,
      derivedFromToken: BANKNIFTY_TOKEN,
      baseSpot: 62273.25,
      futuresBasisBps: 55,
    },
    {
      symbol: 'BANKNIFTY JAN FUT',
      name: 'Bank Nifty January Futures',
      exchange: 'NFO',
      lotSize: 15,
      underlying: 'BANKNIFTY',
      expiry: '28 JAN',
      daysToExpiry: 68,
      derivedFromToken: BANKNIFTY_TOKEN,
      baseSpot: 62273.25,
      futuresBasisBps: 85,
    },
    {
      symbol: 'SENSEX NOV FUT',
      name: 'BSE Sensex November Futures',
      exchange: 'BFO',
      lotSize: 10,
      underlying: 'SENSEX',
      expiry: '27 NOV',
      daysToExpiry: 6,
      derivedFromToken: SENSEX_TOKEN,
      baseSpot: 82696.8,
      futuresBasisBps: 25,
    },
    {
      symbol: 'SENSEX DEC FUT',
      name: 'BSE Sensex December Futures',
      exchange: 'BFO',
      lotSize: 10,
      underlying: 'SENSEX',
      expiry: '24 DEC',
      daysToExpiry: 33,
      derivedFromToken: SENSEX_TOKEN,
      baseSpot: 82696.8,
      futuresBasisBps: 55,
    },
  ];

  for (const f of extraIndexFutures) {
    derivatives.push({
      token: nextToken++,
      symbol: f.symbol,
      name: f.name,
      exchange: f.exchange,
      lotSize: f.lotSize,
      tickSize: 0.05,
      basePrice: Number((f.baseSpot * (1 + f.futuresBasisBps / 10000)).toFixed(2)),
      sector: 'Derivatives',
      instrumentType: 'FUT',
      underlying: f.underlying,
      expiry: f.expiry,
      daysToExpiry: f.daysToExpiry,
      derivedFromToken: f.derivedFromToken,
      futuresBasisBps: f.futuresBasisBps,
    });
  }

  // Index Options Chains (NIFTY, BANKNIFTY, SENSEX)
  const indexOptionConfigs: Array<{
    underlying: string;
    displayName: string;
    exchange: Exchange;
    lotSize: number;
    derivedFromToken: number;
    baseSpot: number;
    iv: number;
    strikeStart: number;
    strikeEnd: number;
    strikeStep: number;
    expiries: Array<{ label: string; dte: number }>;
  }> = [
    {
      underlying: 'NIFTY',
      displayName: 'Nifty 50',
      exchange: 'NFO',
      lotSize: 25,
      derivedFromToken: NIFTY_TOKEN,
      baseSpot: 25800,
      iv: 0.135,
      strikeStart: 24800,
      strikeEnd: 26600,
      strikeStep: 50,
      expiries: [
        { label: '26 NOV', dte: 5 },
        { label: '3 DEC', dte: 12 },
        { label: '24 DEC', dte: 33 },
      ],
    },
    {
      underlying: 'BANKNIFTY',
      displayName: 'Bank Nifty',
      exchange: 'NFO',
      lotSize: 15,
      derivedFromToken: BANKNIFTY_TOKEN,
      baseSpot: 62300,
      iv: 0.155,
      strikeStart: 60000,
      strikeEnd: 64500,
      strikeStep: 100,
      expiries: [
        { label: '26 NOV', dte: 5 },
        { label: '24 DEC', dte: 33 },
      ],
    },
    {
      underlying: 'SENSEX',
      displayName: 'BSE Sensex',
      exchange: 'BFO',
      lotSize: 10,
      derivedFromToken: SENSEX_TOKEN,
      baseSpot: 83900,
      iv: 0.13,
      strikeStart: 81000,
      strikeEnd: 85500,
      strikeStep: 100,
      expiries: [
        { label: '27 NOV', dte: 6 },
        { label: '24 DEC', dte: 33 },
      ],
    },
  ];

  for (const cfg of indexOptionConfigs) {
    for (const exp of cfg.expiries) {
      for (let strike = cfg.strikeStart; strike <= cfg.strikeEnd; strike += cfg.strikeStep) {
        for (const side of ['CE', 'PE'] as const) {
          const basePremium = priceOptionBlackScholes({
            spot: cfg.baseSpot,
            strike,
            daysToExpiry: exp.dte,
            iv: cfg.iv,
            optionType: side,
          });
          derivatives.push({
            token: nextToken++,
            symbol: `${cfg.underlying} ${exp.label} ${strike} ${side}`,
            name: `${cfg.displayName} ${exp.label} ${strike} ${side === 'CE' ? 'Call' : 'Put'}`,
            exchange: cfg.exchange,
            lotSize: cfg.lotSize,
            tickSize: 0.05,
            basePrice: basePremium,
            sector: 'Options',
            instrumentType: side,
            underlying: cfg.underlying,
            expiry: exp.label,
            strike,
            optionIv: cfg.iv,
            daysToExpiry: exp.dte,
            derivedFromToken: cfg.derivedFromToken,
          });
        }
      }
    }
  }

  // Stock Futures & Options Chains for liquid F&O equities
  const stockFnoConfigs: Array<{
    symbol: string;
    token: number;
    lotSize: number;
    strikeStep: number;
    iv: number;
  }> = [
    { symbol: 'RELIANCE', token: 738561, lotSize: 500, strikeStep: 20, iv: 0.22 },
    { symbol: 'TCS', token: 2953217, lotSize: 175, strikeStep: 50, iv: 0.21 },
    { symbol: 'INFY', token: 408065, lotSize: 400, strikeStep: 20, iv: 0.24 },
    { symbol: 'HDFCBANK', token: 341249, lotSize: 550, strikeStep: 10, iv: 0.19 },
    { symbol: 'ICICIBANK', token: 1270529, lotSize: 700, strikeStep: 20, iv: 0.2 },
    { symbol: 'SBIN', token: 779521, lotSize: 750, strikeStep: 10, iv: 0.25 },
    { symbol: 'BHARTIARTL', token: 2714625, lotSize: 475, strikeStep: 20, iv: 0.22 },
    { symbol: 'ITC', token: 424961, lotSize: 1600, strikeStep: 5, iv: 0.18 },
    { symbol: 'LT', token: 2939649, lotSize: 150, strikeStep: 50, iv: 0.23 },
    { symbol: 'WIPRO', token: 969473, lotSize: 1500, strikeStep: 5, iv: 0.25 },
    { symbol: 'MARUTI', token: 2815745, lotSize: 50, strikeStep: 200, iv: 0.22 },
    { symbol: 'AXISBANK', token: 1510401, lotSize: 625, strikeStep: 20, iv: 0.23 },
    { symbol: 'SUNPHARMA', token: 857857, lotSize: 350, strikeStep: 20, iv: 0.21 },
    { symbol: 'BAJFINANCE', token: 81153, lotSize: 125, strikeStep: 20, iv: 0.26 },
    { symbol: 'TITAN', token: 897537, lotSize: 175, strikeStep: 50, iv: 0.24 },
    { symbol: 'KOTAKBANK', token: 492033, lotSize: 400, strikeStep: 10, iv: 0.21 },
    { symbol: 'ADANIENT', token: 6401, lotSize: 300, strikeStep: 50, iv: 0.34 },
    { symbol: 'HAL', token: 589569, lotSize: 150, strikeStep: 50, iv: 0.3 },
  ];

  const baseByToken = new Map(BASE_INSTRUMENTS.map((i) => [i.token, i]));

  for (const sc of stockFnoConfigs) {
    const eq = baseByToken.get(sc.token);
    if (!eq) continue;

    // Near & Next month Stock Futures
    for (const futExp of [
      { code: 'NOV', name: 'November', expiry: '26 NOV', dte: 5, basisBps: 30 },
      { code: 'DEC', name: 'December', expiry: '24 DEC', dte: 33, basisBps: 65 },
    ]) {
      derivatives.push({
        token: nextToken++,
        symbol: `${sc.symbol} ${futExp.code} FUT`,
        name: `${eq.name} ${futExp.name} Futures`,
        exchange: 'NFO',
        lotSize: sc.lotSize,
        tickSize: 0.05,
        basePrice: Number((eq.basePrice * (1 + futExp.basisBps / 10000)).toFixed(2)),
        sector: 'Derivatives',
        instrumentType: 'FUT',
        underlying: sc.symbol,
        expiry: futExp.expiry,
        daysToExpiry: futExp.dte,
        derivedFromToken: sc.token,
        futuresBasisBps: futExp.basisBps,
      });
    }

    // 9 Option Strikes (4 below, ATM, 4 above) for Near-month NOV expiry
    const atmStrike = Math.round(eq.basePrice / sc.strikeStep) * sc.strikeStep;
    for (let offset = -4; offset <= 4; offset++) {
      const strike = atmStrike + offset * sc.strikeStep;
      if (strike <= 0) continue;
      for (const side of ['CE', 'PE'] as const) {
        const basePremium = priceOptionBlackScholes({
          spot: eq.basePrice,
          strike,
          daysToExpiry: 5,
          iv: sc.iv,
          optionType: side,
        });
        derivatives.push({
          token: nextToken++,
          symbol: `${sc.symbol} NOV ${strike} ${side}`,
          name: `${eq.name} NOV ${strike} ${side === 'CE' ? 'Call' : 'Put'}`,
          exchange: 'NFO',
          lotSize: sc.lotSize,
          tickSize: 0.05,
          basePrice: basePremium,
          sector: 'Options',
          instrumentType: side,
          underlying: sc.symbol,
          expiry: '26 NOV',
          strike,
          optionIv: sc.iv,
          daysToExpiry: 5,
          derivedFromToken: sc.token,
        });
      }
    }
  }

  return derivatives;
}

export const INSTRUMENTS: Instrument[] = [
  ...BASE_INSTRUMENTS,
  ...buildDerivativeInstruments(),
];

export const INSTRUMENT_MAP = new Map<number, Instrument>(
  INSTRUMENTS.map((inst) => [inst.token, inst]),
);

export const DEFAULT_WATCHLISTS: Record<string, number[]> = {
  '1': [738561, 2953217, 408065, 341249, 1270529, 779521, 2714625, 424961],
  '2': [341249, 1270529, 779521, 1510401, 492033, 81153],
  '3': [2953217, 408065, 969473, 1850625, 1304833],
  '4': [884737, 2815745, 589569, 98049, 2939649],
  '5': [14893570, 14894082, 256265, 260105],
  '6': [128028676, 136330244, 502785, 897537, 60417],
  '7': [857857, 6401, 1304833],
};
