import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFilledOrderToPortfolio,
  calculateRequiredMargin,
  computeHoldingMetrics,
  computePositionMetrics,
  validateOrderRequest,
} from './portfolioMath.ts';
import type { Instrument, MarketQuote, Order, PortfolioState } from './types.ts';

const sampleInstrument: Instrument = {
  token: 738561,
  symbol: 'RELIANCE',
  name: 'Reliance Industries Ltd',
  exchange: 'NSE',
  lotSize: 1,
  tickSize: 0.05,
  basePrice: 2500,
  sector: 'Energy',
};

const sampleQuote: MarketQuote = {
  token: 738561,
  symbol: 'RELIANCE',
  exchange: 'NSE',
  ltp: 2500,
  open: 2480,
  high: 2520,
  low: 2475,
  close: 2480,
  change: 20,
  changePercent: 0.81,
  volume: 1500000,
  averagePrice: 2495,
  lastQty: 12,
  lowerCircuit: 2232,
  upperCircuit: 2728,
  week52High: 2800,
  week52Low: 2150,
  timestamp: 1700000000000,
  direction: 'up',
  depth: { buy: [], sell: [] },
};

function makePortfolio(): PortfolioState {
  return {
    userId: 'KT8492',
    userName: 'Aarav Mehta',
    email: 'trader@kitesandbox.local',
    availableCash: 100000,
    openingBalance: 100000,
    usedMargin: 0,
    realizedPnl: 0,
    watchlists: { '1': [738561] },
    orders: [],
    holdings: [],
    positions: [],
    kiteApiConfig: {
      connected: false,
      mode: 'SIMULATED_FEED',
      apiKeyMasked: '',
    },
    apiLogs: [],
  };
}

test('calculateRequiredMargin applies 100% for CNC and 20% for MIS', () => {
  assert.equal(calculateRequiredMargin('BUY', 'CNC', 10, 2500, [], 738561), 25000);
  assert.equal(calculateRequiredMargin('BUY', 'MIS', 10, 2500, [], 738561), 5000);
});

test('validateOrderRequest rejects CNC SELL without holdings and insufficient margin', () => {
  const portfolio = makePortfolio();
  const resSell = validateOrderRequest({
    portfolio,
    request: { token: 738561, side: 'SELL', product: 'CNC', orderType: 'MARKET', quantity: 5 },
    instrument: sampleInstrument,
    quote: sampleQuote,
  });
  assert.equal(resSell.ok, false);

  const resMargin = validateOrderRequest({
    portfolio,
    request: { token: 738561, side: 'BUY', product: 'CNC', orderType: 'MARKET', quantity: 100 },
    instrument: sampleInstrument,
    quote: sampleQuote,
  });
  assert.equal(resMargin.ok, false);
});

test('applyFilledOrderToPortfolio creates CNC holding and tracks live P&L accurately', () => {
  const portfolio = makePortfolio();
  const buyOrder: Order = {
    id: 'ORD-1',
    exchangeOrderId: 'EX-1',
    userId: 'KT8492',
    token: 738561,
    symbol: 'RELIANCE',
    exchange: 'NSE',
    side: 'BUY',
    product: 'CNC',
    orderType: 'MARKET',
    quantity: 10,
    filledQuantity: 0,
    price: 2500,
    triggerPrice: 0,
    averagePrice: 0,
    status: 'OPEN',
    createdAt: '2026-11-17T09:15:00Z',
    updatedAt: '2026-11-17T09:15:00Z',
  };

  const afterBuy = applyFilledOrderToPortfolio({
    portfolio,
    order: buyOrder,
    fillPrice: 2500,
    nowIso: '2026-11-17T09:15:00Z',
  });

  assert.equal(afterBuy.availableCash, 75000);
  assert.equal(afterBuy.usedMargin, 25000);
  assert.equal(afterBuy.holdings.length, 1);
  assert.equal(afterBuy.holdings[0].quantity, 10);

  const metrics = computeHoldingMetrics(afterBuy.holdings[0], { ...sampleQuote, ltp: 2600 });
  assert.equal(metrics.currentValue, 26000);
  assert.equal(metrics.pnl, 1000);
  assert.equal(metrics.pnlPercent, 4);
});

