const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { PLAN_IDS, getPaidPlanFromWhop, getPlanEntitlements, getAiTradesAllowanceForPlan, shouldRevokeLicense } = require('../lib/plans');
const { activatePaidLicense } = require('../lib/licenseActivation');
const { decodeCustomId, normalizeCheckoutPlan, verifyPayPalWebhook } = require('../lib/paypal');
const { recordUnmappedPurchase } = require('../lib/purchaseAlert');
const { CHECKOUT_PLANS, getStripe, isStripeEnabled } = require('../lib/stripe');

const router = express.Router();

// ─── Stripe Webhook ──────────────────────────────────────────────────────────
// POST /api/webhooks/stripe
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!await isStripeEnabled()) {
    return res.status(503).json({ error: 'Stripe webhook is not available' });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(400).json({ error: 'Webhook secret is not configured' });

  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, req.headers['stripe-signature'], secret);
  } catch (_) {
    console.warn('[Stripe] Invalid webhook signature.');
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  const object = event?.data?.object;
  let project = object?.metadata?.project;
  if (event.type === 'invoice.paid' && project == null) {
    project = object?.subscription_details?.metadata?.project || object?.parent?.subscription_details?.metadata?.project;
    const subscriptionId = typeof object?.subscription === 'string' ? object.subscription : object?.subscription?.id;
    if (project == null && subscriptionId) {
      try {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        project = subscription?.metadata?.project;
      } catch (_) {
        console.error('[Stripe] Failed to verify invoice subscription metadata.');
        return res.status(500).json({ error: 'Failed to process Stripe event' });
      }
    }
  }
  if (project !== 'avalisa-po-bot') {
    return res.json({ received: true, ignored: true });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      if (object.payment_status === 'paid' || (object.mode === 'subscription' && object.status === 'complete')) {
        await handleStripeCheckoutCompleted(object);
      }
    } else if (event.type === 'invoice.paid') {
      await handleStripeInvoicePaid(object);
    } else if (
      event.type === 'customer.subscription.deleted' ||
      (event.type === 'customer.subscription.updated' && ['canceled', 'unpaid'].includes(object.status))
    ) {
      await handleStripeSubscriptionEnded(object);
    }
  } catch (_) {
    console.error(`[Stripe] Failed to process ${String(event.type || 'unknown')} event.`);
    return res.status(500).json({ error: 'Failed to process Stripe event' });
  }

  return res.json({ received: true });
});

