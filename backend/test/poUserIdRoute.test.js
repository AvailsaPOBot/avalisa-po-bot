const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'po-user-id-route-test-secret';
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';

const users = new Map([
  ['a', { id: 'a', email: 'a@example.com', poUserId: null, isAdmin: false }],
  ['b', { id: 'b', email: 'b@example.com', poUserId: '555123', isAdmin: false }],
]);
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
};
const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const router = require('../src/routes/auth');
const layer = router.stack.find((entry) => entry.route?.path === '/po-user-id' && entry.route.methods.put);

test.beforeEach(() => {
  users.get('a').poUserId = null;
  users.get('b').poUserId = '555123';
});

async function put(userId, poUserId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${token}` }, body: { poUserId } };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const [middleware, handler] = layer.route.stack.map((entry) => entry.handle);
  await new Promise((resolve) => middleware(req, res, resolve));
  if (res.statusCode === 200) await handler(req, res);
  return res;
}

test('manual UID linking accepts a free numeric UID', async () => {
  const res = await put('a', '987654');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.poUserId, '987654');
});

test('manual UID linking rejects a UID owned by another user with 409', async () => {
  const res = await put('a', '555123');
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /already linked/);
});

test('manual UID linking refuses changing an existing UID with the support message', async () => {
  const res = await put('b', '777888');
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Email support to change it');
  assert.equal(users.get('b').poUserId, '555123');
});

test('manual UID linking validates the numeric UID format', async () => {
  const res = await put('a', '12x');
  assert.equal(res.statusCode, 400);
  assert.equal(users.get('a').poUserId, null);
});
