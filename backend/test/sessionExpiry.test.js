const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'session-test-secret';
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';

const users = new Map([['u_pro', { id: 'u_pro', email: 'pro@example.com', isAdmin: false }]]);
const prisma = {
  user: { async findUnique({ where }) { return users.get(where.id) || null; } },
  license: { async findUnique({ where }) { return where.userId === 'u_pro' ? { userId: 'u_pro', plan: 'lifetime', tradesUsed: 0, aiTradesUsed: 0 } : null; } },
  deviceFingerprint: {
    async findUnique() { return { fingerprint: 'fp', userId: null, freeTradesUsed: 10 }; },
    async update({ data }) { return { fingerprint: 'fp', freeTradesUsed: 10, ...data }; },
  },
};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const presencePath = require.resolve('../src/lib/presence');
require.cache[presencePath] = { id: presencePath, filename: presencePath, loaded: true, exports: { touch() {} } };

const router = require('../src/routes/license');
const layer = router.stack.find((l) => l.route?.path === '/check' && l.route.methods.post);

async function check(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {}, body: { deviceFingerprint: 'fp' } };
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const [mw, handler] = layer.route.stack.map((s) => s.handle);
  await new Promise((resolve) => mw(req, res, resolve));
  await handler(req, res);
  return res;
}

const sign = (payload, opts) => jwt.sign(payload, process.env.JWT_SECRET, opts);

test('an expired token is reported as sessionExpired instead of silently becoming the free plan', async () => {
  const expired = sign({ userId: 'u_pro', iat: Math.floor(Date.now() / 1000) - 40 * 86400, exp: Math.floor(Date.now() / 1000) - 86400 });
  const res = await check(expired);
  assert.equal(res.body.sessionExpired, true);
  assert.equal(res.body.plan, 'free');
  assert.equal(res.body.refreshedToken, undefined);
});

test('a token signed with a different secret is reported as sessionExpired', async () => {
  const forged = jwt.sign({ userId: 'u_pro' }, 'other-secret', { expiresIn: '30d' });
  assert.equal((await check(forged)).body.sessionExpired, true);
});

test('anonymous callers without a token get no session hints', async () => {
  const res = await check(null);
  assert.equal(res.body.sessionExpired, undefined);
  assert.equal(res.body.refreshedToken, undefined);
});

test('a fresh valid token gets the Pro plan and no refresh', async () => {
  const res = await check(sign({ userId: 'u_pro' }, { expiresIn: '30d' }));
  assert.equal(res.body.plan, 'lifetime');
  assert.equal(res.body.sessionExpired, undefined);
  assert.equal(res.body.refreshedToken, undefined);
});

test('a valid token older than a week is renewed with a fresh 30-day token', async () => {
  const now = Math.floor(Date.now() / 1000);
  const res = await check(sign({ userId: 'u_pro', iat: now - 10 * 86400, exp: now + 20 * 86400 }));
  assert.equal(res.body.plan, 'lifetime');
  const renewed = jwt.verify(res.body.refreshedToken, process.env.JWT_SECRET);
  assert.equal(renewed.userId, 'u_pro');
  assert.ok(renewed.exp - renewed.iat === 30 * 86400);
});
