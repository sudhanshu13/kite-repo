import fs from 'node:fs';
import path from 'node:path';
import { priceOptionBlackScholes } from '../shared/derivatives.ts';
import { hashDynamicInstrumentToken } from '../shared/liveQuoteParser.ts';
import { parseNseEquityCsv, parseNseEtfCsv } from '../shared/nseMasterParser.ts';
import type { Exchange, Instrument } from '../shared/types.ts';

export const NIFTY_TOKEN = 256265;
export const SENSEX_TOKEN = 265;
export const BANKNIFTY_TOKEN = 260105;

const CUSTOM_INSTRUMENTS_FILE = path.resolve(
  process.cwd(),
  '.data',
  'custom-instruments.json',
);

const NSE_MASTER_CACHE_FILE = path.resolve(
  process.cwd(),
  '.data',
  'nse-master-cache.json',
);
const NSE_MASTER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

// Core priority tokens fetched eagerly on startup for instant live prices
export const CORE_LIVE_SYNC_TOKENS = new Set<number>(
  BASE_INSTRUMENTS.filter((i) => Boolean(i.yahooSymbol)).map((i) => i.token),
);

// Extended Nifty 50, Nifty Next 50, Midcap, PSU, New-Age Tech, Defence, Railway & Popular ETFs
const EXTENDED_EQUITY_SEEDS: Array<
  [symbol: string, name: string, sector: string, basePrice: number, exchange?: 'NSE' | 'BSE']