// ─── Whop Webhook ────────────────────────────────────────────────────────────
// POST /api/webhooks/whop
router.post('/whop', express.raw({ type: 'application/json' }), async (req, res) => {
  const signatureHeader = req.headers['webhook-signature'];
  const webhookId        = req.headers['webhook-id'];
  const webhookTimestamp = req.headers['webhook-timestamp'];
  const secret = process.env.WHOP_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[Whop] WHOP_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Always require valid signature headers. (A previous non-production bypass for
  // Whop's header-less test webhooks was removed — it could grant real Pro access
  // whenever NODE_ENV was unset, which is not guaranteed on Render.)
  if (!signatureHeader || !webhookId || !webhookTimestamp) {
    console.warn('[Whop] Missing required webhook signature headers');
    return res.status(401).json({ error: 'Missing signature headers' });
  }
  if (!verifyWhopSignature({ signatureHeader, webhookId, webhookTimestamp, body: req.body, secret })) {
    console.warn('[Whop] Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const action = payload.type || payload.action;
  const data = payload.data;

  console.log(`[Whop] Event: ${action}, ID: ${data?.id}`);

  // membership.activated is the current v1 event name. Keep old underscore
  // variants for older/test payloads that Whop has emitted before.
  const activationEvents = new Set([
    'membership.activated',
    'membership.went_valid',
    'membership_activated',
    'membership_went_valid',
    'payment.succeeded',
    'payment_succeeded',
    'invoice.paid',
    'invoice_paid',
  ]);

  // A subscription that stops paying MUST stop granting access, or a $29/month
  // customer keeps Pro forever after one payment. Before 2026-08-27 nothing handled
  // this because only one-time plans existed.
  const deactivationEvents = new Set([
    'membership.went_invalid',
    'membership.deactivated',
    'membership.cancelled',
    'membership.canceled',
    'membership_went_invalid',
    'membership_deactivated',
    'membership_cancelled',
  ]);

  if (activationEvents.has(action)) {
    try {
      await handleWhopMembership(data, action);
    } catch (err) {
      console.error('[Whop] Error processing membership:', err);
      return res.status(500).json({ error: 'Failed to process membership' });
    }
  } else if (deactivationEvents.has(action)) {
    try {
      await handleWhopDeactivation(data);
    } catch (err) {
      console.error('[Whop] Error processing deactivation:', err);
      return res.status(500).json({ error: 'Failed to process deactivation' });
    }
  }

  res.json({ received: true });
});

// ─── PayPal Webhook ───────────────────────────────────────────────────────────
// POST /api/webhooks/paypal
router.post('/paypal', express.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  try {
    await verifyPayPalWebhook({ headers: req.headers, event });
  } catch (err) {
    console.warn('[PayPal] Invalid webhook signature:', err.message);
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  if (event.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return res.json({ received: true, ignored: true });
  }

  try {
    await handlePayPalCaptureCompleted(event.resource);
  } catch (err) {
    console.error('[PayPal] Error processing capture:', err);
    return res.status(500).json({ error: 'Failed to process PayPal capture' });
  }

  res.json({ received: true });
});

async function handlePayPalCaptureCompleted(resource) {
  if (resource?.status !== 'COMPLETED') {
    console.warn('[PayPal] Capture not completed:', resource?.id, resource?.status);
    return;
  }

  const custom = decodeCustomId(resource?.custom_id || resource?.supplementary_data?.related_ids?.custom_id);
  if (!custom) {
    recordUnmappedPurchase(prisma, {
      reason: 'paypal_missing_custom_id',
      paypalCaptureId: resource?.id,
      amount: resource?.amount?.value,
      currency: resource?.amount?.currency_code,
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
    });
    console.warn('[PayPal] Capture missing Avalisa custom_id:', resource?.id);
    return;
  }

  const plan = normalizeCheckoutPlan(custom.plan);
  if (!plan) {
    recordUnmappedPurchase(prisma, {
      reason: 'paypal_unsupported_plan',
      userId: custom.userId,
      planId: custom.plan,
      paypalCaptureId: resource?.id,
      amount: resource?.amount?.value,
      currency: resource?.amount?.currency_code,
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
    });
    console.warn('[PayPal] Capture has unsupported plan:', custom.plan);
    return;
  }

  await activatePaidLicense({
    userId: custom.userId,
    plan,
    paymentProvider: 'paypal',
    paymentId: resource.id,
  });

  console.log(`[PayPal] Activated ${plan} plan for user ${custom.userId}`);
}

async function findStripeUser(object, metadata = object?.metadata || {}) {
  const userId = metadata?.userId || object?.client_reference_id;
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: String(userId) }, include: { license: true } });
    if (user) return user;
  }
  const email = object?.customer_details?.email || object?.customer_email || object?.email;
  if (!email) return null;
  return prisma.user.findUnique({ where: { email }, include: { license: true } });
}

function stripeUnmappedDetails(object, reason, metadata = object?.metadata || {}) {
  const planKey = metadata?.plan || '';
  const selected = CHECKOUT_PLANS[planKey];
  return {
    reason,
    userId: metadata?.userId || object?.client_reference_id || null,
    customerEmail: object?.customer_details?.email || object?.customer_email || object?.email || null,
    priceInCents: selected?.amount || 0,
    planName: selected?.name || planKey || 'unknown',
    planId: planKey || 'unknown',
    stripeSessionId: object?.id || null,
    eventType: 'checkout.session.completed',
  };
}

