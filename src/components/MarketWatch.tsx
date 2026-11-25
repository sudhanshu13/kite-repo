import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Activity,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FolderInput,
  Loader2,
  Plus,
  Search,
  SlidersVertical,
  Trash2,
  X,
} from 'lucide-react';
import {
  searchInstruments,
  type SearchCategoryFilter,
} from '../../shared/derivatives.ts';
import type {
  Instrument,
  MarketQuote,
  OrderSide,
  WatchlistSignalsMap,
} from '../../shared/types.ts';
import { apiFetch } from '../utils/api.ts';
import { formatPrice, getChangeColorClass, getSignalTextClass } from '../utils/format.ts';

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
  onMergeDiscoveredInstruments?: (
    instruments: Instrument[],
    quotes: MarketQuote[],
  ) => void;
}

interface WatchlistGroup {
  id: string;
  name: string;
  tokens: number[];
  isCustom?: boolean;
}

type SortMode = 'default' | 'az' | 'change' | 'ltp';

const STORAGE_KEY = 'kite_watchlist_groups_v1';

function loadSavedGroups(): Record<string, WatchlistGroup[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, WatchlistGroup[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveGroups(map: Record<string, WatchlistGroup[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

function buildDefaultGroups(
  watchlistId: string,
  tokens: number[],
  instrumentMap: Map<number, Instrument>,
): WatchlistGroup[] {
  if (tokens.length === 0) {
    return [{ id: `wl-${watchlistId}-default`, name: 'Default', tokens: [] }];
  }

  const indexOrFno: number[] = [];
  const banking: number[] = [];
  const primary: number[] = [];

  for (const token of tokens) {
    const inst = instrumentMap.get(token);
    if (!inst) {
      primary.push(token);
      continue;
    }
    if (
      inst.isIndex ||
      inst.exchange === 'INDICES' ||
      inst.exchange === 'NFO' ||
      inst.exchange === 'BFO'
    ) {
      indexOrFno.push(token);
    } else if (inst.sector === 'Banking') {
      banking.push(token);
    } else {
      primary.push(token);
    }
  }

  const groups: WatchlistGroup[] = [];
  if (indexOrFno.length > 0) {
    groups.push({ id: `wl-${watchlistId}-nifty`, name: 'Nifty', tokens: indexOrFno });
  }
  if (primary.length > 0) {
    groups.push({
      id: `wl-${watchlistId}-default`,
      name: watchlistId === '1' ? 'Default' : `Group ${watchlistId}`,
      tokens: primary,
    });
  }
  if (banking.length > 0) {
    groups.push({ id: `wl-${watchlistId}-banking`, name: 'Banking', tokens: banking });
  }

  if (groups.length === 0) {
    return [{ id: `wl-${watchlistId}-default`, name: 'Default', tokens }];
  }
  return groups;
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
  onMergeDiscoveredInstruments,
}: MarketWatchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<SearchCategoryFilter>('all');
  const [searchFocused, setSearchFocused] = useState(false);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [expandedDepthToken, setExpandedDepthToken] = useState<number | null>(null);
  const [flashMap, setFlashMap] = useState<Record<number, 'up' | 'down'>>({});
  const [savedGroupsByWl, setSavedGroupsByWl] = useState<Record<string, WatchlistGroup[]>>(
    () => loadSavedGroups(),
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [targetGroupIdForAdd, setTargetGroupIdForAdd] = useState<string | null>(null);
  const [movingToken, setMovingToken] = useState<number | null>(null);

  // Display / sort settings popover (3-slider button in search bar)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [showTechnicalsTag, setShowTechnicalsTag] = useState(false);

  const prevLtpRef = useRef<Record<number, number>>({});
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const activeTokens = useMemo(
    () => watchlists[activeWatchlistId] ?? [],
    [watchlists, activeWatchlistId],
  );

  const instrumentMap = useMemo(() => {
    const m = new Map<number, Instrument>();
    for (const inst of instruments) m.set(inst.token, inst);
    return m;
  }, [instruments]);

  // Global Ctrl+K / Cmd+K shortcut to focus MarketWatch search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      } else if (e.key === 'Escape') {
        setSearchFocused(false);
        setSettingsOpen(false);
        setMovingToken(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Reconcile active watchlist tokens with persisted or default groups
  const groups = useMemo<WatchlistGroup[]>(() => {
    const customList = savedGroupsByWl[activeWatchlistId];
    const baseGroups =
      customList && customList.length > 0
        ? customList.map((g) => ({
            ...g,
            tokens: g.tokens.filter((t) => activeTokens.includes(t)),
          }))
        : buildDefaultGroups(activeWatchlistId, activeTokens, instrumentMap);

    const assigned = new Set<number>();
    for (const g of baseGroups) {
      for (const t of g.tokens) assigned.add(t);
    }
    const unassigned = activeTokens.filter((t) => !assigned.has(t));
    if (unassigned.length > 0) {
      if (baseGroups.length > 0) {
        baseGroups[0] = {
          ...baseGroups[0],
          tokens: [...baseGroups[0].tokens, ...unassigned],
        };
      } else {
        baseGroups.push({
          id: `wl-${activeWatchlistId}-default`,
          name: 'Default',
          tokens: unassigned,
        });
      }
    }

    if (sortMode === 'default') return baseGroups;

    return baseGroups.map((g) => {
      const sorted = [...g.tokens].sort((a, b) => {
        const instA = instrumentMap.get(a);
        const instB = instrumentMap.get(b);
        const qA = quotes[a];
        const qB = quotes[b];
        if (sortMode === 'az') {
          return (instA?.symbol ?? '').localeCompare(instB?.symbol ?? '');
        }
        if (sortMode === 'change') {
          return (qB?.changePercent ?? 0) - (qA?.changePercent ?? 0);
        }
        return (qB?.ltp ?? 0) - (qA?.ltp ?? 0);
      });
      return { ...g, tokens: sorted };
    });
  }, [savedGroupsByWl, activeWatchlistId, activeTokens, instrumentMap, sortMode, quotes]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    return searchInstruments(instruments, q, {
      category: searchCategory,
      limit: 50,
    });
  }, [instruments, searchQuery, searchCategory]);

  // Live NSE/BSE discovery for any Indian listed stock or ETF beyond the built-in catalog
  useEffect(() => {
    const q = searchQuery.trim();
    if (
      !searchFocused ||
      q.length < 2 ||
      (searchCategory !== 'all' && searchCategory !== 'eq') ||
      /\b(fut|futures|ce|pe|call|put|\d{4,6}\s*(?:ce|pe))\b/i.test(q)
    ) {
      setIsSearchingRemote(false);
      return;
    }

    let cancelled = false;
    setIsSearchingRemote(true);

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/api/instruments?q=${encodeURIComponent(q)}&category=${encodeURIComponent(searchCategory)}&live=1`,
        );
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as {
            instruments?: Instrument[];
            quotes?: MarketQuote[];
          };
          if (!cancelled && onMergeDiscoveredInstruments) {
            onMergeDiscoveredInstruments(
              Array.isArray(data.instruments) ? data.instruments : [],
              Array.isArray(data.quotes) ? data.quotes : [],
            );
          }
        }
      } catch {
        // Ignore transient network errors during live search
      } finally {
        if (!cancelled) setIsSearchingRemote(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchFocused, searchQuery, searchCategory, onMergeDiscoveredInstruments]);

  function persistCurrentGroups(nextGroups: WatchlistGroup[]) {
    setSavedGroupsByWl((prev) => {
      const updated = { ...prev, [activeWatchlistId]: nextGroups };
      saveGroups(updated);
      return updated;
    });
  }

  function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    const newGroup: WatchlistGroup = {
      id: `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      tokens: [],
      isCustom: true,
    };
    const currentNormalized = groups.map((g) => ({ ...g }));
    persistCurrentGroups([newGroup, ...currentNormalized]);
    setTargetGroupIdForAdd(newGroup.id);
    setNewGroupName('');
    setCreatingGroup(false);
  }

  function handleDeleteGroup(groupId: string) {
    if (groups.length <= 1) return;
    const target = groups.find((g) => g.id === groupId);
    const remaining = groups.filter((g) => g.id !== groupId);
    if (target && target.tokens.length > 0 && remaining.length > 0) {
      remaining[0] = {
        ...remaining[0],
        tokens: [...remaining[0].tokens, ...target.tokens],
      };
    }
    persistCurrentGroups(remaining);
    if (targetGroupIdForAdd === groupId) setTargetGroupIdForAdd(null);
  }

  function handleMoveTokenToGroup(token: number, destGroupId: string) {
    const nextGroups = groups.map((g) => {
      const without = g.tokens.filter((t) => t !== token);
      if (g.id === destGroupId) {
        return { ...g, tokens: [...without, token] };
      }
      return { ...g, tokens: without };
    });
    persistCurrentGroups(nextGroups);
    setMovingToken(null);
  }

  function handleAddSymbol(token: number) {
    const destId = targetGroupIdForAdd ?? groups[0]?.id;
    if (destId) {
      const nextGroups = groups.map((g) => {
        const without = g.tokens.filter((t) => t !== token);
        if (g.id === destId) return { ...g, tokens: [...without, token] };
        return { ...g, tokens: without };
      });
      persistCurrentGroups(nextGroups);
    }
    if (!activeTokens.includes(token)) {
      onUpdateWatchlist(activeWatchlistId, [...activeTokens, token]);
    }
    setSearchQuery('');
    setSearchCategory('all');
    setSearchFocused(false);
  }

  function handleRemoveSymbol(token: number) {
    const nextGroups = groups.map((g) => ({
      ...g,
      tokens: g.tokens.filter((t) => t !== token),
    }));
    if (savedGroupsByWl[activeWatchlistId]) {
      persistCurrentGroups(nextGroups);
    }
    onUpdateWatchlist(
      activeWatchlistId,
      activeTokens.filter((t) => t !== token),
    );
    if (expandedDepthToken === token) setExpandedDepthToken(null);
  }

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  return (
    <aside
      aria-label="Marketwatch"
      className="w-full lg:w-[390px] xl:w-[410px] shrink-0 bg-[#FCFCFC] dark:bg-[#141414] border-b lg:border-b-0 lg:border-r border-[#EEEEEE] dark:border-[#282828] flex flex-col lg:h-full"
    >
      {/* Top Bordered Search Box (Exact Kite Style with Ctrl+K & Filter Sliders) */}
      <div ref={searchContainerRef} className="relative px-3 pt-2.5 pb-1.5">
        <div className="flex items-center h-[38px] bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#2F2F2F] rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#4184F3]">
          <div className="w-9 h-full flex items-center justify-center border-r border-[#F0F0F0] dark:border-[#2A2A2A] text-[#9B9B9B] shrink-0">
            <Search className="w-3.5 h-3.5" />
          </div>

          <input
            ref={searchInputRef}
            type="text"
            aria-label="Search instruments to add to watchlist"
            value={searchQuery}
            onFocus={() => setSearchFocused(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchFocused(true);
            }}
            placeholder="Search eg: infy bse, nifty fut, index fund, et..."
            className="flex-1 min-w-0 px-2.5 text-[12px] bg-transparent focus:outline-none text-[#444444] dark:text-[#E0E0E0] placeholder:text-[#9B9B9B]"
          />

          {searchQuery ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchCategory('all');
              }}
              aria-label="Clear search"
              className="mr-1.5 text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] p-1 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="mr-2 px-2 py-0.5 text-[10.5px] font-sans text-[#888888] dark:text-[#A0A0A0] bg-[#F7F7F7] dark:bg-[#252525] border border-[#EAEAEA] dark:border-[#343434] rounded-[3px] shrink-0 select-none">
              Ctrl + K
            </kbd>
          )}

          <div ref={settingsRef} className="relative h-full shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              aria-label="Watchlist sort and display settings"
              aria-expanded={settingsOpen}
              title="Watchlist settings"
              className={`w-9 h-full flex items-center justify-center border-l border-[#F0F0F0] dark:border-[#2A2A2A] transition-colors cursor-pointer ${
                settingsOpen
                  ? 'text-[#FF5722] bg-[#FFF5F2] dark:bg-[#261D1A]'
                  : 'text-[#888888] hover:text-[#444444] dark:hover:text-[#E0E0E0]'
              }`}
            >
              <SlidersVertical className="w-3.5 h-3.5" />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#333333] rounded shadow-lg z-40 p-3 space-y-3 text-xs">
                <div>
                  <div className="text-[11px] font-medium text-[#9B9B9B] uppercase tracking-wider mb-1.5">
                    Sort instruments
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'default', label: 'Default' },
                        { id: 'az', label: 'A – Z' },
                        { id: 'change', label: '% Change' },
                        { id: 'ltp', label: 'LTP' },
                      ] as { id: SortMode; label: string }[]
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSortMode(opt.id)}
                        className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                          sortMode === opt.id
                            ? 'border-[#4184F3] bg-[#4184F3]/10 text-[#4184F3] font-medium'
                            : 'border-[#E5E5E5] dark:border-[#333333] text-[#666666] dark:text-[#A0A0A0] hover:border-[#CCCCCC]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between pt-2 border-t border-[#EEEEEE] dark:border-[#2A2A2A] cursor-pointer">
                  <span className="text-[11.5px] text-[#444444] dark:text-[#D4D4D4]">
                    Show technical rating
                  </span>
                  <input
                    type="checkbox"
                    checked={showTechnicalsTag}
                    onChange={(e) => setShowTechnicalsTag(e.target.checked)}
                    className="accent-[#4184F3]"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Autocomplete Dropdown with F&O Category Tabs */}
        {searchFocused && searchQuery.trim().length > 0 && (
          <div className="absolute left-3 right-3 top-[46px] z-30 bg-white dark:bg-[#181818] border border-[#E0E0E0] dark:border-[#333333] rounded-[3px] shadow-lg overflow-hidden">
            {/* Segment Filter Strip */}
            <div
              role="tablist"
              aria-label="Search instrument category"
              className="flex items-center gap-1 px-2 py-1.5 bg-[#FAFAFA] dark:bg-[#141414] border-b border-[#EEEEEE] dark:border-[#282828] text-[11px]"
            >
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'eq', label: 'Equity' },
                  { id: 'fut', label: 'Futures' },
                  { id: 'opt', label: 'Options' },
                ] as { id: SearchCategoryFilter; label: string }[]
              ).map((cat) => {
                const active = searchCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSearchCategory(cat.id)}
                    className={`px-2 py-0.5 rounded-[2px] transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#FF5722]/12 text-[#FF5722] font-medium'
                        : 'text-[#666666] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#E0E0E0]'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
              <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[#9B9B9B] tabular-nums pr-1">
                {isSearchingRemote && (
                  <span className="inline-flex items-center gap-1 text-[#4184F3]">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span>NSE/BSE</span>
                  </span>
                )}
                <span>{searchResults.length} shown</span>
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#EEEEEE] dark:divide-[#282828]">
              {searchResults.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center text-[#9B9B9B]">
                  {isSearchingRemote
                    ? `Searching NSE & BSE for “${searchQuery}”...`
                    : `No instruments matched “${searchQuery}”`}
                </div>
              ) : (
                searchResults.map((inst) => {
                  const alreadyAdded = activeTokens.includes(inst.token);
                  const q = quotes[inst.token];
                  const isFno = inst.exchange === 'NFO' || inst.exchange === 'BFO';
                  const typeBadgeClass =
                    inst.instrumentType === 'CE'
                      ? 'bg-[#EBF7EC] text-[#4CAF50] dark:bg-[#193320] dark:text-[#4ADE80]'
                      : inst.instrumentType === 'PE'
                        ? 'bg-[#FDECEC] text-[#DF514C] dark:bg-[#351B1B] dark:text-[#F87171]'
                        : inst.instrumentType === 'FUT'
                          ? 'bg-[#EFF6FF] text-[#4184F3] dark:bg-[#1D2B3D] dark:text-[#60A5FA]'
                          : 'bg-[#F3F4F6] text-[#888888] dark:bg-[#262626] dark:text-[#A0A0A0]';
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-medium text-[#444444] dark:text-[#E0E0E0] truncate">
                            {inst.symbol}
                          </span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded-[2px] uppercase shrink-0 font-medium ${typeBadgeClass}`}
                          >
                            {inst.exchange === 'INDICES' ? 'INDEX' : inst.exchange}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#9B9B9B] truncate">
                          {isFno
                            ? `${inst.name} · Lot ${inst.lotSize}`
                            : inst.name}
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
          </div>
        )}
      </div>

      {/* Watchlist Count & "+ New group" Bar */}
      <div className="px-3.5 py-1.5 flex items-center justify-between text-[12px]">
        <span className="text-[#888888] dark:text-[#9A9A9A] tabular-nums">
          {activeWatchlistId} ({activeTokens.length} / 250)
        </span>
        <button
          type="button"
          onClick={() => setCreatingGroup((prev) => !prev)}
          className="text-[#4184F3] hover:text-[#3367D6] font-medium cursor-pointer"
        >
          + New group
        </button>
      </div>

      {/* Inline "+ New group" Creator */}
      {creatingGroup && (
        <form
          onSubmit={handleCreateGroup}
          className="mx-3 mb-2 p-2.5 bg-white dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#303030] rounded-[4px] flex items-center gap-2 shadow-xs"
        >
          <input
            type="text"
            autoFocus
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Group name (e.g. Nifty, IT)"
            aria-label="New group name"
            maxLength={24}
            className="flex-1 min-w-0 px-2 py-1 text-xs bg-[#FAFAFA] dark:bg-[#121212] border border-[#E0E0E0] dark:border-[#333333] rounded focus:outline-none focus:border-[#4184F3] text-[#444444] dark:text-[#E0E0E0]"
          />
          <button
            type="submit"
            disabled={!newGroupName.trim()}
            className="px-2.5 py-1 text-[11px] font-medium bg-[#4184F3] hover:bg-[#3367D6] disabled:opacity-50 text-white rounded cursor-pointer"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setCreatingGroup(false);
              setNewGroupName('');
            }}
            aria-label="Cancel new group"
            className="p-1 text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {/* Grouped Watchlist Boxes */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5">
        {groups.map((group) => {
          const isCollapsed = !!collapsedGroups[group.id];
          return (
            <section
              key={group.id}
              aria-label={`${group.name} group`}
              className="border border-[#EBEBEB] dark:border-[#2A2A2A] rounded-[4px] bg-white dark:bg-[#181818] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden"
            >
              {/* Warm Cream Group Header */}
              <div className="group/hdr flex items-center justify-between px-3 py-2 bg-[#FAF7F2] dark:bg-[#201E1B] border-b border-[#EFEFEF] dark:border-[#2B2B2B]">
                <button
                  type="button"
                  onClick={() => toggleGroupCollapse(group.id)}
                  aria-expanded={!isCollapsed}
                  className="flex items-center gap-1.5 text-left min-w-0 cursor-pointer"
                >
                  <span className="text-[12.5px] font-medium text-[#222222] dark:text-[#E8E8E8] truncate">
                    {group.name}
                  </span>
                  <span className="text-[12px] font-normal text-[#888888] dark:text-[#9A9A9A] tabular-nums">
                    ({group.tokens.length})
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetGroupIdForAdd(group.id);
                      searchInputRef.current?.focus();
                      setSearchFocused(true);
                    }}
                    title={`Add symbol to ${group.name}`}
                    aria-label={`Add symbol to ${group.name}`}
                    className="opacity-0 group-hover/hdr:opacity-100 focus:opacity-100 p-0.5 text-[#888888] hover:text-[#4184F3] transition-opacity cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  {groups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(group.id)}
                      title={`Delete ${group.name} group`}
                      aria-label={`Delete ${group.name} group`}
                      className="opacity-0 group-hover/hdr:opacity-100 focus:opacity-100 p-0.5 text-[#888888] hover:text-[#DF514C] transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(group.id)}
                    aria-label={isCollapsed ? `Expand ${group.name}` : `Collapse ${group.name}`}
                    className="p-0.5 text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Instrument Rows inside Box */}
              {!isCollapsed && (
                <div className="divide-y divide-[#F2F2F2] dark:divide-[#262626]">
                  {group.tokens.length === 0 ? (
                    <div className="px-3.5 py-4 text-center text-[11.5px] text-[#9B9B9B]">
                      No instruments in {group.name}.{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setTargetGroupIdForAdd(group.id);
                          searchInputRef.current?.focus();
                          setSearchFocused(true);
                        }}
                        className="text-[#4184F3] hover:underline cursor-pointer"
                      >
                        Search to add
                      </button>
                    </div>
                  ) : (
                    group.tokens.map((token) => {
                      const inst = instrumentMap.get(token);
                      const q = quotes[token];
                      if (!inst || !q) return null;

                      const isSelected = selectedToken === token;
                      const isDepthOpen = expandedDepthToken === token;
                      const flash = flashMap[token];
                      const signal = signals[token] ?? 'Neutral';
                      const changeColor = getChangeColorClass(q.change);
                      const exchangeLabel =
                        inst.exchange === 'INDICES' ? 'INDEX' : inst.exchange;
                      const absChangeText =
                        q.change < 0
                          ? q.change.toFixed(2)
                          : q.change.toFixed(2);
                      const pctText = `${q.changePercent < 0 ? '' : ''}${q.changePercent.toFixed(2)}%`;

                      return (
                        <div
                          key={token}
                          className={`group relative transition-colors ${
                            flash === 'up'
                              ? 'tick-flash-up'
                              : flash === 'down'
                                ? 'tick-flash-down'
                                : ''
                          } ${
                            isSelected
                              ? 'bg-[#F6F8FB] dark:bg-[#222222]'
                              : 'hover:bg-[#FAFAFA] dark:hover:bg-[#1E1E1E]'
                          }`}
                        >
                          <div className="relative px-3.5 py-2.5 flex items-center justify-between gap-2">
                            {/* Left: Symbol + tiny Exchange Tag */}
                            <button
                              type="button"
                              onClick={() => onSelectSymbolForTechnicals(token)}
                              className="text-left min-w-0 flex-1 cursor-pointer"
                            >
                              <div className="flex items-baseline gap-1.5 min-w-0">
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
                                <span className="text-[9.5px] text-[#9B9B9B] uppercase tracking-wide shrink-0">
                                  {exchangeLabel}
                                </span>
                              </div>
                              {showTechnicalsTag && (
                                <div className="text-[10.5px] mt-0.5 flex items-center gap-1 text-[#9B9B9B]">
                                  <span>{inst.sector}</span>
                                  <span>·</span>
                                  <span className={`font-medium ${getSignalTextClass(signal)}`}>
                                    {signal}
                                  </span>
                                </div>
                              )}
                            </button>

                            {/* Right: Kite Compact Change + % + Chevron + LTP */}
                            <div className="flex items-center gap-2.5 shrink-0 tabular-nums group-hover:opacity-0 transition-opacity">
                              <span className="text-[12px] text-[#9B9B9B] dark:text-[#8C8C8C] hidden sm:inline">
                                {absChangeText}
                              </span>
                              <span className="text-[12px] text-[#444444] dark:text-[#CFCFCF]">
                                {pctText}
                              </span>
                              <span className={`flex items-center gap-1 text-[13px] font-normal ${changeColor}`}>
                                {q.change >= 0 ? (
                                  <ChevronUp className="w-3.5 h-3.5 stroke-[1.75] shrink-0" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5 stroke-[1.75] shrink-0" />
                                )}
                                <span>{q.ltp.toFixed(2)}</span>
                              </span>
                            </div>

                            {/* Kite Floating Hover / Focus Actions */}
                            <div className="hidden group-hover:flex group-focus-within:flex items-center gap-1 absolute right-2.5 top-1/2 -translate-y-1/2 bg-[#FAFAFA]/95 dark:bg-[#1E1E1E]/95 pl-2">
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
                                </>
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
                              {groups.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMovingToken(movingToken === token ? null : token)
                                  }
                                  aria-label={`Move ${inst.symbol} to another group`}
                                  title="Move to group"
                                  className="w-7 h-6 rounded border border-[#E0E0E0] dark:border-[#333333] bg-white dark:bg-[#181818] text-[#666666] dark:text-[#A0A0A0] hover:border-[#4184F3] hover:text-[#4184F3] flex items-center justify-center cursor-pointer"
                                >
                                  <FolderInput className="w-3.5 h-3.5" />
                                </button>
                              )}
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

                          {/* Inline Move-to-Group Picker */}
                          {movingToken === token && (
                            <div className="px-3.5 py-2 bg-[#FAF7F2] dark:bg-[#1E1C19] border-t border-[#EFEFEF] dark:border-[#2B2B2B] flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="text-[#888888]">Move to:</span>
                              {groups
                                .filter((g) => g.id !== group.id)
                                .map((dest) => (
                                  <button
                                    key={dest.id}
                                    type="button"
                                    onClick={() => handleMoveTokenToGroup(token, dest.id)}
                                    className="px-2 py-0.5 bg-white dark:bg-[#262626] border border-[#E0E0E0] dark:border-[#363636] rounded text-[#4184F3] hover:border-[#4184F3] cursor-pointer"
                                  >
                                    {dest.name}
                                  </button>
                                ))}
                              <button
                                type="button"
                                onClick={() => setMovingToken(null)}
                                className="ml-auto text-[#9B9B9B] hover:text-[#444444] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          {/* Expandable Inline Level-2 Market Depth */}
                          {isDepthOpen && q.depth.buy.length > 0 && (
                            <div className="px-3.5 pb-3 pt-1.5 bg-[#FAFAFA] dark:bg-[#121212] border-t border-[#EEEEEE] dark:border-[#282828] text-[11px]">
                              <div className="grid grid-cols-2 gap-3 tabular-nums">
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
              )}
            </section>
          );
        })}
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
                onClick={() => {
                  onSelectWatchlist(id);
                  setTargetGroupIdForAdd(null);
                  setCreatingGroup(false);
                }}
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
