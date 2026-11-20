import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  ListFilter,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { Instrument, MarketQuote, OrderSide } from '../../shared/types.ts';

interface ScreenerStock {
  symbol: string;
  name: string;
  basePrice: number;
  baseChangePct: number;
  marketCapCr: number;
  peRatio: number;
  sector: string;
  universes: string[];
}

const SCREENER_STOCKS: ScreenerStock[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd.', basePrice: 1377.5, baseChangePct: 0.14, marketCapCr: 1861536, peRatio: 22.67, sector: 'Refineries', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', basePrice: 2161.7, baseChangePct: 0.83, marketCapCr: 1340101, peRatio: 43.21, sector: 'Telecom', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd.', basePrice: 846.0, baseChangePct: 2.94, marketCapCr: 1268352, peRatio: 15.83, sector: 'Banks', universes: ['Nifty 500', 'Nifty 50', 'Nifty Bank', 'Large Cap'] },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', basePrice: 1640.0, baseChangePct: 1.93, marketCapCr: 1156007, peRatio: 19.57, sector: 'Banks', universes: ['Nifty 500', 'Nifty 50', 'Nifty Bank', 'Large Cap'] },
  { symbol: 'SBIN', name: 'State Bank of India', basePrice: 1165.1, baseChangePct: 0.79, marketCapCr: 1067059, peRatio: 11.8, sector: 'Banks', universes: ['Nifty 500', 'Nifty 50', 'Nifty Bank', 'Large Cap'] },
  { symbol: 'TCS', name: 'Tata Consultancy Services', basePrice: 2376.2, baseChangePct: 1.43, marketCapCr: 847609, peRatio: 16.42, sector: 'IT - Software', universes: ['Nifty 500', 'Nifty 50', 'Nifty IT', 'Large Cap'] },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', basePrice: 1122.0, baseChangePct: 2.67, marketCapCr: 692878, peRatio: 31.94, sector: 'Finance - NBFC', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd.', basePrice: 4209.1, baseChangePct: -0.05, marketCapCr: 579398, peRatio: 32.43, sector: 'Engineering', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'LICI', name: 'Life Insurance Corp. of India', basePrice: 410.7, baseChangePct: 1.63, marketCapCr: 511186, peRatio: 8.23, sector: 'Insurance', universes: ['Nifty 500', 'Large Cap'] },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd.', basePrice: 515.8, baseChangePct: 2.54, marketCapCr: 500402, peRatio: 23.3, sector: 'Banks', universes: ['Nifty 500', 'Nifty 50', 'Nifty Bank', 'Large Cap'] },
  { symbol: 'INFY', name: 'Infosys Ltd.', basePrice: 1098.0, baseChangePct: 0.56, marketCapCr: 455980, peRatio: 21.15, sector: 'IT - Software', universes: ['Nifty 500', 'Nifty 50', 'Nifty IT', 'Large Cap'] },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', basePrice: 2384.5, baseChangePct: -0.42, marketCapCr: 560214, peRatio: 52.84, sector: 'FMCG', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'ITC', name: 'ITC Ltd.', basePrice: 299.1, baseChangePct: -0.63, marketCapCr: 374120, peRatio: 26.18, sector: 'FMCG', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Inds.', basePrice: 1842.4, baseChangePct: 1.18, marketCapCr: 442095, peRatio: 37.9, sector: 'Pharma', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd.', basePrice: 1188.6, baseChangePct: 1.65, marketCapCr: 368410, peRatio: 13.74, sector: 'Banks', universes: ['Nifty 500', 'Nifty 50', 'Nifty Bank', 'Large Cap'] },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd.', basePrice: 12465.0, baseChangePct: 0.91, marketCapCr: 391875, peRatio: 26.52, sector: 'Automobiles', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd.', basePrice: 3128.4, baseChangePct: 2.14, marketCapCr: 389102, peRatio: 30.88, sector: 'Automobiles', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', basePrice: 1684.3, baseChangePct: 0.72, marketCapCr: 457140, peRatio: 27.45, sector: 'IT - Software', universes: ['Nifty 500', 'Nifty 50', 'Nifty IT', 'Large Cap'] },
  { symbol: 'NTPC', name: 'NTPC Ltd.', basePrice: 368.4, baseChangePct: 1.35, marketCapCr: 357214, peRatio: 16.92, sector: 'Power', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd.', basePrice: 11680.5, baseChangePct: -0.31, marketCapCr: 337190, peRatio: 46.12, sector: 'Cement', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'TITAN', name: 'Titan Company Ltd.', basePrice: 3422.8, baseChangePct: 1.09, marketCapCr: 303870, peRatio: 84.35, sector: 'Consumer Durables', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'ONGC', name: 'Oil & Natural Gas Corp.', basePrice: 264.15, baseChangePct: -0.84, marketCapCr: 332305, peRatio: 7.46, sector: 'Oil & Gas', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ Ltd.', basePrice: 1345.9, baseChangePct: 1.78, marketCapCr: 290720, peRatio: 28.4, sector: 'Infrastructure', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'POWERGRID', name: 'Power Grid Corp. of India', basePrice: 314.25, baseChangePct: 0.48, marketCapCr: 292280, peRatio: 18.61, sector: 'Power', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd.', basePrice: 1794.0, baseChangePct: 1.52, marketCapCr: 286415, peRatio: 33.12, sector: 'Finance - NBFC', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'WIPRO', name: 'Wipro Ltd.', basePrice: 288.45, baseChangePct: 0.94, marketCapCr: 301840, peRatio: 24.18, sector: 'IT - Software', universes: ['Nifty 500', 'Nifty 50', 'Nifty IT', 'Large Cap'] },
  { symbol: 'HAL', name: 'Hindustan Aeronautics Ltd.', basePrice: 4385.6, baseChangePct: 2.38, marketCapCr: 293295, peRatio: 35.64, sector: 'Defence', universes: ['Nifty 500', 'Large Cap'] },
  { symbol: 'COALINDIA', name: 'Coal India Ltd.', basePrice: 418.75, baseChangePct: -0.54, marketCapCr: 258065, peRatio: 7.12, sector: 'Mining', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd.', basePrice: 2418.0, baseChangePct: 1.26, marketCapCr: 279080, peRatio: 68.42, sector: 'Trading', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'DMART', name: 'Avenue Supermarts Ltd.', basePrice: 3895.0, baseChangePct: -0.18, marketCapCr: 253455, peRatio: 92.1, sector: 'Retail', universes: ['Nifty 500', 'Large Cap'] },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.', basePrice: 2468.3, baseChangePct: -1.12, marketCapCr: 236755, peRatio: 51.04, sector: 'Paints', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', basePrice: 794.6, baseChangePct: 1.84, marketCapCr: 292510, peRatio: 9.15, sector: 'Automobiles', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd.', basePrice: 982.4, baseChangePct: 0.68, marketCapCr: 240245, peRatio: 38.7, sector: 'Metals', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'BEL', name: 'Bharat Electronics Ltd.', basePrice: 308.9, baseChangePct: 3.12, marketCapCr: 225800, peRatio: 48.25, sector: 'Defence', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'TRENT', name: 'Trent Ltd.', basePrice: 6412.5, baseChangePct: 2.05, marketCapCr: 227960, peRatio: 142.6, sector: 'Retail', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd.', basePrice: 148.35, baseChangePct: -0.74, marketCapCr: 185180, peRatio: 44.8, sector: 'Metals', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'ZOMATO', name: 'Eternal (Zomato) Ltd.', basePrice: 244.8, baseChangePct: 3.45, marketCapCr: 236110, peRatio: 185.2, sector: 'Consumer Tech', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'JIOFIN', name: 'Jio Financial Services', basePrice: 312.6, baseChangePct: 1.15, marketCapCr: 198605, peRatio: 118.4, sector: 'Finance - NBFC', universes: ['Nifty 500', 'Large Cap'] },
  { symbol: 'DLF', name: 'DLF Ltd.', basePrice: 786.2, baseChangePct: 1.92, marketCapCr: 194610, peRatio: 54.3, sector: 'Real Estate', universes: ['Nifty 500', 'Large Cap'] },
  { symbol: 'SIEMENS', name: 'Siemens Ltd.', basePrice: 5420.0, baseChangePct: 0.44, marketCapCr: 193015, peRatio: 69.8, sector: 'Engineering', universes: ['Nifty 500', 'Large Cap'] },
  { symbol: 'INDIGO', name: 'InterGlobe Aviation Ltd.', basePrice: 4612.8, baseChangePct: 1.38, marketCapCr: 178225, peRatio: 24.9, sector: 'Aviation', universes: ['Nifty 500', 'Large Cap'] },
  { symbol: 'VBL', name: 'Varun Beverages Ltd.', basePrice: 542.15, baseChangePct: -0.28, marketCapCr: 183340, peRatio: 66.5, sector: 'FMCG', universes: ['Nifty 500', 'Large Cap'] },
  { symbol: 'TECHM', name: 'Tech Mahindra Ltd.', basePrice: 1648.9, baseChangePct: 0.87, marketCapCr: 161320, peRatio: 42.1, sector: 'IT - Software', universes: ['Nifty 500', 'Nifty 50', 'Nifty IT', 'Large Cap'] },
  { symbol: 'GRASIM', name: 'Grasim Industries Ltd.', basePrice: 2564.4, baseChangePct: 0.32, marketCapCr: 174500, peRatio: 34.7, sector: 'Cement', universes: ['Nifty 500', 'Nifty 50', 'Large Cap'] },
  { symbol: 'PIDILITIND', name: 'Pidilite Industries Ltd.', basePrice: 2986.0, baseChangePct: -0.45, marketCapCr: 151870, peRatio: 74.2, sector: 'Chemicals', universes: ['Nifty 500', 'Large Cap'] },
  { symbol: 'CIPLA', name: 'Cipla Ltd.', basePrice: 1518.6, baseChangePct: 0.62, marketCapCr: 122640, peRatio: 26.8, sector: 'Pharma', universes: ['Nifty 500', 'Nifty 50', 'Mid Cap'] },
  { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd.', basePrice: 4924.2, baseChangePct: 1.41, marketCapCr: 134980, peRatio: 30.4, sector: 'Automobiles', universes: ['Nifty 500', 'Nifty 50', 'Mid Cap'] },
  { symbol: 'DRREDDY', name: "Dr. Reddy's Laboratories", basePrice: 1248.5, baseChangePct: -0.39, marketCapCr: 104190, peRatio: 19.6, sector: 'Pharma', universes: ['Nifty 500', 'Nifty 50', 'Mid Cap'] },
  { symbol: 'BPCL', name: 'Bharat Petroleum Corp.', basePrice: 292.4, baseChangePct: 0.95, marketCapCr: 126850, peRatio: 9.42, sector: 'Refineries', universes: ['Nifty 500', 'Nifty 50', 'Mid Cap'] },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd.', basePrice: 968.2, baseChangePct: -1.48, marketCapCr: 75430, peRatio: 10.65, sector: 'Banks', universes: ['Nifty 500', 'Nifty 50', 'Nifty Bank', 'Mid Cap'] },
];

const UNIVERSES = ['Nifty 500', 'Nifty 50', 'Nifty Bank', 'Nifty IT', 'Large Cap', 'Mid Cap'];

type SortKey = 'instrument' | 'price' | 'change' | 'mcap' | 'pe' | 'sector';

interface ColumnVisibility {
  price: boolean;
  change: boolean;
  mcap: boolean;
  pe: boolean;
  sector: boolean;
}

interface StockScreenerViewProps {
  instruments: Instrument[];
  quotes: Record<number, MarketQuote>;
  onSelectSymbolForTechnicals: (token: number) => void;
  onOpenOrderModal: (token: number, side: OrderSide) => void;
}

function formatIndianInteger(val: number): string {
  return Math.round(val).toLocaleString('en-IN');
}

export function StockScreenerView({
  instruments,
  quotes,
  onSelectSymbolForTechnicals,
  onOpenOrderModal,
}: StockScreenerViewProps) {
  const [universe, setUniverse] = useState<string>('Nifty 500');
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [changeFilter, setChangeFilter] = useState<'all' | 'gainers' | 'losers'>('all');
  const [maxPeFilter, setMaxPeFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('mcap');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnVisibility>({
    price: true,
    change: true,
    mcap: true,
    pe: true,
    sector: true,
  });

  const filtersRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const symbolToInstrument = useMemo(() => {
    const map = new Map<string, Instrument>();
    for (const inst of instruments) {
      if (!inst.isIndex && inst.exchange === 'NSE') {
        map.set(inst.symbol.toUpperCase(), inst);
      }
    }
    return map;
  }, [instruments]);

  const allSectors = useMemo(
    () => Array.from(new Set(SCREENER_STOCKS.map((s) => s.sector))).sort(),
    [],
  );

  const enrichedRows = useMemo(() => {
    return SCREENER_STOCKS.map((stock) => {
      const liveInst = symbolToInstrument.get(stock.symbol);
      const liveQuote = liveInst ? quotes[liveInst.token] : undefined;
      return {
        ...stock,
        token: liveInst?.token,
        lastPrice: liveQuote ? liveQuote.ltp : stock.basePrice,
        changePct: liveQuote ? liveQuote.changePercent : stock.baseChangePct,
      };
    });
  }, [symbolToInstrument, quotes]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const maxPe = Number(maxPeFilter);
    const hasMaxPe = maxPeFilter.trim() !== '' && Number.isFinite(maxPe) && maxPe > 0;

    return enrichedRows
      .filter((row) => {
        if (!row.universes.includes(universe)) return false;
        if (sectorFilter !== 'ALL' && row.sector !== sectorFilter) return false;
        if (changeFilter === 'gainers' && row.changePct < 0) return false;
        if (changeFilter === 'losers' && row.changePct >= 0) return false;
        if (hasMaxPe && row.peRatio > maxPe) return false;
        if (q) {
          return (
            row.symbol.toLowerCase().includes(q) ||
            row.name.toLowerCase().includes(q) ||
            row.sector.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const mult = sortDir === 'asc' ? 1 : -1;
        switch (sortKey) {
          case 'instrument':
            return a.symbol.localeCompare(b.symbol) * mult;
          case 'price':
            return (a.lastPrice - b.lastPrice) * mult;
          case 'change':
            return (a.changePct - b.changePct) * mult;
          case 'mcap':
            return (a.marketCapCr - b.marketCapCr) * mult;
          case 'pe':
            return (a.peRatio - b.peRatio) * mult;
          case 'sector':
            return a.sector.localeCompare(b.sector) * mult;
        }
      });
  }, [enrichedRows, universe, sectorFilter, changeFilter, maxPeFilter, searchQuery, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setPageInput(String(safePage));
  }, [safePage]);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  const activeFilterCount =
    (sectorFilter !== 'ALL' ? 1 : 0) +
    (changeFilter !== 'all' ? 1 : 0) +
    (maxPeFilter.trim() !== '' ? 1 : 0);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'instrument' || key === 'sector' ? 'asc' : 'desc');
    }
    setCurrentPage(1);
  }

  function handleReset() {
    setUniverse('Nifty 500');
    setSearchQuery('');
    setSectorFilter('ALL');
    setChangeFilter('all');
    setMaxPeFilter('');
    setSortKey('mcap');
    setSortDir('desc');
    setCurrentPage(1);
  }

  function handleDownloadCsv() {
    const headers = ['Instrument', 'Last Price', 'Change %', 'Market Cap (Cr)', 'P/E Ratio', 'Sector'];
    const lines = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [
          r.symbol,
          r.lastPrice.toFixed(2),
          `${r.changePct.toFixed(2)}%`,
          r.marketCapCr,
          r.peRatio.toFixed(2),
          `"${r.sector}"`,
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-screener-${universe.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const startIdx = filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, filteredRows.length);

  return (
    <div className="space-y-4">
      {/* Screener Toolbar Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[16px] font-normal text-[#444444] dark:text-[#E0E0E0] mr-1">
            All Stocks ({filteredRows.length})
          </h2>

          {/* Index / Universe Select */}
          <div className="relative">
            <select
              aria-label="Stock universe"
              value={universe}
              onChange={(e) => {
                setUniverse(e.target.value);
                setCurrentPage(1);
              }}
              className="appearance-none h-[32px] pl-3 pr-8 text-[12px] bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] rounded-[3px] text-[#444444] dark:text-[#E0E0E0] focus:outline-none focus:border-[#4184F3] cursor-pointer"
            >
              {UNIVERSES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#888888] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Filters Button & Popover */}
          <div ref={filtersRef} className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              className={`inline-flex items-center gap-1.5 h-[32px] px-3 text-[12px] rounded-[3px] border transition-colors cursor-pointer ${
                filtersOpen || activeFilterCount > 0
                  ? 'border-[#4184F3] text-[#4184F3] bg-[#4184F3]/5'
                  : 'border-[#CCCCCC] dark:border-[#3A3A3A] text-[#444444] dark:text-[#E0E0E0] bg-white dark:bg-[#181818] hover:border-[#999999]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-[#4184F3] text-white text-[10px] rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filtersOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-64 bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] rounded shadow-lg z-30 p-3.5 space-y-3 text-xs">
                <div>
                  <label
                    htmlFor="screener-sector-filter"
                    className="block text-[11px] text-[#888888] mb-1"
                  >
                    Sector
                  </label>
                  <select
                    id="screener-sector-filter"
                    value={sectorFilter}
                    onChange={(e) => {
                      setSectorFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-[#141414] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                  >
                    <option value="ALL">All Sectors</option>
                    {allSectors.map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-[11px] text-[#888888] mb-1">Day performance</span>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'gainers', label: 'Gainers' },
                        { id: 'losers', label: 'Losers' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setChangeFilter(opt.id);
                          setCurrentPage(1);
                        }}
                        className={`py-1 text-[11px] rounded border cursor-pointer ${
                          changeFilter === opt.id
                            ? 'border-[#4184F3] bg-[#4184F3]/10 text-[#4184F3] font-medium'
                            : 'border-[#E0E0E0] dark:border-[#333333] text-[#666666] dark:text-[#A0A0A0]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="screener-max-pe"
                    className="block text-[11px] text-[#888888] mb-1"
                  >
                    Max P/E Ratio
                  </label>
                  <input
                    id="screener-max-pe"
                    type="number"
                    min="1"
                    step="1"
                    value={maxPeFilter}
                    onChange={(e) => {
                      setMaxPeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="e.g. 30"
                    className="w-full px-2.5 py-1.5 text-xs tabular-nums bg-white dark:bg-[#141414] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset screener filters"
            title="Reset filters"
            className="p-1.5 text-[#666666] dark:text-[#A0A0A0] hover:text-[#4184F3] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Toolbar: Search + Columns + Download */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-40 sm:w-44">
            <Search className="w-3.5 h-3.5 text-[#9B9B9B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search"
              aria-label="Search stocks in screener"
              className="w-full h-[32px] pl-8 pr-2.5 text-[12px] bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] rounded-[3px] text-[#444444] dark:text-[#E0E0E0] placeholder:text-[#9B9B9B] focus:outline-none focus:border-[#4184F3]"
            />
          </div>

          {/* Columns Dropdown */}
          <div ref={columnsRef} className="relative">
            <button
              type="button"
              onClick={() => setColumnsOpen((prev) => !prev)}
              aria-expanded={columnsOpen}
              className="inline-flex items-center gap-1.5 text-[12px] text-[#4184F3] hover:text-[#3367D6] cursor-pointer"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Columns</span>
            </button>
            {columnsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-[#1E1E1E] border border-[#E0E0E0] dark:border-[#333333] rounded shadow-lg z-30 p-2.5 space-y-1.5 text-xs">
                {(
                  [
                    { key: 'price', label: 'Last Price' },
                    { key: 'change', label: 'Change %' },
                    { key: 'mcap', label: 'Market Cap (Cr)' },
                    { key: 'pe', label: 'P/E Ratio' },
                    { key: 'sector', label: 'Sector' },
                  ] as const
                ).map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 py-0.5 text-[#444444] dark:text-[#D4D4D4] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={columns[col.key]}
                      onChange={(e) =>
                        setColumns((prev) => ({ ...prev, [col.key]: e.target.checked }))
                      }
                      className="accent-[#4184F3]"
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Download CSV */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 text-[12px] text-[#4184F3] hover:text-[#3367D6] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Screener Data Table */}
      <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
        <table className="w-full text-[13px] text-left border-collapse">
          <thead>
            <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[12px] text-[#9B9B9B] dark:text-[#8C8C8C]">
              <th className="py-3 px-3 font-normal border-r border-[#F2F2F2] dark:border-[#242424] min-w-[165px]">
                <button
                  type="button"
                  onClick={() => handleSort('instrument')}
                  className="hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
                >
                  Instrument {sortKey === 'instrument' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </button>
              </th>
              {columns.price && (
                <th className="py-3 px-4 font-normal text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('price')}
                    className="hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
                  >
                    Last Price {sortKey === 'price' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
              )}
              {columns.change && (
                <th className="py-3 px-4 font-normal text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('change')}
                    className="hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
                  >
                    Change % {sortKey === 'change' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
              )}
              {columns.mcap && (
                <th className="py-3 px-4 font-normal text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('mcap')}
                    className="hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
                  >
                    Market Cap (Cr) {sortKey === 'mcap' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
              )}
              {columns.pe && (
                <th className="py-3 px-4 font-normal text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('pe')}
                    className="hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
                  >
                    P/E Ratio {sortKey === 'pe' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
              )}
              {columns.sector && (
                <th className="py-3 px-4 font-normal whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('sector')}
                    className="hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
                  >
                    Sector {sortKey === 'sector' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#242424]">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 text-center text-xs text-[#9B9B9B]"
                >
                  No stocks match the selected screener criteria.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={row.symbol}
                  className="group hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E] transition-colors"
                >
                  <td className="py-3 px-3 border-r border-[#F2F2F2] dark:border-[#242424]">
                    <div className="flex items-center justify-between gap-2">
                      {row.token !== undefined ? (
                        <button
                          type="button"
                          onClick={() => onSelectSymbolForTechnicals(row.token!)}
                          className="font-normal text-[#444444] dark:text-[#E0E0E0] hover:text-[#4184F3] cursor-pointer text-left"
                        >
                          {row.symbol}
                        </button>
                      ) : (
                        <span className="font-normal text-[#444444] dark:text-[#E0E0E0]">
                          {row.symbol}
                        </span>
                      )}

                      {row.token !== undefined && (
                        <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenOrderModal(row.token!, 'BUY')}
                            aria-label={`Buy ${row.symbol}`}
                            className="w-5 h-5 text-[10px] font-semibold bg-[#4184F3] text-white rounded hover:bg-[#3367D6] cursor-pointer"
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenOrderModal(row.token!, 'SELL')}
                            aria-label={`Sell ${row.symbol}`}
                            className="w-5 h-5 text-[10px] font-semibold bg-[#FF5722] text-white rounded hover:bg-[#E64A19] cursor-pointer"
                          >
                            S
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  {columns.price && (
                    <td className="py-3 px-4 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                      {row.lastPrice.toFixed(2)}
                    </td>
                  )}
                  {columns.change && (
                    <td
                      className={`py-3 px-4 text-right tabular-nums ${
                        row.changePct >= 0
                          ? 'text-[#4CAF50] dark:text-[#4ADE80]'
                          : 'text-[#DF514C] dark:text-[#F87171]'
                      }`}
                    >
                      {row.changePct.toFixed(2)}%
                    </td>
                  )}
                  {columns.mcap && (
                    <td className="py-3 px-4 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                      {formatIndianInteger(row.marketCapCr)}
                    </td>
                  )}
                  {columns.pe && (
                    <td className="py-3 px-4 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                      {row.peRatio.toFixed(2)}
                    </td>
                  )}
                  {columns.sector && (
                    <td className="py-3 px-4 text-[#444444] dark:text-[#D4D4D4] whitespace-nowrap">
                      {row.sector}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[12px] text-[#666666] dark:text-[#A0A0A0]">
        <div className="tabular-nums text-[#888888]">
          Showing {startIdx}-{endIdx} of {filteredRows.length}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Show</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-7 px-2 text-xs bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] rounded-[3px] text-[#444444] dark:text-[#E0E0E0] focus:outline-none focus:border-[#4184F3] cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage(1)}
              aria-label="First page"
              className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] dark:border-[#333333] rounded-[3px] disabled:opacity-40 hover:border-[#4184F3] cursor-pointer"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
              className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] dark:border-[#333333] rounded-[3px] disabled:opacity-40 hover:border-[#4184F3] cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 tabular-nums">
            <span>Page</span>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Current page number"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
              onBlur={() => {
                const num = Number(pageInput);
                if (num >= 1 && num <= totalPages) setCurrentPage(num);
                else setPageInput(String(safePage));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const num = Number(pageInput);
                  if (num >= 1 && num <= totalPages) setCurrentPage(num);
                  else setPageInput(String(safePage));
                }
              }}
              className="w-11 h-7 px-2 text-center text-xs bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] rounded-[3px] text-[#444444] dark:text-[#E0E0E0] focus:outline-none focus:border-[#4184F3]"
            />
            <span>of {totalPages}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
              className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] dark:border-[#333333] rounded-[3px] disabled:opacity-40 hover:border-[#4184F3] cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              aria-label="Last page"
              className="w-7 h-7 flex items-center justify-center border border-[#E5E5E5] dark:border-[#333333] rounded-[3px] disabled:opacity-40 hover:border-[#4184F3] cursor-pointer"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
