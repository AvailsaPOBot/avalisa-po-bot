import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { affiliateLinkFor } from '../lib/affiliate';
import '../styles/luxury.css';
import '../styles/landing-v3.css';
import '../styles/pages-v3.css';
import '../styles/free-pro.css';

// /free-pro — where clip descriptions point instead of the bare Pocket Option link.
// Board 21 Nov: a visitor must see what the product is: the real Pocket Option screen, the real
// Avalisa panel working, the Pocket Option mark, and Avalisa herself. The hero video is a real
// recording (take1.mov, 27 Oct 2026, Pocket Option DEMO, extension v2.4.23), cropped, email blurred,
// sped up 2x. Beat captions follow what the panel status line actually shows at each moment.
// No outcome claims (2113). Price matches the plan table.

const DEMO_BEATS = [
  { until: 3, title: 'Skips what misses your rules', body: 'Status: SKIP, 2 of 3 rules. It keeps scanning.' },
  { until: 6, title: 'You change the settings', body: 'Intensity, start amount, steps, minimum payout.' },
  { until: 10, title: 'Scans pairs paying 90% or more', body: 'Bitcoin OTC, Cardano OTC, CHF/JPY OTC at 92%.' },
  { until: 13.1, title: 'Rules line up, it places the trade', body: 'Trade #1, PUT $1.00, on the demo balance.' },
];

const STEPS = [
  {
    key: 'po',
    title: 'Open a new Pocket Option account',
    body: 'Register a fresh account through the button on this page. If you use an ad blocker, pause it for this step so Pocket Option records where you came from.',
    image: '/assets/free-pro/step-po.webp',
    width: 900, height: 924,
    alt: 'The Pocket Option trading screen',
    caption: 'Pocket Option, where you trade',
  },
  {
    key: 'account',
    title: 'Create your free Avalisa account',
    titleSignedIn: 'You already have an Avalisa account',
    body: 'Email, Google or Facebook. You get 10 Demo trades right away, so you can try the controls while Pro is confirmed.',
    bodySignedIn: 'Signed in. Go straight to step 3.',
    image: '/assets/free-pro/step-register.webp',
    width: 640, height: 867,
    alt: 'The Avalisa sign-up form',
    caption: 'Avalisa sign-up, never your Pocket Option password',
  },
  {
    key: 'id',
    title: 'Add your Pocket Option ID',
    body: 'Your ID is the number on your Pocket Option profile. Paste it in Avalisa under Dashboard, Settings, “Link Your Pocket Option Account”. Pro turns on at once when Pocket Option has confirmed the sign-up; otherwise it waits for a quick manual check.',
    image: '/assets/free-pro/step-panel.webp',
    width: 600, height: 1520,
    alt: 'The Avalisa panel with the PRO badge and unlimited trade allowance',
    caption: 'The panel with Pro: trade allowance ∞',
  },
];

const PRO_FEATURES = ['Unlimited trades', 'Martingale and Avalisa Bot 4-rule mode', 'Demo and Real accounts', 'Never billed, never expires'];

const QUALIFIES = [
  'A Pocket Option account you register today, through the button on this page',
  'The same Pocket Option ID linked in your Avalisa account',
];
const DOES_NOT = [
  'A Pocket Option account you already had',
  'A sign-up made after leaving this page and coming back to Pocket Option another way',
  'A sign-up with an ad blocker that stripped the referral',
];

const FAQ = [
  ['What exactly is Avalisa PO Bot?', 'A Chrome extension, plus a phone web app, that opens a small panel inside your own Pocket Option tab. You choose the strategy, start amount, Martingale steps and minimum payout; it places the trades and stops when you press Stop or hit your step limit.'],
  ['Is it really the same Pro as the paid plan?', 'Yes. Same features, same updates. It does not turn into a subscription later.'],
  ['How long does the confirmation take?', 'Usually it is there by the time you add your ID, and Pro turns on at once. If Pocket Option has not confirmed it yet, your claim waits for a manual check. If it has been several days, email us your Pocket Option ID.'],
  ['Do I have to deposit to get Pro?', 'No. Pro is granted for the registration. You can run Avalisa on your Pocket Option demo balance first.'],
  ['Why is it free?', 'Pocket Option pays us a commission for new accounts that sign up through our link. That pays for your Pro.'],
  ['I already have a Pocket Option account. What can I do?', 'The free plan needs a new account. Your current account can use the 10 free Demo trades, or Basic and Pro from the pricing page.'],
];

const SUPPORT_EMAIL = 'avalisapobot@gmail.com';

