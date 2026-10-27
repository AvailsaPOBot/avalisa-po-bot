const { sendEmail, emailConfigured } = require('./email');
const { PLAN_IDS, getPlanEntitlements } = require('./plans');

const DEMO_LIMIT = getPlanEntitlements(PLAN_IDS.DEMO).tradesLimit;
const SUBJECT = `Your ${DEMO_LIMIT} free Demo trades are used up`;
const PRICING_URL = 'https://avalisabot.vercel.app/pricing';
const SUPPORT_EMAIL = 'avalisapobot@gmail.com';

const LINES = [
  `Your ${DEMO_LIMIT} free Demo trades are used up. To continue:`,
  'Basic — $69, one-time only (never renews, never billed again): unlimited Martingale trades, cloud settings sync, and trade history.',
  'Pro — choose one at checkout: $119 one-time (never renews), or $29/month (a real recurring subscription that auto-renews every month until cancelled). Both unlock unlimited trades, Martingale mode, and Avalisa Bot mode.',
  `Plans: ${PRICING_URL}`,
  `Support: ${SUPPORT_EMAIL}`,
  "Trading involves risk; never trade money you can't afford to lose.",
];

function buildDemoLimitEmail() {
  const text = `${LINES.join('\n\n')}\n\nAvalisa Bot`;
  const html = `${LINES.map((l) => `<p>${l.replace(/https:\/\/\S+/g, (u) => `<a href="${u}">${u}</a>`)}</p>`).join('')}<p>Avalisa Bot</p>`;
  return { subject: SUBJECT, text, html };
}

// True only on the increment that lands exactly on the Demo limit, so each
// Demo licence gets this mail once (later increments overshoot the limit).
function reachedDemoLimit(plan, tradesUsed) {
  return plan === PLAN_IDS.DEMO && tradesUsed === DEMO_LIMIT;
}

// Fire-and-forget: never throws, never blocks or fails the increment that called it.
function sendDemoLimitEmail(prisma, userId) {
  try {
    if (!userId || !emailConfigured()) return;
    Promise.resolve()
      .then(() => prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))
      .then((user) => (user && user.email ? sendEmail({ to: user.email, ...buildDemoLimitEmail() }) : null))
      .catch(() => {});
  } catch (_) {
    // Limit mail is best-effort.
  }
}

module.exports = { buildDemoLimitEmail, reachedDemoLimit, sendDemoLimitEmail };
