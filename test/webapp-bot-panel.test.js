const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { JSDOM } = require('../dashboard/node_modules/jsdom');

// Seen on a real iPhone (2026-10-15): a licence check that timed out left a signed-in user
// looking signed out, with Start greyed out and no way to retry short of reloading.
const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'mobile-proof/ios/AvalisaMobileProof/ProofRuntime.js'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'dashboard/public/webapp-bot/panel.js'), 'utf8');

test('a network failure keeps the signed-in view and offers Retry', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div>QT Demo USD 100.00</div></body></html>', {
    url: 'https://m.po.trade/en/cabinet/demo-quick-high-low/',
    runScripts: 'outside-only',
  });
  const win = dom.window;
  win.TextDecoder = TextDecoder;
  win.AbortController = AbortController;
  win.localStorage.setItem('avalisa.webappBot.auth.v1', JSON.stringify({ jwt: 'jwt-1', userId: 'u1', userEmail: 'a@b.c' }));
  win.fetch = async () => { const e = new Error('Fetch is aborted'); e.name = 'AbortError'; throw e; };
  try {
    win.eval(`${runtime}\n//# sourceURL=ProofRuntime.js`);
    await new Promise(r => setTimeout(r, 50));
    win.AvalisaProof.debug.state.demoMode = 'confirmed';
    win.AvalisaProof.scan = () => {};
    win.eval(`${panel}\n//# sourceURL=panel.js`);
    await new Promise(r => setTimeout(r, 50));
    // The runtime's own scan cannot read this stub page, so pin the mode the panel reads.
    const snap = JSON.parse(win.AvalisaProof.snapshot());
    assert.equal(snap.authStatus, 'error');
    const shadow = win.document.getElementById('avalisa-webapp-bot').shadowRoot;
    const realSnapshot = win.AvalisaProof.snapshot;
    win.AvalisaProof.snapshot = () => JSON.stringify({ ...JSON.parse(realSnapshot()), demoMode: 'confirmed' });
    win.AvalisaWebappPanel.render();
    assert.equal(shadow.querySelector('.auth-in').hidden, false, 'still shown as signed in');
    assert.equal(shadow.querySelector('.auth-out').hidden, true, 'no sign-in prompt');
    assert.equal(shadow.querySelector('.start').disabled, false, 'Retry is tappable');
    assert.match(shadow.querySelector('.start').textContent, /Retry/);
    assert.match(shadow.querySelector('.status').textContent, /Could not reach the Avalisa server/);

    // Retry must only re-check the plan — never start the bot (seen on the Board's iPhone:
    // the check timed out while the backend woke up, and Retry was wired to Start).
    let started = 0, checked = 0;
    win.AvalisaProof.startBot = () => { started += 1; };
    win.AvalisaProof.checkLicense = async () => { checked += 1; };
    shadow.querySelector('.start').click();
    await new Promise(r => setTimeout(r, 20));
    assert.equal(started, 0, 'Retry did not start the bot');
    assert.equal(checked, 1, 'Retry re-checked the plan');
    assert.equal(shadow.querySelector('.plan').textContent, '…', 'no guessed plan badge while unknown');
  } finally {
    win.close();
  }
});
