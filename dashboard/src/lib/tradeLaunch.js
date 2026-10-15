// Where the "Trade" button takes a signed-in user.
//
// Avalisa runs *inside* the Pocket Option page — that is the only way it can read the
// chart and place a trade. So each platform needs a host that can load PO and run the
// bot in it:
//   - desktop Chrome / Edge / Brave → Pocket Option itself, where the extension's panel
//     appears on the trading page;
//   - any phone or tablet → /webapp, which sets up and runs the phone Webapp Bot;
//   - other desktop browsers (Safari, Firefox) → /webapp, which says to use Chrome.
//     A web page cannot open another browser, so that is the honest best.

export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent || '';
  const touchMac = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  if (/iPhone|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  // iPadOS reports itself as a Mac; the touch-point check is the only reliable tell,
  // so it must run after the explicit mobile UAs or it swallows them.
  if (/iPad/i.test(ua) || touchMac) return 'ipados';
  const isChromium = /Chrome|Chromium|Edg\//i.test(ua) && !/OPR|SamsungBrowser/i.test(ua);
  return isChromium ? 'desktop-chromium' : 'desktop-other';
}

// Pocket Option's trading page on the demo account; the extension matches pocketoption.com.
export const PO_DESKTOP_TRADE_URL = 'https://pocketoption.com/en/cabinet/demo-quick-high-low/';

export function tradeTarget(platform = detectPlatform()) {
  if (platform === 'desktop-chromium') {
    return { href: PO_DESKTOP_TRADE_URL, external: true, hint: 'Opens Pocket Option — the Avalisa panel appears on the trading page.' };
  }
  if (platform === 'ios' || platform === 'ipados' || platform === 'android') {
    return { href: '/webapp', external: false, hint: 'Opens the Webapp Bot for your phone.' };
  }
  return { href: '/webapp', external: false, hint: 'Avalisa runs in Chrome on a computer.' };
}
