/**
 * A signed-in user's 30-day token aging out used to turn their account into
 * "DEMO" with an upgrade prompt (Board, 2026-10-06). The backend now flags it
 * (`sessionExpired`) and renews week-old tokens (`refreshedToken`); this checks
 * the extension applies both and never acts on hints when nobody is signed in.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
function load() {
  const store = {};
  const ctx = {
    console, setTimeout, clearTimeout, AbortController, fetch: async () => ({}),
    chrome: { storage: { local: { set(v) { Object.assign(store, v); }, get() {}, remove() {} }, onChanged: { addListener() {} } }, runtime: {} },
    window: {}, document: { addEventListener() {} }, navigator: { userAgent: 'test' },
  };
  vm.createContext(ctx);
  for (const f of ['config.js', 'state.js', 'apiClient.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'extension', f), 'utf8'), ctx, { filename: f });
  }
  return { ctx, store };
}

{
  const { ctx, store } = load();
  vm.runInContext("state.jwt = 'old-token'", ctx);
  let expired = 0;
  const ended = ctx.applySessionHints({ plan: 'free', sessionExpired: true }, { onExpired: () => { expired += 1; } });
  assert.strictEqual(ended, true);
  assert.strictEqual(expired, 1, 'an expired session must sign the user out');
  assert.deepStrictEqual(store, {}, 'nothing is stored for an expired session');
}

{
  const { ctx, store } = load();
  vm.runInContext("state.jwt = 'old-token'", ctx);
  const ended = ctx.applySessionHints({ plan: 'lifetime', refreshedToken: 'new-token' }, { onExpired: () => assert.fail('not expired') });
  assert.strictEqual(ended, false);
  assert.strictEqual(vm.runInContext('state.jwt', ctx), 'new-token', 'state carries the renewed token');
  assert.strictEqual(store.jwt, 'new-token', 'the renewed token is persisted');
}

{
  const { ctx, store } = load();
  vm.runInContext('state.jwt = null', ctx);
  const ended = ctx.applySessionHints({ sessionExpired: true, refreshedToken: 'x' }, { onExpired: () => assert.fail('nobody signed in') });
  assert.strictEqual(ended, false, 'hints are ignored when no one is signed in');
  assert.deepStrictEqual(store, {});
}

{
  const content = fs.readFileSync(path.join(root, 'extension/content.js'), 'utf8');
  assert.match(content, /applySessionHints\(data, \{ onExpired: handleSessionExpired \}\)/, 'checkLicense applies the hints');
  assert.match(content, /function handleSessionExpired\(\)/);
}

console.log('extension-session-expiry: ok');
