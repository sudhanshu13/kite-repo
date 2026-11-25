import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveOptionSnapshotFromSpot,
  priceOptionBlackScholes,
  searchInstruments,
  tokenizeSearchQuery,
} from './derivatives.ts';
import type { Instrument } from './types.ts';

const SAMPLE_INSTRUMENTS: Instrument[] = [
  {
    token: 256265,
    symbol: 'NIFTY 50',
    name: 'NSE Nifty 50 Index',
    exchange: 'INDICES',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 25800,
    sector: 'Index',
    isIndex: true,
    instrumentType: 'INDEX',
    underlying: 'NIFTY',
  },
  {
    token: 14893570,
    symbol: 'NIFTY NOV FUT',
    name: 'Nifty 50 November Futures',
    exchange: 'NFO',
    lotSize: 25,
    tickSize: 0.05,
    basePrice: 25864.5,
    sector: 'Derivatives',
    instrumentType: 'FUT',
    underlying: 'NIFTY',
    expiry: '26 NOV',
    daysToExpiry: 5,
    derivedFromToken: 256265,
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
    derivedFromToken: 260105,
    futuresBasisBps: 25,
  },
  {
    token: 500001,
    symbol: 'NIFTY 26 NOV 25800 CE',
    name: 'Nifty 50 26 NOV 25800 Call',
    exchange: 'NFO',
    lotSize: 25,
    tickSize: 0.05,
    basePrice: 185,
    sector: 'Options',
    instrumentType: 'CE',
    underlying: 'NIFTY',
    expiry: '26 NOV',
    strike: 25800,
    optionIv: 0.135,
    daysToExpiry: 5,
    derivedFromToken: 256265,
  },
  {
    token: 500002,
    symbol: 'NIFTY 26 NOV 25800 PE',
    name: 'Nifty 50 26 NOV 25800 Put',
    exchange: 'NFO',
    lotSize: 25,
    tickSize: 0.05,
    basePrice: 165,
    sector: 'Options',
    instrumentType: 'PE',
    underlying: 'NIFTY',
    expiry: '26 NOV',
    strike: 25800,
    optionIv: 0.135,
    daysToExpiry: 5,
    derivedFromToken: 256265,
  },
  {
    token: 408065,
    symbol: 'INFY',
    name: 'Infosys Ltd.',
    exchange: 'NSE',
    lotSize: 1,
    tickSize: 0.05,
    basePrice: 1130,
    sector: 'IT',
    instrumentType: 'EQ',
    underlying: 'INFY',
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
  },
];

test('tokenizeSearchQuery splits compact and multi-word derivative queries cleanly', () => {
  assert.deepEqual(tokenizeSearchQuery('nifty fut'), ['nifty', 'fut']);
  assert.deepEqual(tokenizeSearchQuery('nifty 25800ce'), ['nifty', '25800', 'ce']);
  assert.deepEqual(tokenizeSearchQuery('nifty25800pe'), ['nifty', '25800', 'pe']);
  assert.deepEqual(tokenizeSearchQuery('bank nifty 62000 call'), ['banknifty', '62000', 'ce']);
  assert.deepEqual(tokenizeSearchQuery('NIFTYFUT'), ['nifty', 'fut']);
});

test('priceOptionBlackScholes prices ITM/ATM/OTM calls and puts accurately', () => {
  const atmCall = priceOptionBlackScholes({
    spot: 25800,
    strike: 25800,
    daysToExpiry: 7,
    iv: 0.14,
    optionType: 'CE',
  });
  const itmCall = priceOptionBlackScholes({
    spot: 25800,
    strike: 25500,
    daysToExpiry: 7,
    iv: 0.14,
    optionType: 'CE',
  });
  const otmCall = priceOptionBlackScholes({
    spot: 25800,
    strike: 26200,
    daysToExpiry: 7,
    iv: 0.14,
    optionType: 'CE',
  });
  const atmPut = priceOptionBlackScholes({
    spot: 25800,
    strike: 25800,
    daysToExpiry: 7,
    iv: 0.14,
    optionType: 'PE',
  });

  assert.ok(itmCall > atmCall, 'ITM call must be more expensive than ATM call');
  assert.ok(atmCall > otmCall, 'ATM call must be more expensive than OTM call');
  assert.ok(itmCall > 300, 'ITM call must exceed intrinsic value (300)');
  assert.ok(atmPut > 100 && atmPut < 400, 'ATM put should have realistic premium');
});

test('deriveOptionSnapshotFromSpot responds positively for CE and negatively for PE on spot rally', () => {
  const spotSnapshot = {
    token: 256265,
    ltp: 25950,
    open: 25800,
    high: 25980,
    low: 25780,
    prevClose: 25750,
    change: 200,
    changePercent: 0.78,
    volume: 0,
    averagePrice: 25880,
    week52High: 26300,
    week52Low: 22100,
    timestamp: Date.now(),
    isMarketOpen: true,
    historyCloses: [25750, 25820, 25900, 25950],
  };

  const ceSnap = deriveOptionSnapshotFromSpot(SAMPLE_INSTRUMENTS[3], spotSnapshot);
  const peSnap = deriveOptionSnapshotFromSpot(SAMPLE_INSTRUMENTS[4], spotSnapshot);

  assert.ok(ceSnap.change > 0, 'CE option should gain when spot rallies +200');
  assert.ok(peSnap.change < 0, 'PE option should lose when spot rallies +200');
  assert.ok(ceSnap.ltp > peSnap.ltp, '25800 CE should be pricier than 25800 PE at 25950 spot');
  assert.ok(ceSnap.volume > 0);
});

