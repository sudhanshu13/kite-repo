import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { computeHoldingMetrics } from '../../shared/portfolioMath.ts';
import type { Holding, MarketQuote, OrderSide } from '../../shared/types.ts';
import { formatINR, formatPrice, getChangeColorClass } from '../utils/format.ts';

type HoldingTab = 'all' | 'equity' | 'mutual_funds';

interface MutualFundHolding {
  id: string;
  symbol: string;
  amc: string;
  category: string;
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
    category: 'Flexi Cap',
    units: 420.5,
    avgNav: 74.85,
    ltpNav: 83.42,
    dayChangePct: 0.64,
  },
  {
    id: 'mf-utin50',
    symbol: 'UTI NIFTY 50 INDEX FUND',
    amc: 'Direct Plan · Growth',
    category: 'Index Fund',
    units: 185.25,
    avgNav: 148.2,
    ltpNav: 162.75,
    dayChangePct: 1.08,
  },
  {
    id: 'mf-hdfcmid',
    symbol: 'HDFC MID-CAP OPPORTUNITIES FUND',
    amc: 'Direct Plan · Growth',
    category: 'Mid Cap',
    units: 130.0,
    avgNav: 169.4,
    ltpNav: 186.9,
    dayChangePct: -0.22,
  },
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
  onNotify?: (message: string) => void;
}

