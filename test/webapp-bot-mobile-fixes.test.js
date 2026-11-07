const assert = require('assert');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { JSDOM } = require('../dashboard/node_modules/jsdom');

// Pocket Option mobile fixes verified live on m.pocketoption.com (7 Nov 2026):
//   1. the trade amount has no <input>; it is set through a custom keypad
//   2. a balance with thousands separators ("$49,999.92") was cut off at the comma
//   3. the hidden account menu lists "QT Real" first, so a demo session was labelled real
const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'dashboard/public/webapp-bot/runtime.js'), 'utf8');

function load(body, url = 'https://m.pocketoption.com/en/cabinet/') {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, {
    url,
    runScripts: 'outside-only',
  });
  const win = dom.window;
  win.TextDecoder = TextDecoder;
  win.AbortController = AbortController;
  win.fetch = async () => { throw new Error('offline'); };
  // jsdom has no layout: report a box for everything except what is hidden (or inside something hidden).
  const hiddenNode = el => {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      if (node.hasAttribute('hidden') || /display:\s*none/i.test(node.getAttribute('style') || '')) return true;
    }
    return false;
  };
  win.Element.prototype.getBoundingClientRect = function rect() {
    const on = !hiddenNode(this);
    return { x: 0, y: 0, top: 0, left: 0, right: on ? 100 : 0, bottom: on ? 30 : 0, width: on ? 100 : 0, height: on ? 30 : 0 };
  };
  win.eval(`${runtime}\n//# sourceURL=runtime.js`);
  return win;
}

const parseBalance = value => Number(String(value || '').replace(/[^\d.-]/g, ''));

// ---------- Bug 1: amount keypad ----------

const KEYPAD_PAGE = `
  <div class="block block--bet-amount"><span>Amount</span> <span class="amount-field">$10</span></div>
  <div class="modal" hidden>
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0].map(k => `<div class="virtual-keyboard__input">${k}</div>`).join('')}
    <div class="virtual-keyboard__input"><svg viewBox="0 0 10 10"><path d="M0 0"/></svg></div>
  </div>`;

// Wires up the fake page: tapping the block toggles the modal; the keys edit the amount.
function wireKeypad(win, startValue = '10', format = v => `$${v || '0'}`) {
  const doc = win.document;
  const state = { value: startValue, events: [], opened: 0, closed: 0 };
  const field = doc.querySelector('.amount-field');
  const modal = doc.querySelector('.modal');
  const render = () => { field.textContent = format(state.value); doc.querySelector('.block--bet-amount').firstChild.textContent = `Amount ${state.value}`; };
  render();
  doc.querySelector('.block--bet-amount').addEventListener('click', () => {
    if (modal.hasAttribute('hidden')) { modal.removeAttribute('hidden'); state.opened += 1; }
    else { modal.setAttribute('hidden', ''); state.closed += 1; }
  });
  doc.querySelectorAll('.virtual-keyboard__input').forEach(key => {
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(type => key.addEventListener(type, () => state.events.push(type)));
    key.addEventListener('click', () => {
      state.events.push('click');
      if (key.querySelector('svg')) state.value = state.value.slice(0, -1);
      else state.value += key.textContent.trim();
      render();
    });
  });
  return state;
}

