import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const extensionDir = new URL('../', import.meta.url);

async function createContentHarness({ displayedPair = null, favorites = [], debug = false } = {}) {
  const [configSrc, stateSrc, poDomSrc, contentSrc] = await Promise.all([
    readFile(new URL('config.js', extensionDir), 'utf8'),
    readFile(new URL('state.js', extensionDir), 'utf8'),
    readFile(new URL('poDom.js', extensionDir), 'utf8'),
    readFile(new URL('content.js', extensionDir), 'utf8'),
  ]);

  let currentPairText = displayedPair;
  const messageListeners = [];
  const logs = [];

  const favoriteNodes = favorites.map(({ id, label }) => ({
    getAttribute(attr) {
      return attr === 'data-id' ? id : null;
    },
    querySelector() {
      return { textContent: label };
    },
  }));

  const document = {
    addEventListener() {},
    getElementById() {
      return null;
    },
    querySelector(selector) {
      if (currentPairText && selector === '.asset-select .asset__name') {
        return { textContent: currentPairText };
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('data-id')) return favoriteNodes;
      return [];
    },
  };

  const window = {
    __AVALISA_DEBUG_LOGS__: debug,
    document,
    location: { pathname: '/en/cabinet/demo-quick-high-low/' },
    localStorage: { getItem: () => (debug ? '1' : null) },
    addEventListener(type, fn) {
      if (type === 'message') messageListeners.push(fn);
    },
    postMessage() {},
  };

  const chrome = {
    runtime: {
      getManifest: () => ({ version: '2.4.24' }),
      getURL: (f) => `chrome-extension://avalisa/${f}`,
      onMessage: { addListener() {} },
      sendMessage() {},
    },
    storage: {
      local: {
        get(_keys, cb) {
          if (cb) cb({});
        },
        set(_vals, cb) {
          if (cb) cb();
        },
        remove(_keys, cb) {
          if (cb) cb();
        },
      },
      onChanged: { addListener() {} },
    },
  };

  const consoleStub = {
    log: (...args) => logs.push(args),
    warn: (...args) => logs.push(args),
    error: (...args) => logs.push(args),
  };

  const ctx = vm.createContext({
    window,
    document,
    location: window.location,
    chrome,
    console: consoleStub,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
  });
  ctx.globalThis = ctx;

  vm.runInContext(
    `${configSrc}\n${stateSrc}\n${poDomSrc}\n${contentSrc}\nthis.__state = state; this.__getBufferedCandles = getBufferedCandles;`,
    ctx,
  );

  assert.equal(messageListeners.length, 1, 'content.js registers its window message listener');

  return {
    state: ctx.__state,
    logs,
    getBufferedCandles: () => ctx.__getBufferedCandles(),
    setDisplayedPair(pairText) {
      currentPairText = pairText;
    },
    dispatchHistory(payload) {
      messageListeners[0]({
        data: {
          type: 'AVALISA_WS_HISTORY',
          data: JSON.stringify(payload),
        },
      });
    },
  };
}

const toHost = (val) => JSON.parse(JSON.stringify(val));

test('history frame for the displayed pair seeds the buffer and sets activePair', async () => {
  const h = await createContentHarness({ displayedPair: 'CAD/JPY OTC' });

  h.dispatchHistory({
    asset: 'CADJPY_otc',
    period: 30,
    history: [
      [1700000000, 110.1],
      [1700000030, 110.2],
      [1700000060, 110.3],
    ],
  });

  assert.equal(h.state.activePair, 'CADJPY_otc');
  assert.equal(h.state.activePeriod, 30);
  assert.equal(h.getBufferedCandles().length, 3);
  assert.deepEqual(Object.keys(h.state.candleBuffer), ['CADJPY_otc:30']);
});

test('late history frame for another pair leaves activePair and the displayed pair buffer untouched', async () => {
  const h = await createContentHarness({ displayedPair: 'CAD/JPY OTC', debug: true });

  h.dispatchHistory({
    asset: 'CADJPY_otc',
    period: 30,
    history: [
      [1700000000, 110.1],
      [1700000030, 110.2],
      [1700000060, 110.3],
    ],
  });

  const beforeRef = h.state.candleBuffer['CADJPY_otc:30'];
  const beforeCandles = toHost(beforeRef);
  h.logs.length = 0;

  // Late frame arrives for the previous pair while the chart already shows CAD/JPY OTC.
  h.dispatchHistory({
    asset: 'BHDCNY_otc',
    period: 30,
    history: [
      [1700000000, 18.91],
      [1700000030, 18.92],
    ],
  });

  assert.equal(h.state.activePair, 'CADJPY_otc');
  assert.equal(h.state.activePeriod, 30);
  assert.equal(h.state.candleBuffer['CADJPY_otc:30'], beforeRef);
  assert.deepEqual(toHost(h.state.candleBuffer['CADJPY_otc:30']), beforeCandles);
  assert.equal(h.state.candleBuffer['BHDCNY_otc:30'], undefined);
  assert.deepEqual(Object.keys(h.state.candleBuffer), ['CADJPY_otc:30']);
  assert.ok(
    h.logs.some(
      (entry) =>
        entry[0] === '[Avalisa] HISTORY ignored for' &&
        entry[1] === 'BHDCNY_otc' &&
        entry[2] === '- chart shows' &&
        entry[3] === 'CADJPY_otc',
    ),
    'logs debug message when ignoring a stale pair history frame',
  );
});

