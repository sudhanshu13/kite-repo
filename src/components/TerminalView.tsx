import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Columns2, Layers } from 'lucide-react';
import { computeHoldingMetrics, computePositionMetrics } from '../../shared/portfolioMath.ts';
import type {
  Instrument,
  MarketQuote,
  OrderSide,
  PortfolioState,
  TechnicalSummary,
  WatchlistSignalsMap,
} from '../../shared/types.ts';
import { apiFetch } from '../utils/api.ts';
import {
  formatINR,
  formatPrice,
  formatSigned,
  getChangeColorClass,
  getSignalTextClass,
} from '../utils/format.ts';

export interface WorkspaceConfig {
  id: string;
  name: string;
  showDepth: boolean;
  showWatchlist: boolean;
  showPositions: boolean;
  showBlotter: boolean;
}

interface TerminalViewProps {
  workspace: WorkspaceConfig;
  portfolio: PortfolioState;
  instruments: Instrument[];
  quotes: Record<number, MarketQuote>;
  signals: WatchlistSignalsMap;
  activeWatchlistId: string;
  selectedToken: number;
  onSelectToken: (token: number) => void;
  onUpdateWorkspace: (next: WorkspaceConfig) => void;
  onOpenOrderModal: (token: number, side: OrderSide) => void;
  onCancelOrder: (orderId: string) => void;
  onExitPosition: (positionId: string) => void;
  onExitTerminal: () => void;
}

