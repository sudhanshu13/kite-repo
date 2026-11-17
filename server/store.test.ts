import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
