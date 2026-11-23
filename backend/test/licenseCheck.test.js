// POST /api/license/check — response contract and database round trips.
// The route is the extension's hot path (called on every panel load), so this locks
// both what it answers and how many queries it spends doing so.
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'license-check-test-secret';
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';

const calls = [];
let users;
let licenses;
let fingerprints;
let licenseReadFails = false;
let linkWriteFails = false;
let releaseLinkWrite = null; // when set, updateMany waits for it

function reset() {
  calls.length = 0;
  licenseReadFails = false;
  linkWriteFails = false;
  releaseLinkWrite = null;
  users = new Map([
    ['u_pro', { id: 'u_pro', email: 'pro@example.com', isAdmin: false, poUserId: '700001' }],
    ['u_basic', { id: 'u_basic', email: 'basic@example.com', isAdmin: false, poUserId: null }],
    ['u_free', { id: 'u_free', email: 'free@example.com', isAdmin: false, poUserId: null }],
    ['u_nolicense', { id: 'u_nolicense', email: 'none@example.com', isAdmin: false, poUserId: null }],
    ['u_weird', { id: 'u_weird', email: 'weird@example.com', isAdmin: false, poUserId: null }],
  ]);
  licenses = new Map([
    ['u_pro', { userId: 'u_pro', plan: 'lifetime', tradesUsed: 40, aiTradesUsed: 3 }],
    ['u_basic', { userId: 'u_basic', plan: 'basic', tradesUsed: 7, aiTradesUsed: 0, createdAt: new Date('2026-10-01T00:00:00Z') }],
    ['u_free', { userId: 'u_free', plan: 'free', tradesUsed: 4, aiTradesUsed: 0 }],
    ['u_weird', { userId: 'u_weird', plan: 'mystery', tradesUsed: 0, aiTradesUsed: 0 }],
  ]);
  fingerprints = new Map([['fp_seen', { fingerprint: 'fp_seen', userId: null, freeTradesUsed: 6 }]]);
}

function pick(row, select) {
  if (!row || !select) return row;
  return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
}

const prisma = {
  user: {
    async findUnique({ where, select }) {
      calls.push(['user.findUnique', where]);
      if (where.id) return pick(users.get(where.id) || null, select);
      return pick([...users.values()].find((u) => u.poUserId === where.poUserId) || null, select);
    },
    async updateMany({ where, data }) {
      calls.push(['user.updateMany', where]);
      if (releaseLinkWrite) await releaseLinkWrite;
      if (linkWriteFails) { const e = new Error('unique constraint'); e.code = 'P2002'; throw e; }
      const u = users.get(where.id);
      if (!u || u.poUserId !== where.poUserId) return { count: 0 };
      u.poUserId = data.poUserId;
      return { count: 1 };
    },
  },
  license: {
    async findUnique({ where }) {
      calls.push(['license.findUnique', where]);
      if (licenseReadFails) throw new Error('db down');
      return licenses.get(where.userId) || null;
    },
  },
  deviceFingerprint: {
    async findUnique({ where }) {
      calls.push(['deviceFingerprint.findUnique', where]);
      return fingerprints.get(where.fingerprint) || null;
    },
    async create({ data }) {
      calls.push(['deviceFingerprint.create', data]);
      const row = { ...data };
      fingerprints.set(data.fingerprint, row);
      return row;
    },
    async update({ where, data }) {
      calls.push(['deviceFingerprint.update', where]);
      const row = { ...fingerprints.get(where.fingerprint), ...data };
      fingerprints.set(where.fingerprint, row);
      return row;
    },
  },
  appConfig: { async findUnique() { return { value: 'false' }; } },
  funnelEvent: { async create() {} },
};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const presencePath = require.resolve('../src/lib/presence');
require.cache[presencePath] = { id: presencePath, filename: presencePath, loaded: true, exports: { touch() {} } };

const router = require('../src/routes/license');
const layer = router.stack.find((l) => l.route?.path === '/check' && l.route.methods.post);

async function check({ userId, body = { deviceFingerprint: 'fp_seen' } } = {}) {
  const token = userId ? jwt.sign({ userId }, process.env.JWT_SECRET) : null;
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {}, body };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const [mw, handler] = layer.route.stack.map((s) => s.handle);
  await new Promise((resolve) => mw(req, res, resolve));
  await handler(req, res);
  return res;
}

const names = () => calls.map(([name]) => name);

test('missing deviceFingerprint is a 400 with no database work in the route', async () => {
  reset();
  const res = await check({ body: {} });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'deviceFingerprint is required' });
  assert.deepEqual(names(), []);
});

