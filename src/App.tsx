import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type {
  AuthUser,
  Instrument,
  MarketQuote,
  Order,
  OrderRequest,
  OrderSide,
  PortfolioState,
  WatchlistSignalsMap,
} from '../shared/types.ts';
import { AdminView } from './components/AdminView.tsx';
import { BidsView } from './components/BidsView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { FundsApiView } from './components/FundsApiView.tsx';
import { HoldingsView } from './components/HoldingsView.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { MarketWatch } from './components/MarketWatch.tsx';
import { OrderModal } from './components/OrderModal.tsx';
import { OrdersView } from './components/OrdersView.tsx';
import { PositionsView } from './components/PositionsView.tsx';
import { TechnicalsView } from './components/TechnicalsView.tsx';
import { TerminalView, type WorkspaceConfig } from './components/TerminalView.tsx';
import { TopBar, type NavTab } from './components/TopBar.tsx';
import { apiFetch, getAuthToken, setAuthToken } from './utils/api.ts';

const NIFTY_TOKEN = 256265;
const SENSEX_TOKEN = 265;

const DEFAULT_WORKSPACE: WorkspaceConfig = {
  id: 'default',
  name: 'Default',
  showDepth: true,
  showWatchlist: true,
  showPositions: true,
  showBlotter: true,
};