test('late history frame arriving right after switching chart to an unseeded pair does not flip activePair back', async () => {
  const h = await createContentHarness({ displayedPair: 'BHD/CNY OTC' });

  h.dispatchHistory({
    asset: 'BTCUSD_otc',
    period: 30,
    history: [
      [1700000000, 68000],
      [1700000030, 68050],
    ],
  });

  assert.equal(h.state.activePair, null);
  assert.equal(h.state.activePeriod, null);
  assert.deepEqual(Object.keys(h.state.candleBuffer), []);
});

test('history frame still seeds normally when the displayed pair is UNKNOWN', async () => {
  const h = await createContentHarness({ displayedPair: null });

  h.dispatchHistory({
    asset: 'AUDCAD_otc',
    period: 30,
    history: [
      [1700000000, 0.9101],
      [1700000030, 0.9105],
    ],
  });

  assert.equal(h.state.activePair, 'AUDCAD_otc');
  assert.equal(h.state.activePeriod, 30);
  assert.equal(h.getBufferedCandles().length, 2);
});

test('live switch sequence: Bitcoin OTC -> BHD/CNY OTC -> CAD/JPY OTC ignores late previous-pair frames', async () => {
  const h = await createContentHarness({
    displayedPair: 'Bitcoin OTC',
    favorites: [{ id: 'BTCUSD_otc', label: 'Bitcoin OTC' }],
  });

  // 1. Bitcoin OTC on chart: BTCUSD_otc matches via favourite data-id mapping.
  h.dispatchHistory({
    asset: 'BTCUSD_otc',
    period: 30,
    history: [
      [1700000000, 68000],
      [1700000030, 68050],
    ],
  });
  assert.equal(h.state.activePair, 'BTCUSD_otc');
  assert.equal(h.getBufferedCandles().length, 2);

  // 2. Bot switches chart to BHD/CNY OTC; BHD/CNY seed arrives, then a late BTCUSD_otc frame arrives.
  h.setDisplayedPair('BHD/CNY OTC');
  h.dispatchHistory({
    asset: 'BHDCNY_otc',
    period: 30,
    history: [
      [1700000000, 18.91],
      [1700000030, 18.92],
      [1700000060, 18.93],
    ],
  });
  assert.equal(h.state.activePair, 'BHDCNY_otc');
  assert.equal(h.getBufferedCandles().length, 3);

  h.dispatchHistory({
    asset: 'BTCUSD_otc',
    period: 30,
    history: [[1700000090, 68100]],
  });
  assert.equal(h.state.activePair, 'BHDCNY_otc');
  assert.equal(h.getBufferedCandles().length, 3);
  assert.deepEqual(Object.keys(h.state.candleBuffer), ['BHDCNY_otc:30']);

  // 3. Bot switches chart to CAD/JPY OTC; CAD/JPY seed arrives, then a late BHDCNY_otc frame arrives.
  h.setDisplayedPair('CAD/JPY OTC');
  h.dispatchHistory({
    asset: 'CADJPY_otc',
    period: 30,
    history: [
      [1700000000, 110.1],
      [1700000030, 110.2],
      [1700000060, 110.3],
      [1700000090, 110.4],
    ],
  });
  assert.equal(h.state.activePair, 'CADJPY_otc');
  assert.equal(h.getBufferedCandles().length, 4);

  h.dispatchHistory({
    asset: 'BHDCNY_otc',
    period: 30,
    history: [[1700000120, 18.94]],
  });
  assert.equal(h.state.activePair, 'CADJPY_otc');
  assert.equal(h.getBufferedCandles().length, 4);
  assert.deepEqual(Object.keys(h.state.candleBuffer), ['CADJPY_otc:30']);
});


test('chart-period history (60s on M1) does not replace or wipe the 30s analysis buffer', async () => {
  const h = await createContentHarness({ displayedPair: 'CAD/JPY OTC' });

  const seed30 = Array.from({ length: 27 }, (_, i) => [1700000000 + i * 30, 100 + i]);
  h.dispatchHistory({ asset: 'CADJPY_otc', period: 30, history: seed30 });
  assert.equal(h.state.activePeriod, 30);
  const ref = h.state.candleBuffer['CADJPY_otc:30'];
  const before = toHost(ref);

  // PO's own chart answer at the chart timeframe, same pair.
  const seed60 = Array.from({ length: 14 }, (_, i) => [1700000000 + i * 60, 100 + i]);
  h.dispatchHistory({ asset: 'CADJPY_otc', period: 60, history: seed60 });

  assert.equal(h.state.activePair, 'CADJPY_otc');
  assert.equal(h.state.activePeriod, 30);
  assert.equal(h.state.candleBuffer['CADJPY_otc:30'], ref);
  assert.deepEqual(toHost(h.state.candleBuffer['CADJPY_otc:30']), before);
  assert.equal(h.state.candleBuffer['CADJPY_otc:60'], undefined);
  assert.equal(h.getBufferedCandles().length, before.length);
});

test('a 60s frame on a freshly opened pair never becomes the active analysis series', async () => {
  const h = await createContentHarness({ displayedPair: 'CAD/JPY OTC' });
  h.dispatchHistory({ asset: 'CADJPY_otc', period: 60, history: [[1700000000, 110.1], [1700000060, 110.2]] });
  assert.notEqual(h.state.activePeriod, 60);
  assert.equal(h.state.candleBuffer['CADJPY_otc:60'], undefined);
  h.dispatchHistory({ asset: 'CADJPY_otc', period: 30, history: [[1700000000, 110.1], [1700000030, 110.2]] });
  assert.equal(h.state.activePair, 'CADJPY_otc');
  assert.equal(h.state.activePeriod, 30);
});
