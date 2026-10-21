// Grant a Whop purchase that arrived before its buyer had an account.
//
// Whop sends the webhook at checkout. A buyer who pays first and registers
// afterwards had no account to match, so the webhook stored an
// `unmapped_purchase` row (reason no_matching_account) and the buyer landed on
// Demo after registering. This applies that stored purchase at registration.
//
// THE INVARIANT (see webhooks.js): expiresAt === null means permanent. A
// recurring purchase is only granted with a known, future renewal end — never
// as permanent — and rows stored before the recurrence fields existed are left
// for a manual grant.

const { getPaidPlanFromWhop, getPlanEntitlements, getAiTradesAllowanceForPlan, WHOP_RECURRING_PLAN_IDS } = require('./plans');

const LOOKBACK_DAYS = 90;

// A recurring purchase whose payload names no renewal end still gets a non-null expiresAt:
// expiresAt only marks the licence as revocable by a later cancel event (licence checks do
// not read it), and null would make a $29/month buyer permanent.
const RECURRING_FALLBACK_DAYS = 31;

function whopRecurrence(data, now = new Date()) {
  const renewalEnd =
    data?.renewal_period_end ?? data?.plan?.renewal_period_end ?? data?.current_period_end ?? null;
  const planId = String(data?.plan?.id || data?.plan_id || data?.checkout?.plan?.id || data?.product?.plan_id || '');
  const isRecurring = Boolean(
    data?.plan?.billing_period ||
    data?.plan?.plan_type === 'renewal' ||
    data?.billing_period ||
    renewalEnd ||
    WHOP_RECURRING_PLAN_IDS.has(planId)
  );
  let expiresAt = null;
  if (isRecurring && renewalEnd) expiresAt = new Date(Number(renewalEnd) * 1000 || renewalEnd);
  else if (isRecurring) expiresAt = new Date(now.getTime() + RECURRING_FALLBACK_DAYS * 24 * 60 * 60 * 1000);
  return { isRecurring, renewalEnd, expiresAt };
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

// Returns the granted plan id, or null. Never throws: registration must not fail.
async function grantPendingWhopPurchase(prisma, user, now = new Date()) {
  try {
    const email = normalizeEmail(user?.email);
    if (!user?.id || !email) return null;

    const rows = await prisma.funnelEvent.findMany({
      where: {
        type: 'unmapped_purchase',
        createdAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const row = rows.find((r) =>
      r?.meta?.reason === 'no_matching_account' &&
      typeof r.meta.isRecurring === 'boolean' &&
      r.meta.membershipId &&
      normalizeEmail(r.meta.customerEmail) === email
    );
    if (!row) return null;
    const meta = row.meta;

    const plan = getPaidPlanFromWhop({
      planId: meta.planId,
      priceInCents: meta.priceInCents,
      planName: meta.planName,
    });
    if (!plan) return null;

    const { expiresAt } = whopRecurrence({ renewal_period_end: meta.renewalEnd });
    if (meta.isRecurring && (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= now)) {
      return null;
    }

    const orderId = `whop_${meta.membershipId}`;
    const alreadyUsed = await prisma.license.findFirst({ where: { lemonsqueezyOrderId: orderId } });
    if (alreadyUsed) return null;

    const aiTradesAllowance = getAiTradesAllowanceForPlan(plan);
    await prisma.license.update({
      where: { userId: user.id },
      data: {
        plan,
        tradesUsed: 0,
        tradesLimit: getPlanEntitlements(plan).tradesLimit,
        ...(aiTradesAllowance !== null && { aiTradesAllowance }),
        lemonsqueezyOrderId: orderId,
        expiresAt: meta.isRecurring ? expiresAt : null,
      },
    });
    try {
      await prisma.funnelEvent.create({
        data: { type: 'unmapped_purchase_granted', userId: user.id, meta: { membershipId: meta.membershipId, plan } },
      });
    } catch (err) {
      // Analytics only.
    }
    console.log(`[Whop] Granted stored purchase ${meta.membershipId} (${plan}) to new user ${user.id}`);
    return plan;
  } catch (err) {
    console.error('[Whop] Pending purchase grant failed:', err.message);
    return null;
  }
}

module.exports = { grantPendingWhopPurchase, whopRecurrence };
