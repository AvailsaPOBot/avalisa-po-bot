/**
 * A buyer who pays on Whop BEFORE registering must get the plan at registration,
 * not Demo. A monthly buyer must never be granted permanent access this way.
 */
const test = require('node:test');
const assert = require('node:assert');
const { grantPendingWhopPurchase, whopRecurrence } = require('../src/lib/pendingPurchase');
const { getPaidPlanFromWhop } = require('../src/lib/plans');

const NOW = new Date('2026-10-17T00:00:00Z');

// Use the first price the real plan matcher accepts, so the test follows plans.js.
const PRICE = [2900, 4900, 9900, 1900, 3900, 5900, 14900, 19900].find((c) => getPaidPlanFromWhop({ priceInCents: c }));

function mockPrisma(rows, { usedOrderIds = [] } = {}) {
  const calls = { updates: [], events: [] };
  return {
    calls,
    funnelEvent: {
      findMany: async () => rows,
      create: async ({ data }) => calls.events.push(data),
    },
    license: {
      findFirst: async ({ where }) => (usedOrderIds.includes(where.lemonsqueezyOrderId) ? { id: 'x' } : null),
      update: async (args) => calls.updates.push(args),
    },
  };
}

function row(meta) {
  return {
    type: 'unmapped_purchase',
    createdAt: NOW,
    meta: {
      reason: 'no_matching_account',
      customerEmail: 'Buyer@Example.com ',
      membershipId: 'mem_1',
      priceInCents: PRICE,
      planName: '',
      planId: '',
      isRecurring: false,
      renewalEnd: null,
      ...meta,
    },
  };
}

const user = { id: 'u1', email: 'buyer@example.com' };

test('one-time purchase stored before signup is granted permanently, case-insensitively', async () => {
  assert.ok(PRICE, 'a known Whop price must map to a plan');
  const prisma = mockPrisma([row({})]);
  const plan = await grantPendingWhopPurchase(prisma, user, NOW);
  assert.ok(plan);
  assert.equal(prisma.calls.updates.length, 1);
  const { where, data } = prisma.calls.updates[0];
  assert.deepEqual(where, { userId: 'u1' });
  assert.equal(data.plan, plan);
  assert.equal(data.expiresAt, null);
  assert.equal(data.lemonsqueezyOrderId, 'whop_mem_1');
  assert.equal(prisma.calls.events[0].type, 'unmapped_purchase_granted');
});

test('recurring purchase is granted only until its renewal end', async () => {
  const end = Math.floor(new Date('2026-11-10T00:00:00Z').getTime() / 1000);
  const prisma = mockPrisma([row({ isRecurring: true, renewalEnd: end })]);
  assert.ok(await grantPendingWhopPurchase(prisma, user, NOW));
  assert.equal(prisma.calls.updates[0].data.expiresAt.toISOString(), '2026-11-10T00:00:00.000Z');
});

test('recurring purchase with no or past renewal end is NOT granted (never permanent)', async () => {
  const past = Math.floor(new Date('2026-10-01T00:00:00Z').getTime() / 1000);
  for (const renewalEnd of [null, past]) {
    const prisma = mockPrisma([row({ isRecurring: true, renewalEnd })]);
    assert.equal(await grantPendingWhopPurchase(prisma, user, NOW), null);
    assert.equal(prisma.calls.updates.length, 0);
  }
});

test('legacy rows without recurrence info, other emails, other reasons and used orders are skipped', async () => {
  const legacy = row({});
  delete legacy.meta.isRecurring;
  const cases = [
    mockPrisma([legacy]),
    mockPrisma([row({ customerEmail: 'someone@else.com' })]),
    mockPrisma([row({ reason: 'no_plan_match' })]),
    mockPrisma([row({})], { usedOrderIds: ['whop_mem_1'] }),
  ];
  for (const prisma of cases) {
    assert.equal(await grantPendingWhopPurchase(prisma, user, NOW), null);
    assert.equal(prisma.calls.updates.length, 0);
  }
});

test('a database error never breaks registration', async () => {
  const prisma = { funnelEvent: { findMany: async () => { throw new Error('db down'); } } };
  assert.equal(await grantPendingWhopPurchase(prisma, user, NOW), null);
});

test('whopRecurrence keeps the webhook expiry rule', () => {
  assert.deepEqual(whopRecurrence({}), { isRecurring: false, renewalEnd: null, expiresAt: null });
  const r = whopRecurrence({ plan: { billing_period: 30 }, renewal_period_end: 1790000000 });
  assert.equal(r.isRecurring, true);
  assert.equal(r.expiresAt.getTime(), 1790000000 * 1000);
});
