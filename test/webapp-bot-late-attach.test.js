const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { JSDOM } = require('../dashboard/node_modules/jsdom');

// The website's phone loader starts the runtime after Pocket Option has loaded, so PO's
// socket already exists and was built from the native constructor. The runtime must
// still see that socket's traffic, or the bot never gets candles on a phone browser.
const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'mobile-proof/ios/AvalisaMobileProof/ProofRuntime.js'), 'utf8');

test('late start adopts a socket that was opened before the runtime loaded', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div>QT Demo USD 100.00</div></body></html>', {
    url: 'https://m.po.trade/en/cabinet/demo-quick-high-low/',
    runScripts: 'outside-only',
  });
  const win = dom.window;
  await new Promise(resolve => (win.document.readyState === 'complete' ? resolve() : win.addEventListener('load', resolve)));
  win.fetch = async () => new Response('{}', { status: 401 });
  win.TextDecoder = TextDecoder;

  const sent = [];
  class FakeSocket extends win.EventTarget {
    constructor() { super(); this.readyState = 1; }
    send(data) { sent.push(data); }
  }
  win.WebSocket = FakeSocket;
  const poSocket = new FakeSocket(); // PO's socket, created before the loader ran

  try {
    win.eval(`${runtime}\n//# sourceURL=ProofRuntime.js`);
    const proof = win.AvalisaProof;
    assert.ok(proof, 'runtime loaded');
    assert.ok(!proof.debug.state.wsSeen, 'nothing seen before PO sends');

    poSocket.send('3'); // PO heartbeat
    assert.deepEqual(sent, ['3'], 'PO traffic still goes out unchanged');

    poSocket.dispatchEvent(new win.MessageEvent('message', { data: '42["successupdateBalance",{}]' }));
    assert.equal(proof.debug.state.wsSeen, true, 'runtime reads the adopted socket');

    poSocket.send('2');
    poSocket.dispatchEvent(new win.MessageEvent('message', { data: '2' }));
    assert.deepEqual(sent, ['3', '2'], 'adopting twice does not duplicate sends');
  } finally {
    win.close(); // stops the runtime's scan interval so the test process can exit
  }
});
