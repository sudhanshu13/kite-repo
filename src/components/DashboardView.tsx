import { useMemo } from 'react';
import { Activity, ArrowUpRight, Briefcase, Wallet } from 'lucide-react';
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
  const instrumentMap = useMemo(() => {
    const m = new Map<number, Instrument>();
    for (const i of instruments) m.set(i.token, i);
    return m;
  }, [instruments]);

  const holdingsSummary = useMemo(() => {
    let totalInvestment = 0;
    let currentValue = 0;
    let dayPnl = 0;
    for (const h of portfolio.holdings) {
      const m = computeHoldingMetrics(h, quotes[h.token]);
      totalInvestment += h.investedValue;
      currentValue += m.currentValue;
      dayPnl += m.dayPnl;
    }
    const totalPnl = currentValue - totalInvestment;
    const totalPnlPct = totalInvestment > 0 ? (totalPnl / totalInvestment) * 100 : 0;
    return { totalInvestment, currentValue, totalPnl, totalPnlPct, dayPnl };
  }, [portfolio.holdings, quotes]);

  const positionsMtm = useMemo(() => {
    let total = 0;
    let openCount = 0;
    for (const p of portfolio.positions) {
      const m = computePositionMetrics(p, quotes[p.token]);
      total += m.mtmPnl;
      if (m.isOpen) openCount++;
    }
    return { total, openCount };
  }, [portfolio.positions, quotes]);

  const activeWatchTokens = portfolio.watchlists[activeWatchlistId] ?? [];

  return (
    <div className="p-5 lg:p-8 max-w-6xl space-y-8">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#EEEEEE] dark:border-[#282828]">
        <div>
          <h1 className="text-[22px] font-normal text-[#444444] dark:text-[#E0E0E0] tracking-tight">
            Hi, {portfolio.userName.split(' ')[0]}
          </h1>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => onNavigate('technicals')}
            className="inline-flex items-center gap-1.5 text-[#4184F3] hover:underline font-normal cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Technicals</span>
          </button>
          <span className="text-[#E0E0E0] dark:text-[#333333]">·</span>
          <button
            type="button"
            onClick={() => onNavigate('positions')}
            className="inline-flex items-center gap-1.5 text-[#4184F3] hover:underline font-normal cursor-pointer"
          >
            <span>Positions ({positionsMtm.openCount})</span>
          </button>
          {isAdmin && (
            <>
              <span className="text-[#E0E0E0] dark:text-[#333333]">·</span>
              <button
                type="button"
                onClick={() => onNavigate('funds')}
                className="inline-flex items-center gap-1.5 text-[#4184F3] hover:underline font-normal cursor-pointer"
              >
                <span>Funds &amp; API</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <span className="text-[#E0E0E0] dark:text-[#333333]">·</span>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="inline-flex items-center gap-1.5 text-[#FF5722] hover:underline font-medium cursor-pointer"
              >
                <span>Admin</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Equity Margin & Holdings Summary — Kite Signature 2-Column Open Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Equity Margin */}
        <section aria-labelledby="dash-equity-heading" className="space-y-4">
          <div className="flex items-center gap-2 text-[15px] font-normal text-[#444444] dark:text-[#E0E0E0]">
            <Wallet className="w-4 h-4 text-[#9B9B9B]" />
            <h2 id="dash-equity-heading">Equity</h2>
          </div>

          <div className="flex items-start gap-8 pt-1">
            <div>
              <div className="text-[32px] leading-tight font-light tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                {formatINR(portfolio.availableCash)}
              </div>
              <div className="text-xs text-[#9B9B9B] mt-1">Margin available</div>
            </div>

            <div className="space-y-2 text-xs border-l border-[#EEEEEE] dark:border-[#282828] pl-6">
              <div className="flex items-center justify-between gap-6">
                <span className="text-[#9B9B9B]">Margins used</span>
                <span className="tabular-nums font-normal text-[#444444] dark:text-[#E0E0E0]">
                  {formatINR(portfolio.usedMargin)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[#9B9B9B]">Opening balance</span>
                <span className="tabular-nums font-normal text-[#444444] dark:text-[#E0E0E0]">
                  {formatINR(portfolio.openingBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[#9B9B9B]">
                  Positions M2M ({positionsMtm.openCount})
                </span>
                <span
                  className={`tabular-nums font-medium ${getChangeColorClass(positionsMtm.total)}`}
                >
                  {formatINR(positionsMtm.total, true)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Holdings Summary */}
        <section aria-labelledby="dash-holdings-heading" className="space-y-4">
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

          <div className="flex items-start gap-8 pt-1">
            <div>
              <div
                className={`text-[32px] leading-tight font-light tabular-nums ${getChangeColorClass(holdingsSummary.totalPnl)}`}
              >
                {formatINR(holdingsSummary.totalPnl, true)}
              </div>
              <div className="text-xs text-[#9B9B9B] mt-1 tabular-nums">
                P&amp;L ({holdingsSummary.totalPnlPct >= 0 ? '+' : ''}
                {holdingsSummary.totalPnlPct.toFixed(2)}%)
              </div>
            </div>

            <div className="space-y-2 text-xs border-l border-[#EEEEEE] dark:border-[#282828] pl-6">
              <div className="flex items-center justify-between gap-6">
                <span className="text-[#9B9B9B]">Current value</span>
                <span className="tabular-nums font-normal text-[#444444] dark:text-[#E0E0E0]">
                  {formatINR(holdingsSummary.currentValue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[#9B9B9B]">Investment</span>
                <span className="tabular-nums font-normal text-[#444444] dark:text-[#E0E0E0]">
                  {formatINR(holdingsSummary.totalInvestment)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-[#9B9B9B]">Day&apos;s P&amp;L</span>
                <span
                  className={`tabular-nums font-medium ${getChangeColorClass(holdingsSummary.dayPnl)}`}
                >
                  {formatINR(holdingsSummary.dayPnl, true)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Active Positions Snapshot */}
      {portfolio.positions.length > 0 && (
        <section
          aria-labelledby="dash-positions-heading"
          className="pt-5 border-t border-[#EEEEEE] dark:border-[#282828]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2
                id="dash-positions-heading"
                className="text-[15px] font-normal text-[#444444] dark:text-[#E0E0E0]"
              >
                Positions ({portfolio.positions.length})
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

      {/* Watchlist Real-Time Price & Technical Pulse Table (No Charts) */}
      <section aria-labelledby="dash-pulse-heading" className="pt-5 border-t border-[#EEEEEE] dark:border-[#282828]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2
              id="dash-pulse-heading"
              className="text-[15px] font-normal text-[#444444] dark:text-[#E0E0E0]"
            >
              Watchlist {activeWatchlistId} · Live Quotes &amp; Technicals
            </h2>
          </div>
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
