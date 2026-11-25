import { useMemo, useState } from 'react';
import { Briefcase, Check, CircleDot, Copy, Droplet, PieChart, X } from 'lucide-react';
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
  getChangeColorClass,
} from '../utils/format.ts';
import { StockScreenerView } from './StockScreenerView.tsx';
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

type DashboardSubTab = 'dashboard' | 'screener';
type AllocationMode = 'current' | 'investment';

export function DashboardView({
  portfolio,
  instruments,
  quotes,
  onNavigate,
  onSelectSymbolForTechnicals,
  onOpenOrderModal,
}: DashboardViewProps) {
  const [subTab, setSubTab] = useState<DashboardSubTab>('dashboard');
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('current');
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

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

  const openPositions = useMemo(
    () =>
      portfolio.positions
        .map((p) => ({ position: p, metrics: computePositionMetrics(p, quotes[p.token]) }))
        .filter((r) => r.metrics.isOpen),
    [portfolio.positions, quotes],
  );

  const referralCode = `REF-${portfolio.userId}`;

  function handleCopyReferral() {
    navigator.clipboard?.writeText(referralCode).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="w-full">
      {/* Top Two-Tab Bar: Dashboard | Stock screener */}
      <div className="px-5 lg:px-8 border-b border-[#EEEEEE] dark:border-[#282828] flex items-center gap-7">
        <div role="tablist" aria-label="Dashboard sections" className="flex items-center gap-7">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'dashboard'}
            onClick={() => setSubTab('dashboard')}
            className={`relative py-3 text-[12.5px] transition-colors cursor-pointer ${
              subTab === 'dashboard'
                ? 'text-[#FF5722] font-normal'
                : 'text-[#444444] dark:text-[#A0A0A0] hover:text-[#FF5722]'
            }`}
          >
            <span>Dashboard</span>
            {subTab === 'dashboard' && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5722]"
              />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'screener'}
            onClick={() => setSubTab('screener')}
            className={`relative py-3 text-[12.5px] transition-colors cursor-pointer ${
              subTab === 'screener'
                ? 'text-[#FF5722] font-normal'
                : 'text-[#444444] dark:text-[#A0A0A0] hover:text-[#FF5722]'
            }`}
          >
            <span>Stock screener</span>
            {subTab === 'screener' && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5722]"
              />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content Area */}
      <div className="px-5 py-6 lg:px-8 lg:py-7">
        {subTab === 'screener' ? (
          <StockScreenerView
            instruments={instruments}
            quotes={quotes}
            onSelectSymbolForTechnicals={onSelectSymbolForTechnicals}
            onOpenOrderModal={onOpenOrderModal}
          />
        ) : (
          <div className="space-y-8">
            {/* Greeting Header */}
            <div className="pb-5 border-b border-[#EEEEEE] dark:border-[#282828]">
              <h1 className="text-[24px] font-normal text-[#444444] dark:text-[#E0E0E0] tracking-[-0.015em]">
                Hi, {portfolio.userName.split(' ')[0]}
              </h1>
            </div>

            {/* Row 1: Equity & Commodity Margin Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pb-8 border-b border-[#EEEEEE] dark:border-[#282828]">
              {/* Equity Column */}
              <section aria-label="Equity" className="space-y-5">
                <div className="flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0]">
                  <PieChart className="w-4 h-4 text-[#666666] dark:text-[#9B9B9B] stroke-[1.6]" />
                  <h2 className="text-[15px] font-normal">Equity</h2>
                </div>

                <div className="flex items-start gap-7">
                  <div className="min-w-[168px]">
                    <div className="text-[32px] leading-[1.15] font-light tabular-nums text-[#444444] dark:text-[#F0F0F0] tracking-[-0.02em]">
                      {formatINR(portfolio.availableCash)}
                    </div>
                    <div className="text-[12px] text-[#9B9B9B] mt-2">Margin available</div>
                  </div>

                  <div className="border-l border-[#EEEEEE] dark:border-[#282828] pl-6 space-y-2.5 text-[12px]">
                    <div className="flex items-center gap-4">
                      <span className="text-[#9B9B9B] min-w-[96px]">Margins used</span>
                      <span className="tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                        {formatINR(portfolio.usedMargin)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[#9B9B9B] min-w-[96px]">Opening balance</span>
                      <span className="tabular-nums text-[#444444] dark:text-[#E0E0E0]">
                        {formatINR(portfolio.openingBalance)}
                      </span>
                    </div>
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => onNavigate('funds')}
                        className="inline-flex items-center gap-1.5 text-[12px] text-[#4184F3] hover:underline cursor-pointer"
                      >
                        <CircleDot className="w-3 h-3" />
                        <span>View statement</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Commodity Column */}
              <section aria-label="Commodity" className="space-y-5">
                <div className="flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0]">
                  <Droplet className="w-4 h-4 text-[#666666] dark:text-[#9B9B9B] stroke-[1.6]" />
                  <h2 className="text-[15px] font-normal">Commodity</h2>
                </div>

                <div className="flex items-start gap-7">
                  <div className="min-w-[168px]">
                    <div className="text-[32px] leading-[1.15] font-light tabular-nums text-[#444444] dark:text-[#F0F0F0] tracking-[-0.02em]">
                      0
                    </div>
                    <div className="text-[12px] text-[#9B9B9B] mt-2">Margin available</div>
                  </div>

                  <div className="border-l border-[#EEEEEE] dark:border-[#282828] pl-6 space-y-2.5 text-[12px]">
                    <div className="flex items-center gap-4">
                      <span className="text-[#9B9B9B] min-w-[96px]">Margins used</span>
                      <span className="tabular-nums text-[#444444] dark:text-[#E0E0E0]">0</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[#9B9B9B] min-w-[96px]">Opening balance</span>
                      <span className="tabular-nums text-[#444444] dark:text-[#E0E0E0]">0</span>
                    </div>
                    <div className="pt-0.5">
                      <button
                        type="button"
                        onClick={() => onNavigate('funds')}
                        className="inline-flex items-center gap-1.5 text-[12px] text-[#4184F3] hover:underline cursor-pointer"
                      >
                        <CircleDot className="w-3 h-3" />
                        <span>View statement</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Row 2: DEMAT Holdings (or Empty State) + Right Promo Card */}
            <div className="flex flex-col lg:flex-row items-start justify-between gap-8 pt-2">
              <div className="flex-1 min-w-0 w-full">
                {portfolio.holdings.length === 0 ? (
                  <div className="py-10 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                    <Briefcase className="w-16 h-16 text-[#D8D8D8] dark:text-[#3A3A3A] stroke-[1.1]" />
                    <p className="text-[13.5px] text-[#888888] dark:text-[#9A9A9A] mt-5 leading-relaxed">
                      You don&apos;t have any stocks in your DEMAT yet. Get started with
                      absolutely free equity investments.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSubTab('screener')}
                      className="mt-5 px-6 py-2.5 bg-[#4184F3] hover:bg-[#3367D6] text-white text-[13px] font-medium rounded-[3px] transition-colors cursor-pointer"
                    >
                      Start investing
                    </button>
                  </div>
                ) : (
                  <section aria-label={`Holdings (${portfolio.holdings.length})`} className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#444444] dark:text-[#E0E0E0]">
                        <Briefcase className="w-4 h-4 text-[#666666] dark:text-[#9B9B9B] stroke-[1.6]" />
                        <h2 className="text-[15px] font-normal">
                          Holdings ({portfolio.holdings.length})
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('holdings')}
                        className="text-[12px] text-[#4184F3] hover:underline cursor-pointer"
                      >
                        View all
                      </button>
                    </div>

                    <div className="space-y-5">
                      <div className="flex flex-wrap items-start gap-8">
                        <div className="shrink-0">
                          <div
                            className={`text-[32px] leading-[1.15] font-light tabular-nums whitespace-nowrap tracking-tight ${getChangeColorClass(
                              holdingsSummary.totalPnl,
                            )}`}
                          >
                            {formatINR(holdingsSummary.totalPnl, true)}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={`text-[12px] tabular-nums ${getChangeColorClass(
                                holdingsSummary.totalPnlPct,
                              )}`}
                            >
                              {holdingsSummary.totalPnlPct >= 0 ? '+' : ''}
                              {holdingsSummary.totalPnlPct.toFixed(2)}%
                            </span>
                            <span className="text-[12px] text-[#9B9B9B]">P&amp;L</span>
                          </div>
                        </div>

                        <div className="border-l border-[#EEEEEE] dark:border-[#282828] pl-6 space-y-2 text-[12px] min-w-[200px]">
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-[#9B9B9B] whitespace-nowrap">Current value</span>
                            <span className="tabular-nums whitespace-nowrap text-[#444444] dark:text-[#E0E0E0]">
                              {formatINR(holdingsSummary.currentValue)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-[#9B9B9B] whitespace-nowrap">Investment</span>
                            <span className="tabular-nums whitespace-nowrap text-[#444444] dark:text-[#E0E0E0]">
                              {formatINR(holdingsSummary.totalInvestment)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-6">
                            <span className="text-[#9B9B9B] whitespace-nowrap">Day&apos;s P&amp;L</span>
                            <span
                              className={`tabular-nums whitespace-nowrap ${getChangeColorClass(holdingsSummary.dayPnl)}`}
                            >
                              {formatINR(holdingsSummary.dayPnl, true)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#9B9B9B] tabular-nums">
                            Portfolio weight ·{' '}
                            {formatINR(
                              allocationMode === 'current'
                                ? holdingsSummary.currentValue
                                : holdingsSummary.totalInvestment,
                            )}
                          </span>
                          <div className="inline-flex border border-[#E5E5E5] dark:border-[#303030] rounded-[3px] overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setAllocationMode('current')}
                              className={`px-2 py-0.5 text-[11px] cursor-pointer ${
                                allocationMode === 'current'
                                  ? 'bg-[#4184F3]/10 text-[#4184F3] font-medium'
                                  : 'text-[#666666] dark:text-[#A0A0A0]'
                              }`}
                            >
                              Current value
                            </button>
                            <button
                              type="button"
                              onClick={() => setAllocationMode('investment')}
                              className={`px-2 py-0.5 text-[11px] border-l border-[#E5E5E5] dark:border-[#303030] cursor-pointer ${
                                allocationMode === 'investment'
                                  ? 'bg-[#4184F3]/10 text-[#4184F3] font-medium'
                                  : 'text-[#666666] dark:text-[#A0A0A0]'
                              }`}
                            >
                              Investment value
                            </button>
                          </div>
                        </div>

                        <div className="h-6 w-full flex gap-[2px] rounded-[2px] overflow-hidden bg-[#F3F4F6] dark:bg-[#222222]">
                          {holdingsSummary.allocation.map((item) => (
                            <button
                              key={item.token}
                              type="button"
                              onClick={() => onSelectSymbolForTechnicals(item.token)}
                              title={`${item.symbol}: ${item.pct.toFixed(1)}%`}
                              style={{
                                width: `${Math.max(item.pct, 2)}%`,
                                backgroundColor: item.color,
                              }}
                              className="h-full hover:opacity-85 transition-opacity cursor-pointer"
                            />
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                          {holdingsSummary.allocation.map((item) => (
                            <button
                              key={item.token}
                              type="button"
                              onClick={() => onSelectSymbolForTechnicals(item.token)}
                              className="inline-flex items-center gap-1.5 text-[#666666] dark:text-[#A0A0A0] hover:text-[#4184F3] cursor-pointer"
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span>{item.symbol}</span>
                              <span className="tabular-nums text-[#9B9B9B]">
                                {item.pct.toFixed(1)}%
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Compact Open Positions Table when active */}
                    {openPositions.length > 0 && (
                      <div className="pt-5 border-t border-[#EEEEEE] dark:border-[#282828] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-[14px] font-normal text-[#444444] dark:text-[#E0E0E0]">
                            Open Positions ({openPositions.length})
                          </h3>
                          <button
                            type="button"
                            onClick={() => onNavigate('positions')}
                            className="text-[12px] text-[#4184F3] hover:underline cursor-pointer"
                          >
                            Manage positions
                          </button>
                        </div>
                        <div className="overflow-x-auto border-t border-b border-[#EEEEEE] dark:border-[#282828]">
                          <table className="w-full text-[12.5px] text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#EEEEEE] dark:border-[#282828] text-[11.5px] text-[#9B9B9B]">
                                <th className="py-2 px-2 font-normal">Product</th>
                                <th className="py-2 px-2 font-normal">Instrument</th>
                                <th className="py-2 px-2 font-normal text-right">Qty.</th>
                                <th className="py-2 px-2 font-normal text-right">Avg.</th>
                                <th className="py-2 px-2 font-normal text-right">LTP</th>
                                <th className="py-2 px-2 font-normal text-right">P&amp;L</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F0F0F0] dark:divide-[#242424]">
                              {openPositions.map(({ position, metrics }) => (
                                <tr
                                  key={position.id}
                                  className="hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E]"
                                >
                                  <td className="py-2 px-2 text-[11px] text-[#666666] dark:text-[#A0A0A0]">
                                    {position.product}
                                  </td>
                                  <td className="py-2 px-2">
                                    <button
                                      type="button"
                                      onClick={() => onSelectSymbolForTechnicals(position.token)}
                                      className="text-[#444444] dark:text-[#E0E0E0] hover:text-[#4184F3] cursor-pointer"
                                    >
                                      {position.symbol}
                                    </button>
                                    <span className="ml-1 text-[10px] text-[#9B9B9B]">
                                      {position.exchange}
                                    </span>
                                  </td>
                                  <td
                                    className={`py-2 px-2 text-right tabular-nums ${
                                      position.quantity > 0 ? 'text-[#4184F3]' : 'text-[#DF514C]'
                                    }`}
                                  >
                                    {position.quantity}
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums">
                                    {formatPrice(
                                      position.quantity >= 0
                                        ? position.averageBuyPrice
                                        : position.averageSellPrice,
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-right tabular-nums">
                                    {formatPrice(metrics.ltp)}
                                  </td>
                                  <td
                                    className={`py-2 px-2 text-right tabular-nums font-medium ${getChangeColorClass(
                                      metrics.mtmPnl,
                                    )}`}
                                  >
                                    {formatINR(metrics.mtmPnl, true)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </section>
                )}
              </div>

              {/* Right Referral Promo Card (Matching Reference Screenshot) */}
              <aside
                aria-label="Refer your friends and family"
                className="w-full lg:w-[272px] shrink-0 rounded-[4px] bg-[#F6F7F9] dark:bg-[#1B1D21] border border-[#EFEFEF] dark:border-[#2A2C30] p-5 relative overflow-hidden"
              >
                <div className="relative z-10 max-w-[195px]">
                  <h3 className="text-[18px] font-semibold text-[#333333] dark:text-[#F0F0F0] leading-[1.28]">
                    Refer your friends &amp; family
                  </h3>
                  <p className="text-[12px] text-[#666666] dark:text-[#A0A0A0] mt-2 leading-relaxed">
                    Earn 10% of their brokerage plus 300 reward points
                  </p>
                  <button
                    type="button"
                    onClick={() => setReferralModalOpen(true)}
                    className="mt-4 px-4 py-1.5 bg-[#4184F3] hover:bg-[#3367D6] text-white text-[12px] font-medium rounded-[3px] transition-colors cursor-pointer"
                  >
                    Know more
                  </button>
                </div>

                {/* Decorative Gift Box SVG Accent */}
                <svg
                  viewBox="0 0 96 84"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="w-24 h-20 absolute right-0 bottom-0 pointer-events-none select-none"
                >
                  <path d="M10 74L96 58V84H10V74Z" fill="#4184F3" opacity="0.9" />
                  <rect x="28" y="34" width="38" height="34" rx="2" transform="rotate(-14 28 34)" fill="#F9A825" />
                  <rect x="24" y="28" width="44" height="10" rx="2" transform="rotate(-14 24 28)" fill="#FF7043" />
                  <rect x="44" y="29" width="7" height="39" transform="rotate(-14 44 29)" fill="#FF5722" />
                  <circle cx="42" cy="24" r="5" fill="#FF7043" />
                  <circle cx="51" cy="22" r="5" fill="#FF5722" />
                  <circle cx="77" cy="24" r="2" fill="#FF8A65" />
                  <circle cx="24" cy="54" r="2" fill="#4184F3" />
                </svg>
              </aside>
            </div>
          </div>
        )}
      </div>

      {/* Referral Info Modal */}
      {referralModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Referral program details"
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#333333] rounded w-full max-w-sm shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#EEEEEE] dark:border-[#2C2C2C] flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]">
                Refer your friends &amp; family
              </h3>
              <button
                type="button"
                onClick={() => setReferralModalOpen(false)}
                aria-label="Close referral details"
                className="text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs text-[#666666] dark:text-[#A0A0A0]">
              <p className="leading-relaxed">
                Share your referral code with friends and family to earn 10% of their
                brokerage plus 300 reward points on every successful account activation.
              </p>
              <div className="flex items-center justify-between px-3 py-2 bg-[#F9F9F9] dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#303030] rounded">
                <span className="font-mono font-medium text-[#444444] dark:text-[#E0E0E0]">
                  {referralCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyReferral}
                  className="inline-flex items-center gap-1 text-[#4184F3] hover:underline font-medium cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#4CAF50]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
