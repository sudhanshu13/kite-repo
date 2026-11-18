import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Check,
  ChevronDown,
  LogOut,
  Moon,
  Plus,
  Sun,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import type { AuthUser, MarketQuote } from '../../shared/types.ts';
import { formatPrice, formatSigned, getChangeColorClass } from '../utils/format.ts';
import { KiteLogo } from './KiteLogo.tsx';
import type { WorkspaceConfig } from './TerminalView.tsx';

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
  niftyQuote,
  sensexQuote,
  wsConnected,
  openOrdersCount,
  openPositionsCount,
  theme,
  onToggleTheme,
  onLogout,
}: TopBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [openNewInTerminal, setOpenNewInTerminal] = useState(true);

  const profileRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen && !workspaceOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (workspaceRef.current && !workspaceRef.current.contains(e.target as Node)) {
        setWorkspaceOpen(false);
        setCreatingWorkspace(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileOpen(false);
        setWorkspaceOpen(false);
        setCreatingWorkspace(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen, workspaceOpen]);

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

  function handleCreateWorkspaceSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = newWorkspaceName.trim();
    if (!trimmed) return;
    onCreateWorkspace(trimmed, openNewInTerminal);
    setNewWorkspaceName('');
    setCreatingWorkspace(false);
    setWorkspaceOpen(false);
  }

  return (
    <div className="shrink-0 select-none z-20 bg-white dark:bg-[#181818] border-b border-[#EEEEEE] dark:border-[#282828] shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
      <header className="h-[50px] flex items-center justify-between">
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

        {/* Right Zone: Kite Logo + Joined Workspace/Terminal Selector on Left, Nav & Profile Right-Aligned */}
        <div className="flex-1 flex items-center justify-between gap-4 px-4 lg:px-7 min-w-0 h-full">
          <div className="flex items-center gap-5 min-w-0">
            <button
              type="button"
              onClick={() => {
                onToggleTerminal(false);
                onSelectTab('dashboard');
                onSelectMobilePane('workspace');
              }}
              className="flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Kite Home"
            >
              <KiteLogo variant="mark" className="w-[22px] h-[22px]" />
              <span className="text-sm font-semibold tracking-tight text-[#444444] dark:text-[#F3F4F6] lg:hidden">
                Kite
              </span>
            </button>

            {/* Kite-style Joined Workspace Dropdown + Terminal Grid Icon */}
            <div
              ref={workspaceRef}
              className="relative hidden lg:flex items-center h-[32px] border border-[#EEEEEE] dark:border-[#303030] rounded-[3px] bg-white dark:bg-[#1E1E1E]"
            >
              <button
                type="button"
                onClick={() => {
                  setWorkspaceOpen((prev) => !prev);
                  setProfileOpen(false);
                }}
                aria-expanded={workspaceOpen}
                aria-haspopup="menu"
                aria-label="Select workspace"
                className="h-full min-w-[165px] xl:min-w-[185px] px-3 flex items-center justify-between gap-3 text-[12.5px] font-normal text-[#444444] dark:text-[#E0E0E0] hover:bg-[#FAFAFA] dark:hover:bg-[#252525] border-r border-[#EEEEEE] dark:border-[#303030] cursor-pointer transition-colors"
              >
                <span className="truncate">{activeWorkspace?.name ?? 'Default'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#9B9B9B] shrink-0 transition-transform ${
                    workspaceOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => onToggleTerminal()}
                aria-label={terminalMode ? 'Exit terminal' : 'Go to terminal'}
                title={terminalMode ? 'Exit terminal' : 'Go to terminal'}
                className={`group relative h-full w-[36px] flex items-center justify-center transition-colors cursor-pointer ${
                  terminalMode
                    ? 'bg-[#FFF5F2] dark:bg-[#2C1D18] text-[#FF5722]'
                    : 'text-[#8C8C8C] hover:text-[#444444] dark:hover:text-[#E0E0E0] hover:bg-[#FAFAFA] dark:hover:bg-[#252525]'
                }`}
              >
                <TerminalGridIcon className="w-[16px] h-[16px]" />
                <span
                  role="tooltip"
                  className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 px-2 py-1 rounded-[2px] bg-[#222222] dark:bg-[#2D2D2D] text-white text-[11px] whitespace-nowrap shadow z-50"
                >
                  {terminalMode ? 'Exit terminal' : 'Go to terminal'}
                </span>
              </button>

              {workspaceOpen && (
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
                              setWorkspaceOpen(false);
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

          <div className="flex items-center gap-4 lg:gap-5 ml-auto min-w-0 h-full">
            <nav
              aria-label="Primary sections"
              className="hidden lg:flex items-center gap-5 xl:gap-6 h-full"
            >
              {visibleNavItems.map((item) => {
                const isActive = !terminalMode && activeTab === item.id;
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
                      onToggleTerminal(false);
                      onSelectTab(item.id);
                    }}
                    className={`relative h-full px-0.5 text-[12.5px] whitespace-nowrap shrink-0 flex items-center gap-1 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-[#FF5722] font-medium'
                        : 'text-[#444444] dark:text-[#CCCCCC] hover:text-[#FF5722] dark:hover:text-[#FF5722] font-normal'
                    }`}
                  >
                    <span>{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="text-[11px] font-mono-num text-[#FF5722] font-medium">
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

            <div className="hidden lg:block h-4 w-px bg-[#EEEEEE] dark:bg-[#282828] shrink-0" />

            <div className="flex items-center gap-2 shrink-0">
              <div
                className="flex items-center gap-1.5 text-[11px] text-[#9B9B9B] dark:text-[#8C8C8C] whitespace-nowrap"
                title={wsConnected ? 'Live market stream connected' : 'Reconnecting stream'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    wsConnected ? 'bg-[#4CAF50]' : 'bg-[#DF514C]'
                  }`}
                />
                <span className="hidden sm:inline">{wsConnected ? 'Live' : 'Offline'}</span>
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

              {/* Kite User Profile Dropdown */}
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((prev) => !prev);
                    setWorkspaceOpen(false);
                  }}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  aria-label="User profile menu"
                  className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-[#F5F7FA] dark:hover:bg-[#242424] transition-colors cursor-pointer"
                >
                  <span
                    aria-hidden="true"
                    className="w-6 h-6 rounded-full bg-[#F3EEFE] dark:bg-[#2A2636] text-[#7E57C2] dark:text-[#B39DDB] text-[10px] font-semibold inline-flex items-center justify-center shrink-0"
                  >
                    {initials}
                  </span>
                  <span className="font-mono-num text-[12.5px] font-normal text-[#444444] dark:text-[#E0E0E0]">
                    {user.userId}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-[#9B9B9B] transition-transform ${
                      profileOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {profileOpen && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-[calc(100%+6px)] w-60 bg-white dark:bg-[#1E1E1E] border border-[#E5E5E5] dark:border-[#303030] shadow-[0_4px_16px_rgba(0,0,0,0.08)] rounded z-50 py-1.5 text-xs"
                  >
                    <div className="px-3.5 py-2.5 border-b border-[#EEEEEE] dark:border-[#282828]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[13px] text-[#444444] dark:text-[#E0E0E0] truncate">
                          {user.userName}
                        </span>
                        {user.role === 'admin' && (
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-[#FF5722] shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9B9B9B] dark:text-[#8C8C8C] truncate mt-0.5">
                        {user.userId} · {user.email}
                      </div>
                    </div>

                    <div className="py-1 border-b border-[#EEEEEE] dark:border-[#282828]">
                      {visibleNavItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onToggleTerminal(false);
                            onSelectTab(item.id);
                            onSelectMobilePane('workspace');
                            setProfileOpen(false);
                          }}
                          className={`w-full text-left px-3.5 py-1.5 flex items-center justify-between hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer ${
                            !terminalMode && activeTab === item.id
                              ? 'text-[#FF5722] font-medium'
                              : 'text-[#444444] dark:text-[#D4D4D4]'
                          }`}
                        >
                          <span>{item.label}</span>
                          {item.id === 'dashboard' && (
                            <UserIcon className="w-3.5 h-3.5 text-[#9B9B9B]" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="pt-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setProfileOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3.5 py-1.5 flex items-center gap-2 text-[#DF514C] dark:text-[#F87171] hover:bg-[#F5F7FA] dark:hover:bg-[#262626] cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onLogout}
                aria-label="Logout"
                title="Logout"
                className="p-1.5 text-[#666666] dark:text-[#A0A0A0] hover:text-[#DF514C] dark:hover:text-[#F87171] hover:bg-[#F5F7FA] dark:hover:bg-[#242424] rounded transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
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


