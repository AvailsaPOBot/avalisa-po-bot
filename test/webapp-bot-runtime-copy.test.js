const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');

// The website serves the phone bot from dashboard/public/webapp-bot/runtime.js; the apps
// inject mobile-proof/.../ProofRuntime.js. One bot, two copies — they must not drift.
// After editing ProofRuntime.js: cp it to dashboard/public/webapp-bot/runtime.js.
const root = path.resolve(__dirname, '..');

test('website phone bot runtime is identical to the app runtime', () => {
  const app = fs.readFileSync(path.join(root, 'mobile-proof/ios/AvalisaMobileProof/ProofRuntime.js'), 'utf8');
  const site = fs.readFileSync(path.join(root, 'dashboard/public/webapp-bot/runtime.js'), 'utf8');
  assert.ok(site === app, 'dashboard/public/webapp-bot/runtime.js is out of date — copy ProofRuntime.js over it');
});
