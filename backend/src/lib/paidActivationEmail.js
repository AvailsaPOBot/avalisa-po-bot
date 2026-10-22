const { sendEmail, emailConfigured } = require('./email');

const DASHBOARD_URL = 'https://avalisabot.vercel.app/dashboard';

function sendPaidActivationEmail({ to, plan } = {}) {
  try {
    if (!to || !emailConfigured()) return;
    const planName = plan === 'lifetime' ? 'Pro' : plan === 'basic' ? 'Basic' : String(plan || 'paid');
    const text = [
      `Your Avalisa ${planName} plan is active.`,
      '',
      'Sign in to the Avalisa extension panel with this email to use your plan.',
      `Link your Pocket Option ID in your dashboard: ${DASHBOARD_URL}`,
      '',
      'Avalisa Bot',
    ].join('\n');
    const html = `<p>Your Avalisa ${planName} plan is active.</p><p>Sign in to the Avalisa extension panel with this email to use your plan.</p><p><a href="${DASHBOARD_URL}">Link your Pocket Option ID in your dashboard</a></p><p>Avalisa Bot</p>`;
    Promise.resolve().then(() => sendEmail({
      to,
      subject: `Your Avalisa ${planName} plan is active`,
      text,
      html,
    })).catch(() => {});
  } catch (_) {
    // Paid access must never depend on email configuration or delivery.
  }
}

module.exports = { sendPaidActivationEmail };
