/**
 * Live 2026-10-06 (Avalisa Bot, Mid): "data not ready for Bitcoin_otc (buffer holds
 * BTCUSD_otc)" on every scan. The favourite's label is "Bitcoin OTC" but PO's candle
 * feed — and the favourite's own data-id — say "BTCUSD_otc", so non-currency favourites
 * never matched their buffer. normalizeAssetName now resolves labels through those ids.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('../dashboard/node_modules/jsdom');

const root = path.resolve(__dirname, '..');
const dom = new JSDOM(`<div class="assets-favorites">
  <div class="assets-favorites-list__item"><div class="animated assets-favorites-item" data-id="BTCUSD_otc">
    <div class="assets-favorites-item__line"><span class="assets-favorites-item__label">Bitcoin OTC</span> +92 %</div></div></div>
  <div class="assets-favorites-list__item"><div class="animated assets-favorites-item" data-id="ADA-USD_otc">
    <div class="assets-favorites-item__line"><span class="assets-favorites-item__label">Cardano  OTC</span> +80 %</div></div></div>
  <div class="assets-favorites-list__item"><div class="animated assets-favorites-item" data-id="AUDNZD_otc">
    <div class="assets-favorites-item__line"><span class="assets-favorites-item__label">AUD/NZD OTC</span> +92 %</div></div></div>
</div>`);
const ctx = { console, document: dom.window.document, window: dom.window, Date, Map, setTimeout, clearTimeout, chrome: { storage: { local: { get() {}, set() {} } } } };
vm.createContext(ctx);
for (const f of ['config.js', 'state.js', 'poDom.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'extension', f), 'utf8'), ctx, { filename: f });
}
const n = (x) => vm.runInContext(`normalizeAssetName(${JSON.stringify(x)})`, ctx);

assert.strictEqual(n('Bitcoin OTC'), 'BTCUSD_otc', 'crypto label resolves to the feed id');
assert.strictEqual(n('Cardano OTC'), 'ADA-USD_otc', 'whitespace in labels is tolerated');
assert.strictEqual(n('AUD/NZD OTC'), 'AUDNZD_otc', 'currency pairs keep resolving the same way');
assert.strictEqual(n('EUR/USD OTC'), 'EURUSD_otc', 'pairs not in favourites fall back to the label rule');
assert.strictEqual(n('BTCUSD_otc'), 'BTCUSD_otc', 'feed ids pass through unchanged');
assert.strictEqual(n(''), '', 'empty stays empty');

console.log('extension-asset-id-resolution: ok');
