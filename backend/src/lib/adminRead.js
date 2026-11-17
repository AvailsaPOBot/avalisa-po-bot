const crypto = require('crypto');
const { PLAN_IDS } = require('./plans');

// Read-only admin key for the CEO loop (Board 2026-11-17). The loop's check-ins kept
// hitting /login because admin JWTs expire, so claims and unpaid activations went
// unread for days. Only the SHA-256 of the key lives here; the key itself stays on
// the Mac mini. ADMIN_READ_KEY_SHA256 in the environment replaces it (rotation).
const DEFAULT_KEY_SHA256 = 'd6ed7c99e30173136d3aaf7bd6b93326e2c9b4c3e390923860feac646d3faa50';

function expectedHash() {
  const fromEnv = (process.env.ADMIN_READ_KEY_SHA256 || '').trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(fromEnv) ? fromEnv : DEFAULT_KEY_SHA256;
}

function isValidReadKey(key, hashHex = expectedHash()) {
  if (typeof key !== 'string' || key.length < 32 || key.length > 256) return false;
  const got = crypto.createHash('sha256').update(key).digest();
  const want = Buffer.from(hashHex, 'hex');
  return want.length === got.length && crypto.timingSafeEqual(got, want);
}

function requireReadKey(req, res, next) {
  if (!isValidReadKey(req.get('x-admin-read-key'))) {
    return res.status(401).json({ error: 'Invalid read key' });
  }
  next();
}

// Pro is stored as 'lifetime' (monthly Pro too; orderRef 'whop_' marks a Whop purchase,
// null marks an affiliate or admin grant).
const PAID_PLANS = [PLAN_IDS.BASIC, PLAN_IDS.PRO];

// Everything the admin page shows that a check-in needs, and nothing it can change.
async function buildAdminReadSummary(prisma, { now = new Date(), days = 30 } = {}) {
  const since = new Date(now.getTime() - days * 86400000);
  const [claims, unmapped, escalations, paid, referrals, users] = await Promise.all([
    prisma.license.findMany({
      where: { claimStatus: 'pending' },
      include: { user: { select: { email: true } } },
      orderBy: { updatedAt: 'asc' },
    }),
    prisma.funnelEvent.findMany({
      where: { type: 'unmapped_purchase', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.funnelEvent.findMany({
      where: { type: 'support_escalation', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.license.findMany({
      where: { plan: { in: PAID_PLANS }, updatedAt: { gte: since } },
      include: { user: { select: { email: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    }),
    prisma.affiliateReferral.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
  ]);

  const referralEvents = {};
  for (const r of referrals) referralEvents[r.event] = (referralEvents[r.event] || 0) + 1;

  return {
    generatedAt: now.toISOString(),
    sinceDays: days,
    pendingClaims: claims.map(l => ({
      userId: l.userId, email: l.user?.email || null, claimedPoUid: l.claimedPoUid, submittedAt: l.updatedAt,
    })),
    unmappedPurchases: unmapped.map(e => ({ at: e.createdAt, meta: e.meta })),
    supportEscalations: escalations.map(e => ({ at: e.createdAt, userId: e.userId, meta: e.meta })),
    paidLicensesChanged: paid.map(l => ({
      email: l.user?.email || null, plan: l.plan, expiresAt: l.expiresAt,
      orderRef: l.lemonsqueezyOrderId ? l.lemonsqueezyOrderId.slice(0, 5) : null, updatedAt: l.updatedAt,
    })),
    affiliateReferrals: { total: referrals.length, byEvent: referralEvents },
    newUsers: users,
  };
}

module.exports = { isValidReadKey, requireReadKey, buildAdminReadSummary, DEFAULT_KEY_SHA256 };
