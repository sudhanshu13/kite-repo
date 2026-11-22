import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MarketEngine } from './marketEngine.ts';
import { TradingStore } from './store.ts';

function createTempStore() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kite-store-test-'));
  const filePath = path.join(tmpDir, 'store.json');
  const store = new TradingStore(undefined, filePath);
  return {
    store,
    cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }),
  };
}

test('TradingStore seeds default trader KT8492 and admin AD0001 with distinct roles', () => {
  const { store, cleanup } = createTempStore();
  try {
    const traderAuth = store.login('KT8492', 'kitedemo', '123456');
    assert.equal(traderAuth.ok, true);
    if (traderAuth.ok) {
      assert.equal(traderAuth.user.role, 'user');
    }

    const adminAuth = store.login('AD0001', 'kiteadmin', '000000');
    assert.equal(adminAuth.ok, true);
    if (adminAuth.ok) {
      assert.equal(adminAuth.user.role, 'admin');
    }

    const users = store.adminListUsers();
    assert.equal(users.length, 2);
    assert.equal(users[0].userId, 'AD0001');
    assert.equal(users[1].userId, 'KT8492');
  } finally {
    cleanup();
  }
});

test('Admin can create user with custom capital, adjust funds, suspend, and prevent self-lockout', () => {
  const { store, cleanup } = createTempStore();
  try {
    const created = store.adminCreateUser({
      userId: 'kt9900',
      userName: 'Priya Verma',
      email: 'priya@kitesandbox.local',
      password: 'secret99',
      pin: '654321',
      role: 'user',
      openingBalance: 500000,
      seedSampleData: false,
    });
    assert.equal(created.ok, true);
    if (created.ok) {
      assert.equal(created.user.userId, 'KT9900');
      assert.equal(created.user.role, 'user');
      assert.equal(created.user.availableCash, 500000);
      assert.equal(created.user.holdingsCount, 0);
    }

    // Newly created user can authenticate
    const loginRes = store.login('KT9900', 'secret99', '654321');
    assert.equal(loginRes.ok, true);

    // Admin adds ₹2,50,000 capital
    const adj = store.adminAdjustUserFunds('AD0001', 'KT9900', 250000);
    assert.equal(adj.ok, true);
    if (adj.ok) {
      assert.equal(adj.user.availableCash, 750000);
      assert.equal(adj.user.openingBalance, 750000);
    }

    // Admin suspends KT9900 -> existing session token and login fail
    const suspended = store.adminUpdateUser('AD0001', 'KT9900', { disabled: true });
    assert.equal(suspended.ok, true);
    if (loginRes.ok) {
      assert.equal(store.verifySessionToken(loginRes.token), null);
    }
    const blockedLogin = store.login('KT9900', 'secret99', '654321');
    assert.equal(blockedLogin.ok, false);

    // Admin cannot demote, suspend, or delete themselves
    assert.equal(store.adminUpdateUser('AD0001', 'AD0001', { role: 'user' }).ok, false);
    assert.equal(store.adminUpdateUser('AD0001', 'AD0001', { disabled: true }).ok, false);
    assert.equal(store.adminDeleteUser('AD0001', 'AD0001').ok, false);
  } finally {
    cleanup();
  }
});

test('CUSTOM order executes immediately at user-entered price and averages into CNC holdings', () => {
  const { store, cleanup } = createTempStore();
  try {
    const market = new MarketEngine();
    // Use AD0001 (starts clean with ₹25,00,000 cash and 0 holdings)
    // 1) Buy 1 qty of TCS (token 2953217) at custom price ₹2395
    const first = store.placeOrder(
      'AD0001',
      {
        token: 2953217,
        side: 'BUY',
        product: 'CNC',
        orderType: 'CUSTOM',
        quantity: 1,
        price: 2395,
      },
      market,
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.order.status, 'COMPLETE');
    assert.equal(first.order.averagePrice, 2395);

    // 2) Buy 100 qty of TCS at custom price ₹1500
    const second = store.placeOrder(
      'AD0001',
      {
        token: 2953217,
        side: 'BUY',
        product: 'CNC',
        orderType: 'CUSTOM',
        quantity: 100,
        price: 1500,
      },
      market,
    );
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.order.status, 'COMPLETE');
    assert.equal(second.order.averagePrice, 1500);

    const tcsHolding = second.portfolio.holdings.find((h) => h.token === 2953217);
    assert.ok(tcsHolding);
    assert.equal(tcsHolding.quantity, 101);
    assert.equal(tcsHolding.investedValue, 152395);
    assert.equal(tcsHolding.averagePrice, 1508.86);
  } finally {
    cleanup();
  }
});

test('TradingStore updateHolding and deleteHolding modify and remove CNC holdings accurately', () => {
  const { store, cleanup } = createTempStore();
  try {
    const initial = store.getPortfolio('KT8492');
    assert.ok(initial && initial.holdings.length > 0);
    const target = initial.holdings[0];

    const updated = store.updateHolding('KT8492', target.token, 25, 1400.5);
    assert.equal(updated.ok, true);
    if (updated.ok) {
      const h = updated.portfolio.holdings.find((item) => item.token === target.token);
      assert.ok(h);
      assert.equal(h.quantity, 25);
      assert.equal(h.averagePrice, 1400.5);
      assert.equal(h.investedValue, 35012.5);
    }

    assert.equal(store.updateHolding('KT8492', target.token, 0, 1400).ok, false);

    const deleted = store.deleteHolding('KT8492', target.token);
    assert.equal(deleted.ok, true);
    if (deleted.ok) {
      assert.equal(
        deleted.portfolio.holdings.some((item) => item.token === target.token),
        false,
      );
    }
  } finally {
    cleanup();
  }
});

test('TradingStore updatePosition and deletePosition modify and remove positions accurately', () => {
  const { store, cleanup } = createTempStore();
  try {
    const initial = store.getPortfolio('KT8492');
    assert.ok(initial && initial.positions.length > 0);
    const target = initial.positions[0];

    const updated = store.updatePosition('KT8492', target.id, 30, 1125.5);
    assert.equal(updated.ok, true);
    if (updated.ok) {
      const p = updated.portfolio.positions.find((item) => item.id === target.id);
      assert.ok(p);
      assert.equal(p.quantity, 30);
      assert.equal(p.averageBuyPrice, 1125.5);
    }

    const updatedShort = store.updatePosition('KT8492', target.id, -20, 1150);
    assert.equal(updatedShort.ok, true);
    if (updatedShort.ok) {
      const p = updatedShort.portfolio.positions.find((item) => item.id === target.id);
      assert.ok(p);
      assert.equal(p.quantity, -20);
      assert.equal(p.averageSellPrice, 1150);
    }

    assert.equal(store.updatePosition('KT8492', target.id, 10, 0).ok, false);

    const deleted = store.deletePosition('KT8492', target.id);
    assert.equal(deleted.ok, true);
    if (deleted.ok) {
      assert.equal(
        deleted.portfolio.positions.some((item) => item.id === target.id),
        false,
      );
    }
  } finally {
    cleanup();
  }
});



