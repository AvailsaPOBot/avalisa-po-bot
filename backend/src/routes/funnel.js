const express = require('express');
const prisma = require('../lib/prisma');
const { recordFunnelEvent } = require('../lib/funnel');

const router = express.Router();
const CHECKOUT_PLANS = new Set(['basic', 'pro']);

// The site sends these beacons with navigator.sendBeacon (no-cors when there is no body),
// so helmet's default Cross-Origin-Resource-Policy: same-origin makes the browser log
// ERR_BLOCKED_BY_RESPONSE.NotSameOrigin. The event is already recorded; allow the response.
router.use((req, res, next) => {
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// POST /api/funnel/checkout-click — public, asynchronous purchase-intent signal.
router.post('/checkout-click', (req, res) => {
  const plan = req.body?.plan;
  if (!CHECKOUT_PLANS.has(plan)) {
    return res.status(400).json({ error: 'Unsupported checkout plan' });
  }

  // Analytics must never affect a buyer's checkout path. recordFunnelEvent
  // already swallows async failures; this also guards against a synchronous one.
  try {
    recordFunnelEvent(prisma, 'checkout_click', { meta: { plan } });
  } catch (err) {
    // Intentionally ignored.
  }

  return res.status(204).end();
});

// POST /api/funnel/pricing-view — public, asynchronous pricing-page arrival signal.
router.post('/pricing-view', (req, res) => {
  // Do not read req.body here. This fixed event cannot become an arbitrary event writer.
  // Analytics must never affect a visitor's ability to view the pricing page.
  try {
    recordFunnelEvent(prisma, 'pricing_view');
  } catch (err) {
    // Intentionally ignored.
  }

  return res.status(204).end();
});

module.exports = router;