export function HoldingsView({
  holdings,
  quotes,
  onOpenOrderModal,
  onSelectSymbolForTechnicals,
  onNotify,
}: HoldingsViewProps) {
  const [activeTab, setActiveTab] = useState<HoldingTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mutualFunds, setMutualFunds] = useState<MutualFundHolding[]>(INITIAL_MUTUAL_FUNDS);

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
    if (!q) return tabRows;
    return tabRows.filter(
      (r) =>
        r.symbol.toLowerCase().includes(q) ||
        (r.subtitle && r.subtitle.toLowerCase().includes(q)),
    );
  }, [tabRows, searchQuery]);

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

  function handleInvestMoreMf(mfId: string) {
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

  function handleRedeemMf(mfId: string) {
    const target = mutualFunds.find((m) => m.id === mfId);
    if (!target) return;
    setMutualFunds((prev) => prev.filter((m) => m.id !== mfId));
    onNotify?.(`Submitted paper redemption for ${target.symbol}.`);
  }

  const tabs: { id: HoldingTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: equityRows.length + mutualFundRows.length },
    { id: 'equity', label: 'Equity', count: equityRows.length },
    { id: 'mutual_funds', label: 'Mutual funds', count: mutualFundRows.length },
  ];

  const headingLabel =
    activeTab === 'equity'
      ? 'Equity holdings'
      : activeTab === 'mutual_funds'
        ? 'Mutual fund holdings'
        : 'Holdings';

  return (
    <div className="p-5 lg:p-8 max-w-6xl space-y-6">
      {/* Kite Sub-Tab Navigation Bar: All | Equity | Mutual funds */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EEEEEE] dark:border-[#282828]">
        <div
          role="tablist"
          aria-label="Holdings categories"
          className="flex items-center gap-6"
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
                className={`relative pb-3 text-[13px] transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'text-[#FF5722] font-medium'
                    : 'text-[#666666] dark:text-[#A0A0A0] hover:text-[#FF5722]'
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

        <div className="relative pb-2 sm:pb-2.5 w-full sm:w-56">
          <Search className="w-3.5 h-3.5 text-[#9B9B9B] absolute left-2.5 top-[11px] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search holdings"
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] rounded-[3px] text-[#444444] dark:text-[#E0E0E0] placeholder:text-[#9B9B9B] focus:outline-none focus:border-[#4184F3]"
          />
        </div>
      </div>

      {/* Section Title */}
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0]">
          {headingLabel} ({filteredRows.length})
        </h1>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-t border-b border-[#EEEEEE] dark:border-[#282828]">
        <div>
          <div className="text-xs text-[#9B9B9B]">Total investment</div>
          <div className="text-xl font-light tabular-nums text-[#444444] dark:text-[#E0E0E0] mt-1">
            {formatINR(totals.investment)}
          </div>
        </div>
        <div>
          <div className="text-xs text-[#9B9B9B]">Current value</div>
          <div className="text-xl font-light tabular-nums text-[#444444] dark:text-[#E0E0E0] mt-1">
            {formatINR(totals.current)}
          </div>
        </div>
        <div>
          <div className="text-xs text-[#9B9B9B]">Day&apos;s P&amp;L</div>
          <div
            className={`text-xl font-light tabular-nums mt-1 ${getChangeColorClass(totals.dayPnl)}`}
          >
            {formatINR(totals.dayPnl, true)}{' '}
            <span className="text-xs">
              ({totals.dayPnlPct >= 0 ? '+' : ''}
              {totals.dayPnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>
        <div>
          <div className="text-xs text-[#9B9B9B]">Total P&amp;L</div>
          <div
            className={`text-xl font-light tabular-nums mt-1 ${getChangeColorClass(totals.totalPnl)}`}
          >
            {formatINR(totals.totalPnl, true)}{' '}
            <span className="text-xs">
              ({totals.totalPnlPct >= 0 ? '+' : ''}
              {totals.totalPnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="py-10 px-4 text-center border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded text-xs text-[#9B9B9B]">
          {searchQuery.trim()
            ? 'No holdings match your search.'
            : activeTab === 'mutual_funds'
              ? 'No mutual fund holdings in your portfolio.'
              : 'No CNC delivery holdings yet. Buy any equity with product type CNC to track long-term simulated holdings.'}
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
          <table className="w-full text-[13px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[12px] text-[#9B9B9B]">
                <th className="py-2.5 px-3 font-normal">Instrument</th>
                <th className="py-2.5 px-3 font-normal text-right">
                  {activeTab === 'mutual_funds' ? 'Units' : 'Qty.'}
                </th>
                <th className="py-2.5 px-3 font-normal text-right">
                  {activeTab === 'mutual_funds' ? 'Avg. NAV' : 'Avg. cost'}
                </th>
                <th className="py-2.5 px-3 font-normal text-right">
                  {activeTab === 'mutual_funds' ? 'NAV' : 'LTP'}
                </th>
                <th className="py-2.5 px-3 font-normal text-right">Cur. val</th>
                <th className="py-2.5 px-3 font-normal text-right">P&amp;L</th>
                <th className="py-2.5 px-3 font-normal text-right">Net chg.</th>
                <th className="py-2.5 px-3 font-normal text-right">Day chg.</th>
                <th className="py-2.5 px-3 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
              {filteredRows.map((row) => (
                <tr
                  key={row.key}
                  className="hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E] transition-colors"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      {row.type === 'equity' && row.token !== undefined ? (
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
                      {row.type === 'mutual_funds' && activeTab === 'all' && (
                        <span className="text-[10px] px-1 py-0.2 bg-[#F3F4F6] dark:bg-[#262626] text-[#9B9B9B] rounded">
                          MF
                        </span>
                      )}
                      {row.t1Quantity && row.t1Quantity > 0 ? (
                        <span className="text-[10px] text-[#9B9B9B]">
                          T1:{row.t1Quantity}
                        </span>
                      ) : null}
                    </div>
                    {row.subtitle && (
                      <div className="text-[11px] text-[#9B9B9B] mt-0.5">
                        {row.subtitle}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {row.type === 'mutual_funds'
                      ? row.quantity.toFixed(2)
                      : row.quantity}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {formatPrice(row.averagePrice)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-medium">
                    {formatPrice(row.ltp)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {formatPrice(row.currentValue)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right tabular-nums font-medium ${getChangeColorClass(row.pnl)}`}
                  >
                    {formatPrice(row.pnl)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right tabular-nums ${getChangeColorClass(row.pnlPercent)}`}
                  >
                    {row.pnlPercent >= 0 ? '+' : ''}
                    {row.pnlPercent.toFixed(2)}%
                  </td>
                  <td
                    className={`py-3 px-3 text-right tabular-nums ${getChangeColorClass(row.dayChangePercent)}`}
                  >
                    {row.dayChangePercent >= 0 ? '+' : ''}
                    {row.dayChangePercent.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-right">
                    {row.type === 'equity' && row.token !== undefined ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenOrderModal(row.token!, 'BUY')}
                          aria-label={`Buy more ${row.symbol}`}
                          className="px-2 py-0.5 text-[11px] font-semibold bg-[#4184F3] text-white rounded hover:bg-[#3367D6] cursor-pointer"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenOrderModal(row.token!, 'SELL')}
                          aria-label={`Sell ${row.symbol} holding`}
                          className="px-2 py-0.5 text-[11px] font-semibold bg-[#FF5722] text-white rounded hover:bg-[#E64A19] cursor-pointer"
                        >
                          Exit
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleInvestMoreMf(row.key)}
                          aria-label={`Invest more in ${row.symbol}`}
                          className="px-2 py-0.5 text-[11px] font-semibold bg-[#4184F3] text-white rounded hover:bg-[#3367D6] cursor-pointer"
                        >
                          Invest
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRedeemMf(row.key)}
                          aria-label={`Redeem ${row.symbol}`}
                          className="px-2 py-0.5 text-[11px] font-semibold bg-[#FF5722] text-white rounded hover:bg-[#E64A19] cursor-pointer"
                        >
                          Redeem
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
