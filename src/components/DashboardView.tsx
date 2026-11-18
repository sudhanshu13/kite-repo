import { useMemo, useState } from 'react';
import { Activity, Briefcase, PieChart } from 'lucide-react';
import { computeHoldingMetrics, computePositionMetrics } from '../../shared/portfolioMath.ts';
import type {
  Instrument,
  MarketQuote,
  OrderSide,
  PortfolioState,
  WatchlistSignalsMap,
} from '../../shared/types.ts';
import {
  formatINR,
  formatPrice,
  formatSigned,
  getChangeColorClass,
  getSignalTextClass,
} from '../utils/format.ts';
import type { NavTab } from './TopBar.tsx';

interface DashboardViewProps {
  portfolio: PortfolioState;
  instruments: Instrument[];
  quotes: Record<number, MarketQuote>;
  signals: WatchlistSignalsMap;
  activeWatchlistId: string;
  isAdmin: boolean;
  onNavigate: (tab: NavTab) => void;
  onSelectSymbolForTechnicals: (token: number) => void;
  onOpenOrderModal: (token: number, side: OrderSide) => void;
}

const ALLOCATION_COLORS = [
  '#4184F3',
  '#4CAF50',
  '#FF9800',
  '#7E57C2',
  '#00ACC1',
  '#FF5722',
  '#EC407A',
];

type AllocationMode = 'current' | 'investment';

