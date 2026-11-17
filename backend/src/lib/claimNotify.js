const { sendEmail, emailConfigured } = require('./email');
const { CLAIM_REJECTION_REASONS, PRICING_URL, getClaimRejectionMessage, getRegisterUrl, normalizeClaimRejectionReason } = require('./claimGuidance');

function truncate(value) {
  return String(value || '').slice(0, 500);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function findUserEmail(prisma, details) {
  const suppliedEmail = details.email || '';
  try {
    const user = await prisma?.user?.findUnique?.({
      where: { id: details.userId },
      select: { email: true },
    });
    return user?.email || suppliedEmail;
  } catch (_) {
    return suppliedEmail;
  }
}

function sendClaimEmail(message) {
  try {
    if (emailConfigured()) {
      Promise.resolve().then(() => sendEmail(message)).catch(() => {});
    }
  } catch (_) {
    // Claim notifications are best-effort and must never affect the request.
  }
}

// Callers must not await this in request handlers. The promise is returned only
// to make the fire-and-forget work directly testable.
function notifyBoardOfClaim(prisma, details = {}) {
  const p = (async () => {
    const userId = truncate(details.userId) || 'unknown';
    const poUid = truncate(details.poUid) || 'unknown';
    const userEmail = truncate(await findUserEmail(prisma, details)) || 'unknown';
    const timestamp = new Date().toISOString();
    const text = [
      'Avalisa Pocket Option account claim awaiting review.',
      `User email: ${userEmail}`,
      `User ID: ${userId}`,
      `Claimed PO UID: ${poUid}`,
      `Timestamp (UTC): ${timestamp}`,
    ].join('\n');

    sendClaimEmail({
      to: process.env.SUPPORT_ALERT_EMAIL || 'avalisapobot@gmail.com',
      subject: '[Avalisa] New PO account claim awaiting review',
      text,
      html: `<p><strong>Avalisa Pocket Option account claim awaiting review.</strong></p><p><strong>User email:</strong> ${escapeHtml(userEmail)}<br><strong>User ID:</strong> ${escapeHtml(userId)}<br><strong>Claimed PO UID:</strong> ${escapeHtml(poUid)}<br><strong>Timestamp (UTC):</strong> ${timestamp}</p>`,
    });
  })();
  p.catch(() => {});
  return p;
}

function notifyUserOfClaimOutcome(prisma, details = {}) {
  const p = (async () => {
    const outcome = details.outcome === 'approved' ? 'approved' : 'rejected';
    const userEmail = truncate(await findUserEmail(prisma, details));
    const poUid = truncate(details.poUid) || 'unknown';
    const reason = truncate(details.reason);
    const approved = outcome === 'approved';
    // Board 2026-11-17: a rejected claimant gets the exact steps to the free plan, with our
    // sign-up link as plain words (the word "affiliate" is never shown to users).
    const notFound = !approved && normalizeClaimRejectionReason(reason) === CLAIM_REJECTION_REASONS.NOT_FOUND;
    const registerUrl = notFound ? await getRegisterUrl(prisma) : null;
    const text = approved
      ? 'Your Pocket Option account is linked to Avalisa. You can now use your Pro access. Need help? Reply to avalisapobot@gmail.com.'
      : notFound
        ? [
          `We checked your Pocket Option ID (${poUid}). It was not created through our sign-up link, so it can't unlock free Pro. Only a new Pocket Option account made from our link qualifies.`,
          '',
          'To get Pro free:',
          `1. Register a new Pocket Option account with our link: ${registerUrl}`,
          '2. Use an email that is not already on Pocket Option.',
          '3. Copy the numeric ID from your new Pocket Option profile.',
          '4. Sign in at https://avalisabot.vercel.app/login, open Dashboard > Settings > "Link Your Pocket Option Account", and enter the new ID.',
          'Pro switches on by itself once Pocket Option confirms the new account.',
          '',
          `Prefer to keep your current account? A paid plan unlocks it straight away: ${PRICING_URL}`,
          'Questions? Email avalisapobot@gmail.com.',
          '',
          'Best,',
          'Admin — https://avalisabot.vercel.app',
        ].join('\n')
        : [
          getClaimRejectionMessage(reason),
          `PO UID checked: ${poUid}`,
          'Questions? Email avalisapobot@gmail.com.',
        ].join('\n');
    const html = `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`
      .replace(registerUrl ? escapeHtml(registerUrl) : '\u0000', registerUrl ? `<a href="${escapeHtml(registerUrl)}">register a new Pocket Option account here</a>` : '');

    if (!userEmail) return;
    sendClaimEmail({
      to: userEmail,
      subject: approved
        ? '[Avalisa] Your Pocket Option account is linked'
        : '[Avalisa] We could not verify your Pocket Option account',
      text,
      html,
    });
  })();
  p.catch(() => {});
  return p;
}

module.exports = { notifyBoardOfClaim, notifyUserOfClaimOutcome };
