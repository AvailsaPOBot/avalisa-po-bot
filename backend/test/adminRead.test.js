const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { isValidReadKey, buildAdminReadSummary, DEFAULT_KEY_SHA256 } = require('../src/lib/adminRead');

const KEY = 'a'.repeat(64);
const HASH = crypto.createHash('sha256').update(KEY).digest('hex');

test('read key: exact key accepted, anything else rejected', () => {
  assert.equal(isValidReadKey(KEY, HASH), true);
  assert.equal(isValidReadKey(KEY.slice(1) + 'b', HASH), false);
  assert.equal(isValidReadKey(undefined, HASH), false);
  assert.equal(isValidReadKey('short', HASH), false);
  assert.equal(isValidReadKey(KEY.toUpperCase(), HASH), false);
});

test('read key: committed default is a sha256 hash, never a key', () => {
  assert.match(DEFAULT_KEY_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(isValidReadKey(DEFAULT_KEY_SHA256), false);
});

test('read key: env override replaces the default hash', () => {
  process.env.ADMIN_READ_KEY_SHA256 = HASH;
  try {
    assert.equal(isValidReadKey(KEY), true);
  } finally {
    delete process.env.ADMIN_READ_KEY_SHA256;
  }
  assert.equal(isValidReadKey(KEY), false);
});

function mockPrisma() {
  const calls = [];
  const day = d => new Date(`2026-11-${d}T00:00:00Z`);
  return {
    calls,
    license: {
      findMany: async args => {
        calls.push(args);
        if (args.where.claimStatus) {
          return [{ userId: 'u1', user: { email: 'claim@x.com' }, claimedPoUid: '123', updatedAt: day(10) }];
        }
        return [{ user: { email: 'buyer@x.com' }, plan: 'lifetime', expiresAt: null, lemonsqueezyOrderId: 'whop_mem_abc', updatedAt: day(17) }];
      },
    },
    funnelEvent: {
      findMany: async args => (args.where.type === 'unmapped_purchase'
        ? [{ createdAt: day(16), meta: { email: 'orphan@x.com' } }]
        : []),
    },
    affiliateReferral: {
      findMany: async () => [{ event: 'registration' }, { event: 'registration' }, { event: 'ftd' }],
    },
    user: { count: async () => 7 },
  };
}

test('summary: claims, orphaned purchases, paid licences and postbacks in one read', async () => {
  const prisma = mockPrisma();
  const s = await buildAdminReadSummary(prisma, { now: new Date('2026-11-17T12:00:00Z'), days: 30 });
  assert.equal(s.pendingClaims[0].email, 'claim@x.com');
  assert.equal(s.unmappedPurchases.length, 1);
  assert.equal(s.paidLicensesChanged[0].plan, 'lifetime');
  assert.equal(s.paidLicensesChanged[0].orderRef, 'whop_', 'order ids are trimmed to their source prefix');
  assert.deepEqual(s.affiliateReferrals, { total: 3, byEvent: { registration: 2, ftd: 1 } });
  assert.equal(s.newUsers, 7);
});

test('summary: never asks the database to write', async () => {
  const prisma = mockPrisma();
  await buildAdminReadSummary(prisma, {});
  for (const model of Object.values(prisma)) {
    if (model && typeof model === 'object' && !Array.isArray(model)) {
      for (const fn of ['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany']) {
        assert.equal(model[fn], undefined);
      }
    }
  }
});
