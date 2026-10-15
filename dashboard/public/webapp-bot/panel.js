/* Avalisa Webapp Bot — on-page control panel for phone browsers.
 *
 * The loader puts runtime.js (the same bot the Mac/iPhone Webapp Bot app injects) into
 * the Pocket Option page, then this file. In the apps the panel is native; here it is a
 * floating sheet inside a shadow root so PO's styles and ours never touch. Every action
 * goes through window.AvalisaProof, exactly as the apps' buttons do.
 */
(function () {
  if (window.AvalisaWebappPanel) { window.AvalisaWebappPanel.open(); return; }
  var proof = window.AvalisaProof;
  if (!proof) return;

  var SITE = 'https://avalisabot.vercel.app';
  var SETTINGS_KEY = 'avalisa.webappBot.panelSettings.v1';
  var OPEN_KEY = 'avalisa.webappBot.panelOpen.v1';

  // Same choices and fixed values the Mac Webapp Bot sends (AvalisaMobileProofMac.swift
  // sendSettings). Keep them in step: this panel must not change how the bot trades.
  var DEFAULTS = {
    strategy: 'martingale', direction: 'alternating', timeframe: 'S30', intensity: 'low',
    aiPairMode: 'current', startAmount: 1, martingaleMultiplier: 2, martingaleSteps: 'infinite',
    payoutEnabled: true, payoutAction: 'switch', payoutMinPercent: 90,
  };
  var FIXED = { delaySeconds: 6, maxProofTrades: 0, maxProofAmount: 64, mobileAmountFallback: 'stop' };

  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (_) { return fallback; }
  }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }

  var settings = Object.assign({}, DEFAULTS, load(SETTINGS_KEY, {}));
  var open = load(OPEN_KEY, true);

  function runtimeSettings() {
    return {
      strategy: settings.strategy,
      direction: settings.direction,
      timeframe: settings.timeframe,
      intensity: settings.intensity,
      startAmount: Number(settings.startAmount) || 1,
      martingaleMultiplier: Number(settings.martingaleMultiplier) || 2,
      martingaleSteps: String(settings.martingaleSteps),
      aiPairMode: settings.aiPairMode,
      payoutAction: settings.payoutEnabled ? settings.payoutAction : 'off',
      payoutMinPercent: Number(settings.payoutMinPercent) || 90,
      delaySeconds: FIXED.delaySeconds,
      maxProofTrades: FIXED.maxProofTrades,
      maxProofAmount: FIXED.maxProofAmount,
      mobileAmountFallback: FIXED.mobileAmountFallback,
    };
  }

  var host = document.createElement('div');
  host.id = 'avalisa-webapp-bot';
  host.style.cssText = 'position:fixed;z-index:2147483646;left:0;right:0;bottom:0;pointer-events:none;';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = [
    '<style>',
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    '.pill{pointer-events:auto;position:fixed;right:12px;bottom:calc(46vh + env(safe-area-inset-bottom));display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border-radius:22px;border:1px solid #2D2D5B;background:#1A1A2E;color:#E2E8F0;font-size:14px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.45)}',
    '.dot{width:9px;height:9px;border-radius:50%;background:#94A3B8}',
    '.dot.on{background:#10B981;box-shadow:0 0 0 3px rgba(16,185,129,.25)}',
    '.sheet{pointer-events:auto;position:fixed;left:0;right:0;bottom:0;max-height:78vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#1A1A2E;color:#E2E8F0;border-top:1px solid #2D2D5B;border-radius:18px 18px 0 0;padding:14px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.5);font-size:14px}',
    '.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
    '.brand{font-weight:700;font-size:16px;color:#fff}.brand small{color:#94A3B8;font-weight:500;font-size:11px;margin-left:6px}',
    '.icon{width:44px;height:44px;border:0;background:transparent;color:#94A3B8;font-size:22px}',
    '.card{border:1px solid #2D2D5B;border-radius:12px;padding:12px;margin-bottom:10px;background:#141428}',
    '.muted{color:#94A3B8;font-size:12px}',
    '.row{display:flex;gap:8px}.row>*{flex:1}',
    'input,select{width:100%;height:44px;border-radius:10px;border:1px solid #2D2D5B;background:#0F0F1F;color:#E2E8F0;padding:0 10px;font-size:16px;margin-top:4px}',
    'label{display:block;font-size:12px;color:#94A3B8;margin-top:8px}',
    'button.b{height:46px;border-radius:12px;border:1px solid #2D2D5B;background:transparent;color:#E2E8F0;font-size:15px;font-weight:600;width:100%}',
    'button.go{background:#059669;border-color:#059669;color:#fff}button.stop{background:#DC2626;border-color:#DC2626;color:#fff}',
    'button.b:disabled{opacity:.4}',
    'a{color:#A78BFA}',
    '.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#2D2D5B;color:#A78BFA;font-size:11px;font-weight:700;text-transform:uppercase}',
    '.status{margin:8px 0 10px;padding:10px;border-radius:10px;background:#0F0F1F;font-size:13px;line-height:1.4}',
    '.status.warn{color:#FBBF24}',
    '.grid{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px}.grid span:nth-child(odd){color:#94A3B8}.grid span:nth-child(even){font-family:ui-monospace,Menlo,monospace;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    'details summary{cursor:pointer;color:#A78BFA;font-size:13px;min-height:44px;display:flex;align-items:center}',
    '.check{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:#E2E8F0}.check input{width:22px;height:22px;margin:0}',
    '.risk{font-size:11px;color:#94A3B8;margin-top:8px;line-height:1.4}',
    '</style>',
    '<button class="pill" part="pill"><span class="dot"></span><span class="pill-text">Avalisa</span></button>',
    '<section class="sheet" hidden>',
    '  <div class="top"><div class="brand">Avalisa<small class="ver"></small></div><button class="icon close" aria-label="Minimise">⌄</button></div>',
    '  <div class="card auth-out" hidden>',
    '    <strong>Sign in to Avalisa</strong>',
    '    <p class="muted">Your Avalisa account, not your Pocket Option login.</p>',
    '    <p class="muted free-note" hidden></p>',
    '    <label>Email<input class="email" type="email" autocomplete="username" inputmode="email"></label>',
    '    <label>Password<input class="password" type="password" autocomplete="current-password"></label>',
    '    <div class="row" style="margin-top:10px"><button class="b go login">Sign in</button><button class="b signup">Create account</button></div>',
    '    <p class="muted" style="margin-top:8px"><a class="forgot" target="_blank" rel="noreferrer">Forgot password?</a></p>',
    '  </div>',
    '  <div class="card auth-in" hidden>',
    '    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div><span class="badge plan"></span> <span class="muted who"></span></div><button class="b logout" style="width:auto;padding:0 14px;height:36px;font-size:13px">Sign out</button></div>',
    '    <p class="muted allowance" style="margin-top:6px"></p>',
    '  </div>',
    '  <div class="status"></div>',
    '  <div class="row"><button class="b go start">▶ Start</button><button class="b stop">■ Stop</button></div>',
    '  <details class="settings" style="margin-top:8px"><summary>Bot settings</summary>',
    '    <label>Strategy<select data-k="strategy"><option value="martingale">Martingale</option><option value="ai">Avalisa Bot</option></select></label>',
    '    <div class="row"><label>Direction<select data-k="direction"><option value="alternating">Alternating</option><option value="call">Always Buy</option><option value="put">Always Sell</option></select></label>',
    '    <label>Timeframe<select data-k="timeframe"><option value="S30">30s</option><option value="M1">1min</option><option value="M3">3min</option><option value="M5">5min</option></select></label></div>',
    '    <div class="row"><label>Intensity<select data-k="intensity"><option value="low">Low</option><option value="mid">Mid</option><option value="high">High</option></select></label>',
    '    <label>Pairs<select data-k="aiPairMode"><option value="current">Current pair only</option><option value="auto">Auto scan favorites</option></select></label></div>',
    '    <div class="row"><label>Start amount ($)<input data-k="startAmount" type="number" min="1" step="1" inputmode="decimal"></label>',
    '    <label>Multiplier<select data-k="martingaleMultiplier"><option>2</option><option>2.2</option><option>2.4</option><option>2.6</option><option>2.8</option><option>3</option></select></label>',
    '    <label>Steps<select data-k="martingaleSteps"><option value="infinite">Infinite</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>8</option><option>10</option><option>12</option></select></label></div>',
    '    <label class="check"><input data-k="payoutEnabled" type="checkbox"> Minimum payout guard</label>',
    '    <div class="row"><label>Minimum payout %<input data-k="payoutMinPercent" type="number" min="1" max="100" inputmode="numeric"></label>',
    '    <label>When below<select data-k="payoutAction"><option value="switch">Auto-switch favorite</option><option value="stop">Stop bot</option></select></label></div>',
    '    <p class="risk">On this phone version, a Martingale ladder that would need more than $' + FIXED.maxProofAmount + ' per trade stops the bot and says why.</p>',
    '  </details>',
    '  <details style="margin-top:4px"><summary>Live readings</summary><div class="grid readings"></div></details>',
    '  <p class="risk">Trading carries risk. Run it on your Demo account first; the bot never trades until it can read whether Pocket Option is on Demo or Real.</p>',
    '</section>',
  ].join('');
  document.documentElement.appendChild(host);

  var $ = function (sel) { return root.querySelector(sel); };
  var pill = $('.pill'), sheet = $('.sheet');
  $('.ver').textContent = 'Webapp Bot ' + (proof.version || '');
  $('.forgot').href = SITE + '/forgot-password';

  function setOpen(next) {
    open = next; save(OPEN_KEY, open);
    sheet.hidden = !open; pill.hidden = open;
  }
  pill.addEventListener('click', function () { setOpen(true); });
  $('.close').addEventListener('click', function () { setOpen(false); });

  root.querySelectorAll('[data-k]').forEach(function (el) {
    var k = el.getAttribute('data-k');
    if (el.type === 'checkbox') el.checked = !!settings[k]; else el.value = String(settings[k]);
    el.addEventListener('change', function () {
      settings[k] = el.type === 'checkbox' ? el.checked : el.value;
      save(SETTINGS_KEY, settings);
      if (!lastStatus.botRunning) proof.setSettings({ settings: runtimeSettings() });
    });
  });

  $('.login').addEventListener('click', function () {
    var email = $('.email').value.trim(), password = $('.password').value;
    Promise.resolve(proof.login(email, password)).then(function () { $('.password').value = ''; render(); });
  });
  $('.signup').addEventListener('click', function () { window.open(SITE + '/register', '_blank', 'noopener'); });
  $('.logout').addEventListener('click', function () { proof.logout(); render(); });
  $('.start').addEventListener('click', function () {
    proof.setSettings({ settings: runtimeSettings() });
    proof.startBot();
    render();
  });
  $('.stop').addEventListener('click', function () { proof.stopBot('stopped by user'); render(); });

  var lastStatus = {};
  function accountLabel(mode) { return mode === 'confirmed' ? 'Demo' : mode === 'real' ? 'Real' : 'Not read yet'; }

  function render() {
    var s;
    try { s = JSON.parse(proof.snapshot()); } catch (_) { return; }
    lastStatus = s;
    // free_tier = not signed in; the backend still grants the free demo allowance to
    // this device, so the bot can run, but the sign-in form stays on screen.
    var signedIn = s.authStatus === 'logged_in';
    var allowance = s.tradesRemaining == null
      ? 'Trade allowance: unlimited'
      : 'Trades left: ' + s.tradesRemaining + (s.tradesLimit ? ' of ' + s.tradesLimit : '');
    $('.auth-out').hidden = signedIn;
    $('.auth-in').hidden = !signedIn;
    $('.free-note').hidden = s.authStatus !== 'free_tier';
    $('.free-note').textContent = 'Not signed in — free demo allowance. ' + allowance + '.';
    if (signedIn) {
      $('.plan').textContent = s.licensePlan || 'plan';
      $('.who').textContent = s.userEmail || '';
      $('.allowance').textContent = allowance;
    }
    var blockers = (s.webappReadiness && s.webappReadiness.blockers) || [];
    var status = $('.status');
    var message = s.botRunning
      ? 'Running · ' + accountLabel(s.demoMode) + ' · ' + (s.lastTradeStatus || '')
      : (s.lastBotError || (blockers.length ? 'Not ready: ' + blockers[0] : (s.lastTradeStatus || 'Ready')));
    status.textContent = message;
    status.className = 'status' + (!s.botRunning && (blockers.length || s.lastBotError) ? ' warn' : '');
    $('.start').disabled = s.botRunning || !s.licenseAllowed || !(s.demoMode === 'confirmed' || s.demoMode === 'real');
    $('.stop').disabled = !s.botRunning;
    root.querySelectorAll('.settings [data-k]').forEach(function (el) { el.disabled = !!s.botRunning; });
    $('.dot').className = 'dot' + (s.botRunning ? ' on' : '');
    $('.pill-text').textContent = s.botRunning ? 'Avalisa · running' : 'Avalisa';
    var rows = [
      ['Account', accountLabel(s.demoMode)], ['Pair', s.activePair], ['Candles', s.candleCount],
      ['Balance', s.balance], ['Payout', s.payout], ['Expiry', s.duration],
      ['Bot', s.botRunning ? (s.botMode + ' · step ' + s.martingaleStep) : 'stopped'],
      ['Next amount', s.nextAmount], ['Trades this session', s.tradesCount],
      ['Last result', s.lastResult], ['Layout', s.layoutHealth],
    ];
    var grid = $('.readings');
    grid.textContent = '';
    rows.forEach(function (r) {
      var a = document.createElement('span'); a.textContent = r[0];
      var b = document.createElement('span'); b.textContent = r[1] == null ? '-' : String(r[1]);
      grid.appendChild(a); grid.appendChild(b);
    });
  }

  // A bot restored mid-run keeps the settings it started with, as in the apps.
  try { if (!JSON.parse(proof.snapshot()).botRunning) proof.setSettings({ settings: runtimeSettings() }); } catch (_) {}
  setOpen(open);
  render();
  window.setInterval(render, 1000);
  window.AvalisaWebappPanel = { open: function () { setOpen(true); }, render: render };
})();