export function TerminalView({
  workspace,
  portfolio,
  instruments,
  quotes,
  signals,
  activeWatchlistId,
  selectedToken,
  onSelectToken,
  onUpdateWorkspace,
  onOpenOrderModal,
  onCancelOrder,
  onExitPosition,
  onExitTerminal,
}: TerminalViewProps) {
  const [summary, setSummary] = useState<TechnicalSummary | null>(null);
  const [blotterTab, setBlotterTab] = useState<'orders' | 'holdings'>('orders');

  const instrumentMap = useMemo(() => {
    const m = new Map<number, Instrument>();
    for (const inst of instruments) m.set(inst.token, inst);
    return m;
  }, [instruments]);

  const activeInst = instrumentMap.get(selectedToken);
  const activeQuote = quotes[selectedToken];

  useEffect(() => {
    if (!selectedToken) return;
    let active = true;

    async function loadTech() {
      try {
        const res = await apiFetch(`/api/technicals/${selectedToken}`);
        if (!res.ok) return;
        const data = (await res.json()) as { summary?: TechnicalSummary };
        if (active && data.summary) setSummary(data.summary);
      } catch {
        // Ignore transient network errors
      }
    }

    loadTech();
    const timer = setInterval(loadTech, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedToken]);

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

  const holdingsTotalPnl = useMemo(() => {
    let totalInvestment = 0;
    let currentValue = 0;
    for (const h of portfolio.holdings) {
      const m = computeHoldingMetrics(h, quotes[h.token]);
      totalInvestment += h.investedValue;
      currentValue += m.currentValue;
    }
    return currentValue - totalInvestment;
  }, [portfolio.holdings, quotes]);

  const activeWatchTokens = portfolio.watchlists[activeWatchlistId] ?? [];

  const totalBidQty = activeQuote
    ? activeQuote.depth.buy.reduce((acc, b) => acc + b.quantity, 0)
    : 0;
  const totalAskQty = activeQuote
    ? activeQuote.depth.sell.reduce((acc, s) => acc + s.quantity, 0)
    : 0;
  const bidRatio =
    totalBidQty + totalAskQty > 0
      ? Math.round((totalBidQty / (totalBidQty + totalAskQty)) * 100)
      : 50;

  function togglePane(key: 'showDepth' | 'showWatchlist' | 'showPositions' | 'showBlotter') {
    onUpdateWorkspace({
      ...workspace,
      [key]: !workspace[key],
    });
  }

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA] dark:bg-[#121212] text-xs">
      {/* Terminal Control Strip */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-white dark:bg-[#181818] border-b border-[#EEEEEE] dark:border-[#282828]">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[#444444] dark:text-[#E0E0E0] font-medium">
            <Columns2 className="w-3.5 h-3.5 text-[#FF5722]" />
            <span>{workspace.name}</span>
            <span className="text-[#9B9B9B] font-normal">· Terminal</span>
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-[#EEEEEE] dark:bg-[#282828]" />

          <div className="flex items-center gap-3 text-[11px] tabular-nums">
            <span>
              <span className="text-[#9B9B9B]">Margin: </span>
              <span className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                {formatINR(portfolio.availableCash)}
              </span>
            </span>
            <span>
              <span className="text-[#9B9B9B]">M2M: </span>
              <span className={`font-medium ${getChangeColorClass(positionsMtm.total)}`}>
                {formatINR(positionsMtm.total, true)}
              </span>
            </span>
            <span className="hidden xl:inline">
              <span className="text-[#9B9B9B]">Holdings: </span>
              <span className={`font-medium ${getChangeColorClass(holdingsTotalPnl)}`}>
                {formatINR(holdingsTotalPnl, true)}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Terminal panes"
            className="inline-flex items-center border border-[#E5E5E5] dark:border-[#303030] rounded-[2px] overflow-hidden text-[11px]"
          >
            {(
              [
                ['showDepth', 'Depth'],
                ['showWatchlist', 'Watchlist'],
                ['showPositions', 'Positions'],
                ['showBlotter', 'Blotter'],
              ] as const
            ).map(([key, label], idx) => (
              <button
                key={key}
                type="button"
                onClick={() => togglePane(key)}
                className={`px-2 py-1 transition-colors cursor-pointer whitespace-nowrap ${
                  idx > 0 ? 'border-l border-[#E5E5E5] dark:border-[#303030]' : ''
                } ${
                  workspace[key]
                    ? 'bg-[#FFF5F2] dark:bg-[#2C1D18] text-[#FF5722] font-medium'
                    : 'text-[#888888] hover:text-[#FF5722] hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onExitTerminal}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#444444] dark:text-[#E0E0E0] border border-[#E0E0E0] dark:border-[#333333] hover:border-[#FF5722] hover:text-[#FF5722] rounded-[2px] transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Dashboard</span>
          </button>
        </div>
      </div>

      {/* Multi-Pane High-Density Terminal Grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 xl:grid-cols-12 gap-3 content-start">
        {/* Pane 1: Focused Instrument Depth + Technicals */}
        {workspace.showDepth && (
          <section
            aria-label="Terminal instrument depth and technicals"
            className={`${
              workspace.showWatchlist ? 'xl:col-span-5' : 'xl:col-span-12'
            } bg-white dark:bg-[#181818] border border-[#EEEEEE] dark:border-[#282828] rounded-[2px] flex flex-col`}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#EEEEEE] dark:border-[#282828]">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="font-semibold text-[13px] text-[#444444] dark:text-[#E0E0E0] truncate">
                  {activeInst?.symbol ?? '—'}
                </span>
                <span className="text-[10px] text-[#9B9B9B] uppercase">
                  {activeInst?.exchange}
                </span>
                {activeQuote && (
                  <span
                    className={`ml-1 tabular-nums font-semibold text-[13px] ${getChangeColorClass(activeQuote.change)}`}
                  >
                    {formatPrice(activeQuote.ltp)}
                  </span>
                )}
                {activeQuote && (
                  <span
                    className={`tabular-nums text-[11px] ${getChangeColorClass(activeQuote.change)}`}
                  >
                    ({activeQuote.changePercent >= 0 ? '+' : ''}
                    {activeQuote.changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>

              {activeInst && !activeInst.isIndex && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenOrderModal(activeInst.token, 'BUY')}
                    className="px-2.5 py-0.5 text-[11px] font-semibold bg-[#4184F3] hover:bg-[#3367D6] text-white rounded-[2px] cursor-pointer"
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenOrderModal(activeInst.token, 'SELL')}
                    className="px-2.5 py-0.5 text-[11px] font-semibold bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-[2px] cursor-pointer"
                  >
                    Sell
                  </button>
                </div>
              )}
            </div>

            {!activeQuote ? (
              <div className="p-6 text-[#9B9B9B]">Select an instrument to inspect live depth.</div>
            ) : (
              <div className="p-3.5 space-y-3.5">
                {/* OHLC Ribbon */}
                <div className="grid grid-cols-4 gap-2 text-[11px] tabular-nums pb-2.5 border-b border-[#EEEEEE] dark:border-[#282828]">
                  <div>
                    <div className="text-[#9B9B9B]">Open</div>
                    <div className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                      {formatPrice(activeQuote.open)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#9B9B9B]">High</div>
                    <div className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                      {formatPrice(activeQuote.high)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#9B9B9B]">Low</div>
                    <div className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                      {formatPrice(activeQuote.low)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#9B9B9B]">Prev. Close</div>
                    <div className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                      {formatPrice(activeQuote.close)}
                    </div>
                  </div>
                </div>

                {/* 5-Level Market Depth */}
                <div className="grid grid-cols-2 gap-3 text-[11px] tabular-nums">
                  <div>
                    <div className="flex justify-between text-[#9B9B9B] pb-1 border-b border-[#EEEEEE] dark:border-[#282828]">
                      <span>Bid</span>
                      <span>Qty</span>
                    </div>
                    <div className="divide-y divide-[#F5F5F5] dark:divide-[#232323]">
                      {activeQuote.depth.buy.slice(0, 5).map((lvl, idx) => (
                        <div key={idx} className="flex justify-between py-1">
                          <span className="text-[#4184F3]">{formatPrice(lvl.price)}</span>
                          <span className="text-[#666666] dark:text-[#A0A0A0]">
                            {lvl.quantity.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[#9B9B9B] pb-1 border-b border-[#EEEEEE] dark:border-[#282828]">
                      <span>Offer</span>
                      <span>Qty</span>
                    </div>
                    <div className="divide-y divide-[#F5F5F5] dark:divide-[#232323]">
                      {activeQuote.depth.sell.slice(0, 5).map((lvl, idx) => (
                        <div key={idx} className="flex justify-between py-1">
                          <span className="text-[#DF514C]">{formatPrice(lvl.price)}</span>
                          <span className="text-[#666666] dark:text-[#A0A0A0]">
                            {lvl.quantity.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bid/Offer Ratio Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] tabular-nums text-[#9B9B9B]">
                    <span>Bids {bidRatio}%</span>
                    <span>Offers {100 - bidRatio}%</span>
                  </div>
                  <div className="h-1.5 w-full flex overflow-hidden rounded-full bg-[#EEEEEE] dark:bg-[#282828]">
                    <div style={{ width: `${bidRatio}%` }} className="bg-[#4184F3]" />
                    <div style={{ width: `${100 - bidRatio}%` }} className="bg-[#DF514C]" />
                  </div>
                </div>

                {/* Technicals Snapshot */}
                {summary && (
                  <div className="pt-2.5 border-t border-[#EEEEEE] dark:border-[#282828] flex items-center justify-between text-[11px]">
                    <span className="text-[#9B9B9B]">Technical Rating</span>
                    <span className={`font-semibold ${getSignalTextClass(summary.overallSignal)}`}>
                      {summary.overallSignal}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Pane 2: Watchlist Live Quote Tape */}
        {workspace.showWatchlist && (
          <section
            aria-label="Terminal watchlist quote tape"
            className={`${
              workspace.showDepth ? 'xl:col-span-7' : 'xl:col-span-12'
            } bg-white dark:bg-[#181818] border border-[#EEEEEE] dark:border-[#282828] rounded-[2px] flex flex-col`}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#EEEEEE] dark:border-[#282828]">
              <span className="font-normal text-[13px] text-[#444444] dark:text-[#E0E0E0]">
                Watchlist {activeWatchlistId} · Live Terminal Tape
              </span>
              <span className="text-[11px] tabular-nums text-[#9B9B9B]">
                {activeWatchTokens.length} symbols
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[11.5px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                    <th className="py-2 px-3 font-normal">Instrument</th>
                    <th className="py-2 px-3 font-normal text-right">LTP</th>
                    <th className="py-2 px-3 font-normal text-right">Chg</th>
                    <th className="py-2 px-3 font-normal text-right hidden sm:table-cell">Volume</th>
                    <th className="py-2 px-3 font-normal text-right">Signal</th>
                    <th className="py-2 px-3 font-normal text-right">Trade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                  {activeWatchTokens.map((token) => {
                    const inst = instrumentMap.get(token);
                    const q = quotes[token];
                    if (!inst || !q) return null;
                    const isFocused = token === selectedToken;
                    const signal = signals[token] ?? 'Neutral';
                    return (
                      <tr
                        key={token}
                        onClick={() => onSelectToken(token)}
                        className={`cursor-pointer transition-colors ${
                          isFocused
                            ? 'bg-[#F5F7FA] dark:bg-[#22262E]'
                            : 'hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E]'
                        }`}
                      >
                        <td className="py-2 px-3">
                          <span className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                            {inst.symbol}
                          </span>
                          <span className="ml-1.5 text-[10px] text-[#9B9B9B]">
                            {inst.exchange}
                          </span>
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums font-medium ${getChangeColorClass(q.change)}`}
                        >
                          {formatPrice(q.ltp)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right tabular-nums ${getChangeColorClass(q.change)}`}
                        >
                          {formatSigned(q.change)} ({q.changePercent >= 0 ? '+' : ''}
                          {q.changePercent.toFixed(2)}%)
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#666666] dark:text-[#A0A0A0] hidden sm:table-cell">
                          {q.volume > 0 ? q.volume.toLocaleString('en-IN') : '—'}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-medium ${getSignalTextClass(signal)}`}
                        >
                          {signal}
                        </td>
                        <td
                          className="py-2 px-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {inst.isIndex ? (
                            <span className="text-[#9B9B9B]">Index</span>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenOrderModal(token, 'BUY')}
                                className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#4184F3] hover:bg-[#3367D6] text-white rounded-[2px] cursor-pointer"
                              >
                                B
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenOrderModal(token, 'SELL')}
                                className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-[2px] cursor-pointer"
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
        )}

        {/* Pane 3: Positions M2M */}
        {workspace.showPositions && (
          <section
            aria-label="Terminal open positions"
            className={`${
              workspace.showBlotter ? 'xl:col-span-6' : 'xl:col-span-12'
            } bg-white dark:bg-[#181818] border border-[#EEEEEE] dark:border-[#282828] rounded-[2px] flex flex-col`}
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#EEEEEE] dark:border-[#282828]">
              <span className="text-[13px] text-[#444444] dark:text-[#E0E0E0]">
                Positions ({portfolio.positions.length})
              </span>
              <span
                className={`tabular-nums font-medium text-[12px] ${getChangeColorClass(positionsMtm.total)}`}
              >
                M2M {formatINR(positionsMtm.total, true)}
              </span>
            </div>

            {portfolio.positions.length === 0 ? (
              <div className="p-6 text-[#9B9B9B]">No positions open today.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11.5px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                      <th className="py-2 px-3 font-normal">Prod</th>
                      <th className="py-2 px-3 font-normal">Instrument</th>
                      <th className="py-2 px-3 font-normal text-right">Qty</th>
                      <th className="py-2 px-3 font-normal text-right">LTP</th>
                      <th className="py-2 px-3 font-normal text-right">P&amp;L</th>
                      <th className="py-2 px-3 font-normal text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                    {portfolio.positions.map((pos) => {
                      const m = computePositionMetrics(pos, quotes[pos.token]);
                      return (
                        <tr
                          key={pos.id}
                          className="hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E]"
                        >
                          <td className="py-2 px-3 text-[#666666] dark:text-[#A0A0A0]">
                            {pos.product}
                          </td>
                          <td className="py-2 px-3 font-medium text-[#444444] dark:text-[#E0E0E0]">
                            <button
                              type="button"
                              onClick={() => onSelectToken(pos.token)}
                              className="hover:text-[#FF5722] active:text-[#FF5722] cursor-pointer"
                            >
                              {pos.symbol}
                            </button>
                          </td>
                          <td
                            className={`py-2 px-3 text-right tabular-nums font-medium ${
                              pos.quantity > 0
                                ? 'text-[#4184F3]'
                                : pos.quantity < 0
                                  ? 'text-[#FF5722]'
                                  : 'text-[#9B9B9B]'
                            }`}
                          >
                            {pos.quantity}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {formatPrice(m.ltp)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right tabular-nums font-medium ${getChangeColorClass(m.mtmPnl)}`}
                          >
                            {formatINR(m.mtmPnl, true)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {m.isOpen ? (
                              <button
                                type="button"
                                onClick={() => onExitPosition(pos.id)}
                                className="text-[#4184F3] hover:underline cursor-pointer"
                              >
                                Exit
                              </button>
                            ) : (
                              <span className="text-[#9B9B9B]">Closed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Pane 4: Orders & Holdings Mini-Blotter */}
        {workspace.showBlotter && (
          <section
            aria-label="Terminal orders and holdings blotter"
            className={`${
              workspace.showPositions ? 'xl:col-span-6' : 'xl:col-span-12'
            } bg-white dark:bg-[#181818] border border-[#EEEEEE] dark:border-[#282828] rounded-[2px] flex flex-col`}
          >
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-[#EEEEEE] dark:border-[#282828]">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setBlotterTab('orders')}
                  className={`py-0.5 text-[12.5px] cursor-pointer transition-colors ${
                    blotterTab === 'orders'
                      ? 'text-[#FF5722] font-medium'
                      : 'text-[#666666] dark:text-[#A0A0A0] hover:text-[#FF5722]'
                  }`}
                >
                  Orders ({portfolio.orders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBlotterTab('holdings')}
                  className={`py-0.5 text-[12.5px] cursor-pointer transition-colors ${
                    blotterTab === 'holdings'
                      ? 'text-[#FF5722] font-medium'
                      : 'text-[#666666] dark:text-[#A0A0A0] hover:text-[#FF5722]'
                  }`}
                >
                  Holdings ({portfolio.holdings.length})
                </button>
              </div>
              <Layers className="w-3.5 h-3.5 text-[#9B9B9B]" />
            </div>

            {blotterTab === 'orders' ? (
              portfolio.orders.length === 0 ? (
                <div className="p-6 text-[#9B9B9B]">No orders placed yet.</div>
              ) : (
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-[11.5px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                        <th className="py-2 px-3 font-normal">Side</th>
                        <th className="py-2 px-3 font-normal">Instrument</th>
                        <th className="py-2 px-3 font-normal text-right">Qty</th>
                        <th className="py-2 px-3 font-normal text-right">Price</th>
                        <th className="py-2 px-3 font-normal text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                      {portfolio.orders.slice(0, 12).map((ord) => (
                        <tr key={ord.id} className="hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E]">
                          <td
                            className={`py-2 px-3 font-medium ${
                              ord.side === 'BUY' ? 'text-[#4184F3]' : 'text-[#FF5722]'
                            }`}
                          >
                            {ord.side}
                          </td>
                          <td className="py-2 px-3 text-[#444444] dark:text-[#E0E0E0]">
                            {ord.symbol}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{ord.quantity}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {formatPrice(ord.averagePrice || ord.price)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {ord.status === 'OPEN' || ord.status === 'TRIGGER PENDING' ? (
                              <button
                                type="button"
                                onClick={() => onCancelOrder(ord.id)}
                                className="text-[#DF514C] hover:underline cursor-pointer"
                              >
                                Cancel
                              </button>
                            ) : (
                              <span
                                className={
                                  ord.status === 'COMPLETE'
                                    ? 'text-[#4CAF50]'
                                    : 'text-[#9B9B9B]'
                                }
                              >
                                {ord.status}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : portfolio.holdings.length === 0 ? (
              <div className="p-6 text-[#9B9B9B]">No CNC holdings yet.</div>
            ) : (
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-[11.5px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[#9B9B9B]">
                      <th className="py-2 px-3 font-normal">Instrument</th>
                      <th className="py-2 px-3 font-normal text-right">Qty</th>
                      <th className="py-2 px-3 font-normal text-right">Avg</th>
                      <th className="py-2 px-3 font-normal text-right">LTP</th>
                      <th className="py-2 px-3 font-normal text-right">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                    {portfolio.holdings.map((h) => {
                      const m = computeHoldingMetrics(h, quotes[h.token]);
                      return (
                        <tr
                          key={h.token}
                          onClick={() => onSelectToken(h.token)}
                          className="hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E] cursor-pointer"
                        >
                          <td className="py-2 px-3 font-medium text-[#444444] dark:text-[#E0E0E0]">
                            {h.symbol}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{h.quantity}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {formatPrice(h.averagePrice)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {formatPrice(m.ltp)}
                          </td>
                          <td
                            className={`py-2 px-3 text-right tabular-nums font-medium ${getChangeColorClass(m.pnl)}`}
                          >
                            {formatINR(m.pnl, true)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
