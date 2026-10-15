/* Avalisa Webapp Bot — on-page control panel for phone browsers.
 *
 * The loader puts runtime.js (the same bot the Mac/iPhone Webapp Bot app injects) into
 * the Pocket Option page, then this file. The look is the Board's Webapp Bot design
 * (mobile-proof/mac/AvalisaMobileProofMac.swift), which follows the Chrome extension's
 * panel (extension/overlayView.js): same colours, rows, plan badges and wording, so a user
 * moving between desktop and phone sees one product. It lives in a shadow root so PO's
 * styles and ours never touch. Every action goes through window.AvalisaProof, exactly as
 * the apps' buttons do.
 */
(function () {
  if (window.AvalisaWebappPanel) { window.AvalisaWebappPanel.open(); return; }
  var proof = window.AvalisaProof;
  if (!proof) return;

  var SITE = window.__AVALISA_WEBAPP_ORIGIN || 'https://avalisabot.vercel.app';
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

  // Row icons, drawn in the extension's purple like the Webapp Bot app's SF Symbols.
  var ICON = {
    strategy: '<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    direction: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    timeframe: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M9 2h6"/>',
    intensity: '<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-5"/>',
    pairs: '<path d="M12 2l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/>',
    amount: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5"/><path d="M12 6v12"/>',
    multiplier: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="12" cy="6" r="2"/><path d="M12 8v3M12 11l-5 5M12 11l5 5"/>',
    steps: '<path d="M5 20V12M10 20V8M15 20V4M20 20v-6"/>',
    payout: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    user: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5c1.2-2 3.2-3 5.5-3s4.3 1 5.5 3"/>',
  };
  function icon(name) {
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>';
  }
  function select(key, options) {
    return '<select class="av-select" data-k="' + key + '">' + options.map(function (o) {
      return '<option value="' + o[0] + '">' + o[1] + '</option>';
    }).join('') + '</select>';
  }
  function row(cls, iconName, label, control) {
    return '<div class="av-row ' + cls + '"><span class="av-label">' + icon(iconName) + label + '</span>' + control + '</div>';
  }

  var version = 'v.' + String(proof.version || '').split('-')[0];

  var host = document.createElement('div');
  host.id = 'avalisa-webapp-bot';
  host.style.cssText = 'position:fixed;z-index:2147483646;left:0;right:0;bottom:0;pointer-events:none;';
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = [
    '<style>',
    ':host{all:initial}',
    '[hidden]{display:none!important}',
    '*{box-sizing:border-box;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}',
    // Colours are the extension's (overlayView.js): panel #1a1a2e, border #2d2d5b, fields #0f0f23.
    '.dock{pointer-events:auto;position:fixed;left:0;right:0;bottom:0;max-height:80vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#20203a 0,#1a1a2e 64px);animation:rise .42s cubic-bezier(.2,.8,.2,1) both;color:#e2e8f0;border-top:1px solid #2d2d5b;border-radius:16px 16px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.55)}',
    // Overscroll stays inside the panel instead of moving PO's page.
    '.wrap{display:grid;grid-template-rows:1fr;transition:grid-template-rows .34s cubic-bezier(.2,.8,.2,1);min-height:0}',
    '.dock.closed .wrap{grid-template-rows:0fr}',
    '.body{min-height:0;max-height:calc(80vh - 64px);overflow-y:auto;transition:opacity .25s;overscroll-behavior:contain;touch-action:pan-y;transform:translateZ(0);will-change:transform;padding:0 12px calc(24px + env(safe-area-inset-bottom))}',
    '.dock.closed .body{opacity:0;padding-bottom:0}',
    // On a real iPhone the page ends above Safari's toolbar, so the bar sits at bottom:0 —
    // any extra lift put it over PO's BUY/SELL row. It may cover PO's Trades/Signals strip.
    '.dock.closed{padding-bottom:env(safe-area-inset-bottom)}',
    '.head{display:flex;align-items:center;gap:12px;padding:10px 12px}',
    '.logo{width:84px;height:40px;object-fit:contain;flex-shrink:0}',
    '.title{flex:1;min-width:0}',
    '.title strong{font-size:16px;font-weight:700;color:#fff}',
    '.ver{display:inline-block;vertical-align:2px;font-size:10px;font-weight:700;color:#15120a;background:#f4c95d;border-radius:999px;padding:2px 7px;margin-left:6px}',
    '.live{display:inline-block;width:8px;height:8px;border-radius:50%;background:#475569;margin-left:8px;vertical-align:1px;transition:background .3s}',
    '.dock.running .live{background:#34d399;animation:pulse 1.6s ease-out infinite}',
    '.title a{display:block;font-size:12px;color:#94a3b8;text-decoration:none;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chev{width:40px;height:40px;border-radius:8px;border:1px solid #7c3aed;background:transparent;color:#a78bfa;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .34s cubic-bezier(.2,.8,.2,1),background .2s}',
    '.dock.closed .chev{transform:rotate(180deg)}',
    '.chev:active{background:rgba(124,58,237,.18)}',
    '.card{background:#151528;border:1px solid #2d2d5b;border-radius:10px;margin-bottom:10px}',
    '.acct{display:flex;align-items:center;gap:8px;padding:10px 12px}',
    '.acct .ic{width:22px;height:22px;color:#a78bfa;flex-shrink:0}',
    '.who{flex:1 1 auto;min-width:0;font-size:13px;color:#cbd5e1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.av-plan-badge{font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0}',
    '.plan-lifetime,.plan-pro{background:#f4c95d;color:#15120a}.plan-basic{background:#059669;color:#fff}.plan-free{background:#f4c95d;color:#15120a}',
    '.login-card{padding:12px}',
    '.login-card strong{display:block;font-size:14px;color:#fff;margin-bottom:4px}',
    '.av-note{font-size:11px;line-height:1.5;color:#8fa8c8;margin:0 0 10px}',
    '.av-row{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:46px;padding:6px 12px;border-bottom:1px solid #2d2d5b}',
    '.av-row:last-child{border-bottom:none}',
    '.av-label{display:flex;align-items:center;gap:10px;font-size:13px;color:#cbd5e1}',
    '.ic{width:18px;height:18px;color:#a78bfa;flex-shrink:0}',
    // 16px stops iOS zooming the page when a field is tapped.
    '.av-select,.av-input{background:#0f0f23;border:1px solid #2d2d5b;border-radius:6px;color:#e2e8f0;font-size:16px;height:34px;padding:0 8px;width:150px;-webkit-appearance:none;appearance:none}',
    '.av-select{background-image:linear-gradient(45deg,transparent 50%,#94a3b8 50%),linear-gradient(135deg,#94a3b8 50%,transparent 50%);background-position:calc(100% - 14px) 15px,calc(100% - 9px) 15px;background-size:5px 5px;background-repeat:no-repeat;padding-right:24px}',
    '.av-select:disabled,.av-input:disabled{opacity:.4}',
    '.payout{flex-direction:column;align-items:stretch}',
    '.payout-top{display:flex;justify-content:space-between;align-items:center;gap:10px}',
    '.payout-ctl{display:inline-flex;align-items:center;gap:10px;width:150px;justify-content:flex-end}',
    '.payout-ctl .av-input{width:88px}',
    '.payout .av-select{align-self:flex-end;margin-top:6px;width:200px}',
    '.av-switch{position:relative;display:inline-block;width:44px;height:26px;flex-shrink:0}',
    '.av-switch input{opacity:0;width:0;height:0}',
    '.av-switch-slider{position:absolute;inset:0;background:#334155;border:1px solid #475569;border-radius:999px;transition:.2s}',
    '.av-switch-slider:before{content:"";position:absolute;height:20px;width:20px;left:2px;top:2px;background:#e2e8f0;border-radius:50%;transition:.2s}',
    '.av-switch input:checked+.av-switch-slider{background:#7c3aed;border-color:#a78bfa}',
    '.av-switch input:checked+.av-switch-slider:before{transform:translateX(18px)}',
    '.av-controls{display:flex;gap:8px;margin:2px 0 10px}',
    '.av-btn{border:none;border-radius:10px;height:48px;padding:0 14px;font-size:15px;font-weight:700;flex:1;color:#fff;transition:transform .12s,opacity .2s,box-shadow .3s;-webkit-tap-highlight-color:transparent}',
    '.av-btn:active:not(:disabled){transform:scale(.97)}',
    '.av-btn:disabled{opacity:.4}',
    '.av-btn-green{background:linear-gradient(180deg,#10b981,#059669);box-shadow:0 4px 14px rgba(5,150,105,.35)}.av-btn-red{background:linear-gradient(180deg,#ef4444,#dc2626)}',
    '.av-btn:disabled{box-shadow:none}',
    '.dock.running .stop{box-shadow:0 0 0 0 rgba(220,38,38,.5);animation:ring 2s ease-out infinite}',
    '.av-btn-outline{background:transparent;border:1px solid #7c3aed;color:#a78bfa}',
    '.av-btn-sm{flex:none;height:40px;padding:0 18px;font-size:14px}',
    '.row-btns{display:flex;gap:8px}',
    '.av-sublink{display:inline-block;margin-top:8px;font-size:12px;color:#a78bfa;text-decoration:none}',
    '.av-status{font-size:13px;color:#a78bfa;line-height:1.45;margin-bottom:6px;transition:color .3s}',
    '.chip{display:none;align-items:center;gap:6px;font-size:12px;font-weight:800;letter-spacing:.6px;border-radius:999px;padding:4px 12px;margin:0 0 8px}',
    '.chip.show{display:inline-flex;animation:pop .5s cubic-bezier(.2,1.4,.4,1) both}',
    '.chip.win{background:rgba(52,211,153,.15);color:#34d399;border:1px solid rgba(52,211,153,.4)}',
    '.chip.loss{background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.35)}',
    '.chip.draw{background:rgba(148,163,184,.12);color:#cbd5e1;border:1px solid #475569}',
    '.av-status.error{color:#f87171}.av-status.running{color:#34d399}',
    '.av-counter{font-size:12px;color:#64748b;text-align:right;margin-bottom:3px}',
    'details{margin-top:6px}summary{font-size:12px;color:#a78bfa;min-height:36px;display:flex;align-items:center;cursor:pointer}',
    '.grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11px;padding-bottom:6px}.grid span:nth-child(odd){color:#64748b}.grid span:nth-child(even){font-family:ui-monospace,Menlo,monospace;text-align:right;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.risk{font-size:11px;color:#64748b;line-height:1.5;margin:8px 0 0}',
    '.av-footer{margin-top:10px;padding-top:10px;border-top:1px solid #2d2d5b;font-size:11px;color:#64748b;text-align:center}',
    '.av-footer a{color:#94a3b8;text-decoration:none}.av-footer-sep{color:#475569}',
    '@keyframes rise{from{transform:translateY(100%);opacity:.4}to{transform:none;opacity:1}}',
    '@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.6)}100%{box-shadow:0 0 0 8px rgba(52,211,153,0)}}',
    '@keyframes ring{0%{box-shadow:0 0 0 0 rgba(220,38,38,.45)}100%{box-shadow:0 0 0 10px rgba(220,38,38,0)}}',
    '@keyframes pop{0%{transform:scale(.6);opacity:0}100%{transform:none;opacity:1}}',
    '@media (prefers-reduced-motion:reduce){*,*:before{animation:none!important;transition:none!important}}',
    '</style>',
    '<section class="dock">',
    '  <div class="head">',
    '    <img class="logo" alt="Avalisa">',
    '    <div class="title"><strong>Avalisa PO Bot</strong><span class="ver"></span><span class="live" title="Bot status"></span><a class="site" target="_blank" rel="noopener"></a></div>',
    '    <button class="chev toggle" aria-label="Show or hide the Avalisa panel"></button>',
    '  </div>',
    '  <div class="wrap"><div class="body">',
    // No password box on this page: iOS offers the saved Pocket Option password for any
    // login-looking field here (tested on a real iPhone, masked text fields included).
    // Sign-in happens on the Avalisa site, which hands the session back to this tab.
    '    <div class="card login-card auth-out" hidden>',
    '      <strong>Login to your account</strong>',
    '      <p class="av-note free-note"></p>',
    '      <div class="row-btns"><button class="av-btn av-btn-green login">Login</button><button class="av-btn av-btn-outline signup">Sign up</button></div>',
    '      <a class="av-sublink forgot" target="_blank" rel="noopener">Forgot password?</a>',
    '    </div>',
    '    <div class="card acct auth-in" hidden>' + icon('user') + '<span class="who"></span><span class="av-plan-badge plan"></span><button class="av-btn av-btn-red av-btn-sm logout">Logout</button></div>',
    '    <div class="card settings">',
    row('', 'strategy', 'Strategy', select('strategy', [['martingale', 'Martingale'], ['ai', 'Avalisa Bot']])),
    row('only-martingale', 'direction', 'Direction', select('direction', [['alternating', 'Alternating'], ['call', 'Always Buy'], ['put', 'Always Sell']])),
    row('', 'timeframe', 'Timeframe', select('timeframe', [['S30', '30s'], ['M1', '1min'], ['M3', '3min'], ['M5', '5min']])),
    row('only-ai', 'intensity', 'Intensity', select('intensity', [['low', 'Low'], ['mid', 'Mid'], ['high', 'High']])),
    row('only-ai', 'pairs', 'Pair Scan', select('aiPairMode', [['current', 'Current pair only'], ['auto', 'Auto scan favorites']])),
    row('', 'amount', 'Start Amount ($)', '<input class="av-input" data-k="startAmount" type="number" min="1" step="1" inputmode="decimal">'),
    row('', 'multiplier', 'Martingale ×', select('martingaleMultiplier', [['2', '2.0×'], ['2.2', '2.2×'], ['2.4', '2.4×'], ['2.6', '2.6×'], ['2.8', '2.8×'], ['3', '3.0×']])),
    row('', 'steps', 'Martingale Steps', select('martingaleSteps', [['infinite', 'Infinite'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['8', '8'], ['10', '10'], ['12', '12']])),
    '      <div class="av-row payout"><div class="payout-top"><span class="av-label">' + icon('payout') + 'Minimum payout %</span>',
    '        <span class="payout-ctl"><label class="av-switch"><input type="checkbox" data-k="payoutEnabled"><span class="av-switch-slider"></span></label><input class="av-input" data-k="payoutMinPercent" type="number" min="1" max="100" inputmode="numeric"></span></div>',
    '        ' + select('payoutAction', [['switch', 'Auto-switch favorite'], ['stop', 'Stop bot']]),
    '      </div>',
    '    </div>',
    '    <div class="av-controls"><button class="av-btn av-btn-green start">▶ Start</button><button class="av-btn av-btn-red stop">■ Stop</button></div>',
    '    <div class="chip result"></div>',
    '    <div class="av-status status"></div>',
    '    <div class="av-counter plan-line"></div>',
    '    <div class="av-counter trades"></div>',
    '    <details><summary>Live readings</summary><div class="grid readings"></div></details>',
    '    <p class="risk">On this phone version a Martingale ladder that would need more than $' + FIXED.maxProofAmount + ' per trade stops the bot and says why. Trading carries risk — run it on Demo first; the bot never trades until it can read whether Pocket Option is on Demo or Real.</p>',
    '    <div class="av-footer"><a class="site2" target="_blank" rel="noopener">avalisabot.vercel.app</a><span class="av-footer-sep"> · </span><a class="plans" target="_blank" rel="noopener">Plans</a><span class="av-footer-sep"> · </span><a href="mailto:AvalisaPOBot@gmail.com">AvalisaPOBot@gmail.com</a></div>',
    '  </div></div>',
    '</section>',
  ].join('');
  // Trading pages commonly cancel touchmove at the document to stop the chart page from
  // rubber-banding, which also kills scrolling inside this panel on a real iPhone. Keep the
  // panel's touches to itself (registered on the host, before they bubble to PO's handlers).
  ['touchstart', 'touchmove', 'touchend', 'wheel'].forEach(function (type) {
    host.addEventListener(type, function (event) { event.stopPropagation(); }, { passive: true });
  });
  document.documentElement.appendChild(host);

  var $ = function (sel) { return root.querySelector(sel); };
  var dock = $('.dock');
  $('.logo').src = SITE + '/webapp-bot/logo.png'; // the extension's transparent signature logo
  $('.ver').textContent = version;
  $('.toggle').textContent = '⌄';
  $('.site').href = SITE; $('.site').textContent = SITE.replace(/^https?:\/\//, 'https://');
  $('.site2').href = SITE; $('.plans').href = SITE + '/pricing';
  $('.forgot').href = SITE + '/forgot-password';

  function setOpen(next) {
    open = next; save(OPEN_KEY, open);
    dock.classList.toggle('closed', !open);
  }
  $('.toggle').addEventListener('click', function () { setOpen(!open); });

  function applyStrategyRows() {
    var ai = settings.strategy === 'ai';
    root.querySelectorAll('.only-ai').forEach(function (el) { el.hidden = !ai; });
    root.querySelectorAll('.only-martingale').forEach(function (el) { el.hidden = ai; });
  }

  root.querySelectorAll('[data-k]').forEach(function (el) {
    var k = el.getAttribute('data-k');
    if (el.type === 'checkbox') el.checked = !!settings[k]; else el.value = String(settings[k]);
    el.addEventListener('change', function () {
      settings[k] = el.type === 'checkbox' ? el.checked : el.value;
      save(SETTINGS_KEY, settings);
      applyStrategyRows();
      if (!lastStatus.botRunning) proof.setSettings({ settings: runtimeSettings() });
    });
  });
  applyStrategyRows();

  $('.login').addEventListener('click', function () {
    // Not noopener: the connect page posts the session back through window.opener.
    window.open(SITE + '/webapp-bot/connect', '_blank');
  });
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.origin !== SITE || !data || data.type !== 'avalisa-webapp-session') return;
    Promise.resolve(proof.adoptSession(data.token, data.user)).then(render);
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
  var lastResultKey = null;
  function isNetworkError(text) {
    return /abort|failed to fetch|network|timed? ?out|load failed/i.test(String(text || ''));
  }
  // Runtime readiness reasons are written for engineers; say them the way a trader would.
  function plainBlocker(text) {
    if (/WebSocket|tick stream/i.test(text)) return 'Connecting to Pocket Option prices — usually under 30 seconds.';
    if (/account mode not confirmed/i.test(text)) return 'Waiting to read whether Pocket Option is on Demo or Real.';
    return text;
  }
  function accountLabel(mode) { return mode === 'confirmed' ? 'Demo' : mode === 'real' ? 'Real' : 'Not read yet'; }

  function render() {
    var s;
    try { s = JSON.parse(proof.snapshot()); } catch (_) { return; }
    lastStatus = s;
    // A failed or in-flight licence check keeps the saved session (runtime only clears it on
    // sign-out), so a signed-in user must not be shown the sign-in card during one.
    var signedIn = s.authStatus === 'logged_in' || (!!s.userEmail && s.authStatus !== 'logged_out');
    var offline = s.authStatus === 'error' && isNetworkError(s.licenseReason || s.lastBotError || s.lastTradeStatus);
    var plan = String(s.licensePlan || 'free').toLowerCase();
    var allowance = s.tradesRemaining == null
      ? 'unlimited trades'
      : s.tradesRemaining + (s.tradesLimit ? '/' + s.tradesLimit : '') + ' trades left';
    $('.auth-out').hidden = signedIn;
    $('.auth-in').hidden = !signedIn;
    $('.free-note').textContent = s.authStatus === 'free_tier'
      ? 'Free demo: ' + allowance + ' on this phone. Sign in to use your Avalisa plan — your Avalisa account, never your Pocket Option password.'
      : 'Sign in to use your Avalisa plan — your Avalisa account, never your Pocket Option password.';
    if (signedIn) {
      $('.who').textContent = s.userEmail || 'Avalisa account';
      var badge = $('.plan');
      badge.textContent = plan;
      badge.className = 'av-plan-badge plan plan-' + plan;
    }

    dock.classList.toggle('running', !!s.botRunning);
    // Flash the outcome of each finished trade, once, the way the extension's status does.
    var resultKey = (s.tradesCount || 0) + ':' + s.lastResult;
    if (/^(win|loss|draw|tie)$/i.test(String(s.lastResult)) && resultKey !== lastResultKey && lastResultKey !== null) {
      var chip = $('.result'), r = String(s.lastResult).toLowerCase();
      chip.className = 'chip result';
      void chip.offsetWidth; // restart the pop animation
      chip.className = 'chip result show ' + (r === 'tie' ? 'draw' : r);
      chip.textContent = r === 'win' ? '▲ WIN' : r === 'loss' ? '▼ LOSS' : '■ DRAW';
    }
    lastResultKey = resultKey;
    var blockers = (s.webappReadiness && s.webappReadiness.blockers) || [];
    var status = $('.status');
    var message;
    if (s.botRunning) message = 'Running · ' + accountLabel(s.demoMode) + ' · ' + (s.lastTradeStatus || '');
    else if (s.pageState === 'login') message = 'Sign in to Pocket Option first. When the trading page opens, tap the Avalisa bookmark again.';
    else if (offline || isNetworkError(s.lastBotError || s.lastTradeStatus)) message = 'Could not reach the Avalisa server, so the bot stopped before trading. Check your connection and tap Retry.';
    else message = s.lastBotError || (blockers.length ? plainBlocker(blockers[0]) : (s.lastTradeStatus || 'Stopped'));
    status.textContent = 'Status: ' + message;
    var problem = !s.botRunning && (offline || s.lastBotError || blockers.length || s.pageState === 'login');
    status.className = 'av-status status' + (s.botRunning ? ' running' : problem ? ' error' : '');
    $('.plan-line').textContent = s.authStatus === 'error'
      ? 'Plan: not checked yet'
      : 'Plan: ' + plan.toUpperCase() + ' · ' + allowance;
    $('.trades').textContent = 'Trades this session: ' + (s.tradesCount || 0);

    // Start re-checks the licence itself, so after a network failure it doubles as Retry.
    $('.start').disabled = s.botRunning || !(s.licenseAllowed || offline) || !(s.demoMode === 'confirmed' || s.demoMode === 'real');
    $('.start').textContent = !s.botRunning && offline ? '↻ Retry' : '▶ Start';
    $('.stop').disabled = !s.botRunning;
    root.querySelectorAll('.settings [data-k]').forEach(function (el) { el.disabled = !!s.botRunning; });

    var rows = [
      ['Account', accountLabel(s.demoMode)], ['Pair', s.activePair], ['Candles', s.candleCount],
      ['Balance', s.balance], ['Payout', s.payout], ['Expiry', s.duration],
      ['Bot', s.botRunning ? (s.botMode + ' · step ' + s.martingaleStep) : 'stopped'],
      ['Next amount', s.nextAmount], ['Last result', s.lastResult], ['Layout', s.layoutHealth],
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
