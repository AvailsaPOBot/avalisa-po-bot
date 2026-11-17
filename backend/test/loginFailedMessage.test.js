const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The extension panel shows the backend login error text as-is, so the 401
// message must point Google/Facebook sign-ups (no own password) to Forgot password.
test('login 401 message points OAuth sign-ups to Forgot password', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/routes/auth.js'), 'utf8');
  assert.ok(!src.includes("error: 'Invalid credentials'"), 'old dead-end message removed');
  const m = src.match(/const LOGIN_FAILED_MSG = '([^']+)'/);
  assert.ok(m, 'LOGIN_FAILED_MSG defined');
  assert.match(m[1], /Forgot password/);
  assert.match(m[1], /Google or Facebook/);
  assert.ok(m[1].split(/\s+/).length <= 20, 'short enough for the panel');
});
