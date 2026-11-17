const express = require('express');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { requireReadKey, buildAdminReadSummary } = require('../lib/adminRead');

const router = express.Router();

// Read-only: GET only, behind a key, slow enough to make guessing pointless.
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));
router.use(requireReadKey);

// GET /api/admin-read/summary?days=30
router.get('/summary', async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 90);
    return res.json(await buildAdminReadSummary(prisma, { days }));
  } catch (err) {
    console.error('[AdminRead] summary error:', err);
    return res.status(500).json({ error: 'Failed to build summary' });
  }
});

module.exports = router;
