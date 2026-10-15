import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Copy, Laptop, Monitor, Puzzle, Smartphone } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import '../styles/luxury.css';

const CHROME_EXTENSION_URL =
  import.meta.env.REACT_APP_CHROME_STORE_URL ||
  'https://chromewebstore.google.com/detail/avalisa-po-bot/mkcpdbnlofljijfjiglkodddicpgdapa';

// Avalisa runs *inside* the Pocket Option page — that is the only way it can read the
// chart and place a trade. So each platform needs a host that can load PO and run the
// bot in it. This page tells the visitor which host applies to the device in their hand
// instead of sending everyone to the signup form.
function detectPlatform() {
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

// Pocket Option's mobile site, opened on the demo account. The bot itself refuses to
// trade until it can read Demo or Real from the page.
const PO_MOBILE_URL = 'https://m.po.trade/en/cabinet/demo-quick-high-low/';

// The bookmark the phone runs. It only adds our loader to the page that is open; the
// loader refuses to do anything off Pocket Option.
export function bookmarkCode(origin) {
  return (
    "javascript:(function(){var s=document.createElement('script');" +
    `s.src='${origin}/webapp-bot/loader.js?t='+Date.now();` +
    'document.body.appendChild(s);})();void 0'
  );
}

const PHONE_STEPS = {
  // Walked on a real iPhone (Safari, Oct 2026): Share has no Add Bookmark, the address
  // can only be edited from the Bookmarks list, and Safari never suggests a javascript:
  // bookmark when you type its name — so iPhone users run it from the Bookmarks tab.
  ios: [
    ['Save a bookmark', 'Tap Copy bookmark code above. Then tap ≡ at the left of Safari\'s address bar, choose Add Bookmark to…, name it Avalisa and tap Save.'],
    ['Put the code in it', 'Tap the address bar, then the book icon (Bookmarks). Press and hold Avalisa, tap Edit, clear the address, paste the code and tap Save.'],
    ['Open Pocket Option', 'Use the Open Pocket Option button, sign in to Pocket Option and stay on the Demo account for your first run.'],
    ['Tap Avalisa on the trading page', 'On the Pocket Option trading page, tap the address bar, then the book icon, then Avalisa. The Avalisa panel opens at the bottom of the screen — sign in there with your Avalisa account and press Start. If Pocket Option reloads, tap it again; the bot picks up where it was.'],
  ],
  android: [
    ['Save the Avalisa bookmark', 'Tap Copy bookmark code above. In Chrome tap ⋮ then the star to bookmark this page, tap Edit, name it Avalisa, clear the URL and paste the code.'],
    ['Open Pocket Option', 'Use the Open Pocket Option button, sign in to Pocket Option and stay on the Demo account for your first run.'],
    ['Type Avalisa in the address bar', 'On the Pocket Option page, tap the address bar, type Avalisa and tap the bookmark in the suggestions (Chrome only runs it from there). The Avalisa panel opens at the bottom — sign in with your Avalisa account and press Start. If Pocket Option reloads, run the bookmark again; the bot picks up where it was.'],
  ],
};

function PhoneSetup({ platform }) {
  const [copied, setCopied] = useState(false);
  const code = bookmarkCode(typeof window === 'undefined' ? 'https://avalisabot.vercel.app' : window.location.origin);
  const steps = PHONE_STEPS[platform === 'android' ? 'android' : 'ios'];

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch (_) {
      // Clipboard can be refused (older iOS, private tabs); the code is shown below to copy by hand.
      setCopied(false);
      window.prompt('Copy this bookmark code:', code);
    }
  }

  return (
    <>
      <div className="lux-webapp-actions">
        <button type="button" className="avalisa-button avalisa-button--gold" onClick={copy}>
          {copied ? 'Copied' : 'Copy bookmark code'} {copied ? <Check size={17} /> : <Copy size={17} />}
        </button>
        <a className="avalisa-button avalisa-button--dark" href={PO_MOBILE_URL} target="_blank" rel="noreferrer">
          Open Pocket Option <ArrowRight size={17} />
        </a>
      </div>
      <ol className="lux-webapp-steps lux-webapp-steps--phone">
        {steps.map(([title, text], i) => (
          <li key={title}>
            <span className="lux-webapp-steps__mark">{i + 1}</span>
            <div>
              <strong>{title}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

const COPY = {
  'desktop-chromium': {
    icon: Monitor,
    label: 'Desktop browser',
    status: 'ready',
    headline: 'Your device is ready.',
    body: 'The Chrome extension runs Avalisa directly inside Pocket Option. Install it, open Pocket Option, and the Avalisa panel appears on the trading page.',
  },
  'desktop-other': {
    icon: Laptop,
    label: 'Desktop browser',
    status: 'needs-chrome',
    headline: 'Use a Chromium browser.',
    body: 'Avalisa runs as a browser extension on desktop. Chrome, Brave, or Edge will work — this browser will not load the extension.',
  },
  ios: {
    icon: Smartphone,
    label: 'iPhone',
    status: 'phone',
    headline: 'Run Avalisa in Safari.',
    body: 'Avalisa has to run inside the Pocket Option page, so on a phone it comes in through a bookmark: open Pocket Option in Safari, tap the Avalisa bookmark, and the bot panel opens at the bottom of the trading page. Nothing to install.',
  },
  ipados: {
    icon: Smartphone,
    label: 'iPad',
    status: 'phone',
    headline: 'Run Avalisa in Safari.',
    body: 'Avalisa has to run inside the Pocket Option page, so on a tablet it comes in through a bookmark: open Pocket Option in Safari, tap the Avalisa bookmark, and the bot panel opens on the trading page. Nothing to install.',
  },
  android: {
    icon: Smartphone,
    label: 'Android',
    status: 'phone',
    headline: 'Run Avalisa in Chrome.',
    body: 'Avalisa has to run inside the Pocket Option page, so on a phone it comes in through a bookmark: open Pocket Option in Chrome, tap the Avalisa bookmark, and the bot panel opens at the bottom of the trading page. Nothing to install.',
  },
  unknown: {
    icon: Laptop,
    label: 'Your device',
    status: 'needs-chrome',
    headline: 'Open this on desktop Chrome.',
    body: 'Avalisa runs as a browser extension on desktop, inside the Pocket Option page.',
  },
};

export default function Webapp() {
  const { user } = useAuth();
  const platform = useMemo(detectPlatform, []);
  const info = COPY[platform] || COPY.unknown;
  const Icon = info.icon;
  const ready = info.status === 'ready';

  return (
    <main className="lux-webapp-page">
      <section className="lux-webapp-shell">
        <p className="lux-kicker">Bot access</p>
        <h1>Run Avalisa on this device.</h1>
        <p className="lux-webapp-intro">
          Avalisa works by running inside the Pocket Option trading page itself. Each device
          needs a host that can open Pocket Option and run the bot in it.
        </p>

        <article className={`lux-webapp-card is-${info.status}`}>
          <header>
            <Icon size={20} />
            <div>
              <strong>{info.label}</strong>
              <span>{info.headline}</span>
            </div>
          </header>
          <p>{info.body}</p>

          {info.status === 'phone' ? (
            <PhoneSetup platform={platform} />
          ) : ready ? (
            <a
              className="avalisa-button avalisa-button--gold"
              href={CHROME_EXTENSION_URL}
              target="_blank"
              rel="noreferrer"
            >
              Install the extension <Puzzle size={17} />
            </a>
          ) : (
            <a
              className="avalisa-button avalisa-button--dark"
              href={CHROME_EXTENSION_URL}
              target="_blank"
              rel="noreferrer"
            >
              Get the desktop extension <ArrowRight size={17} />
            </a>
          )}
        </article>

        {info.status !== 'phone' && (
          <p className="lux-webapp-intro lux-webapp-phone-hint">
            On a phone? Open <strong>avalisabot.vercel.app/webapp</strong> in your phone&apos;s
            browser to set up the phone version.
          </p>
        )}

        {/* Two separate sign-ins, and people conflate them: the Avalisa account gates
            the bot's licence, the Pocket Option account is the broker the bot trades on.
            Show both as steps so nobody sits on a login screen wondering which is which. */}
        <ol className="lux-webapp-steps">
          <li className={user ? 'is-done' : ''}>
            <span className="lux-webapp-steps__mark">{user ? <Check size={15} /> : '1'}</span>
            <div>
              <strong>Avalisa account</strong>
              {user ? (
                <p>
                  Signed in as {user.email}. Your plan and trade allowance are checked each
                  time the bot runs — manage them in the <Link to="/dashboard">dashboard</Link>.
                </p>
              ) : (
                <p>
                  <Link to="/login?next=/webapp">Sign in</Link> or{' '}
                  <Link to="/register">create an account</Link> — this is the licence the bot
                  checks before it can run. You will come straight back here.
                </p>
              )}
            </div>
          </li>
          <li>
            <span className="lux-webapp-steps__mark">2</span>
            <div>
              <strong>Pocket Option account</strong>
              <p>
                Separate from your Avalisa account. You sign in to Pocket Option itself, in
                the same window the bot runs in — Avalisa never sees those credentials.
              </p>
            </div>
          </li>
        </ol>

        <p className="lux-risk-note">
          Start in demo mode. Trading involves risk and Avalisa does not guarantee profits.
        </p>
      </section>
    </main>
  );
}
