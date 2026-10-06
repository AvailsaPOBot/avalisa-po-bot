const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';

function makePrisma(state) {
  const prisma = {
    license: {
      async findFirst({ where }) {
        return state.licenses.find((l) => l.claimedPoUid === where.claimedPoUid && l.claimStatus === where.claimStatus) || null;
      },
      async findMany({ where }) {
        return state.licenses.filter((l) => l.claimStatus === where.claimStatus && l.claimedPoUid != null)
          .map((l) => ({ claimedPoUid: l.claimedPoUid }));
      },
      async findUnique({ where }) { return state.licenses.find((l) => l.userId === where.userId) || null; },
      async upsert() { return {}; },
      update({ where, data }) {
        const l = state.licenses.find((x) => x.userId === where.userId);
        Object.assign(l, data);
        return Promise.resolve(l);
      },
    },
    user: {
      async findUnique({ where }) {
        if (where.poUserId) return state.users.find((u) => u.poUserId === where.poUserId) || null;
        return state.users.find((u) => u.id === where.id) || null;
      },
      update({ where, data }) {
        const u = state.users.find((x) => x.id === where.id);
        Object.assign(u, data);
        return Promise.resolve(u);
      },
    },
    affiliateReferral: {
      async upsert({ create }) { state.referrals.add(create.poUid); return create; },
      async findUnique({ where }) { return state.referrals.has(where.poUid) ? { poUid: where.poUid } : null; },
    },
    async $transaction(ops) { return Promise.all(ops); },
  };
  return prisma;
}

function freshState() {
  return {
    users: [{ id: 'u1', email: 'a@example.com', poUserId: null }, { id: 'u2', email: 'b@example.com', poUserId: null }],
    licenses: [
      { userId: 'u1', plan: 'free', claimStatus: 'pending', claimedPoUid: '141478632' },
      { userId: 'u2', plan: 'free', claimStatus: null, claimedPoUid: null },
    ],
    referrals: new Set(),
    notices: [],
  };
}

function load(state) {
  const prisma = makePrisma(state);
  const paths = {
    prisma: require.resolve('../src/lib/prisma'),
    notify: require.resolve('../src/lib/claimNotify'),
    funnel: require.resolve('../src/lib/funnel'),
    lib: require.resolve('../src/lib/affiliateClaim'),
    pp: require.resolve('../src/routes/pocketpartners'),
  };
  for (const p of [paths.lib, paths.pp]) delete require.cache[p];
  require.cache[paths.prisma] = { id: paths.prisma, filename: paths.prisma, loaded: true, exports: prisma };
  require.cache[paths.notify] = { id: paths.notify, filename: paths.notify, loaded: true,
    exports: { notifyUserOfClaimOutcome: (_p, d) => state.notices.push(d), notifyBoardOfClaim() {} } };
  require.cache[paths.funnel] = { id: paths.funnel, filename: paths.funnel, loaded: true, exports: { recordFunnelEvent() {} } };
  return { prisma, lib: require('../src/lib/affiliateClaim'), pp: require('../src/routes/pocketpartners') };
}

async function postback(router, query) {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return b; } };
  await router.stack.find((l) => l.route?.path === '/').route.stack[0].handle({ query }, res);
  return res;
}

test('a postback arriving AFTER the claim approves the pending claim and links the UID', async () => {
  const state = freshState();
  const { pp } = load(state);
  process.env.POCKETPARTNERS_SECRET = 'sekret';
  const res = await postback(pp, { event: 'registration', trader_id: '141478632', token: 'sekret' });
  assert.equal(res.statusCode, 200);
  assert.equal(state.licenses[0].claimStatus, 'approved');
  assert.equal(state.licenses[0].plan, 'lifetime');
  assert.equal(state.users[0].poUserId, '141478632');
  assert.deepEqual(state.notices.map((n) => n.outcome), ['approved']);
});

test('a postback for an unknown UID only stores the referral', async () => {
  const state = freshState();
  const { pp } = load(state);
  process.env.POCKETPARTNERS_SECRET = 'sekret';
  await postback(pp, { event: 'Registration', trader_id: '999', token: 'sekret' });
  assert.ok(state.referrals.has('999'));
  assert.equal(state.licenses[0].claimStatus, 'pending');
  assert.equal(state.notices.length, 0);
});

test('the claim is left for an admin when another account already holds the UID', async () => {
  const state = freshState();
  state.users[1].poUserId = '141478632';
  const { lib } = load(state);
  assert.equal(await lib.approvePendingClaimForUid(makePrisma(state), '141478632'), null);
  assert.equal(state.licenses[0].claimStatus, 'pending');
});

test('startup sweep approves only pending claims PocketPartners has confirmed', async () => {
  const state = freshState();
  state.users.push({ id: 'u3', email: 'c@example.com', poUserId: null });
  state.licenses.push({ userId: 'u3', plan: 'free', claimStatus: 'pending', claimedPoUid: '555' });
  state.referrals.add('141478632');
  const { lib, prisma } = load(state);
  const result = await lib.sweepPendingAffiliateClaims(prisma);
  assert.deepEqual(result, { checked: 2, approved: 1 });
  assert.equal(state.licenses[0].claimStatus, 'approved');
  assert.equal(state.licenses[2].claimStatus, 'pending');
});

test('an approved claim is not approved twice', async () => {
  const state = freshState();
  const { lib, prisma } = load(state);
  assert.equal(await lib.approvePendingClaimForUid(prisma, '141478632'), 'u1');
  assert.equal(await lib.approvePendingClaimForUid(prisma, '141478632'), null);
  assert.equal(state.notices.length, 1);
});