test('amount: keypad types the amount when PO has no amount input', () => {
  const win = load(KEYPAD_PAGE);
  try {
    const pad = wireKeypad(win);
    assert.equal(win.AvalisaProof.debug.setAmountValue(1), true);
    assert.equal(win.document.querySelector('.amount-field').textContent, '$1');
    assert.equal(win.document.querySelector('.block--bet-amount').textContent, 'Amount 1 $1');
    assert.equal(pad.opened, 1, 'keypad opened once');
    assert.equal(pad.closed, 1, 'keypad closed again');
    assert.ok(win.document.querySelector('.modal').hasAttribute('hidden'), 'keypad is closed at the end');
    // Every key press sends the full pointer/mouse/click sequence, in order.
    assert.deepEqual(pad.events.slice(0, 5), ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    // "10" => 2 backspaces, then the digit "1" => 3 key presses in total.
    assert.equal(pad.events.filter(e => e === 'click').length, 3);
  } finally { win.close(); }
});

test('amount: keypad handles multi-digit and decimal amounts and "$1,000" style displays', () => {
  const win = load(KEYPAD_PAGE);
  try {
    const thousands = v => (v ? `$${Number(v).toLocaleString('en-US')}` : '$0');
    const pad = wireKeypad(win, '1000', thousands);
    assert.equal(win.document.querySelector('.amount-field').textContent, '$1,000');
    assert.equal(win.AvalisaProof.debug.visibleAmountMatches(1000), true, '"$1,000" reads as 1000');
    assert.equal(win.AvalisaProof.debug.visibleAmountMatches(1), false);
    assert.equal(win.AvalisaProof.debug.setAmountValue(25), true);
    assert.equal(pad.value, '25');
    assert.equal(win.document.querySelector('.amount-field').textContent, '$25');

    // A non-integer uses "." and at most 2 decimals.
    assert.equal(win.AvalisaProof.debug.setAmountValue(1.5), true);
    assert.equal(pad.value, '1.5');
    assert.equal(win.AvalisaProof.debug.setAmountValue(2.25), true);
    assert.equal(pad.value, '2.25');
  } finally { win.close(); }
});

test('amount: clearing stops after 12 backspaces and a failed set reports false', () => {
  const win = load(KEYPAD_PAGE);
  try {
    wireKeypad(win, '10');
    // Keys that do nothing: the display stays at $7 whatever is pressed.
    let backspaces = 0;
    win.document.addEventListener('click', event => {
      const key = event.target.closest?.('.virtual-keyboard__input');
      if (!key) return;
      if (key.querySelector('svg')) backspaces += 1;
      event.stopImmediatePropagation();
    }, true);
    win.document.querySelector('.amount-field').textContent = '$7';
    assert.equal(win.AvalisaProof.debug.setAmountValue(5), false);
    assert.equal(backspaces, 12, 'gives up after 12 backspaces');
    assert.ok(win.document.querySelector('.modal').hasAttribute('hidden'), 'keypad is closed afterwards');
  } finally { win.close(); }
});

test('amount: an already-open keypad is not tapped shut before typing', () => {
  const win = load(KEYPAD_PAGE);
  try {
    const pad = wireKeypad(win);
    win.document.querySelector('.modal').removeAttribute('hidden');
    assert.equal(win.AvalisaProof.debug.setAmountValue(3), true);
    assert.equal(pad.opened, 0, 'did not toggle it');
    assert.equal(pad.closed, 1, 'closed it once at the end');
    assert.equal(pad.value, '3');
  } finally { win.close(); }
});

test('amount: the desktop <input> path still works', () => {
  const win = load('<div class="block--bet-amount"><div class="value__val"><input value="10"></div></div>');
  try {
    assert.equal(win.AvalisaProof.debug.setAmountValue(3), true);
    assert.equal(win.document.querySelector('input').value, '3.00');
    assert.equal(win.AvalisaProof.debug.visibleAmountMatches(3), true);
    assert.equal(win.AvalisaProof.debug.visibleAmountMatches(4), false);
  } finally { win.close(); }
});

test('amount: .amount-field reads "$1", "$1.00" and "$1,000"', () => {
  const win = load('<div class="block--bet-amount"><span class="amount-field">$1</span></div>');
  try {
    const field = win.document.querySelector('.amount-field');
    const matches = amount => win.AvalisaProof.debug.visibleAmountMatches(amount);
    assert.equal(matches(1), true);
    field.textContent = '$1.00';
    assert.equal(matches(1), true);
    assert.equal(matches(10), false);
    field.textContent = '$1,000';
    assert.equal(matches(1000), true);
    assert.equal(matches(1), false, '"$1,000" is not $1');
    field.textContent = '$12.50';
    assert.equal(matches(12.5), true);
  } finally { win.close(); }
});

// ---------- Bug 2: balance with thousands separators ----------

test('balance: the fallback regex keeps thousands separators', () => {
  const cases = [
    ['$49,999.92', 49999.92],
    ['$1,234,567.89', 1234567.89],
    ['$10', 10],
    ['$0.50', 0.5],
    ['$1234.5', 1234.5],
  ];
  for (const [shown, expected] of cases) {
    const win = load(`<div>Balance ${shown} today</div>`);
    try {
      win.AvalisaProof.debug.inferBalanceAndMode();
      assert.equal(win.AvalisaProof.debug.state.balance, shown);
      assert.equal(parseBalance(win.AvalisaProof.debug.state.balance), expected);
    } finally { win.close(); }
  }
});

test('balance: "QT Demo USD 49,999.92" account text keeps the whole number', () => {
  const win = load('<div>QT Demo USD 49,999.92</div>');
  try {
    win.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(win.AvalisaProof.debug.state.balance, '49,999.92');
    assert.equal(win.AvalisaProof.debug.state.demoMode, 'confirmed');
  } finally { win.close(); }
});

test('balance: a $1 loss on a $50,000 balance is a loss, not a tie', () => {
  const win = load('<div>Balance $49,999.92</div>');
  try {
    const { debug } = win.AvalisaProof;
    debug.inferBalanceAndMode();
    const before = parseBalance(debug.state.balance);
    assert.equal(before, 49999.92);
    assert.equal(debug.classifyResult(before, before - 1, before - 1, 1, 40000, 30), 'loss');
  } finally { win.close(); }
});

test('balance: the try-demo header balance is read when the label says Demo', () => {
  const win = load(`
    <div class="balance-info-block"><div class="balance-info-block__label">QT Demo</div>
      <div class="js-try-demo-balance">$49,999.92</div></div>`, 'https://m.pocketoption.com/en/cabinet/try-demo/');
  try {
    win.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(win.AvalisaProof.debug.state.balance, '$49,999.92');
    assert.equal(win.AvalisaProof.debug.state.demoMode, 'confirmed');
  } finally { win.close(); }
});

test('balance: balance-info-block is not treated as a demo balance when the label says Real', () => {
  const win = load(`
    <div class="balance-info-block"><div class="balance-info-block__label">QT Real</div>
      <div class="js-try-demo-balance">$49,999.92</div><div class="js-balance-real">$120.00</div></div>`);
  try {
    win.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(win.AvalisaProof.debug.state.demoMode, 'real');
    assert.equal(win.AvalisaProof.debug.state.balance, '$120.00');
  } finally { win.close(); }
});

// ---------- Bug 3: account mode label ----------

const HIDDEN_MENU = `
  <div class="account-menu" style="display:none"><div>QT Real</div> <div>QT Demo</div></div>`;

test('account mode: hidden "QT Real" menu + visible "QT Demo" header => demo', () => {
  const win = load(`${HIDDEN_MENU}
    <div class="balance-info-block"><div class="balance-info-block__label">QT Demo</div></div>`);
  try {
    win.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(win.AvalisaProof.debug.state.demoMode, 'confirmed');
  } finally { win.close(); }
});

test('account mode: a visible element whose own text is exactly "QT Demo" counts, even without the label class', () => {
  const win = load(`${HIDDEN_MENU}<header><span>QT Demo</span></header>`);
  try {
    win.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(win.AvalisaProof.debug.state.demoMode, 'confirmed');
  } finally { win.close(); }
});

test('account mode: visible "QT Real" header => real', () => {
  const win = load(`
    <div class="balance-info-block"><div class="balance-info-block__label">QT Real</div></div>
    <div class="account-menu" style="display:none"><div>QT Demo</div></div>`);
  try {
    win.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(win.AvalisaProof.debug.state.demoMode, 'real');
  } finally { win.close(); }
});

test('account mode: any visible Real signal beats a visible Demo one', () => {
  const win = load('<div class="balance-info-block__label">QT Demo</div><span>QT Real</span>');
  try {
    win.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(win.AvalisaProof.debug.state.demoMode, 'real');
  } finally { win.close(); }
});

test('account mode: a demo path is still a demo signal, but a visible Real label overrides it', () => {
  const demoPath = 'https://m.pocketoption.com/en/cabinet/demo-quick-high-low/';
  const demo = load('<div>nothing to read here</div>', demoPath);
  const realLabel = load('<div class="balance-info-block__label">QT Real</div>', demoPath);
  try {
    demo.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(demo.AvalisaProof.debug.state.demoMode, 'confirmed');
    realLabel.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(realLabel.AvalisaProof.debug.state.demoMode, 'real');
  } finally { demo.close(); realLabel.close(); }
});

test('account mode: with nothing visible the body text is still the fallback', () => {
  const win = load('<div style="display:none">QT Demo USD 100</div>');
  try {
    win.AvalisaProof.debug.inferBalanceAndMode();
    assert.equal(win.AvalisaProof.debug.state.demoMode, 'confirmed');
  } finally { win.close(); }
});
