import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Instrument,
  MarketQuote,
  OrderSide,
  WatchlistSignalsMap,
} from '../../shared/types.ts';
import {
  formatPrice,
  formatSigned,
  getChangeColorClass,
  getSignalTextClass,
} from '../utils/format.ts';

interface MarketWatchProps {
  instruments: Instrument[];
  quotes: Record<number, MarketQuote>;
  signals: WatchlistSignalsMap;
  watchlists: Record<string, number[]>;
  activeWatchlistId: string;
  selectedToken: number;
  onSelectWatchlist: (id: string) => void;
  onSelectSymbolForTechnicals: (token: number) => void;
  onUpdateWatchlist: (watchlistId: string, tokens: number[]) => void;
  onOpenOrderModal: (token: number, side: OrderSide) => void;
}

export function MarketWatch({
  instruments,
  quotes,
  signals,
  watchlists,
  activeWatchlistId,
  selectedToken,
  onSelectWatchlist,
  onSelectSymbolForTechnicals,
  onUpdateWatchlist,
  onOpenOrderModal,
}: MarketWatchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [expandedDepthToken, setExpandedDepthToken] = useState<number | null>(null);
  const [flashMap, setFlashMap] = useState<Record<number, 'up' | 'down'>>({});
  const prevLtpRef = useRef<Record<number, number>>({});
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const activeTokens = useMemo(
    () => watchlists[activeWatchlistId] ?? [],
    [watchlists, activeWatchlistId],
  );

  // Detect tick price changes for subtle Kite-style flash highlight
  useEffect(() => {
    const nextFlash: Record<number, 'up' | 'down'> = {};
    for (const token of activeTokens) {
      const q = quotes[token];
      if (!q) continue;
      const prev = prevLtpRef.current[token];
      if (prev !== undefined && q.ltp !== prev) {
        nextFlash[token] = q.ltp > prev ? 'up' : 'down';
      }
      prevLtpRef.current[token] = q.ltp;
    }
    if (Object.keys(nextFlash).length > 0) {
      setFlashMap(nextFlash);
      const timer = setTimeout(() => setFlashMap({}), 450);
      return () => clearTimeout(timer);
    }
  }, [quotes, activeTokens]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return instruments
      .filter(
        (inst) =>
          inst.symbol.toLowerCase().includes(q) ||
          inst.name.toLowerCase().includes(q) ||
          inst.exchange.toLowerCase().includes(q) ||
          inst.sector.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [instruments, searchQuery]);

  const instrumentMap = useMemo(() => {
    const m = new Map<number, Instrument>();
    for (const inst of instruments) m.set(inst.token, inst);
    return m;
  }, [instruments]);

  function handleAddSymbol(token: number) {
    if (!activeTokens.includes(token)) {
      onUpdateWatchlist(activeWatchlistId, [...activeTokens, token]);
    }
    setSearchQuery('');
    setSearchFocused(false);
  }

  function handleRemoveSymbol(token: number) {
    onUpdateWatchlist(
      activeWatchlistId,
      activeTokens.filter((t) => t !== token),
    );
    if (expandedDepthToken === token) setExpandedDepthToken(null);
  }

  return (
    <aside
      aria-label="Marketwatch"
      className="w-full lg:w-[390px] xl:w-[410px] shrink-0 bg-white dark:bg-[#181818] border-b lg:border-b-0 lg:border-r border-[#EEEEEE] dark:border-[#282828] flex flex-col lg:h-[calc(100vh-3rem)]"
    >
      {/* Search Bar */}
      <div
        ref={searchContainerRef}
        className="relative px-3 py-2 border-b border-[#EEEEEE] dark:border-[#282828]"
      >
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#9B9B9B] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            aria-label="Search instruments to add to watchlist"
            value={searchQuery}
            onFocus={() => setSearchFocused(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchFocused(true);
            }}
            placeholder="Search eg: infy bse, nifty fut, reliance..."
            className="w-full pl-8 pr-14 py-1.5 text-xs bg-white dark:bg-[#121212] border border-[#EEEEEE] dark:border-[#282828] rounded focus:outline-none focus:border-[#4184F3] text-[#444444] dark:text-[#E0E0E0] placeholder-[#9B9B9B]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2 text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="absolute right-2.5 text-[11px] tabular-nums text-[#9B9B9B] pointer-events-none">
              {activeTokens.length} / 50
            </span>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {searchFocused && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-full z-30 bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] shadow-lg max-h-72 overflow-y-auto divide-y divide-[#EEEEEE] dark:divide-[#282828]">
            {searchResults.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-[#9B9B9B]">
                No instruments matched "{searchQuery}"
              </div>
            ) : (
              searchResults.map((inst) => {
                const alreadyAdded = activeTokens.includes(inst.token);
                const q = quotes[inst.token];
                return (
                  <div
                    key={inst.token}
                    className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-[#F5F7FA] dark:hover:bg-[#212121]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSymbolForTechnicals(inst.token);
                        setSearchFocused(false);
                      }}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-[#444444] dark:text-[#E0E0E0] truncate">
                          {inst.symbol}
                        </span>
                        <span className="text-[10px] text-[#9B9B9B] uppercase">
                          {inst.exchange}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#9B9B9B] truncate">
                        {inst.name}
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {q && (
                        <span className="text-xs tabular-nums text-[#666666] dark:text-[#A0A0A0] mr-1">
                          {formatPrice(q.ltp)}
                        </span>
                      )}
                      {!inst.isIndex && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenOrderModal(inst.token, 'BUY')}
                            aria-label={`Buy ${inst.symbol}`}
                            className="px-2 py-0.5 text-[11px] font-semibold bg-[#4184F3] text-white rounded hover:bg-[#3367D6] cursor-pointer"
                          >
                            B
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenOrderModal(inst.token, 'SELL')}
                            aria-label={`Sell ${inst.symbol}`}
                            className="px-2 py-0.5 text-[11px] font-semibold bg-[#FF5722] text-white rounded hover:bg-[#E64A19] cursor-pointer"
                          >
                            S
                          </button>
                        </>
                      )}
                      {alreadyAdded ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveSymbol(inst.token)}
                          aria-label={`Remove ${inst.symbol} from watchlist`}
                          className="p-1 text-[#DF514C] hover:bg-[#DF514C]/10 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAddSymbol(inst.token)}
                          aria-label={`Add ${inst.symbol} to watchlist`}
                          className="p-1 text-[#4CAF50] hover:bg-[#4CAF50]/10 rounded cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Watchlist Symbol Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#EEEEEE] dark:divide-[#282828]">
        {activeTokens.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#444444] dark:text-[#E0E0E0]">
              Watchlist {activeWatchlistId} is empty
            </p>
            <p className="text-xs text-[#9B9B9B] mt-1">
              Use the search bar above to add NSE, BSE, or NFO symbols for real-time price updates.
            </p>
          </div>
        ) : (
          activeTokens.map((token) => {
            const inst = instrumentMap.get(token);
            const q = quotes[token];
            if (!inst || !q) return null;

            const isSelected = selectedToken === token;
            const isDepthOpen = expandedDepthToken === token;
            const flash = flashMap[token];
            const signal = signals[token] ?? 'Neutral';
            const changeColor = getChangeColorClass(q.change);

            return (
              <div
                key={token}
                className={`group transition-colors ${
                  flash === 'up'
                    ? 'tick-flash-up'
                    : flash === 'down'
                      ? 'tick-flash-down'
                      : ''
                } ${
                  isSelected
                    ? 'bg-[#F5F7FA] dark:bg-[#212121]'
                    : 'hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E]'
                }`}
              >
                <div className="relative px-3.5 py-2.5 flex items-center justify-between gap-2">
                  {/* Left: Symbol + Exchange + Signal */}
                  <button
                    type="button"
                    onClick={() => onSelectSymbolForTechnicals(token)}
                    className="text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[13px] font-normal truncate ${
                          q.change < 0
                            ? 'text-[#DF514C] dark:text-[#F87171]'
                            : q.change > 0
                              ? 'text-[#4CAF50] dark:text-[#4ADE80]'
                              : 'text-[#444444] dark:text-[#E0E0E0]'
                        }`}
                      >
                        {inst.symbol}
                      </span>
                      <span className="text-[10px] text-[#9B9B9B] uppercase shrink-0">
                        {inst.exchange}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#9B9B9B] dark:text-[#8C8C8C] mt-0.5">
                      <span className="truncate">{inst.sector}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`font-medium ${getSignalTextClass(signal)}`}>
                        {signal}
                      </span>
                    </div>
                  </button>

                  {/* Right: Kite-style price & change with floating hover toolbar */}
                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <span className="text-[11px] text-[#9B9B9B] dark:text-[#8C8C8C] group-hover:opacity-0 transition-opacity hidden sm:inline">
                      {formatSigned(q.change)} ({q.changePercent >= 0 ? '+' : ''}
                      {q.changePercent.toFixed(2)}%)
                    </span>
                    <div
                      className={`text-[13px] font-medium flex items-center justify-end gap-0.5 group-hover:opacity-0 transition-opacity ${changeColor}`}
                    >
                      {q.change >= 0 ? (
                        <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>{formatPrice(q.ltp)}</span>
                    </div>
                  </div>

                  {/* Kite Floating Hover / Focus Actions */}
                  <div className="hidden group-hover:flex group-focus-within:flex items-center gap-1.5 absolute right-3 top-1/2 -translate-y-1/2 bg-[#FAFAFA]/95 dark:bg-[#1E1E1E]/95 pl-2">
                    {!inst.isIndex && (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenOrderModal(token, 'BUY')}
                          aria-label={`Buy ${inst.symbol}`}
                          title="Buy (B)"
                          className="w-7 h-6 text-[11px] font-semibold bg-[#4184F3] hover:bg-[#3367D6] text-white rounded flex items-center justify-center cursor-pointer"
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenOrderModal(token, 'SELL')}
                          aria-label={`Sell ${inst.symbol}`}
                          title="Sell (S)"
                          className="w-7 h-6 text-[11px] font-semibold bg-[#FF5722] hover:bg-[#E64A19] text-white rounded flex items-center justify-center cursor-pointer"
                        >
                          S
                        </button>
                      </>
                    )}
                    {!inst.isIndex && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedDepthToken(isDepthOpen ? null : token)
                        }
                        aria-label={`Market depth for ${inst.symbol}`}
                        aria-expanded={isDepthOpen}
                        title="Market Depth"
                        className={`w-7 h-6 rounded border flex items-center justify-center cursor-pointer ${
                          isDepthOpen
                            ? 'border-[#4184F3] text-[#4184F3] bg-[#4184F3]/10'
                            : 'border-[#E0E0E0] dark:border-[#333333] bg-white dark:bg-[#181818] text-[#666666] dark:text-[#A0A0A0] hover:border-[#4184F3]'
                        }`}
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectSymbolForTechnicals(token)}
                      aria-label={`Technical analysis for ${inst.symbol}`}
                      title="Technicals"
                      className="w-7 h-6 rounded border border-[#E0E0E0] dark:border-[#333333] bg-white dark:bg-[#181818] text-[#666666] dark:text-[#A0A0A0] hover:border-[#FF5722] hover:text-[#FF5722] flex items-center justify-center cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSymbol(token)}
                      aria-label={`Remove ${inst.symbol} from watchlist`}
                      title="Delete from watchlist"
                      className="w-7 h-6 rounded border border-[#E0E0E0] dark:border-[#333333] bg-white dark:bg-[#181818] text-[#9B9B9B] hover:border-[#DF514C] hover:text-[#DF514C] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expandable Inline Level-2 Market Depth (5 Bids / 5 Asks) */}
                {isDepthOpen && q.depth.buy.length > 0 && (
                  <div className="px-3.5 pb-3 pt-1.5 bg-[#FAFAFA] dark:bg-[#121212] border-t border-[#EEEEEE] dark:border-[#282828] text-[11px]">
                    <div className="grid grid-cols-2 gap-3 tabular-nums">
                      {/* Bid Side */}
                      <div>
                        <div className="grid grid-cols-3 text-[#9B9B9B] pb-1 border-b border-[#EEEEEE] dark:border-[#282828]">
                          <span>BID</span>
                          <span className="text-right">ORDERS</span>
                          <span className="text-right">QTY</span>
                        </div>
                        {q.depth.buy.map((lvl, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-3 py-0.5 text-[#4184F3]"
                          >
                            <span>{formatPrice(lvl.price)}</span>
                            <span className="text-right">{lvl.orders}</span>
                            <span className="text-right">{lvl.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {/* Ask Side */}
                      <div>
                        <div className="grid grid-cols-3 text-[#9B9B9B] pb-1 border-b border-[#EEEEEE] dark:border-[#282828]">
                          <span>OFFER</span>
                          <span className="text-right">ORDERS</span>
                          <span className="text-right">QTY</span>
                        </div>
                        {q.depth.sell.map((lvl, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-3 py-0.5 text-[#DF514C] dark:text-[#F87171]"
                          >
                            <span>{formatPrice(lvl.price)}</span>
                            <span className="text-right">{lvl.orders}</span>
                            <span className="text-right">{lvl.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-[#EEEEEE] dark:border-[#282828] text-[10px] tabular-nums text-[#666666] dark:text-[#A0A0A0]">
                      <div>
                        <span className="text-[#9B9B9B] block">OPEN</span>
                        <span>{formatPrice(q.open)}</span>
                      </div>
                      <div>
                        <span className="text-[#9B9B9B] block">HIGH</span>
                        <span>{formatPrice(q.high)}</span>
                      </div>
                      <div>
                        <span className="text-[#9B9B9B] block">LOW</span>
                        <span>{formatPrice(q.low)}</span>
                      </div>
                      <div>
                        <span className="text-[#9B9B9B] block">PREV. CLOSE</span>
                        <span>{formatPrice(q.close)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Watchlist Tabs 1..7 */}
      <div
        role="tablist"
        aria-label="Watchlist groups"
        className="h-9 border-t border-[#EEEEEE] dark:border-[#282828] bg-[#F9F9F9] dark:bg-[#121212] flex items-center justify-between px-1 shrink-0"
      >
        <div className="flex items-center w-full">
          {['1', '2', '3', '4', '5', '6', '7'].map((id) => {
            const active = activeWatchlistId === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`Watchlist ${id}`}
                onClick={() => onSelectWatchlist(id)}
                className={`flex-1 h-9 text-xs tabular-nums font-medium transition-colors cursor-pointer relative ${
                  active
                    ? 'text-[#FF5722] bg-white dark:bg-[#181818]'
                    : 'text-[#666666] dark:text-[#8C8C8C] hover:text-[#444444] dark:hover:text-[#E0E0E0]'
                }`}
              >
                {id}
                {active && (
                  <span className="absolute top-0 left-0 right-0 h-[2px] bg-[#FF5722]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
