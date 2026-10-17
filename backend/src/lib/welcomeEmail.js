const { sendEmail, emailConfigured } = require('./email');

const SUBJECT = 'Welcome to Avalisa — start on demo';
const STORE_URL = 'https://chromewebstore.google.com/detail/avalisa-po-bot/mkcpdbnlofljijfjiglkodddicpgdapa';
const WEBAPP_URL = 'https://avalisabot.vercel.app/webapp';
const GUIDE_URL = 'https://avalisabot.vercel.app/guide';
const PRICING_URL = 'https://avalisabot.vercel.app/pricing';
const SUPPORT_EMAIL = 'avalisapobot@gmail.com';

const LINES = [
  'New accounts start on the free Demo plan: 10 trades to try the bot. If you already bought Basic or Pro and your dashboard does not show it, reply to this email.',
  `Install the Chrome extension: ${STORE_URL} — then sign in to the extension with this same email.`,
  `On a phone (iPhone or Android): open ${WEBAPP_URL} for the steps.`,
  `Setup guide: ${GUIDE_URL}`,
  'Start on your Pocket Option DEMO balance first and watch what it does. Press Stop any time.',
  `Plans: Basic $69 one-time, Pro $119 one-time or $29/month — ${PRICING_URL}`,
  'No bot or setting guarantees profit — only trade money you can afford to lose.',
  `Questions: reply to ${SUPPORT_EMAIL}.`,
];

function buildWelcomeEmail() {
  const text = `Welcome to Avalisa!\n\n${LINES.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\nAvalisa Bot`;
  const html = `<p>Welcome to Avalisa!</p><ol>${LINES.map((l) => `<li>${l.replace(/https:\/\/\S+/g, (u) => `<a href="${u}">${u}</a>`)}</li>`).join('')}</ol><p>Avalisa Bot</p>`;
  return { subject: SUBJECT, text, html };
}

// Fire-and-forget: never throws, never blocks or fails the signup that called it.
function sendWelcomeEmail(user) {
  try {
    const to = user && user.email;
    if (to && emailConfigured()) {
      Promise.resolve().then(() => sendEmail({ to, ...buildWelcomeEmail() })).catch(() => {});
    }
  } catch (_) {
    // Welcome mail is best-effort.
  }
}

module.exports = { sendWelcomeEmail, buildWelcomeEmail };
