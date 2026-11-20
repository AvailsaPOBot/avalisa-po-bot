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

// /free-pro — where clip descriptions and the extension point instead of the bare Pocket Option link.
// Clips brought 72 clicks on 18-19 Nov and 0 registrations: nobody was told why to sign up through us.
// Visual direction (Board): cinematic, Avalisa carries the page. Images generated 2026-11-21 in Gemini
// from "Avalisa Character refer sheet.png" (AVALISA GIRL); composed, never smiling. Sources:
// Promo Assets/Website Redesign/2026-11-21-free-pro/. No outcome claims (2113). Price matches the plan table.

const STEPS = [
  {
    key: 'po',
    title: 'Open a new Pocket Option account',
    body: 'Register a fresh account through the button on this page. If you use an ad blocker, pause it for this step so Pocket Option records where you came from.',
    image: '/assets/free-pro/step-1.webp',
    alt: 'Avalisa holding a phone that shows a Pocket Option chart',
  },
  {
    key: 'account',
    title: 'Create your free Avalisa account',
    titleSignedIn: 'You already have an Avalisa account',
    body: 'Email, Google or Facebook. You get 10 Demo trades right away, so you can try the controls while Pro is confirmed.',
    bodySignedIn: 'Signed in. Go straight to step 3.',
    image: '/assets/free-pro/step-2.webp',
    alt: 'Avalisa at a laptop, setting up her account',
  },
  {
    key: 'id',
    title: 'Add your Pocket Option ID',
    body: 'Your ID is the number on your Pocket Option profile. Paste it in Avalisa under Dashboard, Settings, “Link Your Pocket Option Account”. Pro turns on at once when Pocket Option has confirmed the sign-up; otherwise it waits for a quick manual check.',
    image: '/assets/free-pro/step-3.webp',
    alt: 'Avalisa holding a glowing gold card',
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
    <Link className="fp-step__action" to={user ? '/dashboard?tab=settings' : '/login?next=%2Fdashboard%3Ftab%3Dsettings'}>
      Open Dashboard settings <ArrowRight size={15} aria-hidden="true" />
    </Link>
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
    document.title = 'Free Pro with a new Pocket Option account | Avalisa PO Bot';
    return () => { document.title = previous; };
  }, []);

  // The sticky frame on desktop shows the photo of whichever step is in the middle of the screen.
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
        <div className="fp-hero__media" aria-hidden="true">
          <picture>
            <source media="(max-width: 767px)" srcSet="/assets/free-pro/hero-phone.webp" width="860" height="1541" />
            <img className="fp-hero__photo" src="/assets/free-pro/hero-2200.webp" srcSet="/assets/free-pro/hero-1280.webp 1280w, /assets/free-pro/hero-2200.webp 2200w" sizes="100vw" alt="" width="2200" height="1228" fetchPriority="high" decoding="async" />
          </picture>
          <div className="fp-hero__shade" />
          <div className="v3-grain" />
        </div>

        <div className="fp-hero__copy">
          <p className="v3-hud fp-hero__eyebrow"><i className="v3-dot" aria-hidden="true" />For new Pocket Option accounts</p>
          <h1 className="fp-hero__title" id="fp-title">Avalisa Pro, <em>on the house.</em></h1>
          <p className="fp-hero__price" aria-label="Price: 0 dollars instead of 119 dollars one-time">
            <span className="fp-hero__now">$0</span>
            <span className="fp-hero__was"><s>$119 one-time</s><br />with a new account</span>
          </p>
          <p className="fp-hero__sub">
            Open a new Pocket Option account through our link, add its ID in Avalisa, and the full Pro plan is yours.
          </p>
          <div className="v3-hero__actions">
            <a className="v3-btn" href={pocketOptionHref} target="_blank" rel="noreferrer">
              Open a new Pocket Option account
              <span className="v3-btn__icon" aria-hidden="true"><ArrowUpRight size={17} /></span>
            </a>
            <a className="v3-textlink" href="#fp-steps">See the 3 steps <ArrowRight size={15} aria-hidden="true" /></a>
          </div>
          <p className="v3-risk">Opens Pocket Option in a new tab. Keep this page open for steps 2 and 3.</p>
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
                <img key={step.key} className={`fp-frame__img${index === active ? ' is-on' : ''}`} src={step.image} alt="" width="900" height="1206" loading={index === 0 ? 'eager' : 'lazy'} decoding="async" />
              ))}
              <span className="fp-frame__count"><b>{active + 1}</b> / {STEPS.length}</span>
            </div>
          </div>

          <div className="fp-story__steps">
            <h2 className="fp-h2" id="fp-steps-title">Three steps, in this order.</h2>
            <ol className="fp-steps">
              {STEPS.map((step, index) => (
                <li
                  key={step.key}
                  className={`fp-step${index === active ? ' is-on' : ''}`}
                  data-step={index}
                  ref={(node) => { stepRefs.current[index] = node; }}
                >
                  <img className="fp-step__img" src={step.image} alt={step.alt} width="900" height="1206" loading="lazy" decoding="async" />
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
        <div className="fp-close__media" aria-hidden="true">
          <img src="/assets/free-pro/close-2200.webp" srcSet="/assets/free-pro/close-1280.webp 1280w, /assets/free-pro/close-2200.webp 2200w" sizes="100vw" alt="" width="2200" height="1228" loading="lazy" decoding="async" />
          <div className="fp-close__shade" />
        </div>
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
      </section>
    </main>
  );
}