> = [
  // Remaining Nifty 50 Constituents
  ['HINDUNILVR', 'Hindustan Unilever Ltd.', 'FMCG', 2384.5],
  ['M&M', 'Mahindra & Mahindra Ltd.', 'Auto', 3128.4],
  ['NTPC', 'NTPC Ltd.', 'Power', 368.4],
  ['ULTRACEMCO', 'UltraTech Cement Ltd.', 'Cement', 11680.5],
  ['INDIACEM', 'The India Cements Limited', 'Cement', 368.0],
  ['ONGC', 'Oil & Natural Gas Corporation Ltd.', 'Energy', 264.15],
  ['ADANIPORTS', 'Adani Ports and Special Economic Zone Ltd.', 'Infrastructure', 1345.9],
  ['POWERGRID', 'Power Grid Corporation of India Ltd.', 'Power', 314.25],
  ['BAJAJFINSV', 'Bajaj Finserv Ltd.', 'NBFC', 1794.0],
  ['BAJAJ-AUTO', 'Bajaj Auto Ltd.', 'Auto', 9180.0],
  ['COALINDIA', 'Coal India Ltd.', 'Mining', 418.75],
  ['TATAMOTORS', 'Tata Motors Ltd.', 'Auto', 794.6],
  ['JSWSTEEL', 'JSW Steel Ltd.', 'Metals', 982.4],
  ['TATASTEEL', 'Tata Steel Ltd.', 'Metals', 148.35],
  ['TECHM', 'Tech Mahindra Ltd.', 'IT', 1648.9],
  ['GRASIM', 'Grasim Industries Ltd.', 'Cement', 2564.4],
  ['CIPLA', 'Cipla Ltd.', 'Pharma', 1518.6],
  ['EICHERMOT', 'Eicher Motors Ltd.', 'Auto', 4924.2],
  ['DRREDDY', "Dr. Reddy's Laboratories Ltd.", 'Pharma', 1248.5],
  ['BPCL', 'Bharat Petroleum Corporation Ltd.', 'Energy', 292.4],
  ['INDUSINDBK', 'IndusInd Bank Ltd.', 'Banking', 968.2],
  ['NESTLEIND', 'Nestle India Ltd.', 'FMCG', 2245.0],
  ['APOLLOHOSP', 'Apollo Hospitals Enterprise Ltd.', 'Healthcare', 6940.0],
  ['DIVISLAB', "Divi's Laboratories Ltd.", 'Pharma', 5890.0],
  ['HEROMOTOCO', 'Hero MotoCorp Ltd.', 'Auto', 4620.0],
  ['HINDALCO', 'Hindalco Industries Ltd.', 'Metals', 654.0],
  ['BRITANNIA', 'Britannia Industries Ltd.', 'FMCG', 4980.0],
  ['SBILIFE', 'SBI Life Insurance Company Ltd.', 'Insurance', 1545.0],
  ['HDFCLIFE', 'HDFC Life Insurance Company Ltd.', 'Insurance', 662.0],
  ['SHRIRAMFIN', 'Shriram Finance Ltd.', 'NBFC', 612.0],
  ['TATACONSUM', 'Tata Consumer Products Ltd.', 'FMCG', 984.0],
  ['JIOFIN', 'Jio Financial Services Ltd.', 'NBFC', 312.6],
  // Nifty Next 50 & Large Cap
  ['LICI', 'Life Insurance Corporation of India', 'Insurance', 895.0],
  ['DMART', 'Avenue Supermarts Ltd.', 'Retail', 3895.0],
  ['DLF', 'DLF Ltd.', 'Real Estate', 786.2],
  ['SIEMENS', 'Siemens Ltd.', 'Capital Goods', 5420.0],
  ['ABB', 'ABB India Ltd.', 'Capital Goods', 6890.0],
  ['INDIGO', 'InterGlobe Aviation Ltd.', 'Aviation', 4612.8],
  ['VBL', 'Varun Beverages Ltd.', 'FMCG', 542.15],
  ['PIDILITIND', 'Pidilite Industries Ltd.', 'Chemicals', 2986.0],
  ['TVSMOTOR', 'TVS Motor Company Ltd.', 'Auto', 2685.0],
  ['TATAPOWER', 'Tata Power Company Ltd.', 'Power', 412.5],
  ['ADANIGREEN', 'Adani Green Energy Ltd.', 'Power', 1085.0],
  ['ADANIPOWER', 'Adani Power Ltd.', 'Power', 548.0],
  ['ATGL', 'Adani Total Gas Ltd.', 'Energy', 675.0],
  ['IOC', 'Indian Oil Corporation Ltd.', 'Energy', 138.5],
  ['GAIL', 'GAIL (India) Ltd.', 'Energy', 194.2],
  ['VEDL', 'Vedanta Ltd.', 'Metals', 452.0],
  ['SAIL', 'Steel Authority of India Ltd.', 'Metals', 118.4],
  ['NMDC', 'NMDC Ltd.', 'Mining', 72.5],
  ['PNB', 'Punjab National Bank', 'Banking', 104.2],
  ['BANKBARODA', 'Bank of Baroda', 'Banking', 241.5],
  ['CANBK', 'Canara Bank', 'Banking', 102.8],
  ['UNIONBANK', 'Union Bank of India', 'Banking', 118.6],
  ['IDFCFIRSTB', 'IDFC First Bank Ltd.', 'Banking', 64.5],
  ['YESBANK', 'Yes Bank Ltd.', 'Banking', 20.15],
  ['FEDERALBNK', 'Federal Bank Ltd.', 'Banking', 198.4],
  ['AUBANK', 'AU Small Finance Bank Ltd.', 'Banking', 596.0],
  ['BANDHANBNK', 'Bandhan Bank Ltd.', 'Banking', 164.2],
  ['RBLBANK', 'RBL Bank Ltd.', 'Banking', 168.5],
  ['CHOLAFIN', 'Cholamandalam Investment & Finance Co.', 'NBFC', 1345.0],
  ['MUTHOOTFIN', 'Muthoot Finance Ltd.', 'NBFC', 2140.0],
  ['LICHSGFIN', 'LIC Housing Finance Ltd.', 'NBFC', 612.0],
  ['MANAPPURAM', 'Manappuram Finance Ltd.', 'NBFC', 184.5],
  ['BAJAJHFL', 'Bajaj Housing Finance Ltd.', 'NBFC', 128.4],
  ['PFC', 'Power Finance Corporation Ltd.', 'NBFC', 448.0],
  ['RECLTD', 'REC Ltd.', 'NBFC', 492.0],
  ['IREDA', 'Indian Renewable Energy Development Agency', 'NBFC', 204.5],
  ['HUDCO', 'Housing & Urban Development Corp. Ltd.', 'NBFC', 234.0],
  // Defence, Railways, PSU & Energy
  ['MAZDOCK', 'Mazagon Dock Shipbuilders Ltd.', 'Defence', 2340.0],
  ['COCHINSHIP', 'Cochin Shipyard Ltd.', 'Defence', 1540.0],
  ['BDL', 'Bharat Dynamics Ltd.', 'Defence', 1245.0],
  ['SOLARINDS', 'Solar Industries India Ltd.', 'Defence', 10450.0],
  ['IRCTC', 'Indian Railway Catering & Tourism Corp.', 'Railways', 815.0],
  ['IRFC', 'Indian Railway Finance Corporation Ltd.', 'Railways', 148.6],
  ['RVNL', 'Rail Vikas Nigam Ltd.', 'Railways', 432.0],
  ['BHEL', 'Bharat Heavy Electricals Ltd.', 'Capital Goods', 234.5],
  ['NBCC', 'NBCC (India) Ltd.', 'Infrastructure', 98.4],
  ['NCC', 'NCC Ltd.', 'Infrastructure', 276.0],
  ['NHPC', 'NHPC Ltd.', 'Power', 84.6],
  ['SJVN', 'SJVN Ltd.', 'Power', 112.4],
  ['SUZLON', 'Suzlon Energy Ltd.', 'Power', 62.8],
  ['TORNTPOWER', 'Torrent Power Ltd.', 'Power', 1520.0],
  ['CGPOWER', 'CG Power and Industrial Solutions Ltd.', 'Capital Goods', 715.0],
  ['CUMMINSIND', 'Cummins India Ltd.', 'Capital Goods', 3240.0],
  ['CONCOR', 'Container Corporation of India Ltd.', 'Logistics', 792.0],
  ['GMRINFRA', 'GMR Airports Ltd.', 'Infrastructure', 82.4],
  // IT, Internet & New-Age Tech
  ['LTIM', 'LTIMindtree Ltd.', 'IT', 5840.0],
  ['PERSISTENT', 'Persistent Systems Ltd.', 'IT', 5620.0],
  ['COFORGE', 'Coforge Ltd.', 'IT', 8120.0],
  ['MPHASIS', 'Mphasis Ltd.', 'IT', 2890.0],
  ['KPITTECH', 'KPIT Technologies Ltd.', 'IT', 1410.0],
  ['TATAELXSI', 'Tata Elxsi Ltd.', 'IT', 6940.0],
  ['TATATECH', 'Tata Technologies Ltd.', 'IT', 912.0],
  ['OFSS', 'Oracle Financial Services Software Ltd.', 'IT', 11240.0],
  ['NAUKRI', 'Info Edge (India) Ltd.', 'Internet', 7820.0],
  ['PAYTM', 'One 97 Communications Ltd. (Paytm)', 'Internet', 892.0],
  ['NYKAA', 'FSN E-Commerce Ventures Ltd. (Nykaa)', 'Internet', 174.5],
  ['POLICYBZR', 'PB Fintech Ltd. (Policybazaar)', 'Internet', 1865.0],
  ['DELHIVERY', 'Delhivery Ltd.', 'Logistics', 348.0],
  ['SWIGGY', 'Swiggy Ltd.', 'Internet', 462.0],
  ['OLAELEC', 'Ola Electric Mobility Ltd.', 'Auto', 88.5],
  ['FIRSTCRY', 'Brainbees Solutions Ltd. (FirstCry)', 'Retail', 568.0],
  ['HYUNDAI', 'Hyundai Motor India Ltd.', 'Auto', 1845.0],
  ['WAAREEENER', 'Waaree Energies Ltd.', 'Power', 2740.0],
  ['IDEA', 'Vodafone Idea Ltd.', 'Telecom', 8.15],
  ['TATACOMM', 'Tata Communications Ltd.', 'Telecom', 1745.0],
  ['HFCL', 'HFCL Ltd.', 'Telecom', 124.0],
  // Capital Markets, EMS & Consumer Durables
  ['BSE', 'BSE Ltd.', 'Capital Markets', 4680.0],
  ['CDSL', 'Central Depository Services (India) Ltd.', 'Capital Markets', 1620.0],
  ['MCX', 'Multi Commodity Exchange of India Ltd.', 'Capital Markets', 6240.0],
  ['ANGELONE', 'Angel One Ltd.', 'Capital Markets', 2840.0],
  ['CAMS', 'Computer Age Management Services Ltd.', 'Capital Markets', 4520.0],
  ['KFINTECH', 'KFin Technologies Ltd.', 'Capital Markets', 1120.0],
  ['IEX', 'Indian Energy Exchange Ltd.', 'Capital Markets', 178.5],
  ['DIXON', 'Dixon Technologies (India) Ltd.', 'Electronics', 15840.0],
  ['KAYNES', 'Kaynes Technology India Ltd.', 'Electronics', 5920.0],
  ['HAVELLS', 'Havells India Ltd.', 'Consumer Durables', 1685.0],
  ['POLYCAB', 'Polycab India Ltd.', 'Consumer Durables', 6740.0],
  ['VOLTAS', 'Voltas Ltd.', 'Consumer Durables', 1720.0],
  // Auto & Ancillaries
  ['ASHOKLEY', 'Ashok Leyland Ltd.', 'Auto', 224.0],
  ['BHARATFORG', 'Bharat Forge Ltd.', 'Auto', 1320.0],
  ['MOTHERSON', 'Samvardhana Motherson International Ltd.', 'Auto', 162.5],
  ['EXIDEIND', 'Exide Industries Ltd.', 'Auto', 438.0],
  ['MRF', 'MRF Ltd.', 'Auto', 124500.0],
  ['BOSCHLTD', 'Bosch Ltd.', 'Auto', 34200.0],
  // Pharma & Healthcare
  ['LUPIN', 'Lupin Ltd.', 'Pharma', 2085.0],
  ['AUROPHARMA', 'Aurobindo Pharma Ltd.', 'Pharma', 1265.0],
  ['ZYDUSLIFE', 'Zydus Lifesciences Ltd.', 'Pharma', 985.0],
  ['TORNTPHARM', 'Torrent Pharmaceuticals Ltd.', 'Pharma', 3280.0],
  ['BIOCON', 'Biocon Ltd.', 'Pharma', 342.0],
  ['MAXHEALTH', 'Max Healthcare Institute Ltd.', 'Healthcare', 1065.0],
  ['FORTIS', 'Fortis Healthcare Ltd.', 'Healthcare', 684.0],
  ['MANKIND', 'Mankind Pharma Ltd.', 'Pharma', 2590.0],
  ['ALKEM', 'Alkem Laboratories Ltd.', 'Pharma', 5540.0],
  ['LAURUSLABS', 'Laurus Labs Ltd.', 'Pharma', 548.0],
  // FMCG, Real Estate, Cement & Chemicals
  ['DABUR', 'Dabur India Ltd.', 'FMCG', 524.0],
  ['MARICO', 'Marico Ltd.', 'FMCG', 632.0],
  ['GODREJCP', 'Godrej Consumer Products Ltd.', 'FMCG', 1185.0],
  ['COLPAL', 'Colgate-Palmolive (India) Ltd.', 'FMCG', 2890.0],
  ['UNITDSPR', 'United Spirits Ltd.', 'FMCG', 1485.0],
  ['UBL', 'United Breweries Ltd.', 'FMCG', 1965.0],
  ['JUBLFOOD', 'Jubilant FoodWorks Ltd.', 'Consumer', 648.0],
  ['PAGEIND', 'Page Industries Ltd.', 'Retail', 45200.0],
  ['INDHOTEL', 'Indian Hotels Company Ltd.', 'Hospitality', 792.0],
  ['OBEROIRLTY', 'Oberoi Realty Ltd.', 'Real Estate', 1985.0],
  ['GODREJPROP', 'Godrej Properties Ltd.', 'Real Estate', 2740.0],
  ['PRESTIGE', 'Prestige Estates Projects Ltd.', 'Real Estate', 1645.0],
  ['LODHA', 'Macrotech Developers Ltd. (Lodha)', 'Real Estate', 1320.0],
  ['ACC', 'ACC Ltd.', 'Cement', 2180.0],
  ['AMBUJACEM', 'Ambuja Cements Ltd.', 'Cement', 542.0],
  ['SHREECEM', 'Shree Cement Ltd.', 'Cement', 25800.0],
  ['SRF', 'SRF Ltd.', 'Chemicals', 2340.0],
  ['PIIND', 'PI Industries Ltd.', 'Chemicals', 4120.0],
  ['UPL', 'UPL Ltd.', 'Chemicals', 548.0],
  ['DEEPAKNTR', 'Deepak Nitrite Ltd.', 'Chemicals', 2680.0],
  ['TATACHEM', 'Tata Chemicals Ltd.', 'Chemicals', 1065.0],
  ['ASTRAL', 'Astral Ltd.', 'Building Materials', 1785.0],
  ['SUPREMEIND', 'Supreme Industries Ltd.', 'Building Materials', 4620.0],
  ['BERGEPAINT', 'Berger Paints India Ltd.', 'Consumer', 498.0],
  ['RPOWER', 'Reliance Power Ltd.', 'Power', 42.5],
  ['JPPOWER', 'Jaiprakash Power Ventures Ltd.', 'Power', 18.4],
  ['TRIDENT', 'Trident Ltd.', 'Textiles', 34.2],
  ['ANTGRAPHIC', 'Antarctica Ltd. (BSE)', 'Packaging', 0.72, 'BSE'],
  // Popular Indian Index & Commodity ETFs
  ['NIFTYBEES', 'Nippon India ETF Nifty 50 BeES', 'ETF', 278.5],
  ['BANKBEES', 'Nippon India ETF Nifty Bank BeES', 'ETF', 542.0],
  ['GOLDBEES', 'Nippon India ETF Gold BeES', 'ETF', 66.4],
  ['SILVERBEES', 'Nippon India Silver ETF', 'ETF', 88.2],
  ['LIQUIDBEES', 'Nippon India ETF Liquid BeES', 'ETF', 1000.0],
  ['JUNIORBEES', 'Nippon India ETF Nifty Next 50 Junior BeES', 'ETF', 745.0],
  ['ITBEES', 'Nippon India ETF Nifty IT', 'ETF', 44.8],
];

