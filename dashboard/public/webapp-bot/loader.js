/* Avalisa Webapp Bot loader — what the "Avalisa" bookmark runs on a phone.
 *
 * It must run on the Pocket Option page itself: the bot reads PO's chart and presses
 * PO's own trade buttons, and a page on avalisabot.vercel.app is not allowed to do that
 * to another site. The bookmark adds this file to the PO page the user already has open.
 */
(function () {
  var script = document.currentScript;
  var base = script && script.src ? script.src.replace(/[^/]*$/, '') : 'https://avalisabot.vercel.app/webapp-bot/';
  var version = '9';

  if (!/(^|\.)(po\.trade|po\.cash|pocketoption\.com)$/i.test(location.hostname)) {
    if (window.confirm('Avalisa runs on the Pocket Option page. Open Pocket Option now, then tap the Avalisa bookmark again.')) {
      location.href = 'https://m.po.trade/en/cabinet/demo-quick-high-low/';
    }
    return;
  }
  if (window.AvalisaWebappPanel) { window.AvalisaWebappPanel.open(); return; }
  // The panel sends sign-in to this same site and only accepts the session back from it.
  window.__AVALISA_WEBAPP_ORIGIN = base.replace(/^(https?:\/\/[^/]+).*$/, '$1');

  function add(name, next) {
    var el = document.createElement('script');
    el.src = base + name + '?v=' + version;
    el.onload = next || null;
    el.onerror = function () { window.alert('Avalisa could not load. Check your connection and tap the bookmark again.'); };
    (document.head || document.documentElement).appendChild(el);
  }
  add('runtime.js', function () { add('panel.js'); });
})();
