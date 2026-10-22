const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'po-uid-autolink-test-secret';
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';

const users = new Map([
  ['paid', { id: 'paid', email: 'paid@example.com', poUserId: null, isAdmin: false }],
  ['linked', { id: 'linked', email: 'linked@example.com', poUserId: '555123', isAdmin: false }],
]);
const events = [];
const prisma = {
  user: {
    async findUnique({ where }) {
      if (where.id) return users.get(where.id) || null;
      if (where.poUserId) return [...users.values()].find((user) => user.poUserId === where.poUserId) || null;
      return null;
    },
    async updateMany({ where, data }) {
      const user = users.get(where.id);
      if (!user || user.poUserId !== where.poUserId) return { count: 0 };
      if ([...users.values()].some((other) => other.id !== user.id && other.poUserId === data.poUserId)) {
        const error = new Error('unique constraint'); error.code = 'P2002'; throw error;
      }
      user.poUserId = data.poUserId;
      return { count: 1 };
    },
  },
  license: { async findUnique({ where }) {
    return where.userId === 'paid'
      ? { userId: 'paid', plan: 'basic', tradesUsed: 2, aiTradesUsed: 1 }
      : null;
  } },
  deviceFingerprint: { async findUnique() { return { fingerprint: 'fp', freeTradesUsed: 0 }; } },
  appConfig: { async findUnique() { return { value: 'true' }; } },
  funnelEvent: { async create({ data }) { events.push(data); } },
};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const presencePath = require.resolve('../src/lib/presence');
require.cache[presencePath] = { id: presencePath, filename: presencePath, loaded: true, exports: { touch() {} } };
const router = require('../src/routes/license');
const layer = router.stack.find((entry) => entry.route?.path === '/check' && entry.route.methods.post);

async function check({ userId = null, poUid, bodyUserId } = {}) {
  const token = userId ? jwt.sign({ userId }, process.env.JWT_SECRET) : null;
  const req = {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: { deviceFingerprint: 'fp', ...(poUid === undefined ? {} : { poUid }), ...(bodyUserId ? { userId: bodyUserId } : {}) },
  };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const [middleware, handler] = layer.route.stack.map((entry) => entry.handle);
  await new Promise((resolve) => middleware(req, res, resolve));
  await handler(req, res);
  return res;
}

test('authenticated unlinked user is linked to a free numeric PO UID and gets the unchanged license payload', async () => {
  events.length = 0;
  const res = await check({ userId: 'paid', poUid: '987654' });
  assert.deepEqual(res.body, {
    allowed: true, plan: 'basic', tradesRemaining: null, tradesUsed: 2,
    tradesLimit: null, aiTradesAllowance: 10, aiTradesUsed: 1,
  });
  assert.equal(users.get('paid').poUserId, '987654');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'po_uid_autolinked');
  assert.equal(events[0].userId, 'paid');
  assert.deepEqual(events[0].meta, { userId: 'paid' });
});

test('anonymous caller cannot link a UID, even when sending a userId in the body', async () => {
  users.get('paid').poUserId = null;
  events.length = 0;
  await check({ poUid: '987654', bodyUserId: 'paid' });
  assert.equal(users.get('paid').poUserId, null);
  assert.equal(events.length, 0);
});

test('authenticated linking never overwrites an existing UID', async () => {
  users.get('paid').poUserId = '444444';
  events.length = 0;
  await check({ userId: 'paid', poUid: '987654' });
  assert.equal(users.get('paid').poUserId, '444444');
  assert.equal(events.length, 0);
  users.get('paid').poUserId = null;
});

test('authenticated linking never steals another user UID or accepts malformed UID', async () => {
  events.length = 0;
  await check({ userId: 'paid', poUid: '555123' });
  assert.equal(users.get('paid').poUserId, null);
  await check({ userId: 'paid', poUid: '12x' });
  assert.equal(users.get('paid').poUserId, null);
  assert.equal(events.length, 0);
});