test('Pro user: unlimited payload, auth lookup + license read only', async () => {
  reset();
  const res = await check({ userId: 'u_pro' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    allowed: true, plan: 'lifetime', tradesRemaining: null, aiTradesAllowance: null, aiTradesUsed: 3,
  });
  assert.deepEqual(names(), ['user.findUnique', 'license.findUnique']);
});

test('Basic user: unlimited martingale payload', async () => {
  reset();
  const res = await check({ userId: 'u_basic' });
  assert.deepEqual(res.body, {
    allowed: true, plan: 'basic', tradesRemaining: null, tradesUsed: 7, tradesLimit: null,
    aiTradesAllowance: 0, aiTradesUsed: 0,
  });
});

test('signed-in free licence counts against its limit, and blocks at the limit', async () => {
  reset();
  let res = await check({ userId: 'u_free' });
  assert.deepEqual(res.body, {
    allowed: true, plan: 'free', tradesRemaining: 6, tradesUsed: 4, tradesLimit: 10,
    aiTradesAllowance: 0, aiTradesUsed: 0,
  });
  licenses.get('u_free').tradesUsed = 10;
  res = await check({ userId: 'u_free' });
  assert.equal(res.body.allowed, false);
  assert.equal(res.body.tradesRemaining, 0);
});

test('signed-in user without a licence row', async () => {
  reset();
  const res = await check({ userId: 'u_nolicense' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { allowed: false, reason: 'No license found' });
});

test('unknown plan is a 500 naming the plan', async () => {
  reset();
  const res = await check({ userId: 'u_weird' });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Invalid license plan', plan: 'mystery' });
});

test('license read failure is a 500 "License check failed"', async () => {
  reset();
  licenseReadFails = true;
  const res = await check({ userId: 'u_pro' });
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'License check failed' });
});

test('anonymous known device: one fingerprint read, demo counts from the fingerprint', async () => {
  reset();
  const res = await check();
  assert.deepEqual(res.body, { allowed: true, plan: 'free', tradesRemaining: 4, tradesUsed: 6, tradesLimit: 10 });
  assert.deepEqual(names(), ['deviceFingerprint.findUnique']);
});

test('anonymous new device is created with zero trades used', async () => {
  reset();
  const res = await check({ body: { deviceFingerprint: 'fp_new' } });
  assert.deepEqual(res.body, { allowed: true, plan: 'free', tradesRemaining: 10, tradesUsed: 0, tradesLimit: 10 });
  assert.deepEqual(fingerprints.get('fp_new'), { fingerprint: 'fp_new', userId: null, freeTradesUsed: 0 });
  assert.deepEqual(names(), ['deviceFingerprint.findUnique', 'deviceFingerprint.create']);
});

test('anonymous device at the demo limit is blocked', async () => {
  reset();
  fingerprints.get('fp_seen').freeTradesUsed = 10;
  const res = await check();
  assert.equal(res.body.allowed, false);
  assert.equal(res.body.tradesRemaining, 0);
});

test('already-linked user sending a PO UID costs no extra user lookup', async () => {
  reset();
  const res = await check({ userId: 'u_pro', body: { deviceFingerprint: 'fp_seen', poUid: '999999' } });
  assert.equal(res.body.plan, 'lifetime');
  assert.equal(users.get('u_pro').poUserId, '700001');
  assert.deepEqual(names(), ['user.findUnique', 'license.findUnique']);
});

test('unlinked user: the license read starts without waiting for the PO UID link', async () => {
  reset();
  let release;
  releaseLinkWrite = new Promise((r) => { release = r; });
  const pending = check({ userId: 'u_basic', body: { deviceFingerprint: 'fp_seen', poUid: '123456' } });
  // Let the link reach its write and the license read be issued.
  for (let i = 0; i < 10; i += 1) await new Promise((r) => setImmediate(r));
  assert.ok(names().includes('license.findUnique'), 'license read issued while link write in flight');
  release();
  const res = await pending;
  assert.equal(res.body.plan, 'basic');
  assert.equal(users.get('u_basic').poUserId, '123456', 'link completed before the response');
  assert.deepEqual(names().sort(), ['license.findUnique', 'user.findUnique', 'user.findUnique', 'user.updateMany'].sort());
});

test('a failed PO UID link never changes the licence answer', async () => {
  reset();
  linkWriteFails = true;
  const res = await check({ userId: 'u_basic', body: { deviceFingerprint: 'fp_seen', poUid: '123456' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.plan, 'basic');
  assert.equal(users.get('u_basic').poUserId, null);
});
