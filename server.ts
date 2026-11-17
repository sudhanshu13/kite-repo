import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  AuthUser,
  OrderRequest,
} from './shared/types.ts';
import { INSTRUMENT_MAP } from './server/instruments.ts';
import { MarketEngine } from './server/marketEngine.ts';
import { TradingStore } from './server/store.ts';

const PORT = 3000;
const COOKIE_NAME = 'kite_session';

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

function setSessionCookie(
  req: express.Request,
  res: express.Response,
  token: string,
) {
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  const market = new MarketEngine();
  await Promise.race([
    market.syncFromLiveFeed('full'),
    new Promise<void>((resolve) => setTimeout(resolve, 4500)),
  ]);
  const store = new TradingStore(market);

  function extractTokenFromReq(req: express.Request): string | undefined {
    const cookies = parseCookies(req.headers.cookie);
    const authHeader = req.headers.authorization;
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
    const queryToken =
      typeof req.query.token === 'string' ? req.query.token.trim() : undefined;
    return bearer || queryToken || cookies[COOKIE_NAME];
  }

  function getAuthUser(req: express.Request): AuthUser | null {
    return store.verifySessionToken(extractTokenFromReq(req));
  }

  function requireAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const user = getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    (req as express.Request & { authUser: AuthUser }).authUser = user;
    next();
  }

  function requireAdmin(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const user = (req as express.Request & { authUser?: AuthUser }).authUser;
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator access required.' });
      return;
    }
    next();
  }

  // --- Auth Routes ---
  app.post('/api/auth/login', (req, res) => {
    const { userId, password, pin } = req.body as {
      userId?: string;
      password?: string;
      pin?: string;
    };
    if (!userId || !password || !pin) {
      res.status(400).json({ error: 'Client ID, password, and 6-digit PIN are required.' });
      return;
    }
    const result = store.login(userId, password, pin);
    if (!result.ok) {
      res.status(401).json({ error: result.error });
      return;
    }
    setSessionCookie(req, res, result.token);
    res.json({ user: result.user, token: result.token });
  });

  app.post('/api/auth/register', (req, res) => {
    const { userId, userName, email, password, pin } = req.body as {
      userId?: string;
      userName?: string;
      email?: string;
      password?: string;
      pin?: string;
    };
    if (!userId || !password || !pin) {
      res.status(400).json({ error: 'Client ID, password, and 6-digit PIN are required.' });
      return;
    }
    const result = store.register({
      userId,
      userName: userName || '',
      email: email || '',
      password,
      pin,
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    setSessionCookie(req, res, result.token);
    res.status(201).json({ user: result.user, token: result.token });
  });

  app.post('/api/auth/demo', (req, res) => {
    const result = store.login('KT8492', 'kitedemo', '123456');
    if (!result.ok) {
      res.status(500).json({ error: 'Demo account unavailable.' });
      return;
    }
    setSessionCookie(req, res, result.token);
    res.json({ user: result.user, token: result.token });
  });

  app.post('/api/auth/admin-demo', (req, res) => {
    const result = store.login('AD0001', 'kiteadmin', '000000');
    if (!result.ok) {
      res.status(500).json({ error: 'Admin account unavailable.' });
      return;
    }
    setSessionCookie(req, res, result.token);
    res.json({ user: result.user, token: result.token });
  });

  app.post('/api/auth/logout', (req, res) => {
    const isHttps =
      req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie(COOKIE_NAME, {
      path: '/',
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
    });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const token = extractTokenFromReq(req);
    const user = store.verifySessionToken(token);
    res.json({ user: user ?? null, token: user ? token : null });
  });

  // --- Market Data & Technicals Routes ---
  app.get('/api/instruments', requireAuth, (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const list = market.getInstruments();
    if (!q) {
      res.json({ instruments: list });
      return;
    }
    const filtered = list.filter(
      (i) =>
        i.symbol.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.exchange.toLowerCase().includes(q) ||
        i.sector.toLowerCase().includes(q),
    );
    res.json({ instruments: filtered });
  });

  app.get('/api/quotes', requireAuth, (_req, res) => {
    res.json({ quotes: market.getAllQuotes() });
  });

  app.get('/api/technicals/:token', requireAuth, (req, res) => {
    const token = Number(req.params.token);
    const summary = market.getTechnicalSummary(token);
    if (!summary) {
      res.status(404).json({ error: 'Instrument not found' });
      return;
    }
    res.json({ summary });
  });

  app.post('/api/technicals/batch', requireAuth, (req, res) => {
    const { tokens } = req.body as { tokens?: number[] };
    const validTokens = Array.isArray(tokens) ? tokens.map(Number) : [];
    res.json({ signals: market.getWatchlistSignals(validTokens) });
  });

  // --- Portfolio, Watchlist & Simulated Order Execution ---
  app.get('/api/portfolio', requireAuth, (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    const portfolio = store.getPortfolio(user.userId);
    if (!portfolio) {
      res.status(404).json({ error: 'Portfolio not found' });
      return;
    }
    res.json({ portfolio });
  });

  app.put('/api/watchlists/:id', requireAuth, (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    const id = String(req.params.id);
    const { tokens } = req.body as { tokens?: number[] };
    if (!['1', '2', '3', '4', '5', '6', '7'].includes(id) || !Array.isArray(tokens)) {
      res.status(400).json({ error: 'Invalid watchlist ID or tokens payload.' });
      return;
    }
    const portfolio = store.updateWatchlist(user.userId, id, tokens.map(Number));
    res.json({ portfolio });
  });

  const userSockets = new Map<string, Set<WebSocket>>();
  const userSseClients = new Map<string, Set<express.Response>>();

  function broadcastToUser(userId: string, payload: unknown) {
    const raw = JSON.stringify(payload);
    const set = userSockets.get(userId);
    if (set) {
      for (const ws of set) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(raw);
        }
      }
    }
    const sseSet = userSseClients.get(userId);
    if (sseSet) {
      for (const res of sseSet) {
        res.write(`data: ${raw}\n\n`);
      }
    }
  }

  // Server-Sent Events fallback stream (works over standard HTTP/2 & iframes)
  app.get('/api/stream', requireAuth, (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    if (!userSseClients.has(user.userId)) {
      userSseClients.set(user.userId, new Set());
    }
    userSseClients.get(user.userId)!.add(res);

    const allQuotes = market.getAllQuotes();
    const portfolio = store.getPortfolio(user.userId);
    const allWatchTokens = portfolio
      ? Array.from(new Set(Object.values(portfolio.watchlists).flat()))
      : [];

    res.write(
      `data: ${JSON.stringify({
        type: 'snapshot',
        quotes: allQuotes,
        signals: market.getWatchlistSignals(allWatchTokens),
      })}\n\n`,
    );

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      userSseClients.get(user.userId)?.delete(res);
    });
  });

  app.post('/api/orders', requireAuth, (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    const body = req.body as OrderRequest;
    const result = store.placeOrder(user.userId, body, market);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    broadcastToUser(user.userId, {
      type: 'portfolio:update',
      portfolio: result.portfolio,
    });
    res.json({ order: result.order, portfolio: result.portfolio });
  });

  app.delete('/api/orders/:id', requireAuth, (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    const result = store.cancelOrder(user.userId, String(req.params.id));
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    broadcastToUser(user.userId, {
      type: 'portfolio:update',
      portfolio: result.portfolio,
    });
    res.json({ portfolio: result.portfolio });
  });

  app.post('/api/positions/:id/exit', requireAuth, (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    const result = store.exitPosition(user.userId, String(req.params.id), market);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    broadcastToUser(user.userId, {
      type: 'portfolio:update',
      portfolio: result.portfolio,
    });
    res.json({ portfolio: result.portfolio });
  });

  app.post('/api/positions/:id/convert', requireAuth, (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    const result = store.convertPosition(user.userId, String(req.params.id), market);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    broadcastToUser(user.userId, {
      type: 'portfolio:update',
      portfolio: result.portfolio,
    });
    res.json({ portfolio: result.portfolio });
  });

  app.post('/api/funds/add', requireAuth, requireAdmin, (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    const amount = Number((req.body as { amount?: number }).amount);
    const result = store.addVirtualFunds(user.userId, amount);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ portfolio: result.portfolio });
  });

  app.post('/api/funds/reset', requireAuth, requireAdmin, (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    const portfolio = store.resetPortfolio(user.userId);
    res.json({ portfolio });
  });

  app.post('/api/kite-bridge', requireAuth, requireAdmin, async (req, res) => {
    const user = (req as express.Request & { authUser: AuthUser }).authUser;
    const { apiKey, accessToken } = req.body as {
      apiKey?: string;
      accessToken?: string;
    };

    if (!apiKey?.trim() || !accessToken?.trim()) {
      const portfolio = store.setKiteBridge(user.userId, '', '');
      res.json({ portfolio, message: 'Switched back to built-in live market feed.' });
      return;
    }

    // Verify read-only quote endpoint connectivity with Kite Connect v3 API
    try {
      const probe = await fetch('https://api.kite.trade/quote?i=NSE:INFY', {
        headers: {
          'X-Kite-Version': '3',
          Authorization: `token ${apiKey.trim()}:${accessToken.trim()}`,
        },
      });
      if (!probe.ok) {
        res.status(400).json({
          error: `Kite Connect API returned HTTP ${probe.status}. Verify API Key and Access Token.`,
        });
        return;
      }
      const portfolio = store.setKiteBridge(user.userId, apiKey, accessToken);
      res.json({
        portfolio,
        message: 'Kite Connect read-only quote bridge verified. Orders remain simulated.',
      });
    } catch {
      res.status(400).json({
        error: 'Unable to reach Kite Connect API endpoint from server.',
      });
    }
  });

  // --- Admin Management Routes ---
  app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
    res.json({
      users: store.adminListUsers(),
      liveFeedActive: market.isLiveSynced(),
      marketOpen: market.isMarketOpen(),
    });
  });

  app.post('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    const body = req.body as AdminCreateUserRequest;
    const result = store.adminCreateUser({
      userId: String(body.userId || ''),
      userName: String(body.userName || ''),
      email: body.email ? String(body.email) : undefined,
      password: String(body.password || ''),
      pin: String(body.pin || ''),
      role: body.role === 'admin' ? 'admin' : 'user',
      openingBalance:
        body.openingBalance !== undefined ? Number(body.openingBalance) : undefined,
      seedSampleData: Boolean(body.seedSampleData),
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({ user: result.user });
  });

  app.patch('/api/admin/users/:userId', requireAuth, requireAdmin, (req, res) => {
    const actor = (req as express.Request & { authUser: AuthUser }).authUser;
    const body = req.body as AdminUpdateUserRequest;
    const result = store.adminUpdateUser(
      actor.userId,
      String(req.params.userId),
      body,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ user: result.user });
  });

  app.post('/api/admin/users/:userId/funds', requireAuth, requireAdmin, (req, res) => {
    const actor = (req as express.Request & { authUser: AuthUser }).authUser;
    const amount = Number((req.body as { amount?: number }).amount);
    const targetId = String(req.params.userId).toUpperCase();
    const result = store.adminAdjustUserFunds(actor.userId, targetId, amount);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    broadcastToUser(targetId, {
      type: 'portfolio:update',
      portfolio: result.portfolio,
    });
    res.json({ user: result.user, portfolio: result.portfolio });
  });

  app.post('/api/admin/users/:userId/reset', requireAuth, requireAdmin, (req, res) => {
    const actor = (req as express.Request & { authUser: AuthUser }).authUser;
    const targetId = String(req.params.userId).toUpperCase();
    const seedSampleData = Boolean((req.body as { seedSampleData?: boolean }).seedSampleData);
    const result = store.adminResetUserPortfolio(
      actor.userId,
      targetId,
      seedSampleData,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    broadcastToUser(targetId, {
      type: 'portfolio:update',
      portfolio: result.portfolio,
    });
    res.json({ user: result.user, portfolio: result.portfolio });
  });

  app.delete('/api/admin/users/:userId', requireAuth, requireAdmin, (req, res) => {
    const actor = (req as express.Request & { authUser: AuthUser }).authUser;
    const result = store.adminDeleteUser(actor.userId, String(req.params.userId));
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  // --- Vite / Static SPA Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // --- HTTP + WebSocket Server ---
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const host = request.headers.host || 'localhost:3000';
    const url = new URL(request.url || '/', `http://${host}`);
    if (url.pathname !== '/ws') {
      return;
    }

    const cookies = parseCookies(request.headers.cookie);
    const queryToken = url.searchParams.get('token') || undefined;
    const user = store.verifySessionToken(queryToken || cookies[COOKIE_NAME]);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, user);
    });
  });

  wss.on('connection', (ws: WebSocket, user: AuthUser) => {
    if (!userSockets.has(user.userId)) {
      userSockets.set(user.userId, new Set());
    }
    userSockets.get(user.userId)!.add(ws);

    // Initial snapshot push
    const allQuotes = market.getAllQuotes();
    const portfolio = store.getPortfolio(user.userId);
    const allWatchTokens = portfolio
      ? Array.from(new Set(Object.values(portfolio.watchlists).flat()))
      : [];
    ws.send(
      JSON.stringify({
        type: 'snapshot',
        quotes: allQuotes,
        signals: market.getWatchlistSignals(allWatchTokens),
      }),
    );

    ws.on('close', () => {
      userSockets.get(user.userId)?.delete(ws);
    });
  });

  function broadcastTicks(updatedQuotes: ReturnType<typeof market.stepTick>) {
    if (updatedQuotes.length === 0) return;
    const hasSseClients = Array.from(userSseClients.values()).some((s) => s.size > 0);
    if (wss.clients.size > 0 || hasSseClients) {
      const updatedTokens = updatedQuotes.map((q) => q.token);
      const signals = market.getWatchlistSignals(updatedTokens);
      const payload = JSON.stringify({
        type: 'ticks',
        quotes: updatedQuotes,
        signals,
      });
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
      for (const sseSet of userSseClients.values()) {
        for (const res of sseSet) {
          res.write(`data: ${payload}\n\n`);
        }
      }
    }

    const executions = store.processPendingOrdersOnTick(market);
    for (const exec of executions) {
      broadcastToUser(exec.userId, {
        type: 'order:executed',
        order: exec.order,
        portfolio: exec.portfolio,
      });
    }
  }

  // Real-time 800ms market tick + order matching loop
  setInterval(() => {
    const updatedQuotes = market.stepTick();
    broadcastTicks(updatedQuotes);
  }, 800);

  // Live NSE/BSE quote refresh loop (6s during market hours, 25s off-hours)
  let lastLiveSyncAt = Date.now();
  let lastFullHistorySyncAt = Date.now();
  let liveSyncInFlight = false;
  setInterval(async () => {
    if (liveSyncInFlight) return;
    const now = Date.now();
    const minIntervalMs = market.isMarketOpen() ? 6000 : 25000;
    if (now - lastLiveSyncAt < minIntervalMs) return;

    liveSyncInFlight = true;
    lastLiveSyncAt = now;
    try {
      const needFullHistory = now - lastFullHistorySyncAt >= 5 * 60 * 1000;
      const updatedQuotes = await market.syncFromLiveFeed(
        needFullHistory ? 'full' : 'intraday',
      );
      if (needFullHistory) lastFullHistorySyncAt = now;
      broadcastTicks(updatedQuotes);
    } finally {
      liveSyncInFlight = false;
    }
  }, 2000);

  // Optional Kite Connect Read-Only Poll Loop (5s) for connected users
  setInterval(async () => {
    for (const [userId, sockets] of userSockets.entries()) {
      if (sockets.size === 0) continue;
      const secrets = store.getKiteSecrets(userId);
      const portfolio = store.getPortfolio(userId);
      if (!secrets || !portfolio) continue;

      const tokens = Array.from(
        new Set(Object.values(portfolio.watchlists).flat()),
      ).slice(0, 15);
      const queryParams = tokens
        .map((t) => INSTRUMENT_MAP.get(t))
        .filter((i) => i && (i.exchange === 'NSE' || i.exchange === 'BSE'))
        .map((i) => `i=${i!.exchange}:${encodeURIComponent(i!.symbol)}`)
        .join('&');
      if (!queryParams) continue;

      try {
        const resp = await fetch(`https://api.kite.trade/quote?${queryParams}`, {
          headers: {
            'X-Kite-Version': '3',
            Authorization: `token ${secrets.apiKey}:${secrets.accessToken}`,
          },
        });
        if (!resp.ok) continue;
        const json = (await resp.json()) as {
          data?: Record<string, { last_price?: number; volume?: number }>;
        };
        if (!json.data) continue;
        for (const t of tokens) {
          const inst = INSTRUMENT_MAP.get(t);
          if (!inst) continue;
          const key = `${inst.exchange}:${inst.symbol}`;
          const item = json.data[key];
          if (item?.last_price) {
            market.applyExternalQuote(t, item.last_price, item.volume);
          }
        }
      } catch {
        // Ignore transient external quote poll errors
      }
    }
  }, 5000);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kite Sandbox server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
