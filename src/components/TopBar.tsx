import { LogOut, Moon, Sun } from 'lucide-react';
import type { AuthUser, MarketQuote } from '../../shared/types.ts';
import { formatPrice, formatSigned, getChangeColorClass } from '../utils/format.ts';
import { KiteLogo } from './KiteLogo.tsx';

export type NavTab =
  | 'dashboard'
  | 'orders'
  | 'holdings'
  | 'positions'
  | 'technicals'
  | 'funds'
  | 'admin';

interface TopBarProps {
  user: AuthUser;
  activeTab: NavTab;
  mobilePane: 'watchlist' | 'workspace';
  onSelectMobilePane: (pane: 'watchlist' | 'workspace') => void;
  onSelectTab: (tab: NavTab) => void;
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
  { id: 'technicals', label: 'Technicals' },
  { id: 'funds', label: 'Funds & API', adminOnly: true },
  { id: 'admin', label: 'Admin', adminOnly: true },
];

export function TopBar({
  user,
  activeTab,
  mobilePane,
  onSelectMobilePane,
  onSelectTab,
  niftyQuote,
  sensexQuote,
  wsConnected,
  openOrdersCount,
  openPositionsCount,
  theme,
  onToggleTheme,
  onLogout,
}: TopBarProps) {
  const initials = user.userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('') || user.userId.slice(0, 2);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user.role === 'admin',
  );

  return (
    <div className="shrink-0 select-none z-20 bg-white dark:bg-[#181818] border-b border-[#EEEEEE] dark:border-[#282828] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <header className="h-12 flex items-center justify-between">
        {/* Left Zone: Indices aligned over MarketWatch rail */}
        <div className="hidden lg:flex items-center justify-between lg:w-[390px] xl:w-[410px] shrink-0 h-full px-4 border-r border-[#EEEEEE] dark:border-[#282828] text-[12px]">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-semibold text-[#444444] dark:text-[#E0E0E0] tracking-tight">
              NIFTY 50
            </span>
            <span
              className={`font-mono-num font-semibold ${getChangeColorClass(niftyQuote?.change ?? 0)}`}
            >
              {niftyQuote ? formatPrice(niftyQuote.ltp) : '—'}
            </span>
            <span className="font-mono-num text-[11px] text-[#9B9B9B] dark:text-[#8C8C8C]">
              {niftyQuote
                ? `${formatSigned(niftyQuote.change)} (${niftyQuote.changePercent >= 0 ? '+' : ''}${niftyQuote.changePercent.toFixed(2)}%)`
                : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-semibold text-[#444444] dark:text-[#E0E0E0] tracking-tight">
              SENSEX
            </span>
            <span
              className={`font-mono-num font-semibold ${getChangeColorClass(sensexQuote?.change ?? 0)}`}
            >
              {sensexQuote ? formatPrice(sensexQuote.ltp) : '—'}
            </span>
            <span className="font-mono-num text-[11px] text-[#9B9B9B] dark:text-[#8C8C8C] hidden xl:inline">
              {sensexQuote
                ? `${sensexQuote.changePercent >= 0 ? '+' : ''}${sensexQuote.changePercent.toFixed(2)}%`
                : ''}
            </span>
          </div>
        </div>

        {/* Right Zone: Kite Mark + Nav + User Controls */}
        <div className="flex-1 flex items-center justify-between gap-4 px-3 lg:px-6 min-w-0 h-full">
          <div className="flex items-center gap-6 min-w-0">
            <button
              type="button"
              onClick={() => {
                onSelectTab('dashboard');
                onSelectMobilePane('workspace');
              }}
              className="flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Kite Home"
            >
              <KiteLogo variant="mark" className="w-6 h-6" />
              <span className="text-sm font-semibold tracking-tight text-[#444444] dark:text-[#F3F4F6] lg:hidden">
                Kite
              </span>
            </button>

            <nav
              aria-label="Primary sections"
              className="hidden lg:flex items-center gap-6"
            >
              {visibleNavItems.map((item) => {
                const isActive = activeTab === item.id;
                const badgeCount =
                  item.id === 'orders'
                    ? openOrdersCount
                    : item.id === 'positions'
                      ? openPositionsCount
                      : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`relative h-12 px-0.5 text-[13px] font-normal whitespace-nowrap shrink-0 flex items-center gap-1 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-[#FF5722] font-medium'
                        : 'text-[#444444] dark:text-[#CCCCCC] hover:text-[#FF5722] dark:hover:text-[#FF5722]'
                    }`}
                  >
                    <span>{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="text-[11px] font-mono-num text-[#FF5722] font-semibold">
                        ({badgeCount})
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5722]" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className="flex items-center gap-1.5 text-[11px] text-[#9B9B9B] dark:text-[#8C8C8C] whitespace-nowrap"
              title={wsConnected ? 'Live market stream connected' : 'Reconnecting stream'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  wsConnected ? 'bg-[#4CAF50]' : 'bg-[#DF514C]'
                }`}
              />
              <span>{wsConnected ? 'Live' : 'Offline'}</span>
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="p-1.5 rounded text-[#666666] dark:text-[#A0A0A0] hover:bg-[#F5F7FA] dark:hover:bg-[#242424] hover:text-[#444444] dark:hover:text-[#E0E0E0] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2 text-xs pl-2 border-l border-[#EEEEEE] dark:border-[#282828]">
              <span
                aria-hidden="true"
                className="hidden sm:inline-flex w-6 h-6 rounded-full bg-[#F3EEFE] dark:bg-[#2A2636] text-[#7E57C2] dark:text-[#B39DDB] text-[10px] font-semibold items-center justify-center"
              >
                {initials}
              </span>
              <span className="font-mono-num font-medium text-[#444444] dark:text-[#E0E0E0]">
                {user.userId}
              </span>
              {user.role === 'admin' && (
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#FF5722]">
                  Admin
                </span>
              )}
              <button
                type="button"
                onClick={onLogout}
                aria-label="Logout"
                title="Logout"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#666666] dark:text-[#A0A0A0] hover:text-[#DF514C] dark:hover:text-[#F87171] hover:bg-[#F5F7FA] dark:hover:bg-[#242424] rounded transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
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

        {visibleNavItems.map((item) => {
          const isActive = mobilePane === 'workspace' && activeTab === item.id;
          const badgeCount =
            item.id === 'orders'
              ? openOrdersCount
              : item.id === 'positions'
                ? openPositionsCount
                : 0;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
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
              {badgeCount > 0 && (
                <span className="text-[10px] font-mono-num text-[#FF5722] font-semibold">
                  ({badgeCount})
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF5722]" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