test('searchInstruments matches multi-token futures, option strikes, and exchange filters', () => {
  const niftyFut = searchInstruments(
    [
      ...SAMPLE_INSTRUMENTS,
      {
        token: 500099,
        symbol: 'HDFCBANK NOV FUT',
        name: 'HDFC Bank Ltd. November Futures',
        exchange: 'NFO',
        lotSize: 550,
        tickSize: 0.05,
        basePrice: 848.5,
        sector: 'Derivatives',
        instrumentType: 'FUT',
        underlying: 'HDFCBANK',
        expiry: '26 NOV',
        daysToExpiry: 5,
      },
    ],
    'nifty fut',
  );
  assert.equal(niftyFut[0]?.symbol, 'NIFTY NOV FUT');
  assert.equal(
    niftyFut.some((i) => i.symbol === 'HDFCBANK NOV FUT'),
    false,
    'Bank stock futures must not match nifty fut query',
  );

  const strikeBoth = searchInstruments(SAMPLE_INSTRUMENTS, 'nifty 25800');
  assert.equal(strikeBoth.length, 2);
  assert.equal(strikeBoth[0]?.symbol, 'NIFTY 26 NOV 25800 CE');
  assert.equal(strikeBoth[1]?.symbol, 'NIFTY 26 NOV 25800 PE');

  const strikeCeCompact = searchInstruments(SAMPLE_INSTRUMENTS, 'nifty 25800ce');
  assert.equal(strikeCeCompact.length, 1);
  assert.equal(strikeCeCompact[0]?.symbol, 'NIFTY 26 NOV 25800 CE');

  const infyBse = searchInstruments(SAMPLE_INSTRUMENTS, 'infy bse');
  assert.equal(infyBse.length, 1);
  assert.equal(infyBse[0]?.exchange, 'BSE');

  const optsOnly = searchInstruments(SAMPLE_INSTRUMENTS, 'nifty', { category: 'opt' });
  assert.equal(optsOnly.length, 2);
  assert.ok(optsOnly.every((i) => i.instrumentType === 'CE' || i.instrumentType === 'PE'));
});

test('searchInstruments matches india cement with plurals, 1-edit typos (idia cement), and secondary related matches', () => {
  const indianCatalog: Instrument[] = [
    ...SAMPLE_INSTRUMENTS,
    {
      token: 71000001,
      symbol: 'INDIACEM',
      name: 'The India Cements Limited',
      exchange: 'NSE',
      lotSize: 1,
      tickSize: 0.05,
      basePrice: 365,
      sector: 'Cement',
      instrumentType: 'EQ',
      underlying: 'INDIACEM',
    },
    {
      token: 71000002,
      symbol: 'INDIACEM',
      name: 'The India Cements Limited (BSE)',
      exchange: 'BSE',
      lotSize: 1,
      tickSize: 0.05,
      basePrice: 365.2,
      sector: 'Cement',
      instrumentType: 'EQ',
      underlying: 'INDIACEM',
    },
    {
      token: 71000003,
      symbol: 'INDCEMCAP',
      name: 'India Cements Capital Limited (BSE)',
      exchange: 'BSE',
      lotSize: 1,
      tickSize: 0.05,
      basePrice: 22.4,
      sector: 'Financial Services',
      instrumentType: 'EQ',
      underlying: 'INDCEMCAP',
    },
    {
      token: 71000004,
      symbol: 'INDIAGLYCO',
      name: 'India Glycols Limited',
      exchange: 'NSE',
      lotSize: 1,
      tickSize: 0.05,
      basePrice: 1210,
      sector: 'Chemicals',
      instrumentType: 'EQ',
      underlying: 'INDIAGLYCO',
    },
    {
      token: 71000005,
      symbol: 'INDIAMART',
      name: 'Indiamart Intermesh Limited',
      exchange: 'NSE',
      lotSize: 1,
      tickSize: 0.05,
      basePrice: 2340,
      sector: 'Internet',
      instrumentType: 'EQ',
      underlying: 'INDIAMART',
    },
  ];

  // Exact multi-word query: INDIACEM NSE, INDIACEM BSE, INDCEMCAP first, then related INDIA* stocks
  const exactRes = searchInstruments(indianCatalog, 'india cement');
  assert.equal(exactRes[0]?.symbol, 'INDIACEM');
  assert.equal(exactRes[0]?.exchange, 'NSE');
  assert.equal(exactRes[1]?.symbol, 'INDIACEM');
  assert.equal(exactRes[1]?.exchange, 'BSE');
  assert.equal(exactRes[2]?.symbol, 'INDCEMCAP');
  assert.ok(exactRes.some((i) => i.symbol === 'INDIAGLYCO'));
  assert.ok(exactRes.some((i) => i.symbol === 'INDIAMART'));

  // Plural query: "india cements"
  const pluralRes = searchInstruments(indianCatalog, 'india cements');
  assert.equal(pluralRes[0]?.symbol, 'INDIACEM');

  // 1-character typo query: "idia cement"
  const typoRes = searchInstruments(indianCatalog, 'idia cement');
  assert.equal(typoRes[0]?.symbol, 'INDIACEM');
  assert.equal(typoRes[0]?.exchange, 'NSE');
});

