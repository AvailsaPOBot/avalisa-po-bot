import { useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import '../styles/luxury.css';
import '../styles/landing-v3.css';
import '../styles/pages-v3.css';
import PageHead, { PageLabel } from '../components/v3/PageHead';

const STORE_URL =
  'https://chromewebstore.google.com/detail/avalisa-po-bot/mkcpdbnlofljijfjiglkodddicpgdapa';

// Every number and label on this page is taken from the shipped extension, not from marketing
// copy: panel labels from overlayView.js, defaults from state.js getDefaultSettings(), the
// candle gate from state.js REQUIRED_CANDLES_BY_INTENSITY, the rule gate from signalEngine.js
// RULES_REQUIRED, and the plan limits from backend/src/lib/plans.js PLAN_ENTITLEMENTS.
// If any of those change, this page is wrong and must change with them.
// #137 — the question a doubting buyer actually asks, answerable without an email.
// A paying Pro customer sent us his PO ID and waited 13 days for this exact lookup;
// the route already existed and nothing on the web let a human call it.
// Entitlement only: POST /api/license/po-entitlement returns plan + allowance and
// never a token, email, id or history (guarded by backend/test/poEntitlement.test.js),
// so this box cannot leak anyone's personal data and cannot sign anybody in.
const PLAN_LABELS = { lifetime: 'Pro', basic: 'Basic' };

const STATIC_GUIDES = [
  { href: '/guide/bankroll-rules-automation.html', title: 'Bankroll Rules for Automated Binary-Options Trading' },
  { href: '/guide/basic-vs-pro.html', title: 'Basic vs Pro: Which Avalisa PO Bot Plan Fits How You Trade' },
  { href: '/guide/pricing-questions.html', title: 'Avalisa PO Bot pricing questions answered' },
  { href: '/guide/do-i-need-to-deposit.html', title: 'Do I Need to Deposit Money to Use Avalisa PO Bot?' },
  { href: '/guide/best-pocket-option-bot-settings.html', title: 'Best Pocket Option Bot Settings: What We Measured and Where to Start' },
  { href: '/guide/best-timeframe-for-pocket-option-automation.html', title: 'Best Timeframe for Pocket Option Automation: 1-Minute vs 5-Minute' },
  { href: '/guide/binary-options-vs-forex-automation.html', title: 'Automating Binary Options vs Forex: Why the Maths Is Not the Same' },
  { href: '/guide/bot-not-placing-trades.html', title: 'Avalisa PO Bot Not Placing Trades? A Six-Check Troubleshooting Guide' },
  { href: '/guide/browser-extension-vs-telegram-bots.html', title: 'Chrome Extension Bots vs. Telegram Signal Bots: How Each One Actually Works' },
  { href: '/guide/buying-a-pocket-option-bot-from-a-seller.html', title: 'Buying a Pocket Option Bot From a Freelancer or Seller: Questions to Ask First' },
  { href: '/guide/can-chatgpt-write-a-binary-options-bot.html', title: 'Can ChatGPT Write a Binary Options Bot? What It Gets Wrong' },
  { href: '/guide/can-you-get-banned-for-using-a-bot.html', title: 'Can Your Pocket Option Account Be Banned for Using a Bot?' },
  { href: '/guide/can-you-withdraw-funds-after-bot-trading.html', title: 'Pocket Option Withdrawals: Does Using a Trading Bot Affect Them?' },
  { href: '/guide/check-a-chrome-web-store-trading-bot-listing.html', title: 'How to Check a Pocket Option Bot Listing on the Chrome Web Store' },
  { href: '/guide/does-pocket-option-allow-bots-account-safety.html', title: 'Does Pocket Option Allow Trading Bots? Platform Rules and Account Safety, Explained' },
  { href: '/guide/execution-delay-in-a-browser-trading-bot.html', title: 'Execution Delay in a Browser Trading Bot: What It Is and When It Matters' },
  { href: '/guide/free-pro-with-new-account.html', title: 'Free Pro Access When You Open a New Pocket Option Account Through Our Link' },
  { href: '/guide/github-python-bots-vs-chrome-extension.html', title: 'Pocket Option Bots on GitHub and Python Scripts vs a Chrome Extension' },
  { href: '/guide/honest-win-rate-break-even.html', title: 'Do Pocket Option Bots Make Money? Win Rate, Payout and the 52.1% Break-Even' },
  { href: '/guide/how-browser-extensions-automate-trading.html', title: 'How a Chrome Extension Automates Pocket Option Trading' },
  { href: '/guide/how-to-choose-a-pocket-option-bot.html', title: 'How to Choose a Pocket Option Bot: A Checklist That Filters Out the Junk' },
  { href: '/guide/how-to-install-avalisa-po-bot.html', title: 'How to Install Avalisa PO Bot on Chrome and Connect It to Pocket Option (Step by Step)' },
  { href: '/guide/how-to-read-binary-options-bot-reviews.html', title: 'How to Read Binary Options Bot Reviews and Reddit Threads' },
  { href: '/guide/how-to-stop-or-remove-the-bot-safely.html', title: 'How to Stop, Disable or Uninstall Avalisa PO Bot Safely' },
  { href: '/guide/is-a-pocket-option-bot-safe-or-scam.html', title: 'Is a Pocket Option Bot Safe or a Scam? Eight Things to Check' },
  { href: '/guide/is-there-a-free-pocket-option-bot.html', title: 'Is There a Free Pocket Option Bot? What Is Free and What Costs Money' },
  { href: '/guide/is-there-a-pocket-option-bot-app-or-apk.html', title: 'Is There a Pocket Option Bot App or APK? How to Run Avalisa on a Phone' },
  { href: '/guide/is-there-an-official-pocket-option-bot.html', title: 'Is There an Official Pocket Option Bot?' },
  { href: '/guide/making-your-own-pocket-option-bot.html', title: 'Making Your Own Pocket Option Bot: What It Actually Takes' },
  { href: '/guide/martingale-bots-mt5-crypto-pocket-option.html', title: "Martingale Bots on MT5, Crypto and Pocket Option: What Changes and What Doesn't" },
  { href: '/guide/martingale-calculator.html', title: 'Pocket Option Martingale Calculator: Stake and Worst-Case Cost per Step' },
  { href: '/guide/martingale-risk-explained.html', title: 'Martingale Explained: Why It Can Wipe Out a Balance, and How to Set Limits' },
  { href: '/guide/named-pocket-option-bots-lyra-neuro-gemini.html', title: 'Lyra, Neuro, Gemini: What Named Pocket Option Bots Really Are' },
  { href: '/guide/payout-percentage-filter-importance.html', title: 'Why a Payout-Percentage Filter Matters for Automated Trading Math' },
  { href: '/guide/pocket-option-bot-demo-setups.html', title: 'Three Pocket Option Bot Setups to Test on a Demo Account' },
  { href: '/guide/pocket-option-bot-on-github-checklist.html', title: 'Found a Pocket Option Bot on GitHub? A Checklist Before You Run It' },
  { href: '/guide/pocket-option-bot-otc-trading-guide.html', title: 'Automating OTC Markets on Pocket Option: Weekend Trading Guide' },
  { href: '/guide/pocket-option-bot-pc-exe-vs-extension.html', title: 'Pocket Option Bots for PC: .exe Programs vs a Browser Extension' },
  { href: '/guide/pocket-option-candle-streak-pin-bar.html', title: 'Candle Streak and Pin-Bar Strategies: What They Assume' },
  { href: '/guide/pocket-option-copy-trading-vs-bot.html', title: 'Pocket Option Copy Trading vs a Rules-Based Bot' },
  { href: '/guide/pocket-option-demo-to-real-account.html', title: 'Pocket Option Demo to Real Account: Moving a Bot to Live' },
  { href: '/guide/pocket-option-insider-bot-offers.html', title: 'Pocket Option "Insider Bot" Offers: Telegram, APK and Free-Download Warning Signs' },
  { href: '/guide/pocket-option-signal-and-prediction-bots.html', title: 'Pocket Option Signal and Prediction Bots: How a Signal Becomes a Trade' },
  { href: '/guide/rsi-macd-stochastic-plain-english.html', title: 'RSI, MACD and Stochastic in Plain English (and Which One Avalisa Uses)' },
  { href: '/guide/settings-guide.html', title: 'Avalisa PO Bot Settings Guide: Timeframe, Starting Amount and Martingale Steps' },
  { href: '/guide/test-a-trading-bot-on-demo.html', title: 'How to Test a Trading Bot on a Demo Account Before Risking Money' },
  { href: '/guide/trading-journal-for-bot-sessions.html', title: 'Trading Journal for Bot Sessions: What to Record' },
  { href: '/guide/trading-without-martingale-flat-staking.html', title: 'Trading Without Martingale: Flat Staking vs Martingale' },
  { href: '/guide/what-a-live-pocket-option-bot-means.html', title: 'What a "Live" Pocket Option Bot Means: Live Account vs a Running Session' },
  { href: '/guide/what-ai-in-a-trading-bot-actually-means.html', title: 'How automated trading systems use signal rules' },
  { href: '/guide/what-automation-cannot-do.html', title: 'What a Trading Bot Can and Cannot Do for You' },
  { href: '/guide/what-is-a-binary-options-bot.html', title: 'What a Binary Options Bot Is (and What One Can and Cannot Do)' },
  { href: '/guide/when-to-stop-automated-trading-session.html', title: 'When to Stop: Setting an End Point for an Automated Trading Session' },
  { href: '/guide/why-a-bot-trades-one-at-a-time.html', title: 'Why a Pocket Option Bot Should Hold One Trade at a Time' },
  { href: '/guide/why-bots-win-on-demo-and-lose-on-real.html', title: 'Why a Trading Bot Can Win on Demo and Struggle on a Real Account' },
  { href: '/guide/why-the-trading-tab-must-stay-open.html', title: 'Why the Pocket Option Tab Must Stay Open and Visible While the Bot Runs' },
];

function LicenceCheck() {
  const [uid, setUid] = useState('');
  const [result, setResult] = useState({ status: 'idle' });

  async function check(event) {
    event.preventDefault();
    const trimmed = uid.trim();
    // Mirror the server's own validator rather than inventing a looser one.
    if (!/^\d{3,20}$/.test(trimmed)) {
      setResult({ status: 'invalid' });
      return;
    }
    setResult({ status: 'loading' });
    try {
      const res = await fetch(`${API_BASE}/api/license/po-entitlement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poUid: trimmed }),
      });
      if (!res.ok) {
        setResult({ status: 'invalid' });
        return;
      }
      const data = await res.json();
      setResult({ status: 'done', linked: Boolean(data.linked), plan: data.plan });
    } catch (_) {
      // Never render a failed lookup as "you have no licence" — that is the same
      // false negative that told a paying customer his purchase was gone.
      setResult({ status: 'unreachable' });
    }
  }

  const label = result.status === 'done' ? PLAN_LABELS[result.plan] : null;
  const paid = result.status === 'done' && result.linked && Boolean(label);

  return (
    <section className="v3p-sec v3p-licence">
      <div className="v3-wrap">
        <div className="v3-glass v3p-licence__panel">
          <div className="v3p-licence__head">
            <p className="v3-hud v3-gold">Licence lookup</p>
            <h2 id="licence-check-title">Already bought? Check your Pocket Option ID</h2>
            <p>
              If you have paid and the bot still looks locked, check here before buying anything a
              second time. Enter the numeric account ID shown on your Pocket Option profile.
            </p>
          </div>
          <div className="v3p-licence__body">
            <form className="v3p-licence__form" onSubmit={check}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={uid}
                onChange={e => setUid(e.target.value)}
                aria-label="Pocket Option ID"
                placeholder="e.g. 5131350"
              />
              <button className="v3-btn" type="submit" disabled={result.status === 'loading'}>
                {result.status === 'loading' ? 'Checking…' : 'Check'}
              </button>
            </form>

            <div className="v3p-licence__result" aria-live="polite">
              {result.status === 'invalid' && (
                <p className="is-warn">Enter the numeric Pocket Option account ID — digits only, no email address.</p>
              )}
              {result.status === 'unreachable' && (
                <p className="is-warn">
                  We could not reach our server just now, so this is not an answer either way. Please
                  try again in a moment, or email us and we will check it by hand.
                </p>
              )}
              {paid && (
                <p className="is-ok">
                  <strong>That account already has {label}.</strong> You do not need to buy anything.
                  Open Chrome&apos;s extensions page and press Update so you are on the current version,
                  then open Pocket Option signed in to this account — the panel unlocks on its own.
                  Automatic unlocking arrived in August, so an older copy of the extension cannot see it.
                  If it still looks locked, email us and say what the panel status line reads.
                </p>
              )}
              {result.status === 'done' && !paid && (
                <p className="is-gold">
                  We have no paid licence linked to that ID. If you have paid for Avalisa, email{' '}
                  <a href="mailto:avalisapobot@gmail.com">avalisapobot@gmail.com</a> with that ID and we
                  will sort it out — do not buy a second time. Otherwise the free demo needs no payment,
                  and the plans are on the <Link to="/pricing">pricing page</Link>. Free Pro is only for a
                  NEW Pocket Option account registered through our link, then linked in your dashboard.
                </p>
              )}
            </div>
            <p className="v3p-licence__fine">
              This only reports whether a licence is attached to that ID. It shows no personal details,
              and it does not sign you in to anything.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Guide() {
  const [setupMode, setSetupMode] = useState('desktop');
  const sections = [
    {
      title: 'Install and sign in',
      content: [
        {
          subtitle: 'Add the extension',
          text: 'Install Avalisa PO Bot from the Chrome Web Store. It runs in your own browser on the Pocket Option page — there is nothing to download and nothing to install on your computer.',
        },
        {
          subtitle: 'Create an Avalisa account',
          text: 'Open the panel and register with an email and password. This is an Avalisa account for your licence and settings sync. It is not your Pocket Option login, and the two are unrelated.',
        },
        {
          subtitle: 'Your Pocket Option password is never involved',
          text: 'Avalisa never asks for, types, or stores your Pocket Option password. It works inside the page you are already signed in to, the same way you would click the buttons yourself.',
        },
      ],
    },
    {
      title: 'Your first run — use the demo balance',
      content: [
        {
          subtitle: 'Switch Pocket Option to its demo balance first',
          text: 'Do this before you press Start. Pocket Option\'s demo balance is not real money, so you can watch exactly what the bot does with no financial risk. The bot places trades the same way on demo and on real; only the balance differs. The free Demo plan includes 10 trades, so the bot stops after the tenth — that is the trial limit, not a fault.',
        },
        {
          subtitle: 'Open a pair, then open the Avalisa panel',
          text: 'The panel appears on the Pocket Option trading page. It reads the chart and the trade controls that are already on screen.',
        },
        {
          subtitle: 'Set a step limit, press Start, and watch one full cycle',
          text: 'Martingale Steps defaults to Infinite, so set a limit before your first Start (see Martingale Steps below). Then let it place a few trades before you change anything. Press "Stop bot" at any time — it halts immediately and places nothing further.',
        },
      ],
    },
    {
      title: 'Every setting, explained',
      content: [
        {
          subtitle: 'Strategy — Martingale or Avalisa Bot',
          text: 'Martingale places trades and increases the amount after a loss. Avalisa Bot instead waits for its own rule-based signals from live price data before entering. Martingale is the default and is available on every plan; Avalisa Bot mode requires Pro.',
        },
        {
          subtitle: 'Start Amount ($) — default $1.00',
          text: 'The first trade of every sequence. This is the number that matters most: with a 2.0x multiplier, a sequence that loses several trades in a row grows from this figure very quickly. Start small.',
        },
        {
          subtitle: 'Martingale × — default 2.0x, up to 3.0x',
          text: 'How much the amount is multiplied after a loss. Higher recovers a loss in fewer steps and grows the exposure faster. 2.0x is the default for a reason.',
        },
        {
          subtitle: 'Martingale Steps — default Infinite, and you should change it',
          text: 'How many times in a row the amount is allowed to escalate before the sequence resets. The default is Infinite, which puts no ceiling on how far a losing run can go. Setting 10 or 12 caps the worst case. We recommend choosing a limit rather than leaving it Infinite.',
        },
        {
          subtitle: 'Direction — Alternating, Always Buy, or Always Sell',
          text: 'Alternating (the default) switches between buy and sell. Always Buy and Always Sell hold one direction.',
        },
        {
          subtitle: 'Timeframe — 30s, 1min, 3min, 5min',
          text: 'The expiry of each trade placed. The default is 1min.',
        },
        {
          subtitle: 'Minimum payout % and Pair Scan',
          text: 'Pair Scan set to "Auto scan favorites" rotates through your Pocket Option favourites and takes the ones meeting your minimum payout; "Current pair only" never leaves the pair you are on.',
        },
      ],
    },
    {
      title: 'Avalisa Bot mode, and why it says "Loading"',
      content: [
        {
          subtitle: 'Intensity is an agreement threshold',
          text: 'Avalisa Bot evaluates four independent rules against live price data. Intensity sets how many of the four must agree before it will enter: Low needs 2 of 4, Mid needs 3 of 4, High needs all 4. Higher intensity means fewer trades, not better ones.',
        },
        {
          subtitle: 'It also needs enough price history',
          text: 'Before it will evaluate anything it needs a minimum number of candles: 12 on Low, 16 on Mid, 20 on High. Until it has them the status reads "Loading: 8/16 (mid)" — that is the bot refusing to act on insufficient data, not a fault.',
        },
        {
          subtitle: 'Why it can take a minute after switching pairs',
          text: 'Pocket Option only sends roughly eleven minutes of price history at a time, and it cannot be asked for more. Each new pair therefore has to build its buffer up from live prices. "Waiting for pair data..." then "Loading: n/16" then "Ready" is the normal sequence.',
        },
      ],
    },
    {
      title: 'What the status messages mean',
      content: [
        {
          subtitle: '"Avalisa stopped safely — Pocket Option changed or page error"',
          text: 'Pocket Option changed something on the page that the bot depends on, so it stopped instead of guessing. Reload the page and press Start again. It stops rather than continuing blind, on purpose.',
        },
        {
          subtitle: '"Server offline. Try again in 1 min."',
          text: 'Our licence server did not answer. Your trades and settings are unaffected; wait a moment and press Start again.',
        },
        {
          subtitle: '"Trades: 7 / 10 demo"',
          text: 'You are on the free demo, which includes 10 trades in total. See the next section.',
        },
      ],
    },
    {
      title: 'Free demo versus paid plans',
      content: [
        {
          subtitle: 'Free demo — 10 trades, no payment and no card',
          text: 'The free demo includes 10 trades of Martingale mode so you can see the bot work on your own account before paying anything. Avalisa Bot mode is not included in the demo.',
        },
        {
          subtitle: 'Basic — $69 one-time',
          text: 'Unlimited Martingale trading and cloud settings sync. A one-time purchase, not a subscription.',
        },
        {
          subtitle: 'Pro — $119 one-time, or $29 per month',
          text: 'Everything in Basic plus Avalisa Bot mode. Both options are offered at checkout: $119 one-time, or $29/month, which is a recurring subscription that renews every month until you cancel it.',
        },
      ],
    },
    {
      title: 'Common questions',
      content: [
        {
          subtitle: 'Will this make me money?',
          text: 'No. It automates the strategy and the settings you choose. It does not predict the market, and no automated strategy removes risk. A Martingale sequence can lose several trades in a row.',
        },
        {
          subtitle: 'How does free Pro through Pocket Option work?',
          text: 'It is only for a new Pocket Option account registered through our link. Then submit that account’s numeric ID in Avalisa Dashboard → Settings. If Pocket Option’s partner system has confirmed the referral, Pro unlocks immediately; otherwise the request is queued for admin verification. This Pro grant does not expire.',
        },
        {
          subtitle: 'Can I leave it running unattended?',
          text: 'We do not recommend it. Start on a demo balance and watch it; if you later use a real balance, keep watching and use a step limit rather than Infinite.',
        },
        {
          subtitle: 'Does it work on the Pocket Option mobile app?',
          text: 'Not inside the app. On a computer Avalisa is a Chrome extension; on an iPhone or Android phone it runs on the Pocket Option website in your browser, through the free bookmark from the phone setup page at /webapp.',
        },
        {
          subtitle: 'Is my licence tied to one computer?',
          text: 'No. Sign in with your Avalisa account on another Chrome browser and your licence and settings follow you.',
        },
        {
          subtitle: 'Something is not working',
          text: 'Email us and include what the panel status line said. That one line usually identifies the problem immediately.',
        },
      ],
      contact: true,
    },
  ];

  const exposureRows = [[1, 2, '3×'], [2, 3, '7×'], [3, 4, '15×'], [4, 5, '31×'], [5, 6, '63×'], [6, 7, '127×']];

  return (
    <main className="v3 v3p v3p-guide">
      <PageHead
        id="guide-title"
        eyebrow="Setup guide · Phone · Desktop Chrome"
        title={<>How to set up <em>Avalisa</em> PO Bot</>}
        aside={(
          <aside className="v3-glass v3p-callout">
            <BookOpen size={26} aria-hidden="true" />
            <strong>Try it on demo money first.</strong>
            <span>
              Pocket Option&apos;s demo balance costs nothing and behaves the same. Watch a full
              cycle there before any real money is involved.
            </span>
          </aside>
        )}
      >
        <p className="v3-hud v3p-updated">Written for the current version</p>
        <p className="v3p-sub">
          A complete walkthrough: installing, your first run on a demo balance, what every
          setting actually does, and what to do when something looks wrong. Start on the free
          demo — it needs no payment and no card.
        </p>
      </PageHead>

      <section className="v3p-sec v3p-quick" aria-labelledby="quick-start-title">
        <div className="v3-wrap">
          <PageLabel index="01" total="04">Quick start</PageLabel>
          <h2 className="v3p-visually-hidden" id="quick-start-title">Quick start</h2>
          <div className="v3p-quick__grid">
            <div className="v3p-quick__start">
              <div className="v3p-switch" role="group" aria-label="Choose setup instructions">
                <button type="button" aria-pressed={setupMode === 'phone'} className={setupMode === 'phone' ? 'is-active' : ''} onClick={() => setSetupMode('phone')}>Phone / Tablet · 2 min</button>
                <button type="button" aria-pressed={setupMode === 'desktop'} className={setupMode === 'desktop' ? 'is-active' : ''} onClick={() => setSetupMode('desktop')}>Desktop Chrome · 3 min</button>
              </div>
              <div className="v3-glass v3p-quick__summary" aria-live="polite">
                {setupMode === 'phone' ? <><span className="v3-hud v3-gold">Phone or tablet</span><p>Open <Link to="/webapp">/webapp</Link> in Safari on iPhone or Chrome on Android, save the free Avalisa bookmark, then open Pocket Option on its Demo balance and run the bookmark there. No app to install.</p><Link className="v3-btn" to="/webapp">Open phone setup<span className="v3-btn__icon" aria-hidden="true"><ArrowRight size={17} /></span></Link></> : <><span className="v3-hud v3-gold">Desktop Chrome</span><p>Install the Chrome extension, sign in to your Avalisa account in the panel, open Pocket Option, switch to its Demo balance and set a Martingale step cap before you press Start.</p><a className="v3-btn" href={STORE_URL} target="_blank" rel="noreferrer">Install the extension<span className="v3-btn__icon" aria-hidden="true"><ArrowUpRight size={17} /></span></a></>}
              </div>
              <div className="v3p-quick__links">
                <a className="v3-textlink" href={STORE_URL} target="_blank" rel="noreferrer">Get the extension <ArrowUpRight size={15} aria-hidden="true" /></a>
                <Link className="v3-textlink" to="/pricing">See pricing <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
              <p className="v3p-quick__more">New here? <a href="/guide/how-to-install-avalisa-po-bot.html">Read the install walkthrough</a>. On a phone? <Link to="/webapp">Open phone setup</Link>. Want to check a plan? <Link to="/pricing">Compare plans</Link>.</p>
            </div>
            <div className="v3p-quick__cap">
              <p className="v3-hud v3-gold">Before you trade</p>
              <h2 className="v3-h3">Set a Martingale <em>step cap</em></h2>
              <p className="v3p-quick__capcopy">Each extra recovery step grows the total stake in a losing cycle. At 2×, the panel’s step setting allows one extra trade beyond the setting number.</p>
              <div className="v3p-table-wrap">
                <table className="v3p-table v3p-table--steps"><thead><tr><th scope="col">Panel Steps</th><th scope="col">Trades in cycle</th><th scope="col">Total stake</th></tr></thead><tbody>{exposureRows.map(([step, trades, multiple]) => <tr key={step}><th scope="row">{step}</th><td>{trades}</td><td className="is-gold">{multiple}</td></tr>)}</tbody></table>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LicenceCheck />

      <section className="v3p-sec v3p-steps" aria-labelledby="guide-steps-title">
        <div className="v3-wrap">
          <PageLabel index="02" total="04">The full walkthrough</PageLabel>
          <h2 className="v3-h2" id="guide-steps-title">From install to <em>every</em> setting.</h2>
          <div className="v3p-gsecs">
            {sections.map((section, index) => (
              <article key={section.title} className="v3p-gsec">
                <span className="v3p-gsec__num" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div className="v3p-gsec__body">
                  <span className="v3-hud">{`Part ${String(index + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}`}</span>
                  <h2>{section.title}</h2>
                  <div className="v3p-gsec__items">
                    {section.content.map((item, i) => (
                      <div key={i}>
                        {item.subtitle && <h3>{item.subtitle}</h3>}
                        <p>{item.text}</p>
                      </div>
                    ))}
                  </div>
                  {section.contact && (
                    <a href="mailto:avalisapobot@gmail.com" className="v3-textlink v3p-gsec__mail">
                      <Mail size={15} aria-hidden="true" />
                      avalisapobot@gmail.com
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="v3p-sec v3p-library" aria-labelledby="guide-library-title">
        <div className="v3-wrap">
          <PageLabel index="03" total="04">Guide library</PageLabel>
          <h2 className="v3-h3" id="guide-library-title">Every question, <em>answered</em> in depth.</h2>
          <details className="v3p-library__index">
            <summary>Browse all {STATIC_GUIDES.length} guides</summary>
            <ol>{STATIC_GUIDES.map((page, index) => <li key={page.href}><span className="v3-hud" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><a href={page.href}>{page.title}</a></li>)}</ol>
          </details>
        </div>
      </section>

      <div className="v3-wrap v3p-riskline">
        <PageLabel index="04" total="04">Risk</PageLabel>
        <p className="v3p-riskline__copy">Trading involves risk. Avalisa does not guarantee profits or predict the market. Start on Demo and set a Martingale step cap.</p>
      </div>
    </main>
  );
}
