const Stripe = require('stripe');
const { PLAN_IDS, getPlanEntitlements } = require('./plans');

const ESTATE_STRIPE_ACCOUNT_ID = 'acct_1ULZYMIIeEBWWtbW';
const SITE_URL = () => (process.env.SITE_URL || process.env.FRONTEND_URL || 'https://avalisabot.vercel.app').replace(/\/$/, '');

const CHECKOUT_PLANS = {
  basic: {
    plan: PLAN_IDS.BASIC,
    amount: getPlanEntitlements(PLAN_IDS.BASIC).priceCents,
    name: 'Avalisa PO Bot Basic',
    mode: 'payment',
  },
  pro: {
    plan: PLAN_IDS.PRO,
    amount: getPlanEntitlements(PLAN_IDS.PRO).priceCents,
    name: 'Avalisa PO Bot Pro',
    mode: 'payment',
  },
  pro_monthly: {
    plan: PLAN_IDS.PRO,
    amount: 2900,
    name: 'Avalisa PO Bot Pro (monthly)',
    mode: 'subscription',
  },
};

let client;
let clientSecretKey;
let checkedClient;
let accountCheck;
let enabled = false;
let guardTripped = false;

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!client || clientSecretKey !== secretKey) {
    client = new Stripe(secretKey);
    clientSecretKey = secretKey;
    checkedClient = null;
    accountCheck = null;
    enabled = false;
    guardTripped = false;
  }
  return client;
}

async function isStripeEnabled() {
  const stripe = getStripe();
  if (!stripe) return false;
  if (checkedClient === stripe) return enabled;
  if (!accountCheck) {
    accountCheck = (async () => {
      try {
        const account = await stripe.accounts.retrieve();
        if (account?.id === ESTATE_STRIPE_ACCOUNT_ID) {
          guardTripped = true;
          enabled = false;
          checkedClient = stripe;
          console.error('[Stripe] Disabled: configured key belongs to the Avalisa Estate account. Use the PO Bot Stripe account.');
          return;
        }
        enabled = true;
        checkedClient = stripe;
      } catch (err) {
        // A transient failure must not disable Stripe until the next restart:
        // leave checkedClient unset so the next call verifies again.
        enabled = false;
        console.error('[Stripe] Disabled for now: could not verify the configured Stripe account. Will retry.');
      }
    })();
  }
  const pending = accountCheck;
  await pending;
  if (checkedClient !== stripe && accountCheck === pending) accountCheck = null;
  return checkedClient === stripe && enabled && !guardTripped;
}

// A checkout that would overwrite access the customer already owns forever is refused.
// Monthly Pro writes an expiring licence, and its cancellation downgrades to Demo, so a
// permanent Basic owner who subscribed and later cancelled would lose the Basic they paid for.
function getCheckoutConflict(license, planKey) {
  if (!license || license.plan === PLAN_IDS.DEMO) return null;
  const permanent = license.expiresAt === null || license.expiresAt === undefined;
  const active = permanent || new Date(license.expiresAt) > new Date();
  if (!active) return null;
  if (license.plan === PLAN_IDS.PRO) {
    if (permanent) return 'You already have Pro for life.';
    if (planKey !== 'pro') return 'You already have an active Pro subscription.';
    return null;
  }
  if (license.plan === PLAN_IDS.BASIC && permanent) {
    if (planKey === 'basic') return 'You already own Basic.';
    if (planKey === 'pro_monthly') return 'You own Basic. Choose Pro one-time to upgrade and keep it for life.';
  }
  return null;
}

function createCheckoutParams({ user, planKey }) {
  const selected = CHECKOUT_PLANS[planKey];
  if (!selected) return null;
  const metadata = { project: 'avalisa-po-bot', userId: String(user.id), plan: planKey };
  const params = {
    mode: selected.mode,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: selected.amount,
        product_data: { name: selected.name },
        ...(selected.mode === 'subscription' ? { recurring: { interval: 'month' } } : {}),
      },
    }],
    client_reference_id: String(user.id),
    customer_email: user.email,
    metadata,
    success_url: `${SITE_URL()}/dashboard?checkout=success`,
    cancel_url: `${SITE_URL()}/pricing?checkout=cancelled`,
  };
  if (selected.mode === 'subscription') params.subscription_data = { metadata };
  else params.payment_intent_data = { metadata };
  return params;
}

// Test seam: avoids replacing Stripe's module singleton and never changes runtime behavior.
function _setStripeClientForTests(mockClient) {
  client = mockClient || null;
  clientSecretKey = client ? (process.env.STRIPE_SECRET_KEY || 'test-key') : null;
  checkedClient = null;
  accountCheck = null;
  enabled = false;
  guardTripped = false;
}

module.exports = { CHECKOUT_PLANS, createCheckoutParams, getCheckoutConflict, getStripe, isStripeEnabled, _setStripeClientForTests };