function StepAction({ index, user, pocketOptionHref }) {
  if (index === 0) {
    return <a className="fp-step__action" href={pocketOptionHref} target="_blank" rel="noreferrer">Open Pocket Option <ArrowUpRight size={15} aria-hidden="true" /></a>;
  }
  if (index === 1) {
    return user ? null : <Link className="fp-step__action" to="/register?intent=affiliate">Create Avalisa account <ArrowRight size={15} aria-hidden="true" /></Link>;
  }
  return (
    <Link className="fp-step__action" to={user ? '/dashboard#free-pro' : '/login?next=%2Fdashboard%23free-pro'}>
      Open your Dashboard <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

function DemoStage() {
  const videoRef = useRef(null);
  const panelRef = useRef(null);
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    const panel = panelRef.current;
    if (!video) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      [video, panel].forEach((v) => { if (v) { v.removeAttribute('autoplay'); try { v.pause(); } catch { /* jsdom */ } } });
    }
    const onTime = () => {
      const t = video.currentTime;
      const next = DEMO_BEATS.findIndex((b) => t < b.until);
      setBeat(next === -1 ? DEMO_BEATS.length - 1 : next);
      // the magnified panel is the same recording cropped: keep it on the same frame
      if (panel && Math.abs(panel.currentTime - t) > 0.25) panel.currentTime = t;
    };
    video.addEventListener('timeupdate', onTime);
    return () => video.removeEventListener('timeupdate', onTime);
  }, []);

  return (
    <figure className="fp-demo">
      <div className="fp-demo__stage">
      <div className="fp-window">
        <div className="fp-window__bar" aria-hidden="true">
          <i /><i /><i />
          <span>pocketoption.com</span>
        </div>
        <div className="fp-window__screen">
          <video
            ref={videoRef}
            className="fp-window__video"
            poster="/assets/free-pro/po-demo-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="Recording: the Avalisa panel running inside a Pocket Option demo account and placing a trade"
          >
            <source src="/assets/free-pro/po-demo.webm" type="video/webm" />
            <source src="/assets/free-pro/po-demo.mp4" type="video/mp4" />
          </video>
          <span className="fp-window__ring" aria-hidden="true" />
        </div>
      </div>
      <div className="fp-zoom" aria-hidden="true">
        <span className="fp-zoom__tag">Avalisa panel, enlarged</span>
        <video ref={panelRef} className="fp-zoom__video" poster="/assets/free-pro/po-panel-poster.jpg" autoPlay muted loop playsInline preload="auto">
          <source src="/assets/free-pro/po-panel.webm" type="video/webm" />
          <source src="/assets/free-pro/po-panel.mp4" type="video/mp4" />
        </video>
      </div>
      <img className="fp-demo__mascot" src="/assets/free-pro/avalisa-cutout.webp" alt="" width="316" height="1223" aria-hidden="true" />
      </div>
      <ol className="fp-beats" aria-label="What happens in the recording">
        {DEMO_BEATS.map((b, i) => (
          <li key={b.title} className={i === beat ? 'is-on' : i < beat ? 'is-done' : ''}>
            <b>{b.title}</b>
            <span>{b.body}</span>
          </li>
        ))}
      </ol>
      <figcaption className="fp-demo__note">Real recording on a Pocket Option demo account, 27 Oct 2026, shown at 2× speed.</figcaption>
    </figure>
  );
}

