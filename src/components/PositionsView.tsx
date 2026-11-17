import { useMemo, useState } from 'react';
import { computePositionMetrics } from '../../shared/portfolioMath.ts';
import type { MarketQuote, Position } from '../../shared/types.ts';
import { formatINR, formatPrice, getChangeColorClass } from '../utils/format.ts';

interface PositionsViewProps {
  positions: Position[];
  quotes: Record<number, MarketQuote>;
  onExitPosition: (positionId: string) => Promise<void>;
  onConvertPosition: (positionId: string) => Promise<void>;
  onSelectSymbolForTechnicals: (token: number) => void;
  onGoToDashboard: () => void;
}

export function PositionsView({
  positions,
  quotes,
  onExitPosition,
  onConvertPosition,
  onSelectSymbolForTechnicals,
  onGoToDashboard,
}: PositionsViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      positions.map((pos) => {
        const metrics = computePositionMetrics(pos, quotes[pos.token]);
        const avgPrice =
          pos.quantity >= 0
            ? pos.averageBuyPrice || pos.averageSellPrice
            : pos.averageSellPrice || pos.averageBuyPrice;
        const chgPct =
          avgPrice > 0 ? ((metrics.ltp - avgPrice) / avgPrice) * 100 : 0;
        const unrealizedPnl = metrics.mtmPnl - pos.realizedPnl;
        return { pos, metrics, avgPrice, chgPct, unrealizedPnl };
      }),
    [positions, quotes],
  );

  const summary = useMemo(() => {
    let totalPnl = 0;
    let realized = 0;
    let unrealized = 0;
    let openCount = 0;
    for (const r of rows) {
      totalPnl += r.metrics.mtmPnl;
      realized += r.pos.realizedPnl;
      unrealized += r.unrealizedPnl;
      if (r.metrics.isOpen) openCount++;
    }
    return { totalPnl, realized, unrealized, openCount };
  }, [rows]);

  async function handleExit(id: string) {
    setBusyId(id);
    try {
      await onExitPosition(id);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConvert(id: string) {
    setBusyId(id);
    try {
      await onConvertPosition(id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-5 lg:p-8 max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EEEEEE] dark:border-[#282828]">
        <h1 className="text-[18px] font-normal text-[#444444] dark:text-[#E0E0E0]">
          Positions ({positions.length})
        </h1>
        <div className="flex flex-wrap items-center gap-5 text-xs tabular-nums">
          <div>
            <span className="text-[#9B9B9B] mr-1.5">Open:</span>
            <span className="font-semibold text-[#444444] dark:text-[#E0E0E0]">
              {summary.openCount}
            </span>
          </div>
          <div>
            <span className="text-[#9B9B9B] mr-1.5">Realised:</span>
            <span className={`font-semibold ${getChangeColorClass(summary.realized)}`}>
              {formatINR(summary.realized, true)}
            </span>
          </div>
          <div>
            <span className="text-[#9B9B9B] mr-1.5">Total M2M:</span>
            <span className={`font-semibold text-sm ${getChangeColorClass(summary.totalPnl)}`}>
              {formatINR(summary.totalPnl, true)}
            </span>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 px-4 text-center border border-[#EEEEEE] dark:border-[#282828] bg-white dark:bg-[#181818] rounded space-y-3">
          <p className="text-sm text-[#444444] dark:text-[#E0E0E0]">
            You don&apos;t have any open or closed intraday/overnight positions today.
          </p>
          <p className="text-xs text-[#9B9B9B]">
            Place an <strong>MIS</strong> (Intraday) or <strong>NRML</strong> (Overnight F&amp;O) order from the Marketwatch to track live M2M P&amp;L here.
          </p>
          <button
            type="button"
            onClick={onGoToDashboard}
            className="inline-flex items-center px-4 py-2 text-xs font-semibold bg-[#4184F3] hover:bg-[#3367D6] text-white rounded cursor-pointer"
          >
            Back to Dashboard
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
          <table className="w-full text-[13px] text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[12px] text-[#9B9B9B]">
                <th className="py-2.5 px-3 font-normal">Product</th>
                <th className="py-2.5 px-3 font-normal">Instrument</th>
                <th className="py-2.5 px-3 font-normal text-right">Qty.</th>
                <th className="py-2.5 px-3 font-normal text-right">Avg.</th>
                <th className="py-2.5 px-3 font-normal text-right">LTP</th>
                <th className="py-2.5 px-3 font-normal text-right">P&amp;L</th>
                <th className="py-2.5 px-3 font-normal text-right hidden sm:table-cell">Chg.</th>
                <th className="py-2.5 px-3 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
              {rows.map(({ pos, metrics, avgPrice, chgPct }) => (
                <tr
                  key={pos.id}
                  className={`hover:bg-[#F9F9F9] dark:hover:bg-[#1E1E1E] transition-colors ${
                    !metrics.isOpen ? 'opacity-65' : ''
                  }`}
                >
                  <td className="py-3 px-3 text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0]">
                    <span className="px-1.5 py-0.5 rounded bg-[#F5F5F5] dark:bg-[#242424] text-[#666666] dark:text-[#B0B0B0]">
                      {pos.product}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => onSelectSymbolForTechnicals(pos.token)}
                      className="font-normal text-[#444444] dark:text-[#E0E0E0] hover:text-[#4184F3] cursor-pointer"
                    >
                      {pos.symbol}
                    </button>
                    <span className="ml-1.5 text-[10px] text-[#9B9B9B] uppercase">
                      {pos.exchange}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-3 text-right tabular-nums font-medium ${
                      pos.quantity > 0
                        ? 'text-[#4184F3]'
                        : pos.quantity < 0
                          ? 'text-[#FF5722]'
                          : 'text-[#9B9B9B]'
                    }`}
                  >
                    {pos.quantity}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                    {formatPrice(avgPrice)}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                    {formatPrice(metrics.ltp)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right tabular-nums font-medium ${getChangeColorClass(metrics.mtmPnl)}`}
                  >
                    {formatINR(metrics.mtmPnl, true)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right tabular-nums text-xs hidden sm:table-cell ${getChangeColorClass(
                      pos.quantity < 0 ? -chgPct : chgPct,
                    )}`}
                  >
                    {(pos.quantity < 0 ? -chgPct : chgPct) >= 0 ? '+' : ''}
                    {(pos.quantity < 0 ? -chgPct : chgPct).toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-right">
                    {metrics.isOpen ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === pos.id}
                          onClick={() => handleExit(pos.id)}
                          aria-label={`Square off ${pos.symbol} position`}
                          className="px-2.5 py-1 text-[11px] font-medium bg-[#FF5722] text-white rounded hover:bg-[#E64A19] cursor-pointer disabled:opacity-50"
                        >
                          Exit
                        </button>
                        {pos.product === 'MIS' && pos.quantity > 0 && (
                          <button
                            type="button"
                            disabled={busyId === pos.id}
                            onClick={() => handleConvert(pos.id)}
                            aria-label={`Convert ${pos.symbol} MIS to CNC`}
                            className="px-2.5 py-1 text-[11px] font-medium border border-[#4184F3] text-[#4184F3] rounded hover:bg-[#4184F3]/10 cursor-pointer disabled:opacity-50"
                          >
                            Convert
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#9B9B9B]">Closed</span>
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
