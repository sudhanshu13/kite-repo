import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Activity,
  ChevronDown,
  CircleDot,
  Download,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  Users,
  X,
} from 'lucide-react';
import { computeHoldingMetrics } from '../../shared/portfolioMath.ts';
import type { Holding, MarketQuote, OrderSide } from '../../shared/types.ts';
import { formatPrice, getChangeColorClass } from '../utils/format.ts';

type HoldingTab = 'all' | 'equity' | 'mutual_funds';
type BarMode = 'current' | 'invested' | 'pnl';
type EquitySubFilter = 'All equity' | 'Gainers' | 'Losers' | 'T1 holdings';

interface MutualFundHolding {
  id: string;
  symbol: string;
  amc: string;
  units: number;
  avgNav: number;
  ltpNav: number;
  dayChangePct: number;
}

const INITIAL_MUTUAL_FUNDS: MutualFundHolding[] = [
  {
    id: 'mf-ppfcf',
    symbol: 'PARAG PARIKH FLEXI CAP FUND',
    amc: 'Direct Plan · Growth',
    units: 420.5,
    avgNav: 74.85,
    ltpNav: 83.42,
    dayChangePct: 0.64,
  },
  {
    id: 'mf-utin50',
    symbol: 'UTI NIFTY 50 INDEX FUND',
    amc: 'Direct Plan · Growth',
    units: 185.25,
    avgNav: 148.2,
    ltpNav: 162.75,
    dayChangePct: 1.08,
  },
  {
    id: 'mf-hdfcmid',
    symbol: 'HDFC MID-CAP OPPORTUNITIES FUND',
    amc: 'Direct Plan · Growth',
    units: 130.0,
    avgNav: 169.4,
    ltpNav: 186.9,
    dayChangePct: -0.22,
  },
];

const BAR_COLORS = [
  '#436BFF',
  '#00A8FF',
  '#4CAF50',
  '#7E57C2',
  '#FF9800',
  '#FF5722',
  '#26A69A',
];

interface UnifiedHoldingRow {
  key: string;
  type: 'equity' | 'mutual_funds';
  symbol: string;
  subtitle?: string;
  t1Quantity?: number;
  token?: number;
  quantity: number;
  averagePrice: number;
  investedValue: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  dayPnl: number;
  dayChangePercent: number;
}

