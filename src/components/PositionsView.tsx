import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowLeftRight,
  LogOut,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import { computePositionMetrics } from '../../shared/portfolioMath.ts';
import type { MarketQuote, OrderSide, Position } from '../../shared/types.ts';
import { formatINR, formatPrice, getChangeColorClass } from '../utils/format.ts';

interface PositionsViewProps {
  positions: Position[];
  quotes: Record<number, MarketQuote>;
  onOpenOrderModal: (token: number, side: OrderSide) => void;
  onExitPosition: (positionId: string) => Promise<void>;
  onConvertPosition: (positionId: string) => Promise<void>;
  onUpdatePosition: (
    positionId: string,
    quantity: number,
    averagePrice: number,
  ) => Promise<{ ok: boolean; error?: string }>;
  onDeletePosition: (positionId: string) => Promise<{ ok: boolean; error?: string }>;
  onSelectSymbolForTechnicals: (token: number) => void;
  onGoToDashboard: () => void;
}

interface PositionRowView {
  pos: Position;
  metrics: ReturnType<typeof computePositionMetrics>;
  avgPrice: number;
  chgPct: number;
  unrealizedPnl: number;
}

export function PositionsView({
  positions,
  quotes,
  onOpenOrderModal,
  onExitPosition,
  onConvertPosition,
  onUpdatePosition,
  onDeletePosition,
  onSelectSymbolForTechnicals,
  onGoToDashboard,
}: PositionsViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<{
    id: string;
    top: number;
    right: number;
    openUpward: boolean;
  } | null>(null);

  // Edit position modal state
  const [editingRow, setEditingRow] = useState<PositionRowView | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editAvg, setEditAvg] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!openMenu && !editingRow) return;
    function handleOutside(e: MouseEvent) {
      if (!openMenu) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-position-menu]')) return;
      setOpenMenu(null);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setEditingRow(null);
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
  }, [openMenu, editingRow]);

  const rows = useMemo<PositionRowView[]>(
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

  const activeMenuRow = useMemo(
    () => (openMenu ? rows.find((r) => r.pos.id === openMenu.id) ?? null : null),
    [openMenu, rows],
  );

  async function handleExit(id: string) {
    setOpenMenu(null);
    setBusyId(id);
    try {
      await onExitPosition(id);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConvert(id: string) {
    setOpenMenu(null);
    setBusyId(id);
    try {
      await onConvertPosition(id);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setOpenMenu(null);
    setBusyId(id);
    try {
      await onDeletePosition(id);
    } finally {
      setBusyId(null);
    }
  }

  function openEditModal(row: PositionRowView) {
    setOpenMenu(null);
    setEditingRow(row);
    setEditQty(String(row.pos.quantity));
    setEditAvg(row.avgPrice.toFixed(2));
    setEditError(null);
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingRow) return;
    setEditError(null);

    const qtyNum = Number(editQty);
    const avgNum = Number(editAvg);
    if (!Number.isInteger(qtyNum)) {
      setEditError('Quantity must be a valid whole number (positive for long, negative for short, 0 for closed).');
      return;
    }
    if (!Number.isFinite(avgNum) || avgNum <= 0) {
      setEditError('Average price must be greater than zero.');
      return;
    }

    setEditSaving(true);
    try {
      const res = await onUpdatePosition(editingRow.pos.id, qtyNum, avgNum);
      if (!res.ok) {
        setEditError(res.error || 'Could not update position.');
        return;
      }
      setEditingRow(null);
    } finally {
      setEditSaving(false);
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
              <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[12px] text-[#9B9B9B] dark:text-[#8C8C8C]">
                <th className="py-3 px-3 font-normal">Product</th>
                <th className="py-3 px-3 font-normal border-r border-[#F0F0F0] dark:border-[#262626] min-w-[180px]">
                  Instrument
                </th>
                <th className="py-3 px-3 font-normal text-right">Qty.</th>
                <th className="py-3 px-3 font-normal text-right">Avg.</th>
                <th className="py-3 px-3 font-normal text-right border-r border-[#F0F0F0] dark:border-[#262626]">
                  LTP
                </th>
                <th className="py-3 px-3 font-normal text-right bg-[#FAFAFA] dark:bg-[#191919]">
                  P&amp;L
                </th>
                <th className="py-3 px-3 pr-9 font-normal text-right whitespace-nowrap">
                  Chg.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#242424]">
              {rows.map((row) => {
                const { pos, metrics, avgPrice, chgPct } = row;
                const isMenuOpen = openMenu?.id === pos.id;
                const effectiveChg = pos.quantity < 0 ? -chgPct : chgPct;
                return (
                  <tr
                    key={pos.id}
                    className={`group hover:bg-[#FAFAFA] dark:hover:bg-[#1D1D1D] transition-colors ${
                      !metrics.isOpen ? 'opacity-65' : ''
                    }`}
                  >
                    <td className="py-3.5 px-3 text-[11px] font-medium text-[#666666] dark:text-[#A0A0A0]">
                      <span className="px-1.5 py-0.5 rounded-[3px] bg-[#F5F5F5] dark:bg-[#242424] text-[#666666] dark:text-[#B0B0B0]">
                        {pos.product}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 border-r border-[#F0F0F0] dark:border-[#262626]">
                      <button
                        type="button"
                        onClick={() => onSelectSymbolForTechnicals(pos.token)}
                        className="font-normal text-[#444444] dark:text-[#E0E0E0] hover:text-[#4184F3] cursor-pointer text-left"
                      >
                        {pos.symbol}
                      </button>
                      <span className="ml-1.5 text-[10px] text-[#9B9B9B] uppercase">
                        {pos.exchange}
                      </span>
                      {!metrics.isOpen && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#262626] text-[#9B9B9B]">
                          Closed
                        </span>
                      )}
                    </td>

                    <td
                      className={`py-3.5 px-3 text-right tabular-nums font-medium ${
                        pos.quantity > 0
                          ? 'text-[#4184F3]'
                          : pos.quantity < 0
                            ? 'text-[#FF5722]'
                            : 'text-[#9B9B9B]'
                      }`}
                    >
                      {pos.quantity}
                    </td>

                    <td className="py-3.5 px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                      {formatPrice(avgPrice)}
                    </td>

                    <td className="py-3.5 px-3 text-right tabular-nums text-[#444444] dark:text-[#E0E0E0] border-r border-[#F0F0F0] dark:border-[#262626]">
                      {formatPrice(metrics.ltp)}
                    </td>

                    <td
                      className={`py-3.5 px-3 text-right tabular-nums bg-[#FAFAFA] dark:bg-[#191919] ${getChangeColorClass(metrics.mtmPnl)}`}
                    >
                      {formatINR(metrics.mtmPnl, true)}
                    </td>

                    <td className="py-3.5 px-3 pr-9 text-right tabular-nums text-[12px] relative">
                      <span className={getChangeColorClass(effectiveChg)}>
                        {effectiveChg >= 0 ? '+' : ''}
                        {effectiveChg.toFixed(2)}%
                      </span>

                      {/* Three-Dot Action Button */}
                      <div
                        data-position-menu
                        className={`absolute right-1 top-1/2 -translate-y-1/2 ${
                          isMenuOpen
                            ? 'opacity-100'
                            : 'opacity-40 group-hover:opacity-100 group-focus-within:opacity-100'
                        } transition-opacity`}
                      >
                        <button
                          type="button"
                          disabled={busyId === pos.id}
                          aria-label={`Actions for ${pos.symbol} ${pos.product}`}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          onClick={(e) => {
                            if (isMenuOpen) {
                              setOpenMenu(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const openUpward = window.innerHeight - rect.bottom < 260;
                            setOpenMenu({
                              id: pos.id,
                              top: openUpward ? rect.top - 4 : rect.bottom + 4,
                              right: Math.max(8, window.innerWidth - rect.right),
                              openUpward,
                            });
                          }}
                          className={`w-7 h-7 rounded-[3px] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
                            isMenuOpen
                              ? 'bg-[#EBEBEB] dark:bg-[#2E2E2E] text-[#222222] dark:text-white'
                              : 'hover:bg-[#EFEFEF] dark:hover:bg-[#2A2A2A] text-[#666666] dark:text-[#A0A0A0]'
                          }`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t border-[#EEEEEE] dark:border-[#282828] font-medium text-[13px] tabular-nums">
                <td colSpan={4} className="py-3.5 px-3" />
                <td className="py-3.5 px-3 text-right text-[#444444] dark:text-[#E0E0E0]">
                  Total
                </td>
                <td
                  className={`py-3.5 px-3 text-right bg-[#FAFAFA] dark:bg-[#191919] ${getChangeColorClass(summary.totalPnl)}`}
                >
                  {formatINR(summary.totalPnl, true)}
                </td>
                <td className="py-3.5 px-3 pr-9" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Floating Three-Dot Action Menu (rendered outside overflow-x-auto table) */}
      {openMenu && activeMenuRow && (
        <div
          data-position-menu
          role="menu"
          aria-label={`${activeMenuRow.pos.symbol} ${activeMenuRow.pos.product} options`}
          style={{
            top: openMenu.top,
            right: openMenu.right,
          }}
          className={`fixed z-50 w-44 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#333333] rounded-[4px] shadow-lg py-1 text-left text-[12px] ${
            openMenu.openUpward ? '-translate-y-full' : ''
          }`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpenMenu(null);
              onOpenOrderModal(activeMenuRow.pos.token, 'BUY');
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
              onOpenOrderModal(activeMenuRow.pos.token, 'SELL');
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
          >
            <TrendingDown className="w-3.5 h-3.5 text-[#FF5722]" />
            <span>Sell / Short</span>
          </button>

          {activeMenuRow.metrics.isOpen && (
            <button
              type="button"
              role="menuitem"
              onClick={() => handleExit(activeMenuRow.pos.id)}
              className="w-full px-3 py-1.5 flex items-center gap-2 text-[#FF5722] hover:bg-[#FFF5F2] dark:hover:bg-[#2A1D19] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit position</span>
            </button>
          )}

          {activeMenuRow.metrics.isOpen &&
            activeMenuRow.pos.product === 'MIS' &&
            activeMenuRow.pos.quantity > 0 && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handleConvert(activeMenuRow.pos.id)}
                className="w-full px-3 py-1.5 flex items-center gap-2 text-[#4184F3] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Convert to CNC</span>
              </button>
            )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpenMenu(null);
              onSelectSymbolForTechnicals(activeMenuRow.pos.token);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-[#9B9B9B]" />
            <span>Technicals</span>
          </button>

          <div className="my-1 border-t border-[#EEEEEE] dark:border-[#2C2C2C]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => openEditModal(activeMenuRow)}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5 text-[#9B9B9B]" />
            <span>Edit position</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleDelete(activeMenuRow.pos.id)}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-[#DF514C] dark:text-[#F87171] hover:bg-[#FEF2F2] dark:hover:bg-[#2A1B1B] cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Edit Position Modal */}
      {editingRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editingRow.pos.symbol} position`}
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#333333] rounded w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#EEEEEE] dark:border-[#2C2C2C] flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]">
                Edit position · {editingRow.pos.symbol} ({editingRow.pos.product})
              </h2>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                aria-label="Close edit position modal"
                className="text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label
                  htmlFor="edit-position-qty"
                  className="block text-[11px] text-[#666666] dark:text-[#A0A0A0] mb-1"
                >
                  Net Quantity (negative for short, 0 for closed)
                </label>
                <input
                  id="edit-position-qty"
                  type="number"
                  step="1"
                  required
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full px-3 py-2 text-xs tabular-nums bg-white dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3]"
                />
              </div>

              <div>
                <label
                  htmlFor="edit-position-avg"
                  className="block text-[11px] text-[#666666] dark:text-[#A0A0A0] mb-1"
                >
                  Average Price (₹)
                </label>
                <input
                  id="edit-position-avg"
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
    </div>
  );
}
