const test = require('node:test');
const assert = require('node:assert/strict');

test('paid-activation email tells OAuth sign-ups to create a password first', async () => {
  const sent = [];
  const emailPath = require.resolve('../src/lib/email');
  const original = require.cache[emailPath];
  require.cache[emailPath] = { id: emailPath, filename: emailPath, loaded: true,
    exports: { sendEmail: async (m) => { sent.push(m); }, emailConfigured: () => true } };
  delete require.cache[require.resolve('../src/lib/paidActivationEmail')];
  try {
    const { sendPaidActivationEmail } = require('../src/lib/paidActivationEmail');
    sendPaidActivationEmail({ to: 'buyer@example.com', plan: 'lifetime' });
    await new Promise((r) => setImmediate(r));
    assert.equal(sent.length, 1);
    for (const body of [sent[0].text, sent[0].html]) {
      assert.match(body, /Google or Facebook/);
      assert.match(body, /https:\/\/avalisabot\.vercel\.app\/forgot-password/);
    }
  } finally {
    delete require.cache[require.resolve('../src/lib/paidActivationEmail')];
    if (original) require.cache[emailPath] = original; else delete require.cache[emailPath];
  }
});
