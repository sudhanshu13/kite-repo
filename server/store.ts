import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  applyFilledOrderToPortfolio,
  validateOrderRequest,
} from '../shared/portfolioMath.ts';
import type {
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
  AdminUserSummary,
  AuthUser,
  Order,
  OrderRequest,
  PortfolioState,
  ProductType,
  UserRole,
} from '../shared/types.ts';
import { DEFAULT_WATCHLISTS, INSTRUMENT_MAP } from './instruments.ts';
import type { MarketEngine } from './marketEngine.ts';

interface StoredUser {
  userId: string;
  userName: string;
  email: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
  passwordHash: string;
  pinHash: string;
  portfolio: PortfolioState;
}

interface PersistedData {
  users: Record<string, StoredUser>;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'kite-sandbox-local-hmac-secret-v1';

function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(8).toString('hex');
  const derived = crypto.scryptSync(secret, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

function verifySecret(secret: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hexHash] = parts;
  const derived = crypto.scryptSync(secret, salt, 32);
  const expected = Buffer.from(hexHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function createSeedPortfolio(
  userId: string,
  userName: string,
  email: string,
  market?: MarketEngine,
  options?: { openingBalance?: number; seedSampleData?: boolean },
): PortfolioState {
  const openingBalance = options?.openingBalance ?? 1000000;
  const seedSampleData = options?.seedSampleData ?? true;
  const nowIso = new Date().toISOString();

  if (!seedSampleData) {
    return {
      userId,
      userName,
      email,
      availableCash: openingBalance,
      openingBalance,
      usedMargin: 0,
      realizedPnl: 0,
      watchlists: structuredClone(DEFAULT_WATCHLISTS),
      orders: [],
      holdings: [],
      positions: [],
      kiteApiConfig: {
        connected: false,
        mode: market?.isLiveSynced() ? 'LIVE_MARKET_FEED' : 'SIMULATED_FEED',
        apiKeyMasked: '',
      },
      apiLogs: [
        {
          id: 'LOG-INIT',
          timestamp: nowIso,
          method: 'WS',
          endpoint: '/ws',
          status: 101,
          summary: market?.isLiveSynced()
            ? 'Real-time NSE/BSE live quote & technicals stream initialized'
            : 'Real-time market quote & technicals stream initialized',
        },
      ],
    };
  }

  const relInst = INSTRUMENT_MAP.get(738561)!;
  const tcsInst = INSTRUMENT_MAP.get(2953217)!;
  const hdfcInst = INSTRUMENT_MAP.get(341249)!;
  const infyInst = INSTRUMENT_MAP.get(408065)!;
  const sbinInst = INSTRUMENT_MAP.get(779521)!;
  const niftyFutInst = INSTRUMENT_MAP.get(14893570)!;

  const livePrice = (token: number, fallback: number) =>
    market?.getQuote(token)?.ltp ?? fallback;

  const relLtp = livePrice(738561, relInst.basePrice);
  const tcsLtp = livePrice(2953217, tcsInst.basePrice);
  const hdfcLtp = livePrice(341249, hdfcInst.basePrice);
  const infyLtp = livePrice(408065, infyInst.basePrice);
  const sbinLtp = livePrice(779521, sbinInst.basePrice);
  const niftyFutLtp = livePrice(14893570, niftyFutInst.basePrice);

  const h1Invested = Math.round(15 * (relLtp * 0.96) * 100) / 100;
  const h2Invested = Math.round(6 * (tcsLtp * 0.97) * 100) / 100;
  const h3Invested = Math.round(12 * (hdfcLtp * 1.015) * 100) / 100;
  const holdingsMargin = Math.round((h1Invested + h2Invested + h3Invested) * 100) / 100;

  // Seeded open positions (MIS intraday long/short + NFO NRML futures)
  const infyAvg = Math.round(infyLtp * 0.991 * 100) / 100;
  const infyVal = Math.round(15 * infyAvg * 100) / 100;
  const infyMargin = Math.round(infyVal * 0.2 * 100) / 100;

  const sbinAvg = Math.round(sbinLtp * 1.012 * 100) / 100;
  const sbinVal = Math.round(40 * sbinAvg * 100) / 100;
  const sbinMargin = Math.round(sbinVal * 0.2 * 100) / 100;

  const niftyFutAvg = Math.round(niftyFutLtp * 0.996 * 100) / 100;
  const niftyFutVal = Math.round(25 * niftyFutAvg * 100) / 100;
  const niftyFutMargin = Math.round(niftyFutVal * 0.5 * 100) / 100;

  const usedMargin =
    Math.round((holdingsMargin + infyMargin + sbinMargin + niftyFutMargin) * 100) / 100;

  return {
    userId,
    userName,
    email,
    availableCash: Math.round((openingBalance - usedMargin) * 100) / 100,
    openingBalance,
    usedMargin,
    realizedPnl: 0,
    watchlists: structuredClone(DEFAULT_WATCHLISTS),
    orders: [
      {
        id: '261117100401',
        exchangeOrderId: '1100000010401001',
        userId,
        token: niftyFutInst.token,
        symbol: niftyFutInst.symbol,
        exchange: niftyFutInst.exchange,
        side: 'BUY',
        product: 'NRML',
        orderType: 'MARKET',
        quantity: 25,
        filledQuantity: 25,
        price: niftyFutAvg,
        triggerPrice: 0,
        averagePrice: niftyFutAvg,
        status: 'COMPLETE',
        statusMessage: 'Executed in paper trading engine',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: '261117100402',
        exchangeOrderId: '1100000010401002',
        userId,
        token: sbinInst.token,
        symbol: sbinInst.symbol,
        exchange: sbinInst.exchange,
        side: 'SELL',
        product: 'MIS',
        orderType: 'MARKET',
        quantity: 40,
        filledQuantity: 40,
        price: sbinAvg,
        triggerPrice: 0,
        averagePrice: sbinAvg,
        status: 'COMPLETE',
        statusMessage: 'Executed in paper trading engine',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: '261117100403',
        exchangeOrderId: '1100000010401003',
        userId,
        token: infyInst.token,
        symbol: infyInst.symbol,
        exchange: infyInst.exchange,
        side: 'BUY',
        product: 'MIS',
        orderType: 'MARKET',
        quantity: 15,
        filledQuantity: 15,
        price: infyAvg,
        triggerPrice: 0,
        averagePrice: infyAvg,
        status: 'COMPLETE',
        statusMessage: 'Executed in paper trading engine',
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ],
    holdings: [
      {
        token: relInst.token,
        symbol: relInst.symbol,
        exchange: relInst.exchange,
        quantity: 15,
        averagePrice: Math.round(relLtp * 0.96 * 100) / 100,
        investedValue: h1Invested,
        t1Quantity: 0,
      },
      {
        token: tcsInst.token,
        symbol: tcsInst.symbol,
        exchange: tcsInst.exchange,
        quantity: 6,
        averagePrice: Math.round(tcsLtp * 0.97 * 100) / 100,
        investedValue: h2Invested,
        t1Quantity: 0,
      },
      {
        token: hdfcInst.token,
        symbol: hdfcInst.symbol,
        exchange: hdfcInst.exchange,
        quantity: 12,
        averagePrice: Math.round(hdfcLtp * 1.015 * 100) / 100,
        investedValue: h3Invested,
        t1Quantity: 0,
      },
    ],
    positions: [
      {
        id: `${infyInst.token}-MIS`,
        token: infyInst.token,
        symbol: infyInst.symbol,
        exchange: infyInst.exchange,
        product: 'MIS',
        quantity: 15,
        buyQuantity: 15,
        sellQuantity: 0,
        buyValue: infyVal,
        sellValue: 0,
        averageBuyPrice: infyAvg,
        averageSellPrice: 0,
        realizedPnl: 0,
      },
      {
        id: `${sbinInst.token}-MIS`,
        token: sbinInst.token,
        symbol: sbinInst.symbol,
        exchange: sbinInst.exchange,
        product: 'MIS',
        quantity: -40,
        buyQuantity: 0,
        sellQuantity: 40,
        buyValue: 0,
        sellValue: sbinVal,
        averageBuyPrice: 0,
        averageSellPrice: sbinAvg,
        realizedPnl: 0,
      },
      {
        id: `${niftyFutInst.token}-NRML`,
        token: niftyFutInst.token,
        symbol: niftyFutInst.symbol,
        exchange: niftyFutInst.exchange,
        product: 'NRML',
        quantity: 25,
        buyQuantity: 25,
        sellQuantity: 0,
        buyValue: niftyFutVal,
        sellValue: 0,
        averageBuyPrice: niftyFutAvg,
        averageSellPrice: 0,
        realizedPnl: 0,
      },
    ],
    kiteApiConfig: {
      connected: false,
      mode: market?.isLiveSynced() ? 'LIVE_MARKET_FEED' : 'SIMULATED_FEED',
      apiKeyMasked: '',
    },
    apiLogs: [
      {
        id: 'LOG-INIT',
        timestamp: nowIso,
        method: 'WS',
        endpoint: '/ws',
        status: 101,
        summary: market?.isLiveSynced()
          ? 'Real-time NSE/BSE live quote & technicals stream initialized'
          : 'Real-time market quote & technicals stream initialized',
      },
    ],
  };
}

export class TradingStore {
  private data: PersistedData = { users: {} };
  private market?: MarketEngine;
  private dataFile: string;
  private activeKiteSecrets = new Map<
    string,
    { apiKey: string; accessToken: string }
  >();

  constructor(market?: MarketEngine, dataFile = DATA_FILE) {
    this.market = market;
    this.dataFile = dataFile;
    this.load();
  }

  private load() {
    try {
      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        this.data = JSON.parse(raw) as PersistedData;
      }
    } catch {
      this.data = { users: {} };
    }

    let dirty = false;

    if (!this.data.users['KT8492']) {
      this.data.users['KT8492'] = {
        userId: 'KT8492',
        userName: 'Aarav Mehta',
        email: 'trader@trading.local',
        role: 'user',
        disabled: false,
        createdAt: new Date().toISOString(),
        passwordHash: hashSecret('kitedemo'),
        pinHash: hashSecret('123456'),
        portfolio: createSeedPortfolio(
          'KT8492',
          'Aarav Mehta',
          'trader@trading.local',
          this.market,
        ),
      };
      dirty = true;
    }

    if (!this.data.users['AD0001']) {
      this.data.users['AD0001'] = {
        userId: 'AD0001',
        userName: 'Admin Desk',
        email: 'admin@trading.local',
        role: 'admin',
        disabled: false,
        createdAt: new Date().toISOString(),
        passwordHash: hashSecret('kiteadmin'),
        pinHash: hashSecret('000000'),
        portfolio: createSeedPortfolio(
          'AD0001',
          'Admin Desk',
          'admin@trading.local',
          this.market,
          { openingBalance: 2500000, seedSampleData: false },
        ),
      };
      dirty = true;
    }

    for (const user of Object.values(this.data.users)) {
      if (user.email.endsWith('@kitesandbox.local')) {
        user.email = user.email.replace('@kitesandbox.local', '@trading.local');
        if (user.portfolio?.email) {
          user.portfolio.email = user.email;
        }
        dirty = true;
      }
      if (!user.role) {
        user.role = user.userId === 'AD0001' ? 'admin' : 'user';
        dirty = true;
      }
      if (typeof user.disabled !== 'boolean') {
        user.disabled = false;
        dirty = true;
      }
      if (!user.createdAt) {
        user.createdAt = new Date().toISOString();
        dirty = true;
      }
      if (this.market?.isLiveSynced() && user.portfolio.kiteApiConfig.mode === 'SIMULATED_FEED') {
        user.portfolio.kiteApiConfig.mode = 'LIVE_MARKET_FEED';
        dirty = true;
      }
    }

    if (dirty) this.save();
  }

  private save() {
    try {
      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  }

  private toAdminSummary(record: StoredUser): AdminUserSummary {
    return {
      userId: record.userId,
      userName: record.userName,
      email: record.email,
      role: record.role,
      disabled: record.disabled,
      availableCash: record.portfolio.availableCash,
      usedMargin: record.portfolio.usedMargin,
      openingBalance: record.portfolio.openingBalance,
      realizedPnl: record.portfolio.realizedPnl,
      holdingsCount: record.portfolio.holdings.length,
      openPositionsCount: record.portfolio.positions.filter((p) => p.quantity !== 0).length,
      ordersCount: record.portfolio.orders.length,
      createdAt: record.createdAt,
    };
  }

  public signSessionToken(userId: string): string {
    const payload = Buffer.from(
      JSON.stringify({ userId, iat: Date.now() }),
    ).toString('base64url');
    const sig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  public verifySessionToken(token: string | undefined): AuthUser | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payload)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    try {
      const parsed = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf-8'),
      ) as { userId: string };
      const user = this.data.users[parsed.userId];
      if (!user || user.disabled) return null;
      return {
        userId: user.userId,
        userName: user.userName,
        email: user.email,
        role: user.role,
      };
    } catch {
      return null;
    }
  }

  public login(
    userIdInput: string,
    password: string,
    pin: string,
  ): { ok: true; user: AuthUser; token: string } | { ok: false; error: string } {
    const userId = userIdInput.trim().toUpperCase();
    const record = this.data.users[userId];
    if (!record) {
      return { ok: false, error: 'Invalid Client ID or credentials.' };
    }
    if (record.disabled) {
      return { ok: false, error: 'Account is suspended. Contact an administrator.' };
    }
    if (!verifySecret(password, record.passwordHash)) {
      return { ok: false, error: 'Incorrect password. Please try again.' };
    }
    if (!verifySecret(pin.trim(), record.pinHash)) {
      return { ok: false, error: 'Invalid 6-digit 2FA PIN.' };
    }
    return {
      ok: true,
      user: {
        userId: record.userId,
        userName: record.userName,
        email: record.email,
        role: record.role,
      },
      token: this.signSessionToken(record.userId),
    };
  }

  public register(params: {
    userId: string;
    userName: string;
    email: string;
    password: string;
    pin: string;
  }): { ok: true; user: AuthUser; token: string } | { ok: false; error: string } {
    const userId = params.userId.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(userId)) {
      return {
        ok: false,
        error: 'Client ID must be 4–10 uppercase alphanumeric characters (e.g., KT9012).',
      };
    }
    if (this.data.users[userId]) {
      return { ok: false, error: `Client ID ${userId} already exists.` };
    }
    if (params.password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters.' };
    }
    if (!/^\d{6}$/.test(params.pin.trim())) {
      return { ok: false, error: 'Security PIN must be exactly 6 digits.' };
    }
    const userName = params.userName.trim() || 'Paper Trader';
    const email = params.email.trim() || `${userId.toLowerCase()}@trading.local`;

    this.data.users[userId] = {
      userId,
      userName,
      email,
      role: 'user',
      disabled: false,
      createdAt: new Date().toISOString(),
      passwordHash: hashSecret(params.password),
      pinHash: hashSecret(params.pin.trim()),
      portfolio: createSeedPortfolio(userId, userName, email, this.market),
    };
    this.save();

    return {
      ok: true,
      user: { userId, userName, email, role: 'user' },
      token: this.signSessionToken(userId),
    };
  }

  public getPortfolio(userId: string): PortfolioState | null {
    return this.data.users[userId]?.portfolio ?? null;
  }

  public appendApiLog(
    userId: string,
    method: string,
    endpoint: string,
    status: number,
    summary: string,
  ) {
    const user = this.data.users[userId];
    if (!user) return;
    user.portfolio.apiLogs.unshift({
      id: `LOG-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      status,
      summary,
    });
    if (user.portfolio.apiLogs.length > 40) {
      user.portfolio.apiLogs = user.portfolio.apiLogs.slice(0, 40);
    }
  }

  public updateWatchlist(
    userId: string,
    watchlistId: string,
    tokens: number[],
  ): PortfolioState | null {
    const user = this.data.users[userId];
    if (!user) return null;
    const valid = Array.from(new Set(tokens.filter((t) => INSTRUMENT_MAP.has(t)))).slice(
      0,
      50,
    );
    user.portfolio.watchlists[watchlistId] = valid;
    this.appendApiLog(
      userId,
      'PUT',
      `/api/watchlists/${watchlistId}`,
      200,
      `Updated Watchlist ${watchlistId} (${valid.length} symbols)`,
    );
    this.save();
    return user.portfolio;
  }

  public placeOrder(
    userId: string,
    request: OrderRequest,
    market: MarketEngine,
  ):
    | { ok: true; order: Order; portfolio: PortfolioState }
    | { ok: false; error: string } {
    const user = this.data.users[userId];
    if (!user) return { ok: false, error: 'User session not found.' };

    const instrument = INSTRUMENT_MAP.get(request.token);
    const quote = market.getQuote(request.token);
    if (!instrument || !quote) {
      return { ok: false, error: 'Instrument not found in market feed.' };
    }

    const validation = validateOrderRequest({
      portfolio: user.portfolio,
      request,
      instrument,
      quote,
    });
    if (!validation.ok) {
      return validation;
    }

    const nowIso = new Date().toISOString();
    const orderId = `261117${Math.floor(100000 + Math.random() * 899999)}`;
    const exchangeOrderId = `11000000${Math.floor(10000000 + Math.random() * 89999999)}`;

    const baseOrder: Order = {
      id: orderId,
      exchangeOrderId,
      userId,
      token: instrument.token,
      symbol: instrument.symbol,
      exchange: instrument.exchange,
      side: request.side,
      product: request.product,
      orderType: request.orderType,
      quantity: request.quantity,
      filledQuantity: 0,
      price:
        request.orderType === 'MARKET' || request.orderType === 'SL-M'
          ? quote.ltp
          : Number(request.price || quote.ltp),
      triggerPrice: Number(request.triggerPrice || 0),
      averagePrice: 0,
      status:
        request.orderType === 'SL' || request.orderType === 'SL-M'
          ? 'TRIGGER PENDING'
          : 'OPEN',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Immediate execution check for MARKET, CUSTOM (instant paper fill at entered price), or marketable LIMIT orders
    const isMarketableLimit =
      request.orderType === 'LIMIT' &&
      ((request.side === 'BUY' && baseOrder.price >= quote.ltp) ||
        (request.side === 'SELL' && baseOrder.price <= quote.ltp));

    if (
      request.orderType === 'MARKET' ||
      request.orderType === 'CUSTOM' ||
      isMarketableLimit
    ) {
      const fillPrice =
        request.orderType === 'CUSTOM' ? baseOrder.price : quote.ltp;
      const updatedPortfolio = applyFilledOrderToPortfolio({
        portfolio: user.portfolio,
        order: baseOrder,
        fillPrice,
        nowIso,
      });
      user.portfolio = updatedPortfolio;
      const filled = user.portfolio.orders[0];
      this.appendApiLog(
        userId,
        'POST',
        '/api/orders',
        200,
        `${filled.side} ${filled.quantity} ${filled.symbol} ${filled.product} @ ₹${fillPrice.toFixed(2)} COMPLETE`,
      );
      this.save();
      return { ok: true, order: filled, portfolio: user.portfolio };
    }

    // Reserve margin for resting OPEN / TRIGGER PENDING order
    const reserved = validation.requiredMargin;
    user.portfolio.availableCash =
      Math.round((user.portfolio.availableCash - reserved) * 100) / 100;
    user.portfolio.usedMargin =
      Math.round((user.portfolio.usedMargin + reserved) * 100) / 100;
    baseOrder.reservedMargin = reserved;
    baseOrder.statusMessage =
      baseOrder.status === 'TRIGGER PENDING'
        ? `Waiting for trigger ₹${baseOrder.triggerPrice.toFixed(2)}`
        : `Resting in order book at ₹${baseOrder.price.toFixed(2)}`;
    user.portfolio.orders.unshift(baseOrder);

    this.appendApiLog(
      userId,
      'POST',
      '/api/orders',
      200,
      `${baseOrder.side} ${baseOrder.quantity} ${baseOrder.symbol} ${baseOrder.orderType} (${baseOrder.status})`,
    );
    this.save();
    return { ok: true, order: baseOrder, portfolio: user.portfolio };
  }

  public cancelOrder(
    userId: string,
    orderId: string,
  ): { ok: true; portfolio: PortfolioState } | { ok: false; error: string } {
    const user = this.data.users[userId];
    if (!user) return { ok: false, error: 'User not found.' };
    const order = user.portfolio.orders.find((o) => o.id === orderId);
    if (!order) return { ok: false, error: 'Order not found.' };
    if (order.status !== 'OPEN' && order.status !== 'TRIGGER PENDING') {
      return { ok: false, error: 'Only OPEN or TRIGGER PENDING orders can be cancelled.' };
    }

    const refund = order.reservedMargin ?? 0;
    if (refund > 0) {
      user.portfolio.availableCash =
        Math.round((user.portfolio.availableCash + refund) * 100) / 100;
      user.portfolio.usedMargin = Math.max(
        0,
        Math.round((user.portfolio.usedMargin - refund) * 100) / 100,
      );
      order.reservedMargin = 0;
    }

    order.status = 'CANCELLED';
    order.statusMessage = 'Cancelled by trader';
    order.updatedAt = new Date().toISOString();
    this.appendApiLog(
      userId,
      'DELETE',
      `/api/orders/${orderId}`,
      200,
      `Cancelled ${order.side} ${order.quantity} ${order.symbol}`,
    );
    this.save();
    return { ok: true, portfolio: user.portfolio };
  }

  public processPendingOrdersOnTick(
    market: MarketEngine,
  ): { userId: string; order: Order; portfolio: PortfolioState }[] {
    const executions: { userId: string; order: Order; portfolio: PortfolioState }[] =
      [];
    const nowIso = new Date().toISOString();

    for (const user of Object.values(this.data.users)) {
      let changed = false;
      for (const order of user.portfolio.orders) {
        if (order.status !== 'OPEN' && order.status !== 'TRIGGER PENDING') continue;
        const quote = market.getQuote(order.token);
        if (!quote) continue;

        let shouldExecute = false;
        let fillPrice = quote.ltp;

        if (order.orderType === 'LIMIT') {
          if (order.side === 'BUY' && quote.ltp <= order.price) {
            shouldExecute = true;
            fillPrice = Math.min(order.price, quote.ltp);
          } else if (order.side === 'SELL' && quote.ltp >= order.price) {
            shouldExecute = true;
            fillPrice = Math.max(order.price, quote.ltp);
          }
        } else if (order.orderType === 'SL-M') {
          if (
            (order.side === 'BUY' && quote.ltp >= order.triggerPrice) ||
            (order.side === 'SELL' && quote.ltp <= order.triggerPrice)
          ) {
            shouldExecute = true;
            fillPrice = quote.ltp;
          }
        } else if (order.orderType === 'SL') {
          if (
            order.status === 'TRIGGER PENDING' &&
            ((order.side === 'BUY' && quote.ltp >= order.triggerPrice) ||
              (order.side === 'SELL' && quote.ltp <= order.triggerPrice))
          ) {
            order.status = 'OPEN';
            order.statusMessage = `Trigger hit at ₹${quote.ltp.toFixed(2)}, waiting for limit ₹${order.price.toFixed(2)}`;
            order.updatedAt = nowIso;
            changed = true;
          }
          if (
            order.status === 'OPEN' &&
            ((order.side === 'BUY' && quote.ltp <= order.price) ||
              (order.side === 'SELL' && quote.ltp >= order.price))
          ) {
            shouldExecute = true;
            fillPrice = quote.ltp;
          }
        }

        if (shouldExecute) {
          user.portfolio = applyFilledOrderToPortfolio({
            portfolio: user.portfolio,
            order,
            fillPrice,
            nowIso,
          });
          const updatedOrder =
            user.portfolio.orders.find((o) => o.id === order.id) || order;
          this.appendApiLog(
            user.userId,
            'WS',
            '/api/orders/match',
            200,
            `Matched ${updatedOrder.orderType} ${updatedOrder.side} ${updatedOrder.quantity} ${updatedOrder.symbol} @ ₹${fillPrice.toFixed(2)}`,
          );
          executions.push({
            userId: user.userId,
            order: updatedOrder,
            portfolio: user.portfolio,
          });
          changed = true;
        }
      }
      if (changed) this.save();
    }

    return executions;
  }

  public updateHolding(
    userId: string,
    token: number,
    quantity: number,
    averagePrice: number,
  ): { ok: true; portfolio: PortfolioState } | { ok: false; error: string } {
    const user = this.data.users[userId];
    if (!user) return { ok: false, error: 'User not found.' };
    const holding = user.portfolio.holdings.find((h) => h.token === token);
    if (!holding) return { ok: false, error: 'Holding not found.' };

    const cleanQty = Math.floor(Number(quantity));
    const cleanAvg = Math.round(Number(averagePrice) * 100) / 100;
    if (!Number.isFinite(cleanQty) || cleanQty <= 0) {
      return { ok: false, error: 'Quantity must be a positive whole number.' };
    }
    if (!Number.isFinite(cleanAvg) || cleanAvg <= 0) {
      return { ok: false, error: 'Average price must be greater than zero.' };
    }

    holding.quantity = cleanQty;
    holding.averagePrice = cleanAvg;
    holding.investedValue = Math.round(cleanQty * cleanAvg * 100) / 100;
    this.appendApiLog(
      userId,
      'PATCH',
      `/api/holdings/${token}`,
      200,
      `Updated ${holding.symbol} holding to Qty ${cleanQty} @ ₹${cleanAvg.toFixed(2)}`,
    );
    this.save();
    return { ok: true, portfolio: user.portfolio };
  }

  public deleteHolding(
    userId: string,
    token: number,
  ): { ok: true; portfolio: PortfolioState } | { ok: false; error: string } {
    const user = this.data.users[userId];
    if (!user) return { ok: false, error: 'User not found.' };
    const idx = user.portfolio.holdings.findIndex((h) => h.token === token);
    if (idx === -1) return { ok: false, error: 'Holding not found.' };

    const [removed] = user.portfolio.holdings.splice(idx, 1);
    this.appendApiLog(
      userId,
      'DELETE',
      `/api/holdings/${token}`,
      200,
      `Removed ${removed.symbol} from paper holdings`,
    );
    this.save();
    return { ok: true, portfolio: user.portfolio };
  }

  public updatePosition(
    userId: string,
    positionId: string,
    quantity: number,
    averagePrice: number,
  ): { ok: true; portfolio: PortfolioState } | { ok: false; error: string } {
    const user = this.data.users[userId];
    if (!user) return { ok: false, error: 'User not found.' };
    const pos = user.portfolio.positions.find((p) => p.id === positionId);
    if (!pos) return { ok: false, error: 'Position not found.' };

    const cleanQty = Math.trunc(Number(quantity));
    const cleanAvg = Math.round(Number(averagePrice) * 100) / 100;
    if (!Number.isFinite(cleanQty)) {
      return { ok: false, error: 'Quantity must be a valid whole number.' };
    }
    if (!Number.isFinite(cleanAvg) || cleanAvg <= 0) {
      return { ok: false, error: 'Average price must be greater than zero.' };
    }

    pos.quantity = cleanQty;
    if (cleanQty >= 0) {
      pos.buyQuantity = Math.max(cleanQty, pos.sellQuantity + cleanQty);
      pos.averageBuyPrice = cleanAvg;
      pos.buyValue = Math.round(pos.buyQuantity * cleanAvg * 100) / 100;
    } else {
      const absQty = Math.abs(cleanQty);
      pos.sellQuantity = Math.max(absQty, pos.buyQuantity + absQty);
      pos.averageSellPrice = cleanAvg;
      pos.sellValue = Math.round(pos.sellQuantity * cleanAvg * 100) / 100;
    }

    this.appendApiLog(
      userId,
      'PATCH',
      `/api/positions/${positionId}`,
      200,
      `Updated ${pos.symbol} (${pos.product}) position to Qty ${cleanQty} @ ₹${cleanAvg.toFixed(2)}`,
    );
    this.save();
    return { ok: true, portfolio: user.portfolio };
  }

  public deletePosition(
    userId: string,
    positionId: string,
  ): { ok: true; portfolio: PortfolioState } | { ok: false; error: string } {
    const user = this.data.users[userId];
    if (!user) return { ok: false, error: 'User not found.' };
    const idx = user.portfolio.positions.findIndex((p) => p.id === positionId);
    if (idx === -1) return { ok: false, error: 'Position not found.' };

    const [removed] = user.portfolio.positions.splice(idx, 1);
    this.appendApiLog(
      userId,
      'DELETE',
      `/api/positions/${positionId}`,
      200,
      `Removed ${removed.symbol} (${removed.product}) from positions`,
    );
    this.save();
    return { ok: true, portfolio: user.portfolio };
  }

  public exitPosition(
    userId: string,
    positionId: string,
    market: MarketEngine,
  ): { ok: true; portfolio: PortfolioState } | { ok: false; error: string } {
    const user = this.data.users[userId];
    if (!user) return { ok: false, error: 'User not found.' };
    const pos = user.portfolio.positions.find((p) => p.id === positionId);
    if (!pos || pos.quantity === 0) {
      return { ok: false, error: 'Open position not found.' };
    }
    return this.placeOrder(
      userId,
      {
        token: pos.token,
        side: pos.quantity > 0 ? 'SELL' : 'BUY',
        product: pos.product,
        orderType: 'MARKET',
        quantity: Math.abs(pos.quantity),
      },
      market,
    );
  }

  public convertPosition(
    userId: string,
    positionId: string,
    market: MarketEngine,
  ): { ok: true; portfolio: PortfolioState } | { ok: false; error: string } {
    const user = this.data.users[userId];
    if (!user) return { ok: false, error: 'User not found.' };
    const posIdx = user.portfolio.positions.findIndex((p) => p.id === positionId);
    if (posIdx < 0) return { ok: false, error: 'Position not found.' };
    const pos = user.portfolio.positions[posIdx];
    if (pos.quantity <= 0) {
      return {
        ok: false,
        error: 'Only net long positions can be converted to CNC delivery.',
      };
    }
    const quote = market.getQuote(pos.token);
    const ltp = quote?.ltp ?? pos.averageBuyPrice;
    const targetProduct: ProductType = pos.product === 'MIS' ? 'CNC' : 'MIS';

    if (targetProduct === 'CNC') {
      const fullCost = Math.round(pos.quantity * pos.averageBuyPrice * 100) / 100;
      const misMargin = Math.round(fullCost * 0.2 * 100) / 100;
      const extraNeeded = Math.round((fullCost - misMargin) * 100) / 100;
      if (extraNeeded > user.portfolio.availableCash) {
        return {
          ok: false,
          error: `Insufficient cash to convert MIS to CNC delivery. Extra needed: ₹${extraNeeded.toFixed(2)}.`,
        };
      }
      user.portfolio.availableCash =
        Math.round((user.portfolio.availableCash - extraNeeded) * 100) / 100;
      user.portfolio.usedMargin =
        Math.round((user.portfolio.usedMargin + extraNeeded) * 100) / 100;

      // Move to CNC holdings
      const existingHolding = user.portfolio.holdings.find(
        (h) => h.token === pos.token,
      );
      if (existingHolding) {
        const totalQty = existingHolding.quantity + pos.quantity;
        const totalInv =
          Math.round((existingHolding.investedValue + fullCost) * 100) / 100;
        existingHolding.quantity = totalQty;
        existingHolding.investedValue = totalInv;
        existingHolding.averagePrice = Math.round((totalInv / totalQty) * 100) / 100;
      } else {
        user.portfolio.holdings.push({
          token: pos.token,
          symbol: pos.symbol,
          exchange: pos.exchange,
          quantity: pos.quantity,
          averagePrice: pos.averageBuyPrice,
          investedValue: fullCost,
          t1Quantity: pos.quantity,
        });
      }
      user.portfolio.positions.splice(posIdx, 1);
      this.appendApiLog(
        userId,
        'PUT',
        '/api/positions/convert',
        200,
        `Converted ${pos.quantity} ${pos.symbol} MIS -> CNC @ ₹${ltp.toFixed(2)}`,
      );
      this.save();
      return { ok: true, portfolio: user.portfolio };
    }

    return { ok: false, error: 'Conversion not supported for this product type.' };
  }

  public addVirtualFunds(
    userId: string,
    amount: number,
  ): { ok: true; portfolio: PortfolioState } | { ok: false; error: string } {
    const user = this.data.users[userId];
    if (!user) return { ok: false, error: 'User not found.' };
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
      return {
        ok: false,
        error: 'Enter an amount between ₹1 and ₹1,00,00,000.',
      };
    }
    user.portfolio.availableCash =
      Math.round((user.portfolio.availableCash + amount) * 100) / 100;
    user.portfolio.openingBalance =
      Math.round((user.portfolio.openingBalance + amount) * 100) / 100;
    this.appendApiLog(
      userId,
      'POST',
      '/api/funds/add',
      200,
      `Added ₹${amount.toLocaleString('en-IN')} simulated capital`,
    );
    this.save();
    return { ok: true, portfolio: user.portfolio };
  }

  public resetPortfolio(userId: string): PortfolioState | null {
    const user = this.data.users[userId];
    if (!user) return null;
    user.portfolio = createSeedPortfolio(
      user.userId,
      user.userName,
      user.email,
      this.market,
    );
    this.appendApiLog(
      userId,
      'POST',
      '/api/funds/reset',
      200,
      'Reset paper trading portfolio to ₹10,00,000',
    );
    this.save();
    return user.portfolio;
  }

  public setKiteBridge(
    userId: string,
    apiKey: string,
    accessToken: string,
  ): PortfolioState | null {
    const user = this.data.users[userId];
    if (!user) return null;

    if (!apiKey.trim() || !accessToken.trim()) {
      this.activeKiteSecrets.delete(userId);
      user.portfolio.kiteApiConfig = {
        connected: false,
        mode: this.market?.isLiveSynced() ? 'LIVE_MARKET_FEED' : 'SIMULATED_FEED',
        apiKeyMasked: '',
      };
      this.appendApiLog(
        userId,
        'DELETE',
        '/api/kite-bridge',
        200,
        'Disconnected external read-only bridge; using built-in live market feed',
      );
    } else {
      this.activeKiteSecrets.set(userId, {
        apiKey: apiKey.trim(),
        accessToken: accessToken.trim(),
      });
      const masked =
        apiKey.trim().length > 6
          ? `${apiKey.trim().slice(0, 4)}••••${apiKey.trim().slice(-2)}`
          : '••••••';
      user.portfolio.kiteApiConfig = {
        connected: true,
        mode: 'KITE_PROXY_READONLY',
        apiKeyMasked: masked,
        lastSyncedAt: new Date().toISOString(),
      };
      this.appendApiLog(
        userId,
        'POST',
        '/api/kite-bridge',
        200,
        'Configured external read-only market quote bridge (simulated orders only)',
      );
    }
    this.save();
    return user.portfolio;
  }

  public getKiteSecrets(userId: string) {
    return this.activeKiteSecrets.get(userId);
  }

  // --- Admin User & Capital Management ---
  public adminListUsers(): AdminUserSummary[] {
    return Object.values(this.data.users)
      .sort((a, b) => {
        if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
        return a.userId.localeCompare(b.userId);
      })
      .map((u) => this.toAdminSummary(u));
  }

  public adminCreateUser(
    params: AdminCreateUserRequest,
  ): { ok: true; user: AdminUserSummary } | { ok: false; error: string } {
    const userId = params.userId.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(userId)) {
      return {
        ok: false,
        error: 'Client ID must be 4–10 uppercase alphanumeric characters (e.g., KT9012).',
      };
    }
    if (this.data.users[userId]) {
      return { ok: false, error: `Client ID ${userId} already exists.` };
    }
    if (!params.password || params.password.length < 4) {
      return { ok: false, error: 'Password must be at least 4 characters.' };
    }
    if (!/^\d{6}$/.test(params.pin.trim())) {
      return { ok: false, error: 'Security PIN must be exactly 6 digits.' };
    }
    const role: UserRole = params.role === 'admin' ? 'admin' : 'user';
    const userName = params.userName.trim() || (role === 'admin' ? 'Admin User' : 'Paper Trader');
    const email =
      params.email?.trim() || `${userId.toLowerCase()}@trading.local`;

    const openingBalance =
      typeof params.openingBalance === 'number' &&
      Number.isFinite(params.openingBalance) &&
      params.openingBalance >= 10000 &&
      params.openingBalance <= 50000000
        ? Math.round(params.openingBalance * 100) / 100
        : 1000000;

    const record: StoredUser = {
      userId,
      userName,
      email,
      role,
      disabled: false,
      createdAt: new Date().toISOString(),
      passwordHash: hashSecret(params.password),
      pinHash: hashSecret(params.pin.trim()),
      portfolio: createSeedPortfolio(userId, userName, email, this.market, {
        openingBalance,
        seedSampleData: params.seedSampleData ?? false,
      }),
    };

    this.data.users[userId] = record;
    this.save();
    return { ok: true, user: this.toAdminSummary(record) };
  }

  public adminUpdateUser(
    actorUserId: string,
    targetUserId: string,
    updates: AdminUpdateUserRequest,
  ): { ok: true; user: AdminUserSummary } | { ok: false; error: string } {
    const id = targetUserId.trim().toUpperCase();
    const record = this.data.users[id];
    if (!record) return { ok: false, error: 'User account not found.' };

    if (id === actorUserId && updates.role && updates.role !== 'admin') {
      return { ok: false, error: 'You cannot remove your own administrator role.' };
    }
    if (id === actorUserId && updates.disabled === true) {
      return { ok: false, error: 'You cannot suspend your own active admin account.' };
    }

    if (typeof updates.userName === 'string' && updates.userName.trim()) {
      record.userName = updates.userName.trim();
      record.portfolio.userName = record.userName;
    }
    if (typeof updates.email === 'string' && updates.email.trim()) {
      record.email = updates.email.trim();
      record.portfolio.email = record.email;
    }
    if (updates.role === 'admin' || updates.role === 'user') {
      record.role = updates.role;
    }
    if (typeof updates.disabled === 'boolean') {
      record.disabled = updates.disabled;
    }
    if (typeof updates.password === 'string' && updates.password.length > 0) {
      if (updates.password.length < 4) {
        return { ok: false, error: 'New password must be at least 4 characters.' };
      }
      record.passwordHash = hashSecret(updates.password);
    }
    if (typeof updates.pin === 'string' && updates.pin.trim().length > 0) {
      if (!/^\d{6}$/.test(updates.pin.trim())) {
        return { ok: false, error: 'Security PIN must be exactly 6 digits.' };
      }
      record.pinHash = hashSecret(updates.pin.trim());
    }

    this.appendApiLog(
      id,
      'PATCH',
      `/api/admin/users/${id}`,
      200,
      `Account updated by admin ${actorUserId}`,
    );
    this.save();
    return { ok: true, user: this.toAdminSummary(record) };
  }

  public adminAdjustUserFunds(
    actorUserId: string,
    targetUserId: string,
    deltaAmount: number,
  ):
    | { ok: true; user: AdminUserSummary; portfolio: PortfolioState }
    | { ok: false; error: string } {
    const id = targetUserId.trim().toUpperCase();
    const record = this.data.users[id];
    if (!record) return { ok: false, error: 'User account not found.' };
    if (!Number.isFinite(deltaAmount) || deltaAmount === 0) {
      return { ok: false, error: 'Enter a non-zero capital adjustment amount.' };
    }
    const nextAvailable = Math.round((record.portfolio.availableCash + deltaAmount) * 100) / 100;
    const nextOpening = Math.round((record.portfolio.openingBalance + deltaAmount) * 100) / 100;
    if (nextAvailable < 0 || nextOpening < 0) {
      return {
        ok: false,
        error: `Cannot deduct more than available margin (₹${record.portfolio.availableCash.toLocaleString('en-IN')}).`,
      };
    }

    record.portfolio.availableCash = nextAvailable;
    record.portfolio.openingBalance = nextOpening;
    this.appendApiLog(
      id,
      'POST',
      `/api/admin/users/${id}/funds`,
      200,
      `Admin ${actorUserId} adjusted virtual capital by ${deltaAmount >= 0 ? '+' : ''}₹${deltaAmount.toLocaleString('en-IN')}`,
    );
    this.save();
    return { ok: true, user: this.toAdminSummary(record), portfolio: record.portfolio };
  }

  public adminResetUserPortfolio(
    actorUserId: string,
    targetUserId: string,
    seedSampleData = false,
  ):
    | { ok: true; user: AdminUserSummary; portfolio: PortfolioState }
    | { ok: false; error: string } {
    const id = targetUserId.trim().toUpperCase();
    const record = this.data.users[id];
    if (!record) return { ok: false, error: 'User account not found.' };

    record.portfolio = createSeedPortfolio(
      record.userId,
      record.userName,
      record.email,
      this.market,
      { openingBalance: 1000000, seedSampleData },
    );
    this.appendApiLog(
      id,
      'POST',
      `/api/admin/users/${id}/reset`,
      200,
      `Portfolio reset to ₹10,00,000 by admin ${actorUserId}`,
    );
    this.save();
    return { ok: true, user: this.toAdminSummary(record), portfolio: record.portfolio };
  }

  public adminDeleteUser(
    actorUserId: string,
    targetUserId: string,
  ): { ok: true } | { ok: false; error: string } {
    const id = targetUserId.trim().toUpperCase();
    if (id === actorUserId) {
      return { ok: false, error: 'You cannot delete your own active admin account.' };
    }
    if (!this.data.users[id]) {
      return { ok: false, error: 'User account not found.' };
    }
    delete this.data.users[id];
    this.activeKiteSecrets.delete(id);
    this.save();
    return { ok: true };
  }
}
