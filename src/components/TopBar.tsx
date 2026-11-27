import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  Command,
  Compass,
  Gavel,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Shield,
  ShoppingCart,
  Sun,
  Trash2,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import type {
  AuthUser,
  Instrument,
  MarketQuote,
  Order,
  OrderRequest,
  OrderSide,
  ProductType,
} from '../../shared/types.ts';
import { formatPrice, getChangeColorClass } from '../utils/format.ts';
import { KiteLogo } from './KiteLogo.tsx';
import type { WorkspaceConfig } from './TerminalView.tsx';

export type NavTab =
  | 'dashboard'
  | 'orders'
  | 'holdings'
  | 'positions'
  | 'bids'
  | 'technicals'
  | 'funds'
  | 'admin';

interface BasketItem {
  id: string;
  token: number;
  symbol: string;
  side: OrderSide;
  product: ProductType;
  quantity: number;
}

interface TopBarProps {
  user: AuthUser;
  activeTab: NavTab;
  terminalMode: boolean;
  workspaces: WorkspaceConfig[];
  activeWorkspaceId: string;
  mobilePane: 'watchlist' | 'workspace';
  onSelectMobilePane: (pane: 'watchlist' | 'workspace') => void;
  onSelectTab: (tab: NavTab) => void;
  onToggleTerminal: (next?: boolean) => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (name: string, openInTerminal: boolean) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  instruments: Instrument[];
  quotes: Record<number, MarketQuote>;
  recentOrders: Order[];
  onPlaceOrder: (req: OrderRequest) => Promise<{ ok: boolean; error?: string }>;
  niftyQuote?: MarketQuote;
  sensexQuote?: MarketQuote;
  wsConnected: boolean;
  openOrdersCount: number;
  openPositionsCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onLogout: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'orders', label: 'Orders' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'positions', label: 'Positions' },
  { id: 'bids', label: 'IPO & Bids' },
  { id: 'funds', label: 'Funds' },
  { id: 'admin', label: 'Admin', adminOnly: true },
];

function TerminalGridIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3.5" width="5.5" height="5.5" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11.5" width="5.5" height="5.5" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11.5" width="5.5" height="5.5" rx="0.6" stroke="currentColor" strokeWidth="1.5" />
      <rect
        x="14.2"
        y="2.3"
        width="4.6"
        height="4.6"
        rx="0.5"
        transform="rotate(45 14.2 2.3)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function TopBar({
  user,
  activeTab,
  terminalMode,
  workspaces,
  activeWorkspaceId,
  mobilePane,
  onSelectMobilePane,
  onSelectTab,
  onToggleTerminal,
  onSelectWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  instruments,
  quotes,
  recentOrders,
  onPlaceOrder,
  niftyQuote,
  sensexQuote,
  wsConnected,
  openOrdersCount,
  openPositionsCount,
  theme,
  onToggleTheme,
  onLogout,
}: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<'none' | 'workspace' | 'cart' | 'bell' | 'profile'>('none');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [openNewInTerminal, setOpenNewInTerminal] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Basket cart state
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [basketToken, setBasketToken] = useState<number>(738561);
  const [basketSide, setBasketSide] = useState<OrderSide>('BUY');
  const [basketProduct, setBasketProduct] = useState<ProductType>('CNC');
  const [basketQty, setBasketQty] = useState<number>(1);
  const [basketBusy, setBasketBusy] = useState(false);
  const [basketNotice, setBasketNotice] = useState<string | null>(null);

  // Notifications read state
  const [lastSeenOrderCount, setLastSeenOrderCount] = useState<number>(recentOrders.length);

  const headerRef = useRef<HTMLDivElement>(null);

  const tradableInstruments = instruments.filter((i) => !i.isIndex);

  useEffect(() => {
    if (openMenu === 'none' && !shortcutsOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu('none');
        setCreatingWorkspace(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu('none');
        setCreatingWorkspace(false);
        setShortcutsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu, shortcutsOpen]);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];

  const initials =
    user.userName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() || '')
      .join('') || user.userId.slice(0, 2);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user.role === 'admin',
  );

  const hasUnreadNotifications = recentOrders.length > lastSeenOrderCount;

  function toggleMenu(menu: 'workspace' | 'cart' | 'bell' | 'profile') {
    setCreatingWorkspace(false);
    setBasketNotice(null);
    if (menu === 'bell') {
      setLastSeenOrderCount(recentOrders.length);
    }
    setOpenMenu((prev) => (prev === menu ? 'none' : menu));
  }

  function handleCreateWorkspaceSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;
    onCreateWorkspace(trimmed, openNewInTerminal);
    setNewWorkspaceName('');
    setCreatingWorkspace(false);
    setOpenMenu('none');
  }

  function handleAddToBasket(e: FormEvent) {
    e.preventDefault();
    const inst = tradableInstruments.find((i) => i.token === basketToken) ?? tradableInstruments[0];
    if (!inst) return;
    const qty = Math.max(1, Math.floor(Number(basketQty) || 1));
    setBasket((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        token: inst.token,
        symbol: inst.symbol,
        side: basketSide,
        product: basketProduct,
        quantity: qty,
      },
    ]);
    setBasketNotice(null);
  }

  async function handleExecuteBasket() {
    if (basket.length === 0 || basketBusy) return;
    setBasketBusy(true);
    setBasketNotice(null);
    let succeeded = 0;
    let lastError: string | undefined;
    for (const item of basket) {
      const res = await onPlaceOrder({
        token: item.token,
        side: item.side,
        product: item.product,
        orderType: 'MARKET',
        quantity: item.quantity,
      });
      if (res.ok) succeeded++;
      else lastError = res.error;
    }
    setBasketBusy(false);
    if (succeeded === basket.length) {
      setBasket([]);
      setBasketNotice(`Executed ${succeeded} basket order${succeeded > 1 ? 's' : ''}.`);
    } else {
      setBasketNotice(lastError || `Executed ${succeeded}/${basket.length} orders.`);
    }
  }

  return (
    <div
      ref={headerRef}
      className="shrink-0 select-none z-20 bg-white dark:bg-[#181818] border-b border-[#EEEEEE] dark:border-[#282828] shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
    >
      <header
        data-testid="kite-header"
        className="h-[50px] w-full max-w-[1360px] min-[1560px]:max-w-[1440px] min-[1760px]:max-w-[1560px] mx-auto flex items-center justify-between"
      >
        {/* Left Zone: Indices aligned over MarketWatch rail */}
        <div
          data-testid="top-indices-rail"
          className="hidden lg:flex items-center justify-between gap-2 lg:w-[383px] xl:w-[432px] shrink-0 h-full px-3 xl:px-3.5 border-r border-[#EEEEEE] dark:border-[#282828] overflow-hidden"
        >
          <div
            data-testid="index-nifty"
            className="flex items-baseline gap-1 whitespace-nowrap shrink-0"
          >
            <span className="text-[11px] font-medium text-[#444444] dark:text-[#E0E0E0] tracking-[-0.01em]">
              NIFTY 50
            </span>
            <span
              className={`font-mono-num text-[11px] font-medium ${getChangeColorClass(niftyQuote?.change ?? 0)}`}
            >
              {niftyQuote ? niftyQuote.ltp.toFixed(2) : '—'}
            </span>
            <span className="font-mono-num text-[10px] font-normal text-[#9B9B9B] dark:text-[#8C8C8C]">
              {niftyQuote
                ? `${niftyQuote.change.toFixed(2)} (${niftyQuote.changePercent.toFixed(2)}%)`
                : ''}
            </span>
          </div>

          <div
            data-testid="index-sensex"
            className="flex items-baseline gap-1 whitespace-nowrap shrink-0"
          >
            <span className="text-[11px] font-medium text-[#444444] dark:text-[#E0E0E0] tracking-[-0.01em]">
              SENSEX
            </span>
            <span
              className={`font-mono-num text-[11px] font-medium ${getChangeColorClass(sensexQuote?.change ?? 0)}`}
            >
              {sensexQuote ? sensexQuote.ltp.toFixed(2) : '—'}
            </span>
            <span className="font-mono-num text-[10px] font-normal text-[#9B9B9B] dark:text-[#8C8C8C] hidden xl:inline">
              {sensexQuote
                ? `${sensexQuote.change.toFixed(2)} (${sensexQuote.changePercent.toFixed(2)}%)`
                : ''}
            </span>
          </div>
        </div>

        {/* Right Zone: Kite Logo + Joined Workspace/Terminal Selector on Left, Exact Kite Menu + Cart + Bell + Profile on Right */}
        <div className="flex-1 flex items-center justify-between gap-2.5 xl:gap-3 px-3.5 xl:px-5 min-[1760px]:px-7 min-w-0 h-full">
          <div className="flex items-center gap-3 xl:gap-3.5 min-[1760px]:gap-5 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => {
                onToggleTerminal(false);
                onSelectTab('dashboard');
                onSelectMobilePane('workspace');
              }}
              className="flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Home"
            >
              <KiteLogo variant="mark" className="h-[18px] w-auto" />
              <span className="text-sm font-semibold tracking-tight text-[#444444] dark:text-[#F3F4F6] lg:hidden">
                Terminal
              </span>
            </button>

            {/* Kite-style Joined Workspace Dropdown + Terminal Grid Icon */}
            <div className="relative hidden lg:flex items-center h-[32px] border border-[#EAEAEA] dark:border-[#303030] rounded-[3px] bg-white dark:bg-[#1E1E1E]">
              <button
                type="button"
                onClick={() => toggleMenu('workspace')}
                aria-expanded={openMenu === 'workspace'}
                aria-haspopup="menu"
                aria-label="Select workspace"
                className="h-full min-w-[100px] min-[1400px]:min-w-[126px] min-[1760px]:min-w-[158px] px-2.5 xl:px-3 flex items-center justify-between gap-2 text-[12px] font-normal text-[#444444] dark:text-[#E0E0E0] hover:bg-[#FAFAFA] dark:hover:bg-[#252525] border-r border-[#EAEAEA] dark:border-[#303030] cursor-pointer transition-colors"
              >
                <span className="truncate">{activeWorkspace?.name ?? 'Default'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#9B9B9B] shrink-0 transition-transform ${
                    openMenu === 'workspace' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => onToggleTerminal()}
                aria-label={terminalMode ? 'Exit terminal' : 'Go to terminal'}
                title={terminalMode ? 'Exit terminal' : 'Go to terminal'}
                className={`group relative h-full w-[34px] flex items-center justify-center transition-colors cursor-pointer ${
                  terminalMode
                    ? 'bg-[#FFF5F2] dark:bg-[#2C1D18] text-[#FF5722]'
                    : 'text-[#8C8C8C] hover:text-[#444444] dark:hover:text-[#E0E0E0] hover:bg-[#FAFAFA] dark:hover:bg-[#252525]'
                }`}
              >
                <TerminalGridIcon className="w-[15px] h-[15px]" />
                <span
                  role="tooltip"
                  className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 px-2 py-1 rounded-[2px] bg-[#222222] dark:bg-[#2D2D2D] text-white text-[11px] whitespace-nowrap shadow z-50"
                >
                  {terminalMode ? 'Exit terminal' : 'Go to terminal'}
                </span>
              </button>

              {openMenu === 'workspace' && (
                <div
                  role="menu"
                  aria-label="Workspaces menu"
                  className="absolute left-0 top-[calc(100%+6px)] w-64 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#303030] shadow-[0_4px_16px_rgba(0,0,0,0.08)] rounded z-50 py-1.5 text-xs"
                >
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#9B9B9B] font-semibold border-b border-[#EEEEEE] dark:border-[#282828]">
                    Workspaces
                  </div>

                  <div className="py-1 max-h-48 overflow-y-auto">
                    {workspaces.map((ws) => {
                      const isSelected = ws.id === activeWorkspace?.id;
                      return (
                        <div
                          key={ws.id}
                          className="flex items-center justify-between px-3 py-1.5 hover:bg-[#F5F7FA] dark:hover:bg-[#262626]"
                        >
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              onSelectWorkspace(ws.id);
                              setOpenMenu('none');
                              setCreatingWorkspace(false);
                            }}
                            className={`flex-1 text-left flex items-center gap-2 truncate cursor-pointer ${
                              isSelected
                                ? 'text-[#FF5722] font-medium'
                                : 'text-[#444444] dark:text-[#D4D4D4]'
                            }`}
                          >
                            <Check
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'opacity-100 text-[#FF5722]' : 'opacity-0'
                              }`}
                            />
                            <span className="truncate">{ws.name}</span>
                          </button>

                          {ws.id !== 'default' && (
                            <button
                              type="button"
                              onClick={() => onDeleteWorkspace(ws.id)}
                              aria-label={`Delete workspace ${ws.name}`}
                              className="p-1 text-[#9B9B9B] hover:text-[#DF514C] cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-[#EEEEEE] dark:border-[#282828] pt-1.5 px-3 pb-1">
                    {!creatingWorkspace ? (
                      <button
                        type="button"
                        onClick={() => setCreatingWorkspace(true)}
                        className="w-full py-1.5 flex items-center gap-1.5 text-[#4184F3] hover:underline font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New workspace</span>
                      </button>
                    ) : (
                      <form onSubmit={handleCreateWorkspaceSubmit} className="space-y-2 py-1">
                        <input
                          type="text"
                          value={newWorkspaceName}
                          onChange={(e) => setNewWorkspaceName(e.target.value)}
                          placeholder="Workspace name (e.g. Intraday)"
                          autoFocus
                          maxLength={24}
                          className="w-full px-2 py-1 text-xs border border-[#E0E0E0] dark:border-[#383838] rounded-[2px] bg-white dark:bg-[#141414] text-[#444444] dark:text-[#E0E0E0] focus:outline-none focus:border-[#4184F3]"
                        />
                        <label className="flex items-center gap-1.5 text-[11px] text-[#666666] dark:text-[#A0A0A0] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={openNewInTerminal}
                            onChange={(e) => setOpenNewInTerminal(e.target.checked)}
                            className="accent-[#FF5722]"
                          />
                          <span>Open in terminal mode</span>
                        </label>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setCreatingWorkspace(false);
                              setNewWorkspaceName('');
                            }}
                            className="px-2 py-1 text-[11px] text-[#666666] dark:text-[#A0A0A0] hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-2.5 py-1 text-[11px] font-medium bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-[2px] cursor-pointer"
                          >
                            Create
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right-Aligned Kite Menu Items + Cart + Bell + User Avatar/ID */}
          <div className="flex items-center gap-3 xl:gap-4 min-[1560px]:gap-5 min-[1760px]:gap-6 ml-auto min-w-0 h-full">
            <nav
              aria-label="Primary sections"
              className={`hidden lg:flex items-center h-full ${
                visibleNavItems.length > 6
                  ? 'gap-2.5 xl:gap-3 min-[1400px]:gap-4 min-[1760px]:gap-6'
                  : 'gap-3 xl:gap-4 min-[1400px]:gap-5 min-[1760px]:gap-7'
              }`}
            >
              {visibleNavItems.map((item) => {
                const isActive = !terminalMode && activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onToggleTerminal(false);
                      onSelectTab(item.id);
                    }}
                    className={`h-full px-0.5 text-[12px] whitespace-nowrap shrink-0 flex items-center gap-1 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-[#FF5722] font-normal'
                        : 'text-[#444444] dark:text-[#CCCCCC] hover:text-[#FF5722] dark:hover:text-[#FF5722] font-normal'
                    }`}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Kite Utility Icons: Cart + Notifications Bell + User Avatar/ID */}
            <div className="flex items-center gap-2 xl:gap-2.5 min-[1760px]:gap-4 shrink-0">
              {/* Cart (Basket Orders) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleMenu('cart')}
                  aria-label="Basket cart"
                  aria-expanded={openMenu === 'cart'}
                  title="Basket orders"
                  className={`relative p-1.5 rounded transition-colors cursor-pointer ${
                    openMenu === 'cart'
                      ? 'text-[#FF5722]'
                      : 'text-[#666666] dark:text-[#A0A0A0] hover:text-[#FF5722] dark:hover:text-[#FF5722]'
                  }`}
                >
                  <ShoppingCart className="w-[16px] h-[16px] stroke-[1.75]" />
                  {basket.length > 0 && (
                    <span className="absolute -top-0.5 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#FF5722] text-white text-[9px] font-semibold flex items-center justify-center tabular-nums">
                      {basket.length}
                    </span>
                  )}
                </button>

                {openMenu === 'cart' && (
                  <div
                    role="dialog"
                    aria-label="Basket orders"
                    className="absolute right-0 top-[calc(100%+10px)] w-80 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#303030] shadow-[0_6px_20px_rgba(0,0,0,0.1)] rounded z-50 text-xs overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#EEEEEE] dark:border-[#282828]">
                      <span className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                        Basket ({basket.length})
                      </span>
                      {basket.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBasket([])}
                          className="text-[11px] text-[#9B9B9B] hover:text-[#DF514C] cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    <form
                      onSubmit={handleAddToBasket}
                      className="p-3 border-b border-[#EEEEEE] dark:border-[#282828] space-y-2 bg-[#FAFAFA] dark:bg-[#171717]"
                    >
                      <div className="grid grid-cols-12 gap-1.5">
                        <select
                          aria-label="Select basket instrument"
                          value={basketToken}
                          onChange={(e) => setBasketToken(Number(e.target.value))}
                          className="col-span-6 px-2 py-1 border border-[#E0E0E0] dark:border-[#333333] rounded-[2px] bg-white dark:bg-[#141414] text-[#444444] dark:text-[#E0E0E0]"
                        >
                          {tradableInstruments.slice(0, 20).map((inst) => (
                            <option key={inst.token} value={inst.token}>
                              {inst.symbol}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Order side"
                          value={basketSide}
                          onChange={(e) => setBasketSide(e.target.value as OrderSide)}
                          className="col-span-3 px-1.5 py-1 border border-[#E0E0E0] dark:border-[#333333] rounded-[2px] bg-white dark:bg-[#141414] text-[#444444] dark:text-[#E0E0E0]"
                        >
                          <option value="BUY">BUY</option>
                          <option value="SELL">SELL</option>
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={basketQty}
                          onChange={(e) => setBasketQty(Number(e.target.value))}
                          aria-label="Basket quantity"
                          className="col-span-3 px-2 py-1 border border-[#E0E0E0] dark:border-[#333333] rounded-[2px] bg-white dark:bg-[#141414] text-[#444444] dark:text-[#E0E0E0] tabular-nums"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2 text-[11px] text-[#666666] dark:text-[#A0A0A0]">
                          {(['CNC', 'MIS'] as const).map((p) => (
                            <label key={p} className="inline-flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name="basketProduct"
                                checked={basketProduct === p}
                                onChange={() => setBasketProduct(p)}
                                className="accent-[#FF5722]"
                              />
                              <span>{p}</span>
                            </label>
                          ))}
                        </div>
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-[#4184F3] hover:bg-[#3367D6] text-white font-medium rounded-[2px] cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                    </form>

                    <div className="max-h-48 overflow-y-auto divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                      {basket.length === 0 ? (
                        <div className="p-4 text-center text-[#9B9B9B]">
                          Your order basket is empty. Add instruments above to execute together.
                        </div>
                      ) : (
                        basket.map((item) => {
                          const ltp = quotes[item.token]?.ltp ?? 0;
                          return (
                            <div
                              key={item.id}
                              className="px-3.5 py-2 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`font-semibold text-[10px] ${
                                      item.side === 'BUY' ? 'text-[#4184F3]' : 'text-[#FF5722]'
                                    }`}
                                  >
                                    {item.side}
                                  </span>
                                  <span className="font-medium text-[#444444] dark:text-[#E0E0E0] truncate">
                                    {item.symbol}
                                  </span>
                                  <span className="text-[10px] text-[#9B9B9B]">{item.product}</span>
                                </div>
                                <div className="text-[11px] text-[#9B9B9B] tabular-nums">
                                  Qty {item.quantity} · MKT {ltp > 0 ? `≈ ₹${formatPrice(ltp)}` : ''}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setBasket((prev) => prev.filter((b) => b.id !== item.id))
                                }
                                aria-label={`Remove ${item.symbol} from basket`}
                                className="p-1 text-[#9B9B9B] hover:text-[#DF514C] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {basketNotice && (
                      <div className="px-3.5 py-2 text-[11px] text-[#4CAF50] border-t border-[#EEEEEE] dark:border-[#282828]">
                        {basketNotice}
                      </div>
                    )}

                    {basket.length > 0 && (
                      <div className="p-3 border-t border-[#EEEEEE] dark:border-[#282828] flex justify-end">
                        <button
                          type="button"
                          disabled={basketBusy}
                          onClick={handleExecuteBasket}
                          className="w-full py-1.5 bg-[#4184F3] hover:bg-[#3367D6] disabled:opacity-60 text-white font-medium rounded-[2px] cursor-pointer"
                        >
                          {basketBusy ? 'Executing...' : `Execute ${basket.length} order${basket.length > 1 ? 's' : ''}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notifications Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleMenu('bell')}
                  aria-label="Notifications"
                  aria-expanded={openMenu === 'bell'}
                  title="Notifications"
                  className={`relative p-1.5 rounded transition-colors cursor-pointer ${
                    openMenu === 'bell'
                      ? 'text-[#FF5722]'
                      : 'text-[#666666] dark:text-[#A0A0A0] hover:text-[#FF5722] dark:hover:text-[#FF5722]'
                  }`}
                >
                  <Bell className="w-[16px] h-[16px] stroke-[1.75]" />
                  {hasUnreadNotifications && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#FF5722]" />
                  )}
                </button>

                {openMenu === 'bell' && (
                  <div
                    role="dialog"
                    aria-label="Notifications panel"
                    className="absolute right-0 top-[calc(100%+10px)] w-80 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#303030] shadow-[0_6px_20px_rgba(0,0,0,0.1)] rounded z-50 text-xs overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#EEEEEE] dark:border-[#282828]">
                      <span className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                        Notifications
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#9B9B9B]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            wsConnected ? 'bg-[#4CAF50]' : 'bg-[#DF514C]'
                          }`}
                        />
                        {wsConnected ? 'Live feed' : 'Offline'}
                      </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-[#EEEEEE] dark:divide-[#282828]">
                      {recentOrders.length === 0 ? (
                        <div className="p-5 text-center text-[#9B9B9B]">
                          No recent order alerts.
                        </div>
                      ) : (
                        recentOrders.slice(0, 8).map((ord) => (
                          <button
                            key={ord.id}
                            type="button"
                            onClick={() => {
                              onToggleTerminal(false);
                              onSelectTab('orders');
                              onSelectMobilePane('workspace');
                              setOpenMenu('none');
                            }}
                            className="w-full text-left px-3.5 py-2.5 hover:bg-[#F5F7FA] dark:hover:bg-[#252525] cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-[#444444] dark:text-[#E0E0E0]">
                                {ord.side} {ord.quantity} {ord.symbol}
                              </span>
                              <span
                                className={`text-[10px] font-medium ${
                                  ord.status === 'COMPLETE'
                                    ? 'text-[#4CAF50]'
                                    : ord.status === 'REJECTED' || ord.status === 'CANCELLED'
                                      ? 'text-[#DF514C]'
                                      : 'text-[#4184F3]'
                                }`}
                              >
                                {ord.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#9B9B9B] mt-0.5 tabular-nums">
                              {ord.product} · {ord.orderType} @ ₹{formatPrice(ord.averagePrice || ord.price)}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Kite User Avatar + Client ID Profile Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleMenu('profile')}
                  aria-expanded={openMenu === 'profile'}
                  aria-haspopup="menu"
                  aria-label="User profile menu"
                  className="flex items-center gap-2 py-1 pl-1 pr-0.5 rounded hover:text-[#FF5722] transition-colors cursor-pointer group"
                >
                  <span
                    aria-hidden="true"
                    className="w-[24px] h-[24px] rounded-full bg-[#F2EBF9] dark:bg-[#2A2636] text-[#A27CD1] dark:text-[#B39DDB] text-[9.5px] font-medium inline-flex items-center justify-center shrink-0"
                  >
                    {initials}
                  </span>
                  <span className="font-mono-num text-[12px] font-normal text-[#555555] dark:text-[#E0E0E0] group-hover:text-[#FF5722] transition-colors">
                    {user.userId}
                  </span>
                </button>

                {openMenu === 'profile' && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-[calc(100%+10px)] w-64 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#303030] shadow-[0_6px_20px_rgba(0,0,0,0.1)] rounded z-50 py-1.5 text-xs"
                  >
                    <div className="px-4 py-2.5 border-b border-[#EEEEEE] dark:border-[#282828]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[14px] text-[#444444] dark:text-[#E0E0E0] truncate">
                          {user.userName}
                        </span>
                        {user.role === 'admin' && (
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#FF5722] shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9B9B9B] dark:text-[#8C8C8C] truncate mt-0.5">
                        {user.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#9B9B9B] mt-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            wsConnected ? 'bg-[#4CAF50]' : 'bg-[#DF514C]'
                          }`}
                        />
                        <span>{wsConnected ? 'Live stream connected' : 'Stream offline'}</span>
                      </div>
                    </div>

                    {/* Theme Toggle Row inside Profile Menu (exact Kite style) */}
                    <div className="px-4 py-2 border-b border-[#EEEEEE] dark:border-[#282828] flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[#444444] dark:text-[#D4D4D4]">
                        {theme === 'dark' ? (
                          <Sun className="w-3.5 h-3.5 text-[#9B9B9B]" />
                        ) : (
                          <Moon className="w-3.5 h-3.5 text-[#9B9B9B]" />
                        )}
                        <span>Dark mode</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={theme === 'dark'}
                        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        onClick={onToggleTheme}
                        className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${
                          theme === 'dark' ? 'bg-[#FF5722]' : 'bg-[#DCDCDC]'
                        }`}
                      >
                        <span
                          className={`block w-3 h-3 rounded-full bg-white transition-transform ${
                            theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="py-1 border-b border-[#EEEEEE] dark:border-[#282828]">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onToggleTerminal(false);
                          onSelectTab('dashboard');
                          onSelectMobilePane('workspace');
                          setOpenMenu('none');
                        }}
                        className="w-full text-left px-4 py-1.5 flex items-center gap-2.5 text-[#444444] dark:text-[#D4D4D4] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-[#9B9B9B]" />
                        <span>My profile</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onToggleTerminal(false);
                          onSelectTab('holdings');
                          onSelectMobilePane('workspace');
                          setOpenMenu('none');
                        }}
                        className="w-full text-left px-4 py-1.5 flex items-center gap-2.5 text-[#444444] dark:text-[#D4D4D4] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
                      >
                        <Compass className="w-3.5 h-3.5 text-[#9B9B9B]" />
                        <span>Console · Portfolio</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onToggleTerminal(false);
                          onSelectTab('bids');
                          onSelectMobilePane('workspace');
                          setOpenMenu('none');
                        }}
                        className="w-full text-left px-4 py-1.5 flex items-center gap-2.5 text-[#444444] dark:text-[#D4D4D4] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
                      >
                        <Gavel className="w-3.5 h-3.5 text-[#9B9B9B]" />
                        <span>IPO &amp; Bids</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onToggleTerminal(false);
                          onSelectTab('technicals');
                          onSelectMobilePane('workspace');
                          setOpenMenu('none');
                        }}
                        className="w-full text-left px-4 py-1.5 flex items-center gap-2.5 text-[#444444] dark:text-[#D4D4D4] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
                      >
                        <Activity className="w-3.5 h-3.5 text-[#9B9B9B]" />
                        <span>Live Technicals</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onToggleTerminal(false);
                          onSelectTab('funds');
                          onSelectMobilePane('workspace');
                          setOpenMenu('none');
                        }}
                        className="w-full text-left px-4 py-1.5 flex items-center gap-2.5 text-[#444444] dark:text-[#D4D4D4] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
                      >
                        <Wallet className="w-3.5 h-3.5 text-[#9B9B9B]" />
                        <span>Funds</span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpenMenu('none');
                          setShortcutsOpen(true);
                        }}
                        className="w-full text-left px-4 py-1.5 flex items-center gap-2.5 text-[#444444] dark:text-[#D4D4D4] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
                      >
                        <Command className="w-3.5 h-3.5 text-[#9B9B9B]" />
                        <span>Keyboard shortcuts</span>
                      </button>
                    </div>

                    {user.role === 'admin' && (
                      <div className="py-1 border-b border-[#EEEEEE] dark:border-[#282828]">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onToggleTerminal(false);
                            onSelectTab('admin');
                            onSelectMobilePane('workspace');
                            setOpenMenu('none');
                          }}
                          className="w-full text-left px-4 py-1.5 flex items-center gap-2.5 text-[#FF5722] font-medium hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          <span>Admin Console</span>
                        </button>
                      </div>
                    )}

                    <div className="pt-1">
                      <button
                        type="button"
                        role="menuitem"
                        aria-label="Logout"
                        onClick={() => {
                          setOpenMenu('none');
                          onLogout();
                        }}
                        className="w-full text-left px-4 py-1.5 flex items-center gap-2.5 text-[#444444] dark:text-[#D4D4D4] hover:text-[#DF514C] dark:hover:text-[#F87171] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-[#9B9B9B]" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile / Tablet Compact Navigation Bar */}
      <nav
        aria-label="Mobile sections"
        className="flex lg:hidden items-center gap-1 px-2 border-t border-[#EEEEEE] dark:border-[#282828] overflow-x-auto bg-[#F9F9F9] dark:bg-[#121212]"
      >
        <button
          type="button"
          onClick={() => onSelectMobilePane('watchlist')}
          className={`relative h-9 px-2.5 text-xs font-medium whitespace-nowrap shrink-0 flex items-center cursor-pointer ${
            mobilePane === 'watchlist'
              ? 'text-[#FF5722]'
              : 'text-[#666666] dark:text-[#A0A0A0]'
          }`}
        >
          Watchlist
          {mobilePane === 'watchlist' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5722]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onToggleTerminal(true);
            onSelectMobilePane('workspace');
          }}
          className={`relative h-9 px-2.5 text-xs font-medium whitespace-nowrap shrink-0 flex items-center cursor-pointer ${
            mobilePane === 'workspace' && terminalMode
              ? 'text-[#FF5722]'
              : 'text-[#4184F3]'
          }`}
        >
          Terminal
          {mobilePane === 'workspace' && terminalMode && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5722]" />
          )}
        </button>

        {visibleNavItems.map((item) => {
          const isActive =
            mobilePane === 'workspace' && !terminalMode && activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onToggleTerminal(false);
                onSelectTab(item.id);
                onSelectMobilePane('workspace');
              }}
              className={`relative h-9 px-2.5 text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                isActive
                  ? 'text-[#FF5722]'
                  : 'text-[#666666] dark:text-[#A0A0A0]'
              }`}
            >
              <span>{item.label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5722]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Keyboard Shortcuts Modal */}
      {shortcutsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcuts-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#1C1C1C] border border-[#E5E5E5] dark:border-[#303030] rounded shadow-xl overflow-hidden text-xs">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EEEEEE] dark:border-[#282828]">
              <h2
                id="shortcuts-modal-title"
                className="text-[14px] font-medium text-[#444444] dark:text-[#E0E0E0] flex items-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4 text-[#FF5722]" />
                <span>Keyboard shortcuts</span>
              </h2>
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                aria-label="Close shortcuts"
                className="p-1 text-[#9B9B9B] hover:text-[#444444] dark:hover:text-[#E0E0E0] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 divide-y divide-[#EEEEEE] dark:divide-[#282828]">
              {[
                ['B / S', 'Open Buy or Sell order window from watchlist'],
                ['Esc', 'Close active modal, popover, or menu'],
                ['Click symbol', 'Open live technicals & 5-level market depth'],
                ['Terminal icon', 'Toggle multi-pane Terminal workspace'],
              ].map(([key, desc]) => (
                <div key={key} className="py-2.5 flex items-center justify-between gap-4">
                  <span className="text-[#666666] dark:text-[#A0A0A0]">{desc}</span>
                  <kbd className="px-2 py-0.5 text-[11px] font-mono-num bg-[#F5F5F5] dark:bg-[#262626] border border-[#E0E0E0] dark:border-[#383838] rounded-[2px] text-[#444444] dark:text-[#E0E0E0] whitespace-nowrap">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-[#EEEEEE] dark:border-[#282828] flex justify-end">
              <button
                type="button"
                onClick={() => setShortcutsOpen(false)}
                className="px-4 py-1.5 bg-[#4184F3] hover:bg-[#3367D6] text-white font-medium rounded-[2px] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