interface ToastMessage {
  id: string;
  text: string;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('kite_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // Ignore storage errors
    }
    return 'light';
  });

  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [quotes, setQuotes] = useState<Record<number, MarketQuote>>({});
  const [signals, setSignals] = useState<WatchlistSignalsMap>({});
  const [wsConnected, setWsConnected] = useState(false);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [terminalMode, setTerminalMode] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceConfig[]>([DEFAULT_WORKSPACE]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('default');
  const [mobilePane, setMobilePane] = useState<'watchlist' | 'workspace'>('watchlist');
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>('1');
  const [selectedToken, setSelectedToken] = useState<number>(738561);
  const [orderModal, setOrderModal] = useState<{
    token: number;
    side: OrderSide;
  } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const pushToast = useCallback((text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('kite_theme', theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  // Initial auth check + ?autostart=1 demo fast path
  useEffect(() => {
    let active = true;
    async function bootstrapAuth() {
      try {
        const meRes = await apiFetch('/api/auth/me');
        if (meRes.ok) {
          const data = (await meRes.json()) as {
            user?: AuthUser | null;
            token?: string | null;
          };
          if (active && data.user) {
            if (data.token) setAuthToken(data.token);
            setUser(data.user);
            setAuthChecked(true);
            return;
          }
        }
        const params = new URLSearchParams(window.location.search);
        if (params.get('autostart') === '1') {
          const demoRes = await apiFetch('/api/auth/demo', { method: 'POST' });
          if (demoRes.ok) {
            const data = (await demoRes.json()) as {
              user?: AuthUser;
              token?: string;
            };
            if (active && data.user) {
              if (data.token) setAuthToken(data.token);
              setUser(data.user);
            }
          }
        }
      } finally {
        if (active) setAuthChecked(true);
      }
    }
    bootstrapAuth();
    return () => {
      active = false;
    };
  }, []);

  // Load saved workspaces per user
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(`kite_workspaces_${user.userId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as WorkspaceConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasDefault = parsed.some((w) => w.id === 'default');
          setWorkspaces(hasDefault ? parsed : [DEFAULT_WORKSPACE, ...parsed]);
          const savedActive = localStorage.getItem(`kite_active_ws_${user.userId}`);
          setActiveWorkspaceId(
            savedActive && parsed.some((w) => w.id === savedActive) ? savedActive : 'default',
          );
          return;
        }
      }
    } catch {
      // Ignore storage errors
    }
    setWorkspaces([DEFAULT_WORKSPACE]);
    setActiveWorkspaceId('default');
  }, [user]);

  const persistWorkspaces = useCallback(
    (nextList: WorkspaceConfig[], nextActiveId?: string) => {
      if (!user) return;
      try {
        localStorage.setItem(`kite_workspaces_${user.userId}`, JSON.stringify(nextList));
        if (nextActiveId) {
          localStorage.setItem(`kite_active_ws_${user.userId}`, nextActiveId);
        }
      } catch {
        // Ignore storage errors
      }
    },
    [user],
  );

  // Load initial instruments, quotes, and portfolio once authenticated
  useEffect(() => {
    if (!user) return;
    let active = true;

    async function loadWorkspace() {
      const [instRes, quotesRes, portRes] = await Promise.all([
        apiFetch('/api/instruments'),
        apiFetch('/api/quotes'),
        apiFetch('/api/portfolio'),
      ]);
      if (!active) return;

      if (instRes.ok) {
        const d = (await instRes.json()) as { instruments: Instrument[] };
        setInstruments(d.instruments);
      }
      if (quotesRes.ok) {
        const d = (await quotesRes.json()) as { quotes: MarketQuote[] };
        const map: Record<number, MarketQuote> = {};
        for (const q of d.quotes) map[q.token] = q;
        setQuotes(map);
      }
      if (portRes.ok) {
        const d = (await portRes.json()) as { portfolio: PortfolioState };
        setPortfolio(d.portfolio);
        const firstWatch = d.portfolio.watchlists['1']?.[0];
        if (firstWatch) setSelectedToken(firstWatch);

        const allTokens = Array.from(
          new Set(Object.values(d.portfolio.watchlists).flat()),
        );
        const sigRes = await apiFetch('/api/technicals/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: allTokens }),
        });
        if (sigRes.ok && active) {
          const sigData = (await sigRes.json()) as {
            signals: WatchlistSignalsMap;
          };
          setSignals(sigData.signals);
        }
      }
    }

    loadWorkspace();
    return () => {
      active = false;
    };
  }, [user]);

  // Real-time stream connection: WebSocket primary -> SSE secondary -> HTTP live polling fallback
  useEffect(() => {
    if (!user) return;
    let closedByUser = false;
    let wsUnsupported = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let wsFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let sseFallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function stopPolling() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }

    function handleStreamMessage(raw: string) {
      try {
        const msg = JSON.parse(raw) as
          | {
              type: 'snapshot' | 'ticks';
              quotes: MarketQuote[];
              signals?: WatchlistSignalsMap;
            }
          | {
              type: 'portfolio:update';
              portfolio: PortfolioState;
            }
          | {
              type: 'order:executed';
              order: Order;
              portfolio: PortfolioState;
            };

        if (msg.type === 'snapshot' || msg.type === 'ticks') {
          setQuotes((prev) => {
            const next = { ...prev };
            for (const q of msg.quotes) next[q.token] = q;
            return next;
          });
          if (msg.signals) {
            setSignals((prev) => ({ ...prev, ...msg.signals }));
          }
        } else if (msg.type === 'portfolio:update') {
          setPortfolio(msg.portfolio);
        } else if (msg.type === 'order:executed') {
          setPortfolio(msg.portfolio);
          pushToast(
            `Order Executed: ${msg.order.side} ${msg.order.quantity} ${msg.order.symbol} @ ₹${msg.order.averagePrice.toFixed(2)}`,
          );
        }
      } catch {
        // Ignore malformed frames
      }
    }

    let pollFailures = 0;

    async function pollLiveOnce() {
      if (closedByUser) return;
      try {
        const res = await apiFetch('/api/quotes');
        if (!res.ok) {
          pollFailures++;
          if (res.status === 401 || pollFailures >= 2) setWsConnected(false);
          return;
        }
        const data = (await res.json()) as {
          quotes?: MarketQuote[];
          signals?: WatchlistSignalsMap;
        };
        if (closedByUser) return;
        pollFailures = 0;
        if (Array.isArray(data.quotes)) {
          setWsConnected(true);
          setQuotes((prev) => {
            const next = { ...prev };
            for (const q of data.quotes!) next[q.token] = q;
            return next;
          });
        }
        if (data.signals) {
          setSignals((prev) => ({ ...prev, ...data.signals }));
        }
      } catch {
        pollFailures++;
        if (!closedByUser && (!navigator.onLine || pollFailures >= 2)) {
          setWsConnected(false);
        }
      }
    }

    function startPollingFallback() {
      if (closedByUser || pollInterval) return;
      void pollLiveOnce();
      pollInterval = setInterval(() => {
        void pollLiveOnce();
      }, 1500);
      if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          if (!closedByUser) {
            if (wsUnsupported) connectSse();
            else connectWs();
          }
        }, 12000);
      }
    }

    function connectSse() {
      if (closedByUser) return;
      if (sseFallbackTimer) {
        clearTimeout(sseFallbackTimer);
        sseFallbackTimer = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      const token = getAuthToken();
      const qs = token ? `?token=${encodeURIComponent(token)}` : '';
      let sseOpened = false;
      const es = new EventSource(`/api/stream${qs}`, { withCredentials: true });
      sseRef.current = es;

      sseFallbackTimer = setTimeout(() => {
        if (!sseOpened && !closedByUser) {
          es.close();
          sseRef.current = null;
          startPollingFallback();
        }
      }, 2500);

      es.onopen = () => {
        sseOpened = true;
        if (sseFallbackTimer) {
          clearTimeout(sseFallbackTimer);
          sseFallbackTimer = null;
        }
        stopPolling();
        setWsConnected(true);
      };

      es.onmessage = (event) => {
        sseOpened = true;
        if (sseFallbackTimer) {
          clearTimeout(sseFallbackTimer);
          sseFallbackTimer = null;
        }
        stopPolling();
        setWsConnected(true);
        handleStreamMessage(String(event.data));
      };

      es.onerror = () => {
        if (sseFallbackTimer) {
          clearTimeout(sseFallbackTimer);
          sseFallbackTimer = null;
        }
        es.close();
        sseRef.current = null;
        if (!closedByUser) {
          startPollingFallback();
        }
      };
    }

    function connectWs() {
      if (closedByUser) return;
      if (wsUnsupported) {
        connectSse();
        return;
      }
      if (wsFallbackTimer) {
        clearTimeout(wsFallbackTimer);
        wsFallbackTimer = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore close error
        }
        wsRef.current = null;
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getAuthToken();
      const qs = token ? `?token=${encodeURIComponent(token)}` : '';
      let opened = false;
      let fellBack = false;

      let ws: WebSocket;
      try {
        ws = new WebSocket(`${proto}//${window.location.host}/ws${qs}`);
      } catch {
        wsUnsupported = true;
        connectSse();
        return;
      }
      wsRef.current = ws;

      const triggerFallback = () => {
        if (fellBack || closedByUser) return;
        fellBack = true;
        if (wsFallbackTimer) {
          clearTimeout(wsFallbackTimer);
          wsFallbackTimer = null;
        }
        if (!opened) wsUnsupported = true;
        try {
          ws.close();
        } catch {
          // Ignore close error
        }
        if (wsRef.current === ws) wsRef.current = null;
        connectSse();
      };

      wsFallbackTimer = setTimeout(() => {
        if (!opened && !closedByUser) {
          triggerFallback();
        }
      }, 1500);

      ws.onopen = () => {
        opened = true;
        if (wsFallbackTimer) {
          clearTimeout(wsFallbackTimer);
          wsFallbackTimer = null;
        }
        stopPolling();
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        setWsConnected(true);
        handleStreamMessage(String(event.data));
      };

      ws.onclose = () => {
        if (wsFallbackTimer) {
          clearTimeout(wsFallbackTimer);
          wsFallbackTimer = null;
        }
        if (wsRef.current === ws) wsRef.current = null;
        if (!opened) {
          triggerFallback();
          return;
        }
        if (!closedByUser) {
          startPollingFallback();
        }
      };

      ws.onerror = () => {
        if (!opened) {
          triggerFallback();
        }
      };
    }

    const handleOnline = () => {
      if (!closedByUser) {
        wsUnsupported = false;
        connectWs();
      }
    };
    const handleOffline = () => {
      setWsConnected(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    connectWs();

    return () => {
      closedByUser = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsFallbackTimer) clearTimeout(wsFallbackTimer);
      if (sseFallbackTimer) clearTimeout(sseFallbackTimer);
      stopPolling();
      wsRef.current?.close();
      wsRef.current = null;
      sseRef.current?.close();
      sseRef.current = null;
      setWsConnected(false);
    };
  }, [user, pushToast]);

  const instrumentMap = useMemo(() => {
    const m = new Map<number, Instrument>();
    for (const inst of instruments) m.set(inst.token, inst);
    return m;
  }, [instruments]);

  const openOrdersCount = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.orders.filter(
      (o) => o.status === 'OPEN' || o.status === 'TRIGGER PENDING',
    ).length;
  }, [portfolio]);

  const openPositionsCount = useMemo(() => {
    if (!portfolio) return 0;
    return portfolio.positions.filter((p) => p.quantity !== 0).length;
  }, [portfolio]);

  async function handleLogout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setAuthToken(null);
    setUser(null);
    setPortfolio(null);
    setWsConnected(false);
    setTerminalMode(false);
    setActiveTab('dashboard');
    setMobilePane('watchlist');
  }

  function handleSelectWorkspace(workspaceId: string) {
    setActiveWorkspaceId(workspaceId);
    persistWorkspaces(workspaces, workspaceId);
    if (workspaceId !== 'default') {
      setTerminalMode(true);
      setMobilePane('workspace');
    }
  }

  function handleCreateWorkspace(name: string, openInTerminal: boolean) {
    const id = `ws-${Date.now().toString(36)}`;
    const nextWs: WorkspaceConfig = {
      id,
      name,
      showDepth: true,
      showWatchlist: true,
      showPositions: true,
      showBlotter: true,
    };
    const nextList = [...workspaces, nextWs];
    setWorkspaces(nextList);
    setActiveWorkspaceId(id);
    persistWorkspaces(nextList, id);
    if (openInTerminal) {
      setTerminalMode(true);
      setMobilePane('workspace');
    }
    pushToast(`Created workspace "${name}".`);
  }

  function handleDeleteWorkspace(workspaceId: string) {
    if (workspaceId === 'default') return;
    const nextList = workspaces.filter((w) => w.id !== workspaceId);
    const nextActive = activeWorkspaceId === workspaceId ? 'default' : activeWorkspaceId;
    setWorkspaces(nextList);
    setActiveWorkspaceId(nextActive);
    persistWorkspaces(nextList, nextActive);
  }

  function handleUpdateWorkspace(updated: WorkspaceConfig) {
    const nextList = workspaces.map((w) => (w.id === updated.id ? updated : w));
    setWorkspaces(nextList);
    persistWorkspaces(nextList, activeWorkspaceId);
  }

  function handleToggleTerminal(next?: boolean) {
    setTerminalMode((prev) => (typeof next === 'boolean' ? next : !prev));
  }

  async function handleUpdateWatchlist(watchlistId: string, tokens: number[]) {
    const res = await apiFetch(`/api/watchlists/${watchlistId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens }),
    });
    if (res.ok) {
      const data = (await res.json()) as { portfolio: PortfolioState };
      setPortfolio(data.portfolio);
      const sigRes = await apiFetch('/api/technicals/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
      });
      if (sigRes.ok) {
        const sigData = (await sigRes.json()) as { signals: WatchlistSignalsMap };
        setSignals((prev) => ({ ...prev, ...sigData.signals }));
      }
    }
  }

  async function handlePlaceOrder(
    request: OrderRequest,
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const data = (await res.json()) as {
      order?: Order;
      portfolio?: PortfolioState;
      error?: string;
    };
    if (!res.ok || !data.portfolio || !data.order) {
      return { ok: false, error: data.error || 'Order placement failed.' };
    }
    setPortfolio(data.portfolio);
    pushToast(
      data.order.status === 'COMPLETE'
        ? `${data.order.side} ${data.order.quantity} ${data.order.symbol} COMPLETE @ ₹${data.order.averagePrice.toFixed(2)}`
        : `${data.order.side} ${data.order.quantity} ${data.order.symbol} (${data.order.status})`,
    );
    return { ok: true };
  }

  async function handleCancelOrder(orderId: string) {
    const res = await apiFetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    if (res.ok) {
      const data = (await res.json()) as { portfolio: PortfolioState };
      setPortfolio(data.portfolio);
      pushToast(`Cancelled order ${orderId}`);
    }
  }

  async function handleExitPosition(positionId: string) {
    const res = await apiFetch(`/api/positions/${positionId}/exit`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = (await res.json()) as { portfolio: PortfolioState };
      setPortfolio(data.portfolio);
      pushToast('Position squared off at live market price.');
    }
  }

  async function handleConvertPosition(positionId: string) {
    const res = await apiFetch(`/api/positions/${positionId}/convert`, {
      method: 'POST',
    });
    const data = (await res.json()) as {
      portfolio?: PortfolioState;
      error?: string;
    };
    if (res.ok && data.portfolio) {
      setPortfolio(data.portfolio);
      pushToast('Converted MIS position to CNC holding.');
    } else if (data.error) {
      pushToast(data.error);
    }
  }

  async function handleAddFunds(
    amount: number,
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await apiFetch('/api/funds/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const data = (await res.json()) as {
      portfolio?: PortfolioState;
      error?: string;
    };
    if (!res.ok || !data.portfolio) {
      return { ok: false, error: data.error };
    }
    setPortfolio(data.portfolio);
    return { ok: true };
  }

  async function handleResetPortfolio() {
    const res = await apiFetch('/api/funds/reset', { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as { portfolio: PortfolioState };
      setPortfolio(data.portfolio);
      pushToast('Paper portfolio reset to ₹10,00,000.');
    }
  }

  async function handleConfigureKiteBridge(apiKey: string, accessToken: string) {
    const res = await apiFetch('/api/kite-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, accessToken }),
    });
    const data = (await res.json()) as {
      portfolio?: PortfolioState;
      message?: string;
      error?: string;
    };
    if (!res.ok || !data.portfolio) {
      return { ok: false, error: data.error };
    }
    setPortfolio(data.portfolio);
    return { ok: true, message: data.message };
  }

  function handleSelectSymbolForTechnicals(token: number) {
    setSelectedToken(token);
    if (!terminalMode) {
      setActiveTab('technicals');
    }
    setMobilePane('workspace');
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFFFF] dark:bg-[#121212] text-xs text-[#9B9B9B]">
        Initializing Trading Terminal...
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onAuthenticated={(u, tok) => {
          if (tok) setAuthToken(tok);
          setUser(u);
          setActiveTab('dashboard');
          setMobilePane('workspace');
        }}
      />
    );
  }

  const isAdmin = user.role === 'admin';
  const resolvedTab: NavTab =
    !isAdmin && activeTab === 'admin' ? 'dashboard' : activeTab;
  const orderInstrument = orderModal ? instrumentMap.get(orderModal.token) : undefined;
  const orderQuote = orderModal ? quotes[orderModal.token] : undefined;

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) ?? DEFAULT_WORKSPACE;

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFFFF] dark:bg-[#121212] text-[#444444] dark:text-[#E0E0E0]">
      <TopBar
        user={user}
        activeTab={resolvedTab}
        terminalMode={terminalMode}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspace.id}
        mobilePane={mobilePane}
        onSelectMobilePane={setMobilePane}
        onSelectTab={setActiveTab}
        onToggleTerminal={handleToggleTerminal}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        onDeleteWorkspace={handleDeleteWorkspace}
        niftyQuote={quotes[NIFTY_TOKEN]}
        sensexQuote={quotes[SENSEX_TOKEN]}
        instruments={instruments}
        quotes={quotes}
        recentOrders={portfolio?.orders ?? []}
        wsConnected={wsConnected}
        openOrdersCount={openOrdersCount}
        openPositionsCount={openPositionsCount}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onPlaceOrder={handlePlaceOrder}
        onLogout={handleLogout}
      />

      {!portfolio ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[#9B9B9B]">
          Loading portfolio and live market stream...
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <div className={mobilePane === 'watchlist' ? 'block lg:block' : 'hidden lg:block'}>
            <MarketWatch
              instruments={instruments}
              quotes={quotes}
              signals={signals}
              watchlists={portfolio.watchlists}
              activeWatchlistId={activeWatchlistId}
              selectedToken={selectedToken}
              onSelectWatchlist={setActiveWatchlistId}
              onSelectSymbolForTechnicals={handleSelectSymbolForTechnicals}
              onUpdateWatchlist={handleUpdateWatchlist}
              onOpenOrderModal={(token, side) => setOrderModal({ token, side })}
            />
          </div>

          <main
            className={`flex-1 lg:h-[calc(100vh-50px)] overflow-y-auto bg-[#FFFFFF] dark:bg-[#121212] ${
              mobilePane === 'workspace' ? 'block' : 'hidden lg:block'
            }`}
          >
            {terminalMode ? (
              <TerminalView
                workspace={activeWorkspace}
                portfolio={portfolio}
                instruments={instruments}
                quotes={quotes}
                signals={signals}
                activeWatchlistId={activeWatchlistId}
                selectedToken={selectedToken}
                onSelectToken={setSelectedToken}
                onUpdateWorkspace={handleUpdateWorkspace}
                onOpenOrderModal={(token, side) => setOrderModal({ token, side })}
                onCancelOrder={handleCancelOrder}
                onExitPosition={handleExitPosition}
                onExitTerminal={() => setTerminalMode(false)}
              />
            ) : (
              <>
                {resolvedTab === 'dashboard' && (
                  <DashboardView
                    portfolio={portfolio}
                    instruments={instruments}
                    quotes={quotes}
                    signals={signals}
                    activeWatchlistId={activeWatchlistId}
                    isAdmin={isAdmin}
                    onNavigate={setActiveTab}
                    onSelectSymbolForTechnicals={handleSelectSymbolForTechnicals}
                    onOpenOrderModal={(token, side) => setOrderModal({ token, side })}
                  />
                )}

            {resolvedTab === 'technicals' && (
              <TechnicalsView
                instrument={instrumentMap.get(selectedToken)}
                quote={quotes[selectedToken]}
                onOpenOrderModal={(token, side) => setOrderModal({ token, side })}
              />
            )}

            {resolvedTab === 'orders' && (
              <OrdersView
                orders={portfolio.orders}
                onCancelOrder={handleCancelOrder}
              />
            )}

            {resolvedTab === 'holdings' && (
              <HoldingsView
                holdings={portfolio.holdings}
                quotes={quotes}
                onOpenOrderModal={(token, side) => setOrderModal({ token, side })}
                onSelectSymbolForTechnicals={handleSelectSymbolForTechnicals}
                onNotify={pushToast}
              />
            )}

            {resolvedTab === 'positions' && (
              <PositionsView
                positions={portfolio.positions}
                quotes={quotes}
                onExitPosition={handleExitPosition}
                onConvertPosition={handleConvertPosition}
                onSelectSymbolForTechnicals={handleSelectSymbolForTechnicals}
                onGoToDashboard={() => setActiveTab('dashboard')}
              />
            )}

            {resolvedTab === 'bids' && <BidsView onNotify={pushToast} />}

            {resolvedTab === 'funds' && (
              <FundsApiView
                portfolio={portfolio}
                wsConnected={wsConnected}
                isAdmin={isAdmin}
                onAddFunds={handleAddFunds}
                onResetPortfolio={handleResetPortfolio}
                onConfigureKiteBridge={handleConfigureKiteBridge}
              />
            )}

                {resolvedTab === 'admin' && isAdmin && (
                  <AdminView
                    currentUserId={user.userId}
                    onSyncSelfPortfolio={setPortfolio}
                    onNavigate={setActiveTab}
                    onNotify={pushToast}
                  />
                )}
              </>
            )}
          </main>
        </div>
      )}

      {/* Floating Buy / Sell Order Ticket */}
      {orderModal && orderInstrument && orderQuote && portfolio && (
        <OrderModal
          instrument={orderInstrument}
          quote={orderQuote}
          initialSide={orderModal.side}
          availableCash={portfolio.availableCash}
          holdings={portfolio.holdings}
          onClose={() => setOrderModal(null)}
          onSubmitOrder={handlePlaceOrder}
        />
      )}

      {/* Order / System Toasts */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#1E2127] dark:bg-[#252932] text-white text-xs rounded shadow-lg border border-[#373C47]"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#4CAF50] shrink-0" />
                <span>{t.text}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setToasts((prev) => prev.filter((item) => item.id !== t.id))
                }
                aria-label="Dismiss notification"
                className="text-[#9B9B9B] hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