async function handleStripeCheckoutCompleted(session) {
  const metadata = session?.metadata || {};
  const planKey = metadata.plan;
  const selected = CHECKOUT_PLANS[planKey];
  if (!selected) {
    recordUnmappedPurchase(prisma, stripeUnmappedDetails(session, 'stripe_unsupported_plan'));
    return;
  }

  const user = await findStripeUser(session, metadata);
  if (!user) {
    recordUnmappedPurchase(prisma, stripeUnmappedDetails(session, 'stripe_no_matching_account'));
    return;
  }

  if (selected.mode === 'payment') {
    await activatePaidLicense({
      userId: user.id,
      plan: selected.plan,
      paymentProvider: 'stripe',
      paymentId: session.id,
    });
    return;
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  if (!subscriptionId) throw new Error('Completed monthly checkout has no subscription id');
  const subscription = typeof session.subscription === 'object' && session.subscription
    ? session.subscription
    : await getStripe().subscriptions.retrieve(subscriptionId);
  await upsertStripeMonthlyLicense(user.id, subscription, false);
}

async function handleStripeInvoicePaid(invoice) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;
  if (!subscriptionId) return;

  let metadata = invoice.metadata || invoice.subscription_details?.metadata || {};
  let subscription = typeof invoice.subscription === 'object' && invoice.subscription
    ? invoice.subscription
    : null;
  if (!subscription || !metadata.userId || metadata.plan !== 'pro_monthly') {
    subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    metadata = { ...subscription.metadata, ...metadata };
  }
  if (metadata.project !== 'avalisa-po-bot' || metadata.plan !== 'pro_monthly') return;
  if (['canceled', 'unpaid'].includes(subscription.status)) return;

  const user = await findStripeUser(invoice, metadata);
  if (!user) return;
  await upsertStripeMonthlyLicense(user.id, {
    ...subscription,
    current_period_end: invoice.lines?.data?.[0]?.period?.end || subscription.current_period_end,
  }, true);
}

async function upsertStripeMonthlyLicense(userId, subscription, renewalOnly) {
  const subscriptionId = subscription?.id;
  if (!subscriptionId) throw new Error('Monthly Stripe license is missing its subscription id');
  const paymentRef = `stripe_sub_${subscriptionId}`;
  const existing = await prisma.license.findUnique({ where: { userId } });
  if (renewalOnly && existing?.lemonsqueezyOrderId !== paymentRef) return;
  if (existing?.lemonsqueezyOrderId === paymentRef && !renewalOnly) return;

  const end = Number(subscription.current_period_end);
  if (!Number.isFinite(end) || end <= 0) throw new Error('Monthly Stripe subscription has no billing period end');
  const expiresAt = new Date(end * 1000);
  const entitlements = getPlanEntitlements(PLAN_IDS.PRO);
  const aiTradesAllowance = getAiTradesAllowanceForPlan(PLAN_IDS.PRO);
  await prisma.license.upsert({
    where: { userId },
    update: {
      plan: PLAN_IDS.PRO,
      tradesUsed: 0,
      tradesLimit: entitlements.tradesLimit,
      ...(aiTradesAllowance !== null && { aiTradesAllowance }),
      lemonsqueezyOrderId: paymentRef,
      expiresAt,
    },
    create: {
      userId,
      plan: PLAN_IDS.PRO,
      tradesUsed: 0,
      tradesLimit: entitlements.tradesLimit,
      ...(aiTradesAllowance !== null && { aiTradesAllowance }),
      lemonsqueezyOrderId: paymentRef,
      expiresAt,
    },
  });
}

async function handleStripeSubscriptionEnded(subscription) {
  const subscriptionId = subscription?.id;
  if (!subscriptionId) return;
  const license = await prisma.license.findFirst({
    where: { lemonsqueezyOrderId: `stripe_sub_${subscriptionId}` },
  });
  if (license?.plan !== PLAN_IDS.PRO || !shouldRevokeLicense(license)) return;

  const demo = getPlanEntitlements(PLAN_IDS.DEMO);
  await prisma.license.update({
    where: { id: license.id },
    data: {
      plan: PLAN_IDS.DEMO,
      tradesLimit: demo.tradesLimit,
      tradesUsed: 0,
      expiresAt: new Date(),
    },
  });
}

