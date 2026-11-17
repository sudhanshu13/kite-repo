import { useMemo } from 'react';
import { computeHoldingMetrics } from '../../shared/portfolioMath.ts';
import type { Holding, MarketQuote, OrderSide } from '../../shared/types.ts';
import { formatINR, formatPrice, getChangeColorClass } from '../utils/format.ts';

interface HoldingsViewProps {
  holdings: Holding[];
  quotes: Record<number, MarketQuote>;
  onOpenOrderModal: (token: number, side: OrderSide) => void;
  onSelectSymbolForTechnicals: (token: number) => void;
}

export function HoldingsView({
  holdings,
  quotes,
  onOpenOrderModal,
  onSelectSymbolForTechnicals,
}: HoldingsViewProps) {
  const rows = useMemo(
    () =>
      holdings.map((h) => ({
        holding: h,
        metrics: computeHoldingMetrics(h, quotes[h.token]),
      })),
    [holdings, quotes],
  );

  const totals = useMemo(() => {
    let investment = 0;
    let current = 0;
    let dayPnl = 0;
    for (const r of rows) {
      investment += r.holding.investedValue;
      current += r.metrics.currentValue;
      dayPnl += r.metrics.dayPnl;
    }
    const totalPnl = current - investment;
    const totalPnlPct = investment > 0 ? (totalPnl / investment) * 100 : 0;
    const dayPnlPct = current > 0 ? (dayPnl / (current - dayPnl || current)) * 100 : 0;
    return { investment, current, totalPnl, totalPnlPct, dayPnl, dayPnlPct };
  }, [rows]);

  return (
    <div className="p-5 lg:p-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-[#EEEEEE] dark:border-[#282828]">
        <h1 className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0]">
          Holdings ({holdings.length})
        </h1>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-4 border-b border-[#EEEEEE] dark:border-[#282828]">
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

      {rows.length === 0 ? (
        <div className="py-10 px-4 text-center border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded text-xs text-[#9B9B9B]">
          No CNC delivery holdings yet. Buy any equity with product type CNC to track long-term simulated holdings.
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
          <table className="w-full text-[13px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[12px] text-[#9B9B9B]">
                <th className="py-2.5 px-3 font-normal">Instrument</th>
                <th className="py-2.5 px-3 font-normal text-right">Qty.</th>
                <th className="py-2.5 px-3 font-normal text-right">Avg. cost</th>
                <th className="py-2.5 px-3 font-normal text-right">LTP</th>
                <th className="py-2.5 px-3 font-normal text-right">Cur. val</th>
                <th className="py-2.5 px-3 font-normal text-right">P&amp;L</th>
                <th className="py-2.5 px-3 font-normal text-right">Net chg.</th>
                <th className="py-2.5 px-3 font-normal text-right">Day chg.</th>
                <th className="py-2.5 px-3 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
              {rows.map(({ holding, metrics }) => (
                <tr
                  key={holding.token}
                  className="hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E] transition-colors"
                >
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => onSelectSymbolForTechnicals(holding.token)}
                      className="font-normal text-[#444444] dark:text-[#E0E0E0] hover:text-[#4184F3] cursor-pointer"
                    >
                      {holding.symbol}
                    </button>
                    {holding.t1Quantity > 0 && (
                      <span className="ml-1.5 text-[10px] text-[#9B9B9B]">
                        T1:{holding.t1Quantity}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {holding.quantity}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {formatPrice(holding.averagePrice)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-medium">
                    {formatPrice(metrics.ltp)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums">
                    {formatPrice(metrics.currentValue)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right tabular-nums font-medium ${getChangeColorClass(metrics.pnl)}`}
                  >
                    {formatPrice(metrics.pnl)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right tabular-nums ${getChangeColorClass(metrics.pnlPercent)}`}
                  >
                    {metrics.pnlPercent >= 0 ? '+' : ''}
                    {metrics.pnlPercent.toFixed(2)}%
                  </td>
                  <td
                    className={`py-3 px-3 text-right tabular-nums ${getChangeColorClass(metrics.dayChangePercent)}`}
                  >
                    {metrics.dayChangePercent >= 0 ? '+' : ''}
                    {metrics.dayChangePercent.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpenOrderModal(holding.token, 'BUY')}
                        aria-label={`Buy more ${holding.symbol}`}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-[#4184F3] text-white rounded hover:bg-[#3367D6] cursor-pointer"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenOrderModal(holding.token, 'SELL')}
                        aria-label={`Sell ${holding.symbol} holding`}
                        className="px-2 py-0.5 text-[11px] font-semibold bg-[#FF5722] text-white rounded hover:bg-[#E64A19] cursor-pointer"
                      >
                        Exit
                      </button>
                    </div>
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
