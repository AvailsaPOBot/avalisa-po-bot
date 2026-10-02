const test = require('node:test');
const assert = require('node:assert/strict');

const envBefore = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  SITE_URL: process.env.SITE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  DATABASE_URL: process.env.DATABASE_URL,
};
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
process.env.STRIPE_SECRET_KEY = 'sk_test_po_bot';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
delete process.env.SITE_URL;
delete process.env.FRONTEND_URL;

const calls = { activations: [], createdSessions: [], alerts: [], updated: [], licenseUpserts: 0 };
const state = { license: null, users: new Map([['user_1', { id: 'user_1', email: 'buyer@example.com' }]]) };
const prisma = {
  user: {
    async findUnique({ where }) {
      const user = where.id ? state.users.get(where.id) : [...state.users.values()].find((u) => u.email === where.email);
      return user ? { ...user, license: state.license } : null;
    },
  },
  license: {
    async findUnique({ where }) { return where.userId === state.license?.userId ? state.license : null; },
    async findFirst({ where }) {
      return state.license?.lemonsqueezyOrderId === where.lemonsqueezyOrderId ? state.license : null;
    },
    async upsert({ where, create, update }) {
      calls.licenseUpserts += 1;
      state.license = state.license?.userId === where.userId
        ? { ...state.license, ...update }
        : { ...create, id: 'license_1' };
      return state.license;
    },
    async update({ where, data }) {
      calls.updated.push({ where, data });
      state.license = { ...state.license, ...data };
      return state.license;
    },
  },
  funnelEvent: { async create() {} },
};

