/**
 * The sign-in iframe exists only while the sign-in form is showing (2026-10-06).
 * Signed in → no extension frame in Pocket Option's DOM; signed out → frame present.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('../dashboard/node_modules/jsdom');

const content = fs.readFileSync(path.join(__dirname, '../extension/content.js'), 'utf8');
const helpers = content.slice(content.indexOf('function ensureLoginFrame'), content.indexOf('function updateUI'));
const dom = new JSDOM('<div id="av-login-form"><div id="av-login-frame-slot" data-login-url="chrome-extension://x/login.html"></div></div>');
const ctx = { document: dom.window.document, chrome: { runtime: { getURL: (p) => 'chrome-extension://fallback/' + p } } };
vm.createContext(ctx);
vm.runInContext(helpers, ctx);

ctx.ensureLoginFrame();
let frame = dom.window.document.getElementById('av-login-frame');
assert.ok(frame, 'signed out: frame is created');
assert.strictEqual(frame.getAttribute('src'), 'chrome-extension://x/login.html', 'frame loads the extension-origin login page');
ctx.ensureLoginFrame();
assert.strictEqual(dom.window.document.querySelectorAll('#av-login-frame').length, 1, 'never duplicated');
ctx.removeLoginFrame();
assert.strictEqual(dom.window.document.getElementById('av-login-frame'), null, 'signed in: frame removed');

assert.match(content, /loginForm\.style\.display = 'none';\n\s*removeLoginFrame\(\);/, 'updateUI removes the frame when signed in');
assert.match(content, /loginForm\.style\.display = 'block';\n\s*ensureLoginFrame\(\);/, 'updateUI creates the frame when signed out');
console.log('extension-login-frame-lazy: ok');
