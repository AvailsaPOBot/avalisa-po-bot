const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function stub(modPath, exports) {
  const resolved = require.resolve(modPath);
  const original = require.cache[resolved];
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
  return () => {
    if (original) require.cache[resolved] = original;
    else delete require.cache[resolved];
  };
}

function load(email, prisma) {
  const restores = [
    stub('../src/lib/email', email),
    stub('../src/lib/prisma', prisma),
    stub('../src/lib/funnel', { recordFunnelEvent: () => {} }),
    stub('../src/lib/pendingPurchase', { grantPendingWhopPurchase: async () => {} }),
  ];
  for (const m of ['../src/lib/welcomeEmail', '../src/routes/auth']) delete require.cache[require.resolve(m)];
  const router = require('../src/routes/auth');
  const welcome = require('../src/lib/welcomeEmail');
  return {
    router,
    welcome,
    restore() {
      for (const m of ['../src/lib/welcomeEmail', '../src/routes/auth']) delete require.cache[require.resolve(m)];
      restores.reverse().forEach((r) => r());
    },
  };
}

function mockPrisma() {
  return {
    user: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: 'u1', email: data.email, poUserId: null, createdAt: new Date() }),
    },
  };
}

async function register(router, body) {
  const route = router.stack.find((l) => l.route?.path === '/register').route;
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return b; } };
  await route.stack.at(-1).handle({ body }, res);
  await new Promise((r) => setImmediate(r));
  return res;
}

test.beforeEach(() => { process.env.JWT_SECRET = 'test-secret'; });

test('sends exactly one welcome email on a new password register', async () => {
  const sent = [];
  const t = load({ emailConfigured: () => true, sendEmail: async (m) => { sent.push(m); } }, mockPrisma());
  try {
    const res = await register(t.router, { email: 'New@Example.com', password: 'pw123456' });
    assert.equal(res.statusCode, 201);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'new@example.com');
    assert.equal(sent[0].subject, 'Welcome to Avalisa — start on demo');
  } finally { t.restore(); }
});

test('not sent when email is not configured', async () => {
  const sent = [];
  const t = load({ emailConfigured: () => false, sendEmail: async (m) => { sent.push(m); } }, mockPrisma());
  try {
    const res = await register(t.router, { email: 'a@example.com', password: 'pw123456' });
    assert.equal(res.statusCode, 201);
    assert.equal(sent.length, 0);
  } finally { t.restore(); }
});

test('not sent when the email already exists', async () => {
  const sent = [];
  const prisma = mockPrisma();
  prisma.user.findFirst = async () => ({ id: 'u0' });
  const t = load({ emailConfigured: () => true, sendEmail: async (m) => { sent.push(m); } }, prisma);
  try {
    const res = await register(t.router, { email: 'a@example.com', password: 'pw123456' });
    assert.equal(res.statusCode, 409);
    assert.equal(sent.length, 0);
  } finally { t.restore(); }
});

test('a sendEmail rejection or throw does not break registration', async () => {
  for (const sendEmail of [async () => { throw new Error('smtp down'); }, () => { throw new Error('sync'); }]) {
    const t = load({ emailConfigured: () => true, sendEmail }, mockPrisma());
    try {
      const res = await register(t.router, { email: 'a@example.com', password: 'pw123456' });
      assert.equal(res.statusCode, 201);
      assert.ok(res.body.token);
    } finally { t.restore(); }
  }
});

test('content has the store link, /webapp, no dead domain, no profit promises', () => {
  const t = load({ emailConfigured: () => true, sendEmail: async () => {} }, mockPrisma());
  try {
    const { subject, text, html } = t.welcome.buildWelcomeEmail();
    assert.equal(subject, 'Welcome to Avalisa — start on demo');
    for (const body of [text, html]) {
      assert.match(body, /chromewebstore\.google\.com\/detail\/avalisa-po-bot\/mkcpdbnlofljijfjiglkodddicpgdapa/);
      assert.match(body, /avalisabot\.vercel\.app\/webapp/);
      assert.match(body, /avalisabot\.vercel\.app\/guide/);
      assert.match(body, /avalisabot\.vercel\.app\/pricing/);
      assert.match(body, /No bot or setting guarantees profit/);
      assert.doesNotMatch(body, /AvalisaPOBot\.com/i);
      assert.doesNotMatch(body, /passive income|\bAI\b/i);
      const stripped = body.replace('No bot or setting guarantees profit', '');
      assert.doesNotMatch(stripped, /guarantee/i);
    }
  } finally { t.restore(); }
});

test('auth.js calls sendWelcomeEmail on both new-user creation paths only', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../src/routes/auth.js'), 'utf8');
  const oauth = src.split('async function createUserFromOAuth')[1].split('async function findOrCreateOAuthUser')[0];
  const reg = src.split("router.post('/register'")[1].split("router.post('/login'")[0];
  assert.match(oauth, /sendWelcomeEmail\(user\)/);
  assert.match(reg, /sendWelcomeEmail\(user\)/);
  assert.equal((src.match(/sendWelcomeEmail\(/g) || []).length, 2);
});