const prismaPath = require.resolve('../src/lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const activationPath = require.resolve('../src/lib/licenseActivation');
require.cache[activationPath] = {
  id: activationPath,
  filename: activationPath,
  loaded: true,
  exports: {
    async activatePaidLicense(args) {
      calls.activations.push(args);
      const ref = `${args.paymentProvider}_${args.paymentId}`;
      const existing = await prisma.license.findUnique({ where: { userId: args.userId } });
      if (existing?.lemonsqueezyOrderId === ref) return existing;
      return prisma.license.upsert({
        where: { userId: args.userId },
        create: { userId: args.userId, plan: args.plan, lemonsqueezyOrderId: ref, expiresAt: null },
        update: { plan: args.plan, lemonsqueezyOrderId: ref, expiresAt: null },
      });
    },
  },
};
require.cache[require.resolve('../src/lib/purchaseAlert')] = {
  id: require.resolve('../src/lib/purchaseAlert'),
  filename: require.resolve('../src/lib/purchaseAlert'),
  loaded: true,
  exports: { recordUnmappedPurchase(_prisma, details) { calls.alerts.push(details); } },
};

const stripeLib = require('../src/lib/stripe');
const payments = require('../src/routes/payments');
const webhooks = require('../src/routes/webhooks');

let mockEvent;
let accountId = 'acct_po_bot';
const stripeClient = {
  accounts: { async retrieve() { return { id: accountId }; } },
  checkout: { sessions: { async create(params) { calls.createdSessions.push(params); return { url: 'https://checkout.stripe.test/session' }; } } },
  subscriptions: { async retrieve(id) { return { id, metadata: { project: 'avalisa-po-bot', userId: 'user_1', plan: 'pro_monthly' }, current_period_end: 1_800_000_000 }; } },
  webhooks: { constructEvent() { if (mockEvent === 'bad-signature') throw new Error('invalid'); return mockEvent; } },
};

function setStripeEnabled() {
  process.env.STRIPE_SECRET_KEY = 'sk_test_po_bot';
  stripeLib._setStripeClientForTests(stripeClient);
  accountId = 'acct_po_bot';
}

function getHandler(router, path, index = -1) {
  const layer = router.stack.find((entry) => entry.route?.path === path);
  assert.ok(layer, `route ${path} exists`);
  return layer.route.stack.at(index).handle;
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function callWebhook(event) {
  mockEvent = event;
  const res = response();
  await getHandler(webhooks, '/stripe')( {
    body: Buffer.from('{}'),
    headers: { 'stripe-signature': 'sig_test' },
  }, res);
  return res;
}

test.beforeEach(() => {
  calls.activations.length = 0;
  calls.createdSessions.length = 0;
  calls.alerts.length = 0;
  calls.updated.length = 0;
  calls.licenseUpserts = 0;
  state.license = null;
  setStripeEnabled();
});

test.after(() => {
  for (const [key, value] of Object.entries(envBefore)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('disabled Stripe reports status false and checkout returns 503', async () => {
  delete process.env.STRIPE_SECRET_KEY;
  const status = response();
  await getHandler(payments, '/stripe/status')({}, status);
  assert.deepEqual(status.body, { enabled: false });

  const checkout = response();
  await getHandler(payments, '/stripe/checkout')( { body: { plan: 'basic' }, user: { id: 'user_1', email: 'buyer@example.com' } }, checkout);
  assert.equal(checkout.statusCode, 503);
  assert.deepEqual(checkout.body, { error: 'Stripe checkout is not available' });
});

test('Estate Stripe account guard disables Stripe', async () => {
  accountId = 'acct_1ULZYMIIeEBWWtbW';
  stripeLib._setStripeClientForTests(stripeClient);
  assert.equal(await stripeLib.isStripeEnabled(), false);
  const status = response();
  await getHandler(payments, '/stripe/status')({}, status);
  assert.deepEqual(status.body, { enabled: false });
});

test('Stripe account verification failure disables Stripe', async () => {
  stripeLib._setStripeClientForTests({
    accounts: { async retrieve() { throw new Error('network failure'); } },
  });
  assert.equal(await stripeLib.isStripeEnabled(), false);
});

test('checkout params use the expected amounts, modes, metadata, and URLs', async () => {
  const cases = [
    ['basic', 'payment', 6900, 'Avalisa PO Bot Basic', 'payment_intent_data'],
    ['pro', 'payment', 11900, 'Avalisa PO Bot Pro', 'payment_intent_data'],
    ['pro_monthly', 'subscription', 2900, 'Avalisa PO Bot Pro (monthly)', 'subscription_data'],
  ];
  for (const [plan, mode, amount, name, metadataKey] of cases) {
    const res = response();
    await getHandler(payments, '/stripe/checkout')({
      body: { plan }, user: { id: 'user_1', email: 'buyer@example.com' },
    }, res);
    assert.equal(res.statusCode, 200);
    const params = calls.createdSessions.at(-1);
    assert.equal(params.mode, mode);
    assert.equal(params.line_items[0].price_data.unit_amount, amount);
    assert.equal(params.line_items[0].price_data.product_data.name, name);
    assert.deepEqual(params.metadata, { project: 'avalisa-po-bot', userId: 'user_1', plan });
    assert.deepEqual(params[metadataKey].metadata, params.metadata);
    assert.equal(params.client_reference_id, 'user_1');
    assert.equal(params.customer_email, 'buyer@example.com');
    assert.equal(params.success_url, 'https://avalisabot.vercel.app/dashboard?checkout=success');
    assert.equal(params.cancel_url, 'https://avalisabot.vercel.app/pricing?checkout=cancelled');
    assert.equal('payment_method_types' in params, false);
  }
});

test('unknown checkout plan is rejected', async () => {
  const res = response();
  await getHandler(payments, '/stripe/checkout')({ body: { plan: 'enterprise' }, user: { id: 'user_1' } }, res);
  assert.equal(res.statusCode, 400);
});

test('bad Stripe webhook signature returns 400', async () => {
  const res = await callWebhook('bad-signature');
  assert.equal(res.statusCode, 400);
});

test('events from another project are ignored', async () => {
  const res = await callWebhook({ type: 'checkout.session.completed', data: { object: { metadata: { project: 'other' } } } });
  assert.deepEqual(res.body, { received: true, ignored: true });
  assert.equal(calls.activations.length, 0);
});

test('completed checkout activates the mapped license and duplicate delivery is idempotent', async () => {
  const session = {
    id: 'cs_basic_1', mode: 'payment', payment_status: 'paid', client_reference_id: 'user_1',
    metadata: { project: 'avalisa-po-bot', userId: 'user_1', plan: 'pro' },
  };
  assert.equal((await callWebhook({ type: 'checkout.session.completed', data: { object: session } })).statusCode, 200);
  assert.equal((await callWebhook({ type: 'checkout.session.completed', data: { object: session } })).statusCode, 200);
  assert.equal(calls.activations.length, 2);
  assert.equal(calls.licenseUpserts, 1);
  assert.equal(state.license.plan, 'lifetime');
  assert.equal(state.license.lemonsqueezyOrderId, 'stripe_cs_basic_1');
});

test('subscription deletion revokes only the matching monthly Pro license', async () => {
  state.license = {
    id: 'license_1', userId: 'user_1', plan: 'lifetime', expiresAt: new Date('2026-11-01T00:00:00Z'),
    lemonsqueezyOrderId: 'stripe_sub_sub_monthly_1',
  };
  const monthly = await callWebhook({
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_monthly_1', status: 'canceled', metadata: { project: 'avalisa-po-bot', userId: 'user_1', plan: 'pro_monthly' } } },
  });
  assert.equal(monthly.statusCode, 200);
  assert.equal(state.license.plan, 'free');
  assert.equal(calls.updated.length, 1);

  const duplicate = await callWebhook({
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_monthly_1', status: 'canceled', metadata: { project: 'avalisa-po-bot', userId: 'user_1', plan: 'pro_monthly' } } },
  });
  assert.equal(duplicate.statusCode, 200);
  assert.equal(calls.updated.length, 1);

  calls.updated.length = 0;
  state.license = { id: 'license_2', userId: 'user_1', plan: 'lifetime', expiresAt: null, lemonsqueezyOrderId: 'stripe_cs_one_time' };
  const oneTime = await callWebhook({
    type: 'customer.subscription.deleted',
    data: { object: { id: 'sub_monthly_1', metadata: { project: 'avalisa-po-bot', plan: 'pro_monthly' } } },
  });
  assert.equal(oneTime.statusCode, 200);
  assert.equal(calls.updated.length, 0);
});

test('unmapped buyer records a purchase alert', async () => {
  const session = {
    id: 'cs_unmapped', mode: 'payment', payment_status: 'paid', customer_email: 'missing@example.com',
    metadata: { project: 'avalisa-po-bot', userId: 'missing_user', plan: 'basic' },
  };
  const res = await callWebhook({ type: 'checkout.session.completed', data: { object: session } });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.alerts[0].reason, 'stripe_no_matching_account');
  assert.equal(calls.alerts[0].stripeSessionId, 'cs_unmapped');
});

test('invoice.paid renews an existing monthly license to Stripe period end', async () => {
  state.license = {
    id: 'license_1', userId: 'user_1', plan: 'lifetime', expiresAt: new Date('2026-10-01T00:00:00Z'),
    lemonsqueezyOrderId: 'stripe_sub_sub_monthly_1',
  };
  const res = await callWebhook({
    type: 'invoice.paid',
    data: { object: {
      id: 'in_renewal', subscription: 'sub_monthly_1',
      metadata: { project: 'avalisa-po-bot', userId: 'user_1', plan: 'pro_monthly' },
      lines: { data: [{ period: { end: 1_900_000_000 } }] },
    } },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(state.license.expiresAt.getTime(), 1_900_000_000 * 1000);
});

test('a failed account check is retried on the next call instead of staying disabled', async () => {
  let attempts = 0;
  stripeLib._setStripeClientForTests({
    ...stripeClient,
    accounts: { async retrieve() { attempts += 1; if (attempts === 1) throw new Error('network blip'); return { id: 'acct_po_bot' }; } },
  });
  assert.equal(await stripeLib.isStripeEnabled(), false);
  assert.equal(await stripeLib.isStripeEnabled(), true);
  assert.equal(attempts, 2);
});

test('checkout refuses plans that would overwrite access the customer already owns', async () => {
  const future = new Date(Date.now() + 86_400_000);
  const cases = [
    [{ plan: 'basic', expiresAt: null }, 'basic', 409],
    [{ plan: 'basic', expiresAt: null }, 'pro_monthly', 409],
    [{ plan: 'basic', expiresAt: null }, 'pro', 200],
    [{ plan: 'lifetime', expiresAt: null }, 'pro', 409],
    [{ plan: 'lifetime', expiresAt: null }, 'pro_monthly', 409],
    [{ plan: 'lifetime', expiresAt: future }, 'pro_monthly', 409],
    [{ plan: 'lifetime', expiresAt: future }, 'pro', 200],
    [{ plan: 'lifetime', expiresAt: new Date(Date.now() - 1000) }, 'pro_monthly', 200],
    [{ plan: 'free', expiresAt: null }, 'pro_monthly', 200],
  ];
  for (const [license, plan, expected] of cases) {
    state.license = { userId: 'user_1', id: 'license_1', ...license };
    const res = response();
    await getHandler(payments, '/stripe/checkout')({ body: { plan }, user: { id: 'user_1', email: 'buyer@example.com' } }, res);
    assert.equal(res.statusCode, expected, `${license.plan}/${license.expiresAt ? 'expiring' : 'permanent'} buying ${plan}`);
  }
});