function verifyWhopSignature({ signatureHeader, webhookId, webhookTimestamp, body, secret }) {
  const signedContent = Buffer.concat([
    Buffer.from(`${webhookId}.${webhookTimestamp}.`, 'utf8'),
    Buffer.isBuffer(body) ? body : Buffer.from(String(body)),
  ]);

  const submittedSignatures = signatureHeader
    .split(' ')
    .flatMap((part) => part.split(','))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^v\d[=,]/, ''))
    .filter((part) => !/^v\d$/.test(part));

  const secretCandidates = [Buffer.from(secret, 'utf8')];
  if (secret.startsWith('whsec_')) {
    const encoded = secret.slice('whsec_'.length);
    try {
      secretCandidates.push(Buffer.from(encoded, 'base64'));
    } catch (_) {}
  }

  const expectedSignatures = secretCandidates.flatMap((key) => {
    const digest = crypto.createHmac('sha256', key).update(signedContent).digest();
    return [
      digest.toString('base64'),
      `sha256=${digest.toString('hex')}`,
      digest.toString('hex'),
    ];
  });

  return submittedSignatures.some((submitted) =>
    expectedSignatures.some((expected) => safeCompare(submitted, expected))
  );
}

function safeCompare(left, right) {
  try {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length &&
      crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch (_) {
    return false;
  }
}

// Revoke access when a RECURRING Whop membership stops paying.
//
// SAFETY INVARIANT: a licence with expiresAt === null is permanent and is NEVER
// touched here. Every licence created before 2026-08-27 has null, so one-time
// Basic ($69) and Pro ($119) buyers — the Board's existing paying customers —
// cannot lose access through this path no matter what Whop sends. Only licences
// we explicitly marked as expiring (i.e. created from a recurring plan) are
// revocable. We downgrade to the demo plan rather than deleting, so the account
// and its history survive and a re-subscribe simply upgrades it again.
async function handleWhopDeactivation(data) {
  const membershipId = data?.id || data?.membership?.id;
  if (!membershipId) {
    console.warn('[Whop] Deactivation event with no membership id — ignoring.');
    return;
  }

  const whopOrderId = `whop_${membershipId}`;
  const license = await prisma.license.findFirst({ where: { lemonsqueezyOrderId: whopOrderId } });
  if (!license) {
    console.log(`[Whop] Deactivation for unknown membership ${membershipId} — nothing to revoke.`);
    return;
  }

  if (!shouldRevokeLicense(license)) {
    console.log(
      `[Whop] Membership ${membershipId} deactivated, but licence ${license.id} is PERMANENT ` +
      `(expiresAt null — one-time/lifetime purchase). Leaving access untouched.`
    );
    return;
  }

  const demo = getPlanEntitlements(PLAN_IDS.DEMO);
  await prisma.license.update({
    where: { id: license.id },
    data: {
      plan: PLAN_IDS.DEMO,
      tradesLimit: demo.tradesLimit,
      tradesUsed: 0,
      expiresAt: new Date(),
    },
  });
  console.log(`[Whop] Recurring membership ${membershipId} ended — licence ${license.id} downgraded to demo.`);
}

async function handleWhopMembership(data, eventType) {
  const membershipId = data?.membership?.id || data?.membership_id || data?.id || data?.payment_id;
  const customerEmail =
    data?.user?.email ||
    data?.customer?.email ||
    data?.member?.email ||
    data?.membership?.user?.email ||
    data?.metadata?.email ||
    data?.user_email ||
    data?.email;

  // Keep webhook diagnostics to non-sensitive event identifiers only.

  // These raw purchase identifiers are available even when the customer cannot
  // be identified. Keep their extraction above the early returns so every paid
  // but unactivated outcome can be surfaced for manual action.
  const priceInCents = Number(
    data?.plan?.price_cents ??
    data?.checkout?.plan?.price_cents ??
    data?.line_item?.price_cents ??
    data?.amount_cents ??
    data?.price_cents ??
    data?.amount ??
    0
  );
  const planId = String(
    data?.plan?.id ||
    data?.plan_id ||
    data?.checkout?.plan?.id ||
    data?.product?.plan_id ||
    ''
  );
  const planName = String(
    data?.plan?.name ||
    data?.checkout?.plan?.name ||
    data?.product?.name ||
    data?.membership?.plan?.name ||
    ''
  );

  if (!customerEmail) {
    console.warn(`[Whop] No email for membership ${membershipId}`);
    recordUnmappedPurchase(prisma, {
      reason: 'no_customer_email',
      membershipId,
      priceInCents,
      planName,
      planId,
      eventType,
    });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: customerEmail }, include: { license: true } });
  if (!user) {
    console.warn(`[Whop] No user found for email: ${customerEmail}`);
    recordUnmappedPurchase(prisma, {
      reason: 'no_matching_account',
      userId: null,
      customerEmail,
      membershipId,
      priceInCents,
      planName,
      planId,
      eventType,
    });
    return;
  }

  const whopOrderId = `whop_${membershipId}`;

  // Replay protection: if license already exists with this orderId, skip reset
  if (user.license && user.license.lemonsqueezyOrderId === whopOrderId) {
    console.log(`[Whop] Membership ${membershipId} already processed for user ${user.id}. Skipping reset.`);
    return;
  }

  // Match by configured Whop plan ID, current price, or plan name fallback.
  const plan = getPaidPlanFromWhop({ planId, priceInCents, planName });
  if (!plan) {
    console.warn(`[Whop] Cannot determine plan. Price: ${priceInCents}, Name: ${planName}`);
    recordUnmappedPurchase(prisma, {
      reason: 'no_plan_match',
      userId: user.id,
      customerEmail,
      priceInCents,
      planName,
      planId,
      membershipId,
      eventType,
    });
    return;
  }
  const tradesLimit = getPlanEntitlements(plan).tradesLimit;
  const aiTradesAllowance = getAiTradesAllowanceForPlan(plan);

  // Recurring vs one-time. THE INVARIANT: expiresAt === null means "permanent, never
  // revoke". Every licence created before 2026-08-27 has null, so one-time and lifetime
  // buyers are protected by construction — a cancellation event can never take their
  // access away. Only a licence we explicitly marked as expiring is revocable.
  const renewalEnd =
    data?.renewal_period_end ?? data?.plan?.renewal_period_end ?? data?.current_period_end ?? null;
  const isRecurring = Boolean(
    data?.plan?.billing_period ||
    data?.plan?.plan_type === 'renewal' ||
    data?.billing_period ||
    renewalEnd
  );
  const expiresAt = isRecurring && renewalEnd ? new Date(Number(renewalEnd) * 1000 || renewalEnd) : null;
  if (isRecurring) {
    console.log(`[Whop] Recurring membership ${membershipId} -> expiresAt ${expiresAt ? expiresAt.toISOString() : 'unknown'}`);
  }

  await prisma.license.upsert({
    where: { userId: user.id },
    update: {
      plan,
      tradesUsed: 0,
      tradesLimit,
      ...(aiTradesAllowance !== null && { aiTradesAllowance }),
      lemonsqueezyOrderId: `whop_${membershipId}`,
      expiresAt,
    },
    create: {
      userId: user.id,
      plan,
      tradesUsed: 0,
      tradesLimit,
      ...(aiTradesAllowance !== null && { aiTradesAllowance }),
      lemonsqueezyOrderId: `whop_${membershipId}`,
      expiresAt,
    },
  });

  console.log(`[Whop] Activated ${plan} plan for user ${user.id} (${customerEmail})`);
}

module.exports = router;
