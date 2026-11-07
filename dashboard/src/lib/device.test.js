import { detectInAppBrowser, isPhoneLike, MOBILE_UA_PATTERN, PHONE_MEDIA_QUERY } from './device';

const REAL_MATCH_MEDIA = window.matchMedia;
const REAL_UA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

function setUserAgent(value) {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

function setViewportMatches(matches) {
  window.matchMedia = vi.fn((query) => ({ matches: query === PHONE_MEDIA_QUERY ? matches : false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.matchMedia = REAL_MATCH_MEDIA;
  if (REAL_UA) Object.defineProperty(window.navigator, 'userAgent', REAL_UA);
  else delete window.navigator.userAgent;
});

describe('isPhoneLike', () => {
  test('is false on a desktop viewport with a desktop user agent', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36');
    setViewportMatches(false);
    expect(isPhoneLike()).toBe(false);
  });

  test('is true for a narrow viewport (max-width: 767px)', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36');
    setViewportMatches(true);
    expect(isPhoneLike()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });

  test.each([
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'],
    ['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36'],
    ['iPad', 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'],
    ['generic Mobile', 'Mozilla/5.0 (Windows Phone 10.0) Mobile Safari/537.36'],
  ])('is true for a %s user agent on a wide viewport', (_name, ua) => {
    setUserAgent(ua);
    setViewportMatches(false);
    expect(isPhoneLike()).toBe(true);
  });

  test('falls back to the user agent when matchMedia is missing or throws', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) Mobile');
    window.matchMedia = undefined;
    expect(isPhoneLike()).toBe(true);
    window.matchMedia = () => { throw new Error('boom'); };
    expect(isPhoneLike()).toBe(true);
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0');
    expect(isPhoneLike()).toBe(false);
  });

  test('is SSR safe: no window means desktop behaviour', () => {
    vi.stubGlobal('window', undefined);
    expect(isPhoneLike()).toBe(false);
  });

  test('the UA pattern is the one the CEO specified', () => {
    expect(MOBILE_UA_PATTERN.source).toBe('iPhone|Android|iPad|Mobile');
  });
});

describe('detectInAppBrowser', () => {
  test.each([
    ['Instagram', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 330.0.0.20.113'],
    ['Facebook', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0;]'],
    ['Facebook', 'Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/440.0]'],
    ['TikTok', 'Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari/537.36 BytedanceWebview/d8a21c6'],
    ['TikTok', 'Mozilla/5.0 (iPhone) Mobile/15E148 musical_ly_33.1.0'],
    ['Line', 'Mozilla/5.0 (iPhone) Mobile/15E148 Safari Line/13.9.0'],
    ['Telegram', 'Mozilla/5.0 (Linux; Android 13) Telegram-Android/10.0'],
    ['Android WebView', 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 Version/4.0 Chrome/120 Mobile Safari/537.36'],
  ])('flags %s', (name, ua) => {
    expect(detectInAppBrowser(ua)).toBe(name);
  });

  test('leaves real Safari and Chrome alone', () => {
    expect(detectInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1')).toBeNull();
    expect(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36')).toBeNull();
    expect(detectInAppBrowser('')).toBeNull();
  });
});