export default function FreePro() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const pocketOptionHref = affiliateLinkFor(searchParams.get('src'));
  const [active, setActive] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Free Pro: the auto-trading bot for Pocket Option | Avalisa PO Bot';
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) setActive(Number(entry.target.dataset.step)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    stepRefs.current.forEach((node) => node && io.observe(node));
    return () => io.disconnect();
  }, []);

  return (
    <main className="v3 v3p fp">
      <Navbar />

      <section className="fp-hero" aria-labelledby="fp-title">
        <div className="fp-hero__glow" aria-hidden="true"><div className="v3-grain" /></div>
        <div className="fp-hero__grid">
          <div className="fp-hero__copy">
            <p className="fp-works">
              <span>Works with</span>
              <img src="/assets/free-pro/po-logo.png" alt="Pocket Option" width="560" height="80" />
            </p>
            <h1 className="fp-hero__title" id="fp-title">The auto-trading bot for Pocket Option.</h1>
            <p className="fp-hero__sub">
              Avalisa runs inside your own Pocket Option tab, on Chrome or your phone. You set the rules;
              it watches the pairs and places the trades.
            </p>
          </div>
          <DemoStage />
            <div className="fp-offer">
              <p className="fp-offer__price" aria-label="Pro: 0 dollars instead of 119 dollars one-time">
                <span className="fp-offer__now">$0</span>
                <span className="fp-offer__was">Pro, normally <s>$119 one-time</s>,<br />free with a new Pocket Option account</span>
              </p>
              <div className="v3-hero__actions">
                <a className="v3-btn" href={pocketOptionHref} target="_blank" rel="noreferrer">
                  Open a new Pocket Option account
                  <span className="v3-btn__icon" aria-hidden="true"><ArrowUpRight size={17} /></span>
                </a>
                <a className="v3-textlink" href="#fp-steps">See the 3 steps <ArrowRight size={15} aria-hidden="true" /></a>
              </div>
              <p className="v3-risk">Independent tool, not made by Pocket Option. Opens Pocket Option in a new tab.</p>
            </div>
        </div>
      </section>

      <section className="fp-pro" aria-label="What Pro includes">
        <div className="v3-wrap fp-pro__row">
          <p className="fp-pro__label">Pro includes</p>
          <ul className="fp-pro__list">
            {PRO_FEATURES.map((item) => <li key={item}><Check size={15} aria-hidden="true" />{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="fp-story" id="fp-steps" aria-labelledby="fp-steps-title">
        <div className="v3-wrap fp-story__grid">
          <div className="fp-story__stage" aria-hidden="true">
            <div className="fp-frame">
              {STEPS.map((step, index) => (
                <figure key={step.key} className={`fp-frame__shot${index === active ? ' is-on' : ''}`}>
                  <img src={step.image} alt="" width={step.width} height={step.height} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
                  <figcaption>{step.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>

          <div className="fp-story__steps">
            <h2 className="fp-h2" id="fp-steps-title">Free Pro in three steps, in this order.</h2>
            <ol className="fp-steps">
              {STEPS.map((step, index) => (
                <li
                  key={step.key}
                  className={`fp-step${index === active ? ' is-on' : ''}`}
                  data-step={index}
                  ref={(node) => { stepRefs.current[index] = node; }}
                >
                  <img className="fp-step__img" src={step.image} alt={step.alt} width={step.width} height={step.height} loading="lazy" decoding="async" />
                  <span className="fp-step__n" aria-hidden="true">{index + 1}</span>
                  <h3>{user && step.titleSignedIn ? step.titleSignedIn : step.title}</h3>
                  <p>{user && step.bodySignedIn ? step.bodySignedIn : step.body}</p>
                  <StepAction index={index} user={user} pocketOptionHref={pocketOptionHref} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="fp-sec fp-rules" aria-labelledby="fp-rules-title">
        <div className="v3-wrap fp-rules__grid">
          <h2 className="fp-h2" id="fp-rules-title">What counts.</h2>
          <div className="fp-rules__col">
            <h3>Qualifies</h3>
            <ul>{QUALIFIES.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
          </div>
          <div className="fp-rules__col fp-rules__col--no">
            <h3>Does not qualify</h3>
            <ul>{DOES_NOT.map((item) => <li key={item}><X size={16} aria-hidden="true" />{item}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="fp-sec" aria-labelledby="fp-faq-title">
        <div className="v3-wrap v3-split">
          <div className="v3-split__head">
            <h2 className="fp-h2" id="fp-faq-title">Questions before you start.</h2>
            <p className="fp-aside">
              Already linked an ID? <Link to="/guide#licence">Check its plan</Link>. Anything else: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
            </p>
          </div>
          <div className="v3-faq__list fp-faq">
            {FAQ.map(([question, answer]) => (
              <details key={question}><summary>{question}</summary><p>{answer}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="fp-close" aria-labelledby="fp-close-title">
        <div className="v3-wrap fp-close__grid">
          <img className="fp-close__portrait" src="/assets/v3/avalisa-final.webp" alt="Avalisa, the Avalisa PO Bot mascot" width="1122" height="1402" loading="lazy" decoding="async" />
          <div className="fp-close__copy">
            <h2 className="fp-h2" id="fp-close-title">Start with step 1.</h2>
            <p className="fp-close__sub">It takes about two minutes. Your Pocket Option password stays with Pocket Option; Avalisa never asks for it.</p>
            <div className="v3-hero__actions">
              <a className="v3-btn" href={pocketOptionHref} target="_blank" rel="noreferrer">
                Open a new Pocket Option account
                <span className="v3-btn__icon" aria-hidden="true"><ArrowUpRight size={17} /></span>
              </a>
            </div>
            <p className="v3-risk">
              We earn a commission from Pocket Option when you open an account through our link. Trading involves risk:
              you can lose money, and no setting guarantees profit. Start on a demo balance.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
