const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { activatePaidLicense } = require('../lib/licenseActivation');
const {
  capturePayPalOrder,
  captureCoversPlan,
  createPayPalOrder,
  decodeCustomId,
  getCaptureFromOrder,
  normalizeCheckoutPlan,
  paypalConfigured,
} = require('../lib/paypal');

const router = express.Router();

router.get('/paypal/status', (req, res) => {
  res.json({ enabled: paypalConfigured() });
});

router.post('/paypal/orders', authMiddleware, async (req, res) => {
  const plan = normalizeCheckoutPlan(req.body.plan);
  if (!plan) return res.status(400).json({ error: 'Unsupported PayPal plan' });

  if (!paypalConfigured()) {
    return res.status(503).json({ error: 'PayPal checkout is not configured yet' });
  }

  try {
    const order = await createPayPalOrder({
      userId: req.userId,
      email: req.user.email,
      plan,
    });
    res.json(order);
  } catch (err) {
    console.error('[PayPal] Create order failed:', err);
    res.status(500).json({ error: 'Failed to start PayPal checkout' });
  }
});

router.post('/paypal/orders/:orderId/capture', authMiddleware, async (req, res) => {
  if (!paypalConfigured()) {
    return res.status(503).json({ error: 'PayPal checkout is not configured yet' });
  }

  try {
    const order = await capturePayPalOrder(req.params.orderId);
    const custom = decodeCustomId(order.purchase_units?.[0]?.custom_id);
    if (!custom || custom.userId !== req.userId) {
      return res.status(403).json({ error: 'This PayPal order does not belong to your account' });
    }

    const capture = getCaptureFromOrder(order);
    if (!capture) {
      return res.status(400).json({ error: 'PayPal payment was not completed' });
    }

    const plan = normalizeCheckoutPlan(custom.plan);
    if (!plan || !captureCoversPlan(capture, plan)) {
      console.warn('[PayPal] Capture amount does not cover plan:', capture.id, custom.plan, capture.amount);
      return res.status(400).json({ error: 'PayPal payment amount does not match the plan' });
    }

    const license = await activatePaidLicense({
      userId: req.userId,
      plan,
      paymentProvider: 'paypal',
      paymentId: capture.id,
    });

    res.json({ success: true, plan: license.plan, license });
  } catch (err) {
    console.error('[PayPal] Capture failed:', err);
    res.status(500).json({ error: 'Failed to confirm PayPal payment' });
  }
});

module.exports = router;