interface HoldingsViewProps {
  holdings: Holding[];
  quotes: Record<number, MarketQuote>;
  onOpenOrderModal: (token: number, side: OrderSide) => void;
  onSelectSymbolForTechnicals: (token: number) => void;
  onUpdateHolding: (
    token: number,
    quantity: number,
    averagePrice: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeleteHolding: (token: number) => Promise<{ ok: boolean; error?: string }>;
  onNotify?: (message: string) => void;
}

function splitIndianNumber(value: number): { whole: string; decimals: string } {
  const isNeg = value < 0;
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const [intPart, decPart] = formatted.split('.');
  return {
    whole: `${isNeg ? '-' : ''}${intPart}`,
    decimals: `.${decPart}`,
  };
}

function formatIndianSigned(value: number): string {
  const abs = Math.abs(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-${abs}` : abs;
}

export function HoldingsView({
  holdings,
  quotes,
  onOpenOrderModal,
  onSelectSymbolForTechnicals,
  onUpdateHolding,
  onDeleteHolding,
  onNotify,
}: HoldingsViewProps) {
  const [activeTab, setActiveTab] = useState<HoldingTab>('equity');
  const [subFilter, setSubFilter] = useState<EquitySubFilter>('All equity');
  const [searchQuery, setSearchQuery] = useState('');
  const [barMode, setBarMode] = useState<BarMode>('current');
  const [mutualFunds, setMutualFunds] = useState<MutualFundHolding[]>(INITIAL_MUTUAL_FUNDS);

  // Three-dot action dropdown & Edit modal state
  const [openMenu, setOpenMenu] = useState<{
    key: string;
    top: number;
    right: number;
    openUpward: boolean;
  } | null>(null);
  const [editingRow, setEditingRow] = useState<UnifiedHoldingRow | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editAvg, setEditAvg] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Analytics / Family modal
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu && !editingRow && !analyticsOpen) return;
    function handleOutside(e: MouseEvent) {
      if (!openMenu) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-holding-menu]')) return;
      setOpenMenu(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setEditingRow(null);
        setAnalyticsOpen(false);
      }
    }
    function handleViewportChange() {
      if (openMenu) setOpenMenu(null);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [openMenu, editingRow, analyticsOpen]);

  const equityRows = useMemo<UnifiedHoldingRow[]>(
    () =>
      holdings.map((h) => {
        const metrics = computeHoldingMetrics(h, quotes[h.token]);
        return {
          key: `eq-${h.token}`,
          type: 'equity',
          symbol: h.symbol,
          t1Quantity: h.t1Quantity,
          token: h.token,
          quantity: h.quantity,
          averagePrice: h.averagePrice,
          investedValue: h.investedValue,
          ltp: metrics.ltp,
          currentValue: metrics.currentValue,
          pnl: metrics.pnl,
          pnlPercent: metrics.pnlPercent,
          dayPnl: metrics.dayPnl,
          dayChangePercent: metrics.dayChangePercent,
        };
      }),
    [holdings, quotes],
  );

  const mutualFundRows = useMemo<UnifiedHoldingRow[]>(
    () =>
      mutualFunds.map((mf) => {
        const investedValue = mf.units * mf.avgNav;
        const currentValue = mf.units * mf.ltpNav;
        const pnl = currentValue - investedValue;
        const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
        const prevNav = mf.ltpNav / (1 + mf.dayChangePct / 100);
        const dayPnl = (mf.ltpNav - prevNav) * mf.units;
        return {
          key: mf.id,
          type: 'mutual_funds',
          symbol: mf.symbol,
          subtitle: mf.amc,
          quantity: mf.units,
          averagePrice: mf.avgNav,
          investedValue,
          ltp: mf.ltpNav,
          currentValue,
          pnl,
          pnlPercent,
          dayPnl,
          dayChangePercent: mf.dayChangePct,
        };
      }),
    [mutualFunds],
  );

  const tabRows = useMemo(() => {
    if (activeTab === 'equity') return equityRows;
    if (activeTab === 'mutual_funds') return mutualFundRows;
    return [...equityRows, ...mutualFundRows];
  }, [activeTab, equityRows, mutualFundRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tabRows.filter((r) => {
      if (subFilter === 'Gainers' && r.pnl < 0) return false;
      if (subFilter === 'Losers' && r.pnl >= 0) return false;
      if (subFilter === 'T1 holdings' && (!r.t1Quantity || r.t1Quantity <= 0)) return false;
      if (q) {
        return (
          r.symbol.toLowerCase().includes(q) ||
          (r.subtitle && r.subtitle.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [tabRows, subFilter, searchQuery]);

  const totals = useMemo(() => {
    let investment = 0;
    let current = 0;
    let dayPnl = 0;
    for (const r of filteredRows) {
      investment += r.investedValue;
      current += r.currentValue;
      dayPnl += r.dayPnl;
    }
    const totalPnl = current - investment;
    const totalPnlPct = investment > 0 ? (totalPnl / investment) * 100 : 0;
    const dayPnlPct = current > 0 ? (dayPnl / (current - dayPnl || current)) * 100 : 0;
    return { investment, current, totalPnl, totalPnlPct, dayPnl, dayPnlPct };
  }, [filteredRows]);

  const barSegments = useMemo(() => {
    const raw = filteredRows.map((row, idx) => {
      const val =
        barMode === 'current'
          ? row.currentValue
          : barMode === 'invested'
            ? row.investedValue
            : Math.abs(row.pnl);
      return {
        key: row.key,
        symbol: row.symbol,
        value: val,
        signedValue:
          barMode === 'current'
            ? row.currentValue
            : barMode === 'invested'
              ? row.investedValue
              : row.pnl,
        color: BAR_COLORS[idx % BAR_COLORS.length],
      };
    });
    const sum = raw.reduce((acc, s) => acc + s.value, 0);
    return raw
      .map((s) => ({
        ...s,
        pct: sum > 0 ? (s.value / sum) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredRows, barMode]);

  const barHeadlineValue =
    barMode === 'current'
      ? totals.current
      : barMode === 'invested'
        ? totals.investment
        : totals.totalPnl;

  function openEditModal(row: UnifiedHoldingRow) {
    setOpenMenu(null);
    setEditingRow(row);
    setEditQty(String(row.quantity));
    setEditAvg(row.averagePrice.toFixed(2));
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError(null);
    const qtyNum = Number(editQty);
    const avgNum = Number(editAvg);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setEditError('Quantity must be greater than zero.');
      return;
    }
    if (!Number.isFinite(avgNum) || avgNum <= 0) {
      setEditError('Average cost must be greater than zero.');
      return;
    }

    if (editingRow.type === 'equity' && editingRow.token !== undefined) {
      setEditSaving(true);
      try {
        const res = await onUpdateHolding(editingRow.token, qtyNum, avgNum);
        if (!res.ok) {
          setEditError(res.error || 'Could not update holding.');
          return;
        }
        setEditingRow(null);
      } finally {
        setEditSaving(false);
      }
    } else {
      setMutualFunds((prev) =>
        prev.map((m) =>
          m.id === editingRow.key
            ? { ...m, units: Number(qtyNum.toFixed(2)), avgNav: Number(avgNum.toFixed(2)) }
            : m,
        ),
      );
      onNotify?.(`Updated ${editingRow.symbol} holding.`);
      setEditingRow(null);
    }
  }

  async function handleDeleteRow(row: UnifiedHoldingRow) {
    setOpenMenu(null);
    if (row.type === 'equity' && row.token !== undefined) {
      const res = await onDeleteHolding(row.token);
      if (!res.ok && res.error) {
        onNotify?.(res.error);
      }
    } else {
      setMutualFunds((prev) => prev.filter((m) => m.id !== row.key));
      onNotify?.(`Removed ${row.symbol} from mutual fund holdings.`);
    }
  }

  function handleInvestMoreMf(mfId: string) {
    setOpenMenu(null);
    const target = mutualFunds.find((m) => m.id === mfId);
    if (!target) return;
    const addedUnits = Number((5000 / target.ltpNav).toFixed(2));
    setMutualFunds((prev) =>
      prev.map((m) => {
        if (m.id !== mfId) return m;
        const totalUnits = Number((m.units + addedUnits).toFixed(2));
        const totalCost = m.units * m.avgNav + addedUnits * m.ltpNav;
        return {
          ...m,
          units: totalUnits,
          avgNav: Number((totalCost / totalUnits).toFixed(2)),
        };
      }),
    );
    onNotify?.(`Added ₹5,000 SIP order (${addedUnits} units) to ${target.symbol}.`);
  }

  function handleDownloadCsv() {
    const headers = [
      'Instrument',
      'Qty.',
      'Avg. cost',
      'LTP',
      'Invested',
      'Cur. val',
      'P&L',
      'Net chg.',
      'Day chg.',
    ];
    const lines = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [
          `"${r.symbol}"`,
          r.quantity,
          r.averagePrice.toFixed(2),
          r.ltp.toFixed(2),
          r.investedValue.toFixed(2),
          r.currentValue.toFixed(2),
          r.pnl.toFixed(2),
          `${r.pnlPercent.toFixed(2)}%`,
          `${r.dayChangePercent.toFixed(2)}%`,
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holdings-${activeTab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: HoldingTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'equity', label: 'Equity' },
    { id: 'mutual_funds', label: 'Mutual funds' },
  ];

  const activeMenuRow = useMemo(
    () => (openMenu ? filteredRows.find((r) => r.key === openMenu.key) ?? null : null),
    [openMenu, filteredRows],
  );

  const invParts = splitIndianNumber(totals.investment);
  const curParts = splitIndianNumber(totals.current);
  const dayParts = splitIndianNumber(totals.dayPnl);
  const pnlParts = splitIndianNumber(totals.totalPnl);

  return (
    <div className="w-full">
      {/* Top Sub-Tab Bar: All | Equity | Mutual funds */}
      <div className="px-5 lg:px-8 border-b border-[#EEEEEE] dark:border-[#282828]">
        <div
          role="tablist"
          aria-label="Holdings categories"
          className="flex items-center gap-7"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`relative py-3 text-[12.5px] transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-[#FF5722] font-normal'
                    : 'text-[#444444] dark:text-[#A0A0A0] hover:text-[#FF5722]'
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5722]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Holdings Content */}
      <div className="px-5 py-5 lg:px-8 lg:py-6 space-y-5">
        {/* Toolbar Row: Holdings (N) + Filter Select | Search + Family + Analytics + Download */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <h1 className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0] tracking-[-0.01em]">
              Holdings ({filteredRows.length})
            </h1>

            <div className="relative">
              <select
                aria-label="Filter holdings type"
                value={subFilter}
                onChange={(e) => setSubFilter(e.target.value as EquitySubFilter)}
                className="appearance-none h-[30px] pl-3 pr-8 text-[12px] bg-white dark:bg-[#181818] border border-[#E5E5E5] dark:border-[#333333] rounded-[3px] text-[#444444] dark:text-[#E0E0E0] focus:outline-none focus:border-[#4184F3] cursor-pointer"
              >
                <option value="All equity">
                  {activeTab === 'mutual_funds'
                    ? 'All funds'
                    : activeTab === 'all'
                      ? 'All holdings'
                      : 'All equity'}
                </option>
                <option value="Gainers">Gainers</option>
                <option value="Losers">Losers</option>
                {activeTab !== 'mutual_funds' && (
                  <option value="T1 holdings">T1 holdings</option>
                )}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#888888] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[12px]">
            <div className="relative w-32 sm:w-[136px]">
              <Search className="w-3.5 h-3.5 text-[#9B9B9B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search holdings"
                className="w-full h-[30px] pl-8 pr-2.5 text-[12px] bg-white dark:bg-[#181818] border border-[#E5E5E5] dark:border-[#333333] rounded-[3px] text-[#444444] dark:text-[#E0E0E0] placeholder:text-[#9B9B9B] focus:outline-none focus:border-[#4184F3]"
              />
            </div>

            <button
              type="button"
              onClick={() => onNotify?.('Family portfolio linking is available in paper admin mode.')}
              className="inline-flex items-center gap-1.5 text-[#4184F3] hover:text-[#3367D6] cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Family</span>
            </button>

            <button
              type="button"
              onClick={() => setAnalyticsOpen(true)}
              className="inline-flex items-center gap-1.5 text-[#4184F3] hover:text-[#3367D6] cursor-pointer"
            >
              <CircleDot className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center gap-1.5 text-[#4184F3] hover:text-[#3367D6] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* 4-Column Summary KPI Strip (Exact Kite Font Size, Weight & Tinted % Pill) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-1 pb-2">
          <div>
            <div className="text-[12px] text-[#9B9B9B]">Total investment</div>
            <div className="mt-1 tabular-nums text-[#444444] dark:text-[#E0E0E0] leading-tight tracking-[-0.01em]">
              <span className="text-[20px] font-medium">{invParts.whole}</span>
              <span className="text-[12px] font-medium">{invParts.decimals}</span>
            </div>
          </div>

          <div>
            <div className="text-[12px] text-[#9B9B9B]">Current value</div>
            <div className="mt-1 tabular-nums text-[#444444] dark:text-[#E0E0E0] leading-tight tracking-[-0.01em]">
              <span className="text-[20px] font-medium">{curParts.whole}</span>
              <span className="text-[12px] font-medium">{curParts.decimals}</span>
            </div>
          </div>

          <div>
            <div className="text-[12px] text-[#9B9B9B]">Day&apos;s P&amp;L</div>
            <div className="mt-1 flex items-baseline flex-wrap gap-1.5 tabular-nums leading-tight tracking-[-0.01em]">
              <span className={getChangeColorClass(totals.dayPnl)}>
                <span className="text-[20px] font-medium">{dayParts.whole}</span>
                <span className="text-[12px] font-medium">{dayParts.decimals}</span>
              </span>
              <span
                className={`text-[10.5px] font-medium px-1.5 py-[2px] rounded-[2px] ${
                  totals.dayPnl >= 0
                    ? 'bg-[#ECF7ED] text-[#4CAF50] dark:bg-[#193320] dark:text-[#4ADE80]'
                    : 'bg-[#FCECEB] text-[#DF514C] dark:bg-[#351B1B] dark:text-[#F87171]'
                }`}
              >
                {totals.dayPnlPct >= 0 ? '+' : ''}
                {totals.dayPnlPct.toFixed(2)}%
              </span>
            </div>
          </div>

          <div>
            <div className="text-[12px] text-[#9B9B9B]">Total P&amp;L</div>
            <div className="mt-1 flex items-baseline flex-wrap gap-1.5 tabular-nums leading-tight tracking-[-0.01em]">
              <span className={getChangeColorClass(totals.totalPnl)}>
                <span className="text-[20px] font-medium">{pnlParts.whole}</span>
                <span className="text-[12px] font-medium">{pnlParts.decimals}</span>
              </span>
              <span
                className={`text-[10.5px] font-medium px-1.5 py-[2px] rounded-[2px] ${
                  totals.totalPnl >= 0
                    ? 'bg-[#ECF7ED] text-[#4CAF50] dark:bg-[#193320] dark:text-[#4ADE80]'
                    : 'bg-[#FCECEB] text-[#DF514C] dark:bg-[#351B1B] dark:text-[#F87171]'
                }`}
              >
                {totals.totalPnlPct >= 0 ? '+' : ''}
                {totals.totalPnlPct.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {/* Holdings Table */}
        {filteredRows.length === 0 ? (
          <div className="py-10 px-4 text-center border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded text-xs text-[#9B9B9B]">
            {searchQuery.trim()
              ? 'No holdings match your search.'
              : activeTab === 'mutual_funds'
                ? 'No mutual fund holdings in your portfolio.'
                : 'No holdings yet. Buy any equity with product type CNC to track holdings here.'}
          </div>
        ) : (
          <>
            <div
              ref={tableContainerRef}
              className="overflow-x-auto overflow-y-hidden border-t border-[#EEEEEE] dark:border-[#282828]"
            >
              <table className="w-full text-[13px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[12px] text-[#9B9B9B] dark:text-[#8C8C8C]">
                    <th className="py-3 px-2.5 lg:px-3 font-normal border-r border-[#F2F2F2] dark:border-[#262626] min-w-[130px]">
                      Instrument
                    </th>
                    <th className="py-3 px-2.5 lg:px-3 font-normal text-right whitespace-nowrap">
                      {activeTab === 'mutual_funds' ? 'Units' : 'Qty.'}
                    </th>
                    <th className="py-3 px-2.5 lg:px-3 font-normal text-right whitespace-nowrap">
                      {activeTab === 'mutual_funds' ? 'Avg. NAV' : 'Avg. cost'}
                    </th>
                    <th className="py-3 px-2.5 lg:px-3 font-normal text-right border-r border-[#F2F2F2] dark:border-[#262626] whitespace-nowrap">
                      {activeTab === 'mutual_funds' ? 'NAV' : 'LTP'}
                    </th>
                    <th className="py-3 px-2.5 lg:px-3 font-normal text-right whitespace-nowrap">
                      Invested
                    </th>
                    <th className="py-3 px-2.5 lg:px-3 font-normal text-right whitespace-nowrap">
                      Cur. val
                    </th>
                    <th className="py-3 px-2.5 lg:px-3 font-normal text-right bg-[#FAFAFA] dark:bg-[#191919] whitespace-nowrap">
                      P&amp;L
                    </th>
                    <th className="py-3 px-2.5 lg:px-3 font-normal text-right whitespace-nowrap">
                      Net chg.
                    </th>
                    <th className="py-3 px-2.5 lg:px-3 font-normal text-right whitespace-nowrap">
                      Day chg.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2F2F2] dark:divide-[#242424]">
                  {filteredRows.map((row) => {
                    const isMenuOpen = openMenu?.key === row.key;
                    return (
                      <tr
                        key={row.key}
                        className="group hover:bg-[#FAFAFA] dark:hover:bg-[#1D1D1D] transition-colors"
                      >
                        <td className="py-3.5 px-2.5 lg:px-3 border-r border-[#F2F2F2] dark:border-[#262626]">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {row.type === 'equity' && row.token !== undefined ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectSymbolForTechnicals(row.token!)}
                                  className="font-normal text-[13px] text-[#444444] dark:text-[#E0E0E0] hover:text-[#4184F3] cursor-pointer text-left truncate"
                                >
                                  {row.symbol}
                                </button>
                              ) : (
                                <span className="font-normal text-[13px] text-[#444444] dark:text-[#E0E0E0] truncate">
                                  {row.symbol}
                                </span>
                              )}
                              {row.type === 'mutual_funds' && activeTab === 'all' && (
                                <span className="text-[9.5px] px-1 py-0.2 bg-[#F1F5F9] dark:bg-[#262626] text-[#4184F3] rounded">
                                  MF
                                </span>
                              )}
                              {subFilter === 'T1 holdings' &&
                              row.t1Quantity &&
                              row.t1Quantity > 0 ? (
                                <span className="text-[9.5px] px-1 py-0.2 bg-[#EFF6FF] dark:bg-[#1D2B3D] text-[#4184F3] rounded shrink-0">
                                  T1:{row.t1Quantity}
                                </span>
                              ) : null}
                            </div>

                            {/* Three-Dot Action Button (appears on hover/focus or when menu open, zero table width inflation) */}
                            <div
                              data-holding-menu
                              className={`shrink-0 ${
                                isMenuOpen
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                              } transition-opacity`}
                            >
                              <button
                                type="button"
                                aria-label={`Actions for ${row.symbol}`}
                                aria-haspopup="menu"
                                aria-expanded={isMenuOpen}
                                onClick={(e) => {
                                  if (isMenuOpen) {
                                    setOpenMenu(null);
                                    return;
                                  }
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const openUpward = window.innerHeight - rect.bottom < 220;
                                  setOpenMenu({
                                    key: row.key,
                                    top: openUpward ? rect.top - 4 : rect.bottom + 4,
                                    right: Math.max(8, window.innerWidth - rect.right),
                                    openUpward,
                                  });
                                }}
                                className={`w-6 h-6 rounded-[3px] flex items-center justify-center transition-colors cursor-pointer ${
                                  isMenuOpen
                                    ? 'bg-[#EBEBEB] dark:bg-[#2E2E2E] text-[#222222] dark:text-white'
                                    : 'hover:bg-[#EFEFEF] dark:hover:bg-[#2A2A2A] text-[#666666] dark:text-[#A0A0A0]'
                                }`}
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {row.subtitle && (
                            <div className="text-[11px] text-[#9B9B9B] mt-0.5">{row.subtitle}</div>
                          )}
                        </td>

                        <td className="py-3.5 px-2.5 lg:px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0] whitespace-nowrap">
                          {row.type === 'mutual_funds' ? row.quantity.toFixed(2) : row.quantity}
                        </td>

                        <td className="py-3.5 px-2.5 lg:px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0] whitespace-nowrap">
                          {formatPrice(row.averagePrice)}
                        </td>

                        <td className="py-3.5 px-2.5 lg:px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0] border-r border-[#F2F2F2] dark:border-[#262626] whitespace-nowrap">
                          {formatPrice(row.ltp)}
                        </td>

                        <td className="py-3.5 px-2.5 lg:px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0] whitespace-nowrap">
                          {formatPrice(row.investedValue)}
                        </td>

                        <td className="py-3.5 px-2.5 lg:px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0] whitespace-nowrap">
                          {formatPrice(row.currentValue)}
                        </td>

                        <td
                          className={`py-3.5 px-2.5 lg:px-3 text-right tabular-nums bg-[#FAFAFA] dark:bg-[#191919] whitespace-nowrap ${getChangeColorClass(row.pnl)}`}
                        >
                          {formatIndianSigned(row.pnl)}
                        </td>

                        <td
                          className={`py-3.5 px-2.5 lg:px-3 text-right tabular-nums text-[11.5px] whitespace-nowrap ${getChangeColorClass(row.pnlPercent)}`}
                        >
                          {row.pnlPercent >= 0 ? '+' : ''}
                          {row.pnlPercent.toFixed(2)}%
                        </td>

                        <td className="py-3.5 px-2.5 lg:px-3 text-right tabular-nums text-[11.5px] whitespace-nowrap">
                          <span className={getChangeColorClass(row.dayChangePercent)}>
                            {row.dayChangePercent >= 0 ? '+' : ''}
                            {row.dayChangePercent.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Bold Summary Total Footer Row */}
                <tfoot>
                  <tr className="border-t border-[#EEEEEE] dark:border-[#282828] font-medium text-[13px] tabular-nums">
                    <td colSpan={3} className="py-3.5 px-2.5 lg:px-3" />
                    <td className="py-3.5 px-2.5 lg:px-3 text-right text-[#444444] dark:text-[#E0E0E0]">
                      Total
                    </td>
                    <td className="py-3.5 px-2.5 lg:px-3 text-right text-[#444444] dark:text-[#E0E0E0] whitespace-nowrap">
                      {formatPrice(totals.investment)}
                    </td>
                    <td className="py-3.5 px-2.5 lg:px-3 text-right text-[#444444] dark:text-[#E0E0E0] whitespace-nowrap">
                      {formatPrice(totals.current)}
                    </td>
                    <td
                      className={`py-3.5 px-2.5 lg:px-3 text-right bg-[#FAFAFA] dark:bg-[#191919] whitespace-nowrap ${getChangeColorClass(totals.totalPnl)}`}
                    >
                      {formatIndianSigned(totals.totalPnl)}
                    </td>
                    <td
                      className={`py-3.5 px-2.5 lg:px-3 text-right text-[11.5px] whitespace-nowrap ${getChangeColorClass(totals.totalPnlPct)}`}
                    >
                      {totals.totalPnlPct >= 0 ? '+' : ''}
                      {totals.totalPnlPct.toFixed(2)}%
                    </td>
                    <td className="py-3.5 px-2.5 lg:px-3 text-right text-[11.5px] whitespace-nowrap">
                      <span className="text-[#444444] dark:text-[#E0E0E0]">
                        {formatIndianSigned(totals.dayPnl)}
                      </span>{' '}
                      <span className={getChangeColorClass(totals.dayPnlPct)}>
                        ({totals.dayPnlPct.toFixed(2)}%)
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bottom Full-Width Stacked Allocation Bar + Radio Toggle */}
            <div className="pt-3 space-y-3">
              <div
                aria-label="Holdings allocation breakdown bar"
                className="h-[54px] w-full flex overflow-hidden rounded-[1px] bg-[#F3F4F6] dark:bg-[#222222]"
              >
                {barSegments.map((seg) => (
                  <div
                    key={seg.key}
                    title={`${seg.symbol}: ₹${formatPrice(seg.signedValue)} (${seg.pct.toFixed(1)}%)`}
                    style={{
                      width: `${Math.max(seg.pct, 1.5)}%`,
                      backgroundColor: seg.color,
                    }}
                    className="h-full transition-all duration-300 hover:opacity-90"
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[14px] font-normal tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                  {barHeadlineValue < 0 ? '-' : ''}₹
                  {Math.abs(barHeadlineValue).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>

                <div
                  role="radiogroup"
                  aria-label="Allocation bar metric"
                  className="flex items-center gap-5 text-[12px] text-[#666666] dark:text-[#A0A0A0]"
                >
                  {(
                    [
                      { id: 'current', label: 'Current value' },
                      { id: 'invested', label: 'Invested' },
                      { id: 'pnl', label: 'P&L' },
                    ] as { id: BarMode; label: string }[]
                  ).map((opt) => (
                    <label
                      key={opt.id}
                      className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <input
                        type="radio"
                        name="holdings-bar-mode"
                        checked={barMode === opt.id}
                        onChange={() => setBarMode(opt.id)}
                        className="accent-[#4184F3] cursor-pointer"
                      />
                      <span
                        className={
                          barMode === opt.id
                            ? 'text-[#444444] dark:text-[#E0E0E0]'
                            : ''
                        }
                      >
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating Three-Dot Action Menu (rendered outside overflow-x-auto table) */}
      {openMenu && activeMenuRow && (
        <div
          data-holding-menu
          role="menu"
          aria-label={`${activeMenuRow.symbol} options`}
          style={{
            top: openMenu.top,
            right: openMenu.right,
          }}
          className={`fixed z-50 w-44 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#333333] rounded-[4px] shadow-lg py-1 text-left text-[12px] ${
            openMenu.openUpward ? '-translate-y-full' : ''
          }`}
        >
          {activeMenuRow.type === 'equity' && activeMenuRow.token !== undefined ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenOrderModal(activeMenuRow.token!, 'BUY');
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#4184F3]" />
                <span>Add / Buy</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  onOpenOrderModal(activeMenuRow.token!, 'SELL');
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
              >
                <TrendingDown className="w-3.5 h-3.5 text-[#FF5722]" />
                <span>Exit / Sell</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpenMenu(null);
                  onSelectSymbolForTechnicals(activeMenuRow.token!);
                }}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-[#9B9B9B]" />
                <span>Technicals</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => handleInvestMoreMf(activeMenuRow.key)}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#4184F3]" />
              <span>Invest ₹5,000 SIP</span>
            </button>
          )}

          <div className="my-1 border-t border-[#EEEEEE] dark:border-[#2C2C2C]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => openEditModal(activeMenuRow)}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5 text-[#9B9B9B]" />
            <span>Edit holding</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleDeleteRow(activeMenuRow)}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-[#DF514C] dark:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#2A1B1B] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Edit Holding Modal */}
      {editingRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editingRow.symbol} holding`}
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#333333] rounded w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#EEEEEE] dark:border-[#2C2C2C] flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]">
                Edit holding · {editingRow.symbol}
              </h2>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                aria-label="Close edit holding modal"
                className="text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label
                  htmlFor="edit-holding-qty"
                  className="block text-[11px] text-[#666666] dark:text-[#A0A0A0] mb-1"
                >
                  {editingRow.type === 'mutual_funds' ? 'Units' : 'Quantity'}
                </label>
                <input
                  id="edit-holding-qty"
                  type="number"
                  step={editingRow.type === 'mutual_funds' ? '0.01' : '1'}
                  min={editingRow.type === 'mutual_funds' ? '0.01' : '1'}
                  required
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full px-3 py-2 text-xs tabular-nums bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-holding-avg"
                  className="block text-[11px] text-[#666666] dark:text-[#A0A0A0] mb-1"
                >
                  {editingRow.type === 'mutual_funds' ? 'Average NAV (₹)' : 'Average cost (₹)'}
                </label>
                <input
                  id="edit-holding-avg"
                  type="number"
                  step="0.05"
                  min="0.05"
                  required
                  value={editAvg}
                  onChange={(e) => setEditAvg(e.target.value)}
                  className="w-full px-3 py-2 text-xs tabular-nums bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                />
              </div>

              {editError && (
                <p className="text-xs text-[#DF514C] dark:text-[#F87171]">{editError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 text-xs border border-[#E0E0E0] dark:border-[#333333] rounded text-[#666666] dark:text-[#A0A0A0] hover:border-[#999999] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 text-xs font-medium bg-[#4184F3] hover:bg-[#3367D6] disabled:opacity-50 text-white rounded cursor-pointer"
                >
                  {editSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Holdings Analytics Breakdown Modal */}
      {analyticsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Holdings analytics breakdown"
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#333333] rounded w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#EEEEEE] dark:border-[#2C2C2C] flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]">
                Portfolio Weight Analytics
              </h2>
              <button
                type="button"
                onClick={() => setAnalyticsOpen(false)}
                aria-label="Close analytics"
                className="text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              {barSegments.map((seg) => (
                <div key={seg.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0]">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span>{seg.symbol}</span>
                    </span>
                    <span className="tabular-nums text-[#666666] dark:text-[#A0A0A0]">
                      ₹{formatPrice(seg.signedValue)} ({seg.pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[#F0F0F0] dark:bg-[#2A2A2A] rounded overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(100, seg.pct)}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