test('applyFilledOrderToPortfolio computes MIS intraday M2M and realized P&L on square off', () => {
  const portfolio = makePortfolio();
  const buyOrder: Order = {
    id: 'ORD-2',
    exchangeOrderId: 'EX-2',
    userId: 'KT8492',
    token: 738561,
    symbol: 'RELIANCE',
    exchange: 'NSE',
    side: 'BUY',
    product: 'MIS',
    orderType: 'MARKET',
    quantity: 10,
    filledQuantity: 0,
    price: 2500,
    triggerPrice: 0,
    averagePrice: 0,
    status: 'OPEN',
    createdAt: '2026-11-17T09:15:00Z',
    updatedAt: '2026-11-17T09:15:00Z',
  };

  const afterBuy = applyFilledOrderToPortfolio({
    portfolio,
    order: buyOrder,
    fillPrice: 2500,
    nowIso: '2026-11-17T09:15:00Z',
  });

  assert.equal(afterBuy.availableCash, 95000);
  assert.equal(afterBuy.usedMargin, 5000);
  const openPos = computePositionMetrics(afterBuy.positions[0], { ...sampleQuote, ltp: 2540 });
  assert.equal(openPos.mtmPnl, 400);

  const sellOrder: Order = { ...buyOrder, id: 'ORD-3', exchangeOrderId: 'EX-3', side: 'SELL' };
  const afterSell = applyFilledOrderToPortfolio({
    portfolio: afterBuy,
    order: sellOrder,
    fillPrice: 2540,
    nowIso: '2026-11-17T09:20:00Z',
  });

  assert.equal(afterSell.positions[0].quantity, 0);
  assert.equal(afterSell.realizedPnl, 400);
  assert.equal(afterSell.usedMargin, 0);
  assert.equal(afterSell.availableCash, 100400);
});

test('CNC buys at different prices (1 @ 2395 + 100 @ 1500) average in holdings and track live price changes', () => {
  const portfolio: PortfolioState = {
    ...makePortfolio(),
    availableCash: 500000,
    openingBalance: 500000,
  };

  const firstBuy: Order = {
    id: 'ORD-A1',
    exchangeOrderId: 'EX-A1',
    userId: 'KT8492',
    token: 738561,
    symbol: 'RELIANCE',
    exchange: 'NSE',
    side: 'BUY',
    product: 'CNC',
    orderType: 'MARKET',
    quantity: 1,
    filledQuantity: 0,
    price: 2395,
    triggerPrice: 0,
    averagePrice: 0,
    status: 'OPEN',
    createdAt: '2026-11-17T09:15:00Z',
    updatedAt: '2026-11-17T09:15:00Z',
  };

  const afterFirst = applyFilledOrderToPortfolio({
    portfolio,
    order: firstBuy,
    fillPrice: 2395,
    nowIso: '2026-11-17T09:15:00Z',
  });

  assert.equal(afterFirst.holdings[0].quantity, 1);
  assert.equal(afterFirst.holdings[0].averagePrice, 2395);

  const secondCustomBuy: Order = {
    ...firstBuy,
    id: 'ORD-A2',
    exchangeOrderId: 'EX-A2',
    orderType: 'CUSTOM',
    quantity: 100,
    price: 1500,
  };

  const afterSecond = applyFilledOrderToPortfolio({
    portfolio: afterFirst,
    order: secondCustomBuy,
    fillPrice: 1500,
    nowIso: '2026-11-17T09:16:00Z',
  });

  assert.equal(afterSecond.holdings.length, 1);
  assert.equal(afterSecond.holdings[0].quantity, 101);
  assert.equal(afterSecond.holdings[0].investedValue, 152395);
  assert.equal(afterSecond.holdings[0].averagePrice, 1508.86);
  assert.equal(afterSecond.usedMargin, 152395);

  // Live market price change to 2395
  const at2395 = computeHoldingMetrics(afterSecond.holdings[0], { ...sampleQuote, ltp: 2395 });
  assert.equal(at2395.currentValue, 241895);
  assert.equal(at2395.pnl, 89500);

  // Live market price moves up to 2410
  const at2410 = computeHoldingMetrics(afterSecond.holdings[0], { ...sampleQuote, ltp: 2410 });
  assert.equal(at2410.currentValue, 243410);
  assert.equal(at2410.pnl, 91015);

  // Partial sell 1 qty at 2400 then full sell remaining 100 qty leaves zero margin drift
  const partialSell: Order = {
    ...firstBuy,
    id: 'ORD-S1',
    exchangeOrderId: 'EX-S1',
    side: 'SELL',
    orderType: 'CUSTOM',
    quantity: 1,
    price: 2400,
  };
  const afterPartial = applyFilledOrderToPortfolio({
    portfolio: afterSecond,
    order: partialSell,
    fillPrice: 2400,
    nowIso: '2026-11-17T09:17:00Z',
  });
  assert.equal(afterPartial.holdings[0].quantity, 100);

  const exitAll: Order = {
    ...partialSell,
    id: 'ORD-S2',
    exchangeOrderId: 'EX-S2',
    quantity: 100,
  };
  const afterAllSold = applyFilledOrderToPortfolio({
    portfolio: afterPartial,
    order: exitAll,
    fillPrice: 2400,
    nowIso: '2026-11-17T09:18:00Z',
  });
  assert.equal(afterAllSold.holdings.length, 0);
  assert.equal(afterAllSold.usedMargin, 0);
});

