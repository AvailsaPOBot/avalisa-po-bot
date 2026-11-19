const express = require('express');
const prisma = require('../lib/prisma');
const { recordFunnelEvent } = require('../lib/funnel');
const { AFFILIATE_LINK, withSubId } = require('../lib/affiliateLink');

const router = express.Router();

// In-memory cache — 1 hour TTL
let cache = { url: null, expiry: 0 };

// GET /api/config/affiliate-link — no auth, public. Only the extension calls this, so the link it
// serves carries sub_id1=ext (tag added on the way out, so a DB override is tagged too).
const EXT_CHANNEL = 'ext';

router.get('/affiliate-link', async (req, res) => {
  const now = Date.now();
  recordFunnelEvent(prisma, 'affiliate_link_served');
  if (cache.url && now < cache.expiry) {
    return res.json({ url: withSubId(cache.url, EXT_CHANNEL) });
  }

  try {
    const row = await prisma.appConfig.findUnique({ where: { key: 'affiliate_link' } });
    if (row?.value) {
      cache = { url: row.value, expiry: now + 3600000 };
      return res.json({ url: withSubId(row.value, EXT_CHANNEL) });
    }
  } catch (err) {
    console.error('[config] affiliate-link DB error:', err.message);
  }

  return res.json({ url: withSubId(AFFILIATE_LINK, EXT_CHANNEL) });
});

// GET /api/config/winrates — no auth, public
// Returns flat { S30: 48, M1: 52, ... } resolving manual vs real values
router.get('/winrates', async (req, res) => {
  try {
    const row = await prisma.appConfig.findUnique({ where: { key: 'timeframe_winrates' } });
    if (!row?.value) return res.json({});
    const config = JSON.parse(row.value);
    // For each timeframe resolve the effective win rate
    const result = {};
    for (const [tf, entry] of Object.entries(config)) {
      if (entry.mode === 'manual') {
        result[tf] = entry.manual;
      } else if (entry.mode === 'real' && entry.real !== null) {
        result[tf] = entry.real;
      }
      // if real mode but no real data yet, omit
    }
    return res.json(result);
  } catch (err) {
    console.error('[config] winrates error:', err.message);
    return res.json({});
  }
});

module.exports = router;
