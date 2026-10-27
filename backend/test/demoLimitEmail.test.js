const test = require('node:test');
const assert = require('node:assert/strict');

function stub(modPath, exports) {
  const resolved = require.resolve(modPath);
  const original = require.cache[resolved];
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
  return () => {
    if (original) require.cache[resolved] = original;
    else delete require.cache[resolved];
  };
}

function load(email) {
  const restore = stub('../src/lib/email', email);
  delete require.cache[require.resolve('../src/lib/demoLimitEmail')];
  const mod = require('../src/lib/demoLimitEmail');
  return {
    mod,
    restore() {
      delete require.cache[require.resolve('../src/lib/demoLimitEmail')];
      restore();
    },
  };
}

const flush = () => new Promise((r) => setImmediate(r));

test('reachedDemoLimit fires only on the exact Demo limit', () => {
  const { mod, restore } = load({ sendEmail: async () => {}, emailConfigured: () => true });
  try {
    assert.equal(mod.reachedDemoLimit('free', 10), true);
    assert.equal(mod.reachedDemoLimit('free', 9), false);
    assert.equal(mod.reachedDemoLimit('free', 11), false);
    assert.equal(mod.reachedDemoLimit('basic', 10), false);
    assert.equal(mod.reachedDemoLimit('lifetime', 10), false);
  } finally {
    restore();
  }
});

test('copy is honest: both Pro options, Basic one-time, risk line, no outcome claims', () => {
  const { mod, restore } = load({ sendEmail: async () => {}, emailConfigured: () => true });
  try {
    const { subject, text, html } = mod.buildDemoLimitEmail();
    assert.equal(subject, 'Your 10 free Demo trades are used up');
    assert.match(text, /Basic — \$69, one-time only/);
    assert.match(text, /\$119 one-time/);
    assert.match(text, /\$29\/month \(a real recurring subscription/);
    assert.match(text, /never trade money you can't afford to lose/);
    assert.match(html, /<a href="https:\/\/avalisabot\.vercel\.app\/pricing">/);
    assert.doesNotMatch(text, /profit|guarantee|win rate/i);
  } finally {
    restore();
  }
});

test('sendDemoLimitEmail mails the user and swallows send failures', async () => {
  const sent = [];
  const { mod, restore } = load({
    sendEmail: async (m) => { sent.push(m); throw new Error('brevo down'); },
    emailConfigured: () => true,
  });
  try {
    const prisma = { user: { findUnique: async () => ({ email: 'a@b.co' }) } };
    assert.doesNotThrow(() => mod.sendDemoLimitEmail(prisma, 'u1'));
    await flush();
    await flush();
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'a@b.co');
  } finally {
    restore();
  }
});

test('sendDemoLimitEmail is a no-op without email config or user', async () => {
  const sent = [];
  const { mod, restore } = load({ sendEmail: async (m) => sent.push(m), emailConfigured: () => false });
  try {
    mod.sendDemoLimitEmail({ user: { findUnique: async () => ({ email: 'a@b.co' }) } }, 'u1');
    await flush();
    assert.equal(sent.length, 0);
  } finally {
    restore();
  }
});