export function DashboardView({
  portfolio,
  instruments,
  quotes,
  signals,
  activeWatchlistId,
  isAdmin,
  onNavigate,
  onSelectSymbolForTechnicals,
  onOpenOrderModal,
}: DashboardViewProps) {
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('current');

  const instrumentMap = useMemo(() => {
    const m = new Map<number, Instrument>();
    for (const i of instruments) m.set(i.token, i);
    return m;
  }, [instruments]);

  const holdingsSummary = useMemo(() => {
    let totalInvestment = 0;
    let currentValue = 0;
    let dayPnl = 0;
    const rows = portfolio.holdings.map((h, idx) => {
      const m = computeHoldingMetrics(h, quotes[h.token]);
      totalInvestment += h.investedValue;
      currentValue += m.currentValue;
      dayPnl += m.dayPnl;
      return {
        token: h.token,
        symbol: h.symbol,
        investedValue: h.investedValue,
        currentValue: m.currentValue,
        color: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length],
      };
    });
    const totalPnl = currentValue - totalInvestment;
    const totalPnlPct = totalInvestment > 0 ? (totalPnl / totalInvestment) * 100 : 0;

    const totalBase = allocationMode === 'current' ? currentValue : totalInvestment;
    const allocation = rows
      .map((row) => {
        const value = allocationMode === 'current' ? row.currentValue : row.investedValue;
        const pct = totalBase > 0 ? (value / totalBase) * 100 : 0;
        return { ...row, value, pct };
      })
      .sort((a, b) => b.value - a.value);

    return { totalInvestment, currentValue, totalPnl, totalPnlPct, dayPnl, allocation };
  }, [portfolio.holdings, quotes, allocationMode]);

  const positionsMtm = useMemo(() => {
    let total = 0;
    let realized = 0;
    let openCount = 0;
    for (const p of portfolio.positions) {
      const m = computePositionMetrics(p, quotes[p.token]);
      total += m.mtmPnl;
      realized += p.realizedPnl;
      if (m.isOpen) openCount++;
    }
    return { total, realized, openCount };
  }, [portfolio.positions, quotes]);

  const activeWatchTokens = portfolio.watchlists[activeWatchlistId] ?? [];

  const signalCounts = useMemo(() => {
    let buy = 0;
    let sell = 0;
    for (const token of activeWatchTokens) {
      const s = signals[token];
      if (s === 'Strong Buy' || s === 'Buy') buy++;
      else if (s === 'Strong Sell' || s === 'Sell') sell++;
    }
    return { buy, sell };
  }, [activeWatchTokens, signals]);

  return (
    <div className="p-5 lg:p-9 max-w-[1100px] space-y-8">
      {/* Greeting Header — Clean Kite Style */}
      <div className="pb-4 border-b border-[#EEEEEE] dark:border-[#282828]">
        <h1 className="text-[24px] font-normal text-[#444444] dark:text-[#E0E0E0] tracking-tight">
          Hi, {portfolio.userName.split(' ')[0]}
        </h1>
      </div>

      {/* Row 1: Equity & Positions (Open 2-Column Kite Overview) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pb-8 border-b border-[#EEEEEE] dark:border-[#282828]">
        {/* Left: Equity */}
        <section aria-labelledby="dash-equity-heading" className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[15px] font-normal text-[#444444] dark:text-[#E0E0E0]">
              <PieChart className="w-4 h-4 text-[#9B9B9B]" />
              <h2 id="dash-equity-heading">Equity</h2>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => onNavigate('funds')}
                  className="text-[#4184F3] hover:underline cursor-pointer"
                >
                  Funds &amp; API
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="text-[#FF5722] hover:underline font-medium cursor-pointer"
                >
                  Admin
                </button>
              </div>
            )}
          </div>

          <div className="flex items-start gap-8">
            <div className="min-w-[140px]">
              <div className="text-[36px] leading-[1.1] font-light tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                {formatINR(portfolio.availableCash)}
              </div>
              <div className="text-xs text-[#9B9B9B] mt-2">Margin available</div>
            </div>

            <div className="space-y-2 text-xs border-l border-[#EEEEEE] dark:border-[#282828] pl-7 flex-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#9B9B9B]">Margins used</span>
                <span className="tabular-nums font-normal text-[#444444] dark:text-[#E0E0E0]">
                  {formatINR(portfolio.usedMargin)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#9B9B9B]">Opening balance</span>
                <span className="tabular-nums font-normal text-[#444444] dark:text-[#E0E0E0]">
                  {formatINR(portfolio.openingBalance)}
                </span>
              </div>
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => onNavigate('technicals')}
                  className="text-[#4184F3] hover:underline cursor-pointer"
                >
                  View technicals
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right: Positions & Day M2M */}
        <section aria-labelledby="dash-m2m-heading" className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[15px] font-normal text-[#444444] dark:text-[#E0E0E0]">
              <Activity className="w-4 h-4 text-[#9B9B9B]" />
              <h2 id="dash-m2m-heading">Positions ({portfolio.positions.length})</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('positions')}
              className="text-xs text-[#4184F3] hover:underline cursor-pointer"
            >
              Manage positions
            </button>
          </div>

          <div className="flex items-start gap-8">
            <div className="min-w-[140px]">
              <div
                className={`text-[36px] leading-[1.1] font-light tabular-nums ${
                  portfolio.positions.length === 0
                    ? 'text-[#444444] dark:text-[#E0E0E0]'
                    : getChangeColorClass(positionsMtm.total)
                }`}
              >
                {formatINR(positionsMtm.total, portfolio.positions.length > 0)}
              </div>
              <div className="text-xs text-[#9B9B9B] mt-2">Day&apos;s M2M</div>
            </div>

            <div className="space-y-2 text-xs border-l border-[#EEEEEE] dark:border-[#282828] pl-7 flex-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#9B9B9B]">Open positions</span>
                <span className="tabular-nums font-normal text-[#444444] dark:text-[#E0E0E0]">
                  {positionsMtm.openCount}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#9B9B9B]">Realized P&amp;L</span>
                <span
                  className={`tabular-nums font-normal ${getChangeColorClass(positionsMtm.realized)}`}
                >
                  {formatINR(positionsMtm.realized, positionsMtm.realized !== 0)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#9B9B9B]">Watchlist signals</span>
                <button
                  type="button"
                  onClick={() => onNavigate('technicals')}
                  className="tabular-nums text-[#4184F3] hover:underline cursor-pointer"
                >
                  {signalCounts.buy} Buy · {signalCounts.sell} Sell
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: Signature Kite Full-Width Holdings Section + Stacked Allocation Bar */}
      <section
        aria-labelledby="dash-holdings-heading"
        className="space-y-5 pb-8 border-b border-[#EEEEEE] dark:border-[#282828]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[15px] font-normal text-[#444444] dark:text-[#E0E0E0]">
            <Briefcase className="w-4 h-4 text-[#9B9B9B]" />
            <h2 id="dash-holdings-heading">
              Holdings ({portfolio.holdings.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('holdings')}
            className="text-xs text-[#4184F3] hover:underline cursor-pointer"
          >
            View all
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Holdings P&L + Breakdown */}
          <div className="lg:col-span-5 flex items-start gap-8">
            <div className="min-w-[140px]">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span
                  className={`text-[36px] leading-[1.1] font-light tabular-nums ${getChangeColorClass(holdingsSummary.totalPnl)}`}
                >
                  {formatINR(holdingsSummary.totalPnl, true)}
                </span>
                <span
                  className={`text-xs font-normal tabular-nums ${getChangeColorClass(holdingsSummary.totalPnl)}`}
                >
                  {holdingsSummary.totalPnlPct >= 0 ? '+' : ''}
                  {holdingsSummary.totalPnlPct.toFixed(2)}%
                </span>
              </div>
              <div className="text-xs text-[#9B9B9B] mt-2">P&amp;L</div>
            </div>

            <div className="space-y-2 text-xs border-l border-[#EEEEEE] dark:border-[#282828] pl-7 flex-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#9B9B9B]">Current value</span>
                <span className="tabular-nums font-normal text-[#444444] dark:text-[#E0E0E0]">
                  {formatINR(holdingsSummary.currentValue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#9B9B9B]">Investment</span>
                <span className="tabular-nums font-normal text-[#444444] dark:text-[#E0E0E0]">
                  {formatINR(holdingsSummary.totalInvestment)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#9B9B9B]">Day&apos;s P&amp;L</span>
                <span
                  className={`tabular-nums font-medium ${getChangeColorClass(holdingsSummary.dayPnl)}`}
                >
                  {formatINR(holdingsSummary.dayPnl, true)}
                </span>
              </div>
            </div>
          </div>

          {/* Horizontal Stacked Allocation Bar (Portfolio Distribution, Not a Price Chart) */}
          <div className="lg:col-span-7 space-y-3">
            {holdingsSummary.allocation.length === 0 ? (
              <div className="text-xs text-[#9B9B9B] py-4">
                No CNC equity holdings yet. Buy stocks via CNC from the Marketwatch to build your portfolio.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#9B9B9B] tabular-nums">
                    Portfolio weight ·{' '}
                    {formatINR(
                      allocationMode === 'current'
                        ? holdingsSummary.currentValue
                        : holdingsSummary.totalInvestment,
                    )}
                  </span>

                  <div
                    role="group"
                    aria-label="Allocation valuation mode"
                    className="inline-flex border border-[#E5E5E5] dark:border-[#333333] rounded overflow-hidden text-[11px]"
                  >
                    <button
                      type="button"
                      onClick={() => setAllocationMode('current')}
                      className={`px-2.5 py-1 transition-colors cursor-pointer ${
                        allocationMode === 'current'
                          ? 'bg-[#F5F7FA] dark:bg-[#242424] text-[#4184F3] font-medium'
                          : 'text-[#666666] dark:text-[#A0A0A0] hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E]'
                      }`}
                    >
                      Current value
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllocationMode('investment')}
                      className={`px-2.5 py-1 border-l border-[#E5E5E5] dark:border-[#333333] transition-colors cursor-pointer ${
                        allocationMode === 'investment'
                          ? 'bg-[#F5F7FA] dark:bg-[#242424] text-[#4184F3] font-medium'
                          : 'text-[#666666] dark:text-[#A0A0A0] hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E]'
                      }`}
                    >
                      Investment value
                    </button>
                  </div>
                </div>

                {/* Flat Proportional Stacked Bar */}
                <div
                  className="h-7 w-full flex overflow-hidden rounded-[2px] bg-[#F4F4F4] dark:bg-[#222222]"
                  role="img"
                  aria-label="Holdings allocation breakdown bar"
                >
                  {holdingsSummary.allocation.map((item) => (
                    <div
                      key={item.token}
                      style={{
                        width: `${Math.max(item.pct, 0)}%`,
                        backgroundColor: item.color,
                      }}
                      title={`${item.symbol}: ${item.pct.toFixed(1)}% (${formatINR(item.value)})`}
                      className="h-full border-r border-white/60 dark:border-[#121212]/60 last:border-r-0 transition-[width] duration-300"
                    />
                  ))}
                </div>

                {/* Unboxed Symbol Weight Breakdown */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px]">
                  {holdingsSummary.allocation.map((item) => (
                    <button
                      key={item.token}
                      type="button"
                      onClick={() => onSelectSymbolForTechnicals(item.token)}
                      className="inline-flex items-center gap-1.5 text-[#444444] dark:text-[#CCCCCC] hover:text-[#4184F3] cursor-pointer"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium">{item.symbol}</span>
                      <span className="tabular-nums text-[#9B9B9B]">
                        {item.pct.toFixed(1)}%
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Active Positions Snapshot */}
      {portfolio.positions.length > 0 && (
        <section aria-labelledby="dash-positions-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2
                id="dash-positions-heading"
                className="text-[15px] font-normal text-[#444444] dark:text-[#E0E0E0]"
              >
                Open Positions ({portfolio.positions.length})
              </h2>
              <span
                className={`text-xs font-medium tabular-nums ${getChangeColorClass(positionsMtm.total)}`}
              >
                M2M {formatINR(positionsMtm.total, true)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('positions')}
              className="text-xs text-[#4184F3] hover:underline cursor-pointer"
            >
              Manage positions
            </button>
          </div>

          <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                  <th className="py-2 px-3 font-normal">Product</th>
                  <th className="py-2 px-3 font-normal">Instrument</th>
                  <th className="py-2 px-3 font-normal text-right">Qty.</th>
                  <th className="py-2 px-3 font-normal text-right">Avg.</th>
                  <th className="py-2 px-3 font-normal text-right">LTP</th>
                  <th className="py-2 px-3 font-normal text-right">P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                {portfolio.positions.map((pos) => {
                  const m = computePositionMetrics(pos, quotes[pos.token]);
                  const avg =
                    pos.quantity >= 0
                      ? pos.averageBuyPrice || pos.averageSellPrice
                      : pos.averageSellPrice || pos.averageBuyPrice;
                  return (
                    <tr
                      key={pos.id}
                      className="hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E]"
                    >
                      <td className="py-2.5 px-3 text-[11px] text-[#666666] dark:text-[#A0A0A0]">
                        {pos.product}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => onSelectSymbolForTechnicals(pos.token)}
                          className="text-[#444444] dark:text-[#E0E0E0] hover:text-[#4184F3] cursor-pointer"
                        >
                          {pos.symbol}
                        </button>
                        <span className="ml-1.5 text-[10px] text-[#9B9B9B] uppercase">
                          {pos.exchange}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                          pos.quantity > 0
                            ? 'text-[#4184F3]'
                            : pos.quantity < 0
                              ? 'text-[#FF5722]'
                              : 'text-[#9B9B9B]'
                        }`}
                      >
                        {pos.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                        {formatPrice(avg)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                        {formatPrice(m.ltp)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-medium ${getChangeColorClass(m.mtmPnl)}`}
                      >
                        {formatINR(m.mtmPnl, true)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Watchlist Real-Time Price & Technical Pulse Table (No Price Charts) */}
      <section aria-labelledby="dash-pulse-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            id="dash-pulse-heading"
            className="text-[15px] font-normal text-[#444444] dark:text-[#E0E0E0]"
          >
            Watchlist {activeWatchlistId} · Live Quotes &amp; Technicals
          </h2>
          <span className="text-xs tabular-nums text-[#9B9B9B]">
            {activeWatchTokens.length} instruments
          </span>
        </div>

        <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                <th className="py-2.5 px-3 font-normal">Instrument</th>
                <th className="py-2.5 px-3 font-normal text-right">LTP</th>
                <th className="py-2.5 px-3 font-normal text-right">Change</th>
                <th className="py-2.5 px-3 font-normal text-right hidden sm:table-cell">Day Range</th>
                <th className="py-2.5 px-3 font-normal text-right hidden md:table-cell">Volume</th>
                <th className="py-2.5 px-3 font-normal text-right">Technicals</th>
                <th className="py-2.5 px-3 font-normal text-right">Trade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
              {activeWatchTokens.map((token) => {
                const inst = instrumentMap.get(token);
                const q = quotes[token];
                if (!inst || !q) return null;
                const signal = signals[token] ?? 'Neutral';
                return (
                  <tr
                    key={token}
                    className="hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E] transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => onSelectSymbolForTechnicals(token)}
                        className="text-left hover:text-[#4184F3] cursor-pointer"
                      >
                        <span className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                          {inst.symbol}
                        </span>
                        <span className="ml-1.5 text-[10px] text-[#9B9B9B]">
                          {inst.exchange}
                        </span>
                      </button>
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right tabular-nums font-medium ${getChangeColorClass(q.change)}`}
                    >
                      {formatPrice(q.ltp)}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right tabular-nums ${getChangeColorClass(q.change)}`}
                    >
                      {formatSigned(q.change)} ({q.changePercent >= 0 ? '+' : ''}
                      {q.changePercent.toFixed(2)}%)
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#666666] dark:text-[#A0A0A0] hidden sm:table-cell">
                      {formatPrice(q.low)} – {formatPrice(q.high)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#666666] dark:text-[#A0A0A0] hidden md:table-cell">
                      {q.volume > 0 ? q.volume.toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectSymbolForTechnicals(token)}
                        className={`font-medium hover:underline cursor-pointer ${getSignalTextClass(signal)}`}
                      >
                        {signal}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {inst.isIndex ? (
                        <span className="text-[#9B9B9B]">Index</span>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenOrderModal(token, 'BUY')}
                            aria-label={`Buy ${inst.symbol} from dashboard`}
                            className="px-2 py-0.5 text-[11px] font-semibold bg-[#4184F3] hover:bg-[#3367D6] text-white rounded cursor-pointer"
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenOrderModal(token, 'SELL')}
                            aria-label={`Sell ${inst.symbol} from dashboard`}
                            className="px-2 py-0.5 text-[11px] font-semibold bg-[#FF5722] hover:bg-[#E64A19] text-white rounded cursor-pointer"
                          >
                            S
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

