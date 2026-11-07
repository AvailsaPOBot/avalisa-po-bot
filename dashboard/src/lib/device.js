import { useEffect, useState } from 'react';

// One shared definition of "this visitor is on a phone", so no page hard-codes its own
// user-agent check. Phone-like = a narrow viewport OR a mobile user agent. Everything here
// is SSR / test safe: with no window (or no matchMedia) it answers "not a phone", which is
// the desktop behaviour.
export const PHONE_MEDIA_QUERY = '(max-width: 767px)';
export const MOBILE_UA_PATTERN = /iPhone|Android|iPad|Mobile/i;

// In-app browsers (social-app WebViews). They have no Safari / Chrome bookmark menu and
// block javascript: bookmarks, so /webapp cannot work inside them.
const IN_APP_BROWSER_PATTERNS = [
  ['Instagram', /Instagram/i],
  ['Facebook', /FBAN|FBAV|FBIOS/],
  ['TikTok', /BytedanceWebview|musical_ly|TikTok/i],
  ['Line', /\bLine\//],
  ['Telegram', /Telegram/i],
  ['Android WebView', /Android.*; wv\)/],
];

function currentUserAgent() {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
}

export function isPhoneLike() {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof window.matchMedia === 'function' && window.matchMedia(PHONE_MEDIA_QUERY)?.matches) return true;
  } catch (_) {
    // A broken matchMedia must never break a page; fall through to the UA check.
  }
  return MOBILE_UA_PATTERN.test(currentUserAgent());
}

// Name of the in-app browser the page is open in, or null for a normal browser.
export function detectInAppBrowser(userAgent = currentUserAgent()) {
  const ua = userAgent || '';
  const hit = IN_APP_BROWSER_PATTERNS.find(([, pattern]) => pattern.test(ua));
  return hit ? hit[0] : null;
}

// React flavour of isPhoneLike() that follows the viewport (rotation, resizing).
export function usePhoneLike() {
  const [phone, setPhone] = useState(isPhoneLike);

  useEffect(() => {
    const update = () => setPhone(isPhoneLike());
    update();
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(PHONE_MEDIA_QUERY);
    if (!query) return undefined;
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', update);
      return () => query.removeEventListener?.('change', update);
    }
    if (typeof query.addListener === 'function') {
      query.addListener(update);
      return () => query.removeListener?.(update);
    }
    return undefined;
  }, []);

  return phone;
}