function buildExtendedEquities(): Instrument[] {
  const existingKeys = new Set(
    BASE_INSTRUMENTS.map((i) => `${i.exchange}:${i.symbol.toUpperCase()}`),
  );
  const items: Instrument[] = [];

  for (const [symbol, name, sector, basePrice, exchangeOpt] of EXTENDED_EQUITY_SEEDS) {
    const exchange: 'NSE' | 'BSE' = exchangeOpt ?? 'NSE';
    const key = `${exchange}:${symbol.toUpperCase()}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    items.push({
      token: hashDynamicInstrumentToken(exchange, symbol),
      symbol,
      name,
      exchange,
      lotSize: 1,
      tickSize: 0.05,
      basePrice,
      sector,
      instrumentType: 'EQ',
      underlying: symbol,
      yahooSymbol: `${symbol}.${exchange === 'NSE' ? 'NS' : 'BO'}`,
    });
  }

  return items;
}

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

function loadPersistedDynamicInstruments(): Instrument[] {
  try {
    if (!fs.existsSync(CUSTOM_INSTRUMENTS_FILE)) return [];
    const raw = fs.readFileSync(CUSTOM_INSTRUMENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Instrument[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface NseMasterCachePayload {
  updatedAt: number;
  instruments: Instrument[];
}

function loadCachedNseMaster(): NseMasterCachePayload | null {
  try {
    if (!fs.existsSync(NSE_MASTER_CACHE_FILE)) return null;
    const raw = fs.readFileSync(NSE_MASTER_CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as NseMasterCachePayload;
    if (
      parsed &&
      typeof parsed.updatedAt === 'number' &&
      Array.isArray(parsed.instruments)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export const INSTRUMENTS: Instrument[] = [
  ...BASE_INSTRUMENTS,
  ...buildExtendedEquities(),
  ...buildDerivativeInstruments(),
];

export const INSTRUMENT_MAP = new Map<number, Instrument>(
  INSTRUMENTS.map((inst) => [inst.token, inst]),
);

const SYMBOL_EXCHANGE_INDEX = new Map<string, Instrument>(
  INSTRUMENTS.map((inst) => [`${inst.exchange}:${inst.symbol.toUpperCase()}`, inst]),
);

const persistedDynamic: Instrument[] = [];

// Hydrate any previously discovered dynamic NSE/BSE stocks on startup
for (const saved of loadPersistedDynamicInstruments()) {
  const key = `${saved.exchange}:${saved.symbol.toUpperCase()}`;
  if (!INSTRUMENT_MAP.has(saved.token) && !SYMBOL_EXCHANGE_INDEX.has(key)) {
    INSTRUMENTS.push(saved);
    INSTRUMENT_MAP.set(saved.token, saved);
    SYMBOL_EXCHANGE_INDEX.set(key, saved);
    persistedDynamic.push(saved);
  }
}

export function registerMasterInstruments(items: Instrument[]): number {
  let added = 0;
  for (const inst of items) {
    const key = `${inst.exchange}:${inst.symbol.toUpperCase()}`;
    if (SYMBOL_EXCHANGE_INDEX.has(key) || INSTRUMENT_MAP.has(inst.token)) {
      continue;
    }
    INSTRUMENTS.push(inst);
    INSTRUMENT_MAP.set(inst.token, inst);
    SYMBOL_EXCHANGE_INDEX.set(key, inst);
    added++;
  }
  return added;
}

// Hydrate cached official NSE Equity + ETF master list synchronously if available
const initialNseCache = loadCachedNseMaster();
if (initialNseCache && initialNseCache.instruments.length > 0) {
  registerMasterInstruments(initialNseCache.instruments);
}

async function fetchCsvWithFallback(
  urls: string[],
  timeoutMs: number,
): Promise<string | null> {
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/csv,text/plain,*/*',
        },
      });
      if (res.ok) {
        const text = await res.text();
        if (text.length > 500) return text;
      }
    } catch {
      // Try next mirror
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Fetches the official full NSE Equity list (EQUITY_L.csv, ~2,630+ stocks) and
 * NSE ETF list (eq_etfseclist.csv, ~360+ ETFs), merges them into the instrument catalog,
 * and persists a 24-hour disk cache for instant restarts.
 */
export async function syncNseInstrumentMaster(timeoutMs = 4500): Promise<number> {
  const existingCache = loadCachedNseMaster();
  if (
    existingCache &&
    existingCache.instruments.length >= 1500 &&
    Date.now() - existingCache.updatedAt < NSE_MASTER_CACHE_TTL_MS
  ) {
    return registerMasterInstruments(existingCache.instruments);
  }

  const [eqCsv, etfCsv] = await Promise.all([
    fetchCsvWithFallback(
      [
        'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv',
        'https://archives.nseindia.com/content/equities/EQUITY_L.csv',
      ],
      timeoutMs,
    ),
    fetchCsvWithFallback(
      [
        'https://nsearchives.nseindia.com/content/equities/eq_etfseclist.csv',
        'https://archives.nseindia.com/content/equities/eq_etfseclist.csv',
      ],
      timeoutMs,
    ),
  ]);

  const parsedEquities = eqCsv ? parseNseEquityCsv(eqCsv) : [];
  const parsedEtfs = etfCsv ? parseNseEtfCsv(etfCsv) : [];
  const combined = [...parsedEquities, ...parsedEtfs];

  if (combined.length === 0) return 0;

  const added = registerMasterInstruments(combined);

  try {
    const dir = path.dirname(NSE_MASTER_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload: NseMasterCachePayload = {
      updatedAt: Date.now(),
      instruments: combined,
    };
    fs.writeFileSync(NSE_MASTER_CACHE_FILE, JSON.stringify(payload), 'utf-8');
  } catch {
    // Ignore disk cache errors on read-only filesystems
  }

  return added;
}

export function findInstrumentByExchangeSymbol(
  exchange: Exchange,
  symbol: string,
): Instrument | undefined {
  return SYMBOL_EXCHANGE_INDEX.get(`${exchange}:${symbol.toUpperCase()}`);
}

export function registerDynamicInstrument(inst: Instrument): {
  instrument: Instrument;
  isNew: boolean;
} {
  const key = `${inst.exchange}:${inst.symbol.toUpperCase()}`;
  const existingByKey = SYMBOL_EXCHANGE_INDEX.get(key);
  if (existingByKey) {
    return { instrument: existingByKey, isNew: false };
  }
  const existingByToken = INSTRUMENT_MAP.get(inst.token);
  if (existingByToken) {
    return { instrument: existingByToken, isNew: false };
  }

  INSTRUMENTS.push(inst);
  INSTRUMENT_MAP.set(inst.token, inst);
  SYMBOL_EXCHANGE_INDEX.set(key, inst);
  persistedDynamic.push(inst);

  try {
    const dir = path.dirname(CUSTOM_INSTRUMENTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      CUSTOM_INSTRUMENTS_FILE,
      JSON.stringify(persistedDynamic.slice(-500), null, 2),
      'utf-8',
    );
  } catch {
    // Ignore persistence errors on read-only filesystems
  }

  return { instrument: inst, isNew: true };
}

export const DEFAULT_WATCHLISTS: Record<string, number[]> = {
  '1': [738561, 2953217, 408065, 341249, 1270529, 779521, 2714625, 424961],
  '2': [341249, 1270529, 779521, 1510401, 492033, 81153],
  '3': [2953217, 408065, 969473, 1850625, 1304833],
  '4': [884737, 2815745, 589569, 98049, 2939649],
  '5': [14893570, 14894082, 256265, 260105],
  '6': [128028676, 136330244, 502785, 897537, 60417],
  '7': [857857, 6401, 1304833],
};
