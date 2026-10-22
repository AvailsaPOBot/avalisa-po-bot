import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../hooks/useAuth';
import { AFFILIATE_LINK } from '../lib/affiliate';
import HeroSlab from './landing-v3/HeroSlab';
import '../styles/home.css';
import '../styles/landing-v3.css';

// The promo code the affiliate link applies (promoCodeConsistency.test.jsx keeps the two in sync).
const AFFILIATE_PROMO_CODE = 'WELCOME50'; // eslint-disable-line no-unused-vars
const SUPPORT_EMAIL = 'avalisapobot@gmail.com';

// Hero copy. landingLeadsWithFree.test.jsx guards this block: it must lead with the free Demo
// and make no outcome claim.
const HERO = {
  eyebrow: 'Pocket Option · Desktop Chrome · Phone browser',
  sub: 'Avalisa runs inside your own Pocket Option tab, on desktop Chrome or your phone. Set the stake, a step cap and a minimum payout, then start with 10 free Demo trades.',
  cta: 'Start 10 free Demo trades',
  trust: ['10 free Demo trades', 'No card to start', 'No Pocket Option password asked'],
};
// hero-copy-end

const STEPS = [
  ['Open Pocket Option', 'Use the Chrome extension on desktop, or the bookmark setup in your phone browser. You log in to Pocket Option yourself.'],
  ['Set your controls', 'Choose a start amount, a Martingale step cap and the minimum payout a pair must offer before Avalisa trades it.'],
  ['Start on Demo', 'Run the 10 free Martingale trades on a practice balance. Stop the bot whenever you choose.'],
];
const PHONE_STEPS = [
  ['Open the phone setup', 'Visit the setup page on your phone and copy the Avalisa bookmark code.'],
  ['Save it as a bookmark', 'Name it Avalisa. Nothing to install from an app store.'],
  ['Run it on Pocket Option', 'On the Pocket Option page, open the bookmark. The Avalisa panel opens at the bottom.'],
];
const PAIRS = [['EUR/USD', 92], ['AUD/CAD', 86], ['GBP/JPY', 68]];
const FAQ = [
  ['What is included in free Demo?', '10 Martingale trades on a practice balance, phone access, dashboard access and basic trade history.'],
  ['Does Demo include Avalisa Bot mode?', 'No. Demo runs Martingale. Avalisa Bot 4-rule mode is Pro.'],
  ['Does Avalisa need my Pocket Option password?', 'No. You log in to Pocket Option yourself, in your own browser.'],
  ['Do I have to install anything on my phone?', 'No. On a phone Avalisa runs from a browser bookmark on the Pocket Option page. On desktop it is a Chrome extension.'],
  ['What does Pro cost?', 'Pro is $119 one-time or $29/month. Basic is $69 one-time.'],
];

function Lines({ lines, className = 'v3-h2', as: Tag = 'h2', id }) {
  return (
    <Tag className={`${className} v3-reveal`} id={id}>
      {lines.map((line, index) => <span className="v3-mask" key={index}><span style={{ '--i': index }}>{line}</span></span>)}
    </Tag>
  );
}

function SectionLabel({ index, children }) {
  return (
    <div className="v3-label v3-reveal">
      <span>{index} / 05</span><i className="v3-leader" aria-hidden="true" /><span>{children}</span>
    </div>
  );
}

// Below-the-fold reveals: IntersectionObserver + CSS. Nothing in the hero is hidden or animated in.
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return undefined;
    root.classList.add('v3-motion');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    root.querySelectorAll('.v3-reveal').forEach((node) => observer.observe(node));
    return () => { observer.disconnect(); root.classList.remove('v3-motion'); };
  }, [rootRef]);
}

export default function Landing() {
  const { user } = useAuth();
  const startHref = user ? '/dashboard' : '/register';
  const rootRef = useRef(null);
  const [showSticky, setShowSticky] = useState(false);
  const [stepCap, setStepCap] = useState(3);
  const [startAmount, setStartAmount] = useState(10);
  const [minimumPayout, setMinimumPayout] = useState(80);
  const [sandboxStopped, setSandboxStopped] = useState(false);
  const multiple = 2 ** (stepCap + 1) - 1;
  const cycleExposure = startAmount * multiple;
  const ladder = Array.from({ length: stepCap + 1 }, (_, index) => startAmount * 2 ** index);
  const largest = ladder[ladder.length - 1];

  useReveal(rootRef);
  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 360);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="v3" ref={rootRef}>
      <Navbar />
      <main>
        {/* 00 — Hero: photo / 3D slab / type, layered. No entrance animation on first-screen text. */}
        <section className="v3-hero" id="top" aria-labelledby="v3-hero-title">
          <div className="v3-hero__media">
            <picture>
              <source media="(max-width: 767px)" srcSet="/assets/v3/hero-mobile.webp" width="1122" height="1402" />
              <img className="v3-hero__photo" src="/assets/v3/hero.webp" alt="Avalisa, the Avalisa PO Bot mascot, standing in front of a trading chart" width="1280" height="720" fetchPriority="high" decoding="async" />
            </picture>
            <div className="v3-hero__shade" aria-hidden="true" />
            <div className="v3-grain" aria-hidden="true" />
          </div>
          <HeroSlab />
          <div className="v3-hero__copy">
            <p className="v3-hud v3-hero__eyebrow"><i className="v3-dot" aria-hidden="true" />{HERO.eyebrow}</p>
            <h1 className="v3-hero__title" id="v3-hero-title">
              Set your rules.<br /> Let <em>Avalisa</em><br /> run the steps.
            </h1>
            <p className="v3-hero__sub">{HERO.sub}</p>
            <div className="v3-hero__actions">
              <Link className="v3-btn" to={startHref}>{HERO.cta}<span className="v3-btn__icon" aria-hidden="true"><ArrowUpRight size={17} /></span></Link>
              <a className="v3-textlink" href="#how">See how it works <ArrowDown size={15} aria-hidden="true" /></a>
            </div>
            <ul className="v3-hud v3-hero__trust">{HERO.trust.map((item) => <li key={item}>{item}</li>)}</ul>
            <p className="v3-risk">Trading involves risk. Start on a demo account.</p>
          </div>
          <a className="v3-hud v3-hero__cue" href="#how" aria-hidden="true" tabIndex={-1}><span>01 — How it works</span><i /></a>
        </section>

        {/* 01 — How it works */}
        <section className="v3-sec v3-how" id="how" aria-labelledby="how-title">
          <span id="how-it-works" className="v3-alias" aria-hidden="true" />
          <span className="v3-num" aria-hidden="true">01</span>
          <div className="v3-wrap v3-split">
            <div className="v3-split__head">
              <SectionLabel index="01">How it works</SectionLabel>
              <Lines id="how-title" lines={['Three steps to', <>your first <em>Demo</em> session.</>]} />
              <p className="v3-lede v3-reveal">Open it where you already trade, set your limits, and keep your hand on the stop button.</p>
              <div className="v3-links v3-reveal">
                <Link to="/guide">Read the setup guide <ArrowRight size={15} /></Link>
                <Link to="/webapp">Open phone setup <ArrowRight size={15} /></Link>
              </div>
            </div>
            <ol className="v3-steps">
              {STEPS.map(([title, copy], index) => (
                <li className="v3-step v3-reveal" key={title} style={{ '--d': `${index * 90}ms` }}>
                  <span className="v3-step__index">0{index + 1}</span>
                  <div><h3>{title}</h3><p>{copy}</p></div>
                  <span className="v3-hud v3-step__tag">Step 0{index + 1} / 03</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 02 — You stay in control: the interactive sandbox */}
        <section className="v3-sec v3-control" id="controls" aria-labelledby="controls-title">
          <span className="v3-num v3-num--right" aria-hidden="true">02</span>
          <div className="v3-wrap">
            <SectionLabel index="02">You stay in control</SectionLabel>
            <Lines id="controls-title" lines={['You set the limits', <>before a <em>session</em> starts.</>]} />
            <p className="v3-lede v3-reveal">Move the controls and watch how a step cap shapes a Martingale cycle. This is an illustration, not a live trading screen.</p>

            <div className="v3-console v3-reveal">
              <div className="v3-console__controls v3-glass">
                <div className="v3-console__row"><span className="v3-hud">Strategy</span><b>Martingale <small>Demo</small></b></div>
                <label className="v3-console__row"><span className="v3-hud">Start amount</span>
                  <select value={startAmount} onChange={(event) => setStartAmount(Number(event.target.value))}>
                    <option value="1">$1</option><option value="5">$5</option><option value="10">$10</option><option value="25">$25</option>
                  </select>
                </label>
                <div className="v3-console__row"><span className="v3-hud">Multiplier</span><b>2.0×</b></div>
                <label className="v3-range"><span className="v3-hud">Step cap <b>{stepCap}</b></span>
                  <input aria-label="Martingale recovery steps" type="range" min="1" max="6" value={stepCap} onChange={(event) => setStepCap(Number(event.target.value))} />
                </label>
                <label className="v3-range"><span className="v3-hud">Minimum payout <b>{minimumPayout}%</b></span>
                  <input aria-label="Minimum payout" type="range" min="70" max="92" step="2" value={minimumPayout} onChange={(event) => setMinimumPayout(Number(event.target.value))} />
                </label>
                <p className="v3-console__note">Demo trades run Martingale. Avalisa Bot 4-rule mode is <b>Pro</b>.</p>
              </div>

              <div className="v3-console__readout">
                <span className="v3-hud v3-gold">Illustrative example · 2.0×</span>
                <h3>{`Steps ${stepCap} means ${stepCap + 1} trades in a cycle`}</h3>
                <div className="v3-big" aria-hidden="true">${cycleExposure}</div>
                <strong className="v3-exposure">{`Maximum cycle exposure: $${cycleExposure} · ${multiple}× base stake`}</strong>
                <ol className="v3-ladder">
                  {ladder.map((value, index) => (
                    <li key={index}>
                      <span className="v3-hud">{index === 0 ? 'Trade 1' : `Step ${index}`}</span>
                      <i style={{ '--w': value / largest }} />
                      <b>${value}</b>
                    </li>
                  ))}
                </ol>
                <p className="v3-caution">A losing streak can reduce your balance. Use a cap and test on Demo.</p>
                <div className="v3-stop">
                  <button className="v3-stop__btn" type="button" aria-pressed={sandboxStopped} onClick={() => setSandboxStopped((stopped) => !stopped)}>
                    <i aria-hidden="true" />{sandboxStopped ? 'Start Demo' : 'Stop bot'}
                  </button>
                  <span className="v3-hud" role="status" aria-live="polite">Status: {sandboxStopped ? 'Stopped by you' : 'Ready on Demo'}</span>
                </div>
              </div>
            </div>

            <div className="v3-ticker v3-glass v3-reveal">
              <span className="v3-hud v3-gold">Payout floor {minimumPayout}%</span>
              {PAIRS.map(([pair, payout]) => (
                <span className="v3-ticker__pair" key={pair}>
                  {pair} · {payout}% <b className={payout >= minimumPayout ? 'is-ok' : 'is-skip'}>{payout >= minimumPayout ? 'Eligible' : 'Skipped below floor'}</b>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 03 — Works on your phone */}
        <section className="v3-sec v3-phone" id="phone" aria-labelledby="phone-title">
          <span className="v3-num" aria-hidden="true">03</span>
          <div className="v3-wrap v3-phone__grid">
            <figure className="v3-device v3-reveal" aria-label="Illustration of the Avalisa panel on a phone">
              <div className="v3-device__frame">
                <div className="v3-device__screen">
                  <div className="v3-device__bar"><span>pocketoption.com</span></div>
                  <svg className="v3-device__chart" viewBox="0 0 240 150" aria-hidden="true">
                    <path d="M0 120H240M0 80H240M0 40H240" />
                    <polyline points="0,118 22,110 40,116 62,92 84,98 104,72 126,80 148,58 170,64 192,40 214,46 240,26" />
                  </svg>
                  <div className="v3-device__panel">
                    <div className="v3-device__head"><span><i className="v3-dot" /> Avalisa</span><small>Ready on Demo</small></div>
                    <div className="v3-device__row"><span>Mode</span><b>Martingale</b></div>
                    <div className="v3-device__row"><span>Step cap</span><b>3</b></div>
                    <div className="v3-device__row"><span>Min payout</span><b>80%</b></div>
                    <div className="v3-device__buttons"><span>Start</span><span>Stop</span></div>
                  </div>
                </div>
              </div>
              <figcaption className="v3-hud">Illustration · not a live trading screen</figcaption>
            </figure>
            <div>
              <SectionLabel index="03">Works on your phone</SectionLabel>
              <Lines id="phone-title" lines={['Your phone browser,', <>no <em>app</em> to install.</>]} />
              <p className="v3-lede v3-reveal">Avalisa runs inside the Pocket Option page, so on iPhone and Android it comes in through a browser bookmark. On desktop it is a Chrome extension.</p>
              <ol className="v3-mini-steps">
                {PHONE_STEPS.map(([title, copy], index) => (
                  <li className="v3-reveal" key={title} style={{ '--d': `${index * 80}ms` }}><span className="v3-hud">0{index + 1}</span><div><b>{title}</b><p>{copy}</p></div></li>
                ))}
              </ol>
              <div className="v3-links v3-reveal"><Link to="/webapp">Open phone setup <ArrowRight size={15} /></Link></div>
            </div>
          </div>
        </section>

        {/* 04 — Plans */}
        <section className="v3-sec v3-plans" id="pricing" aria-labelledby="plans-title">
          <span className="v3-num v3-num--right" aria-hidden="true">04</span>
          <div className="v3-wrap">
            <SectionLabel index="04">Plans</SectionLabel>
            <Lines id="plans-title" lines={['Start free.', <>Unlock more when you are <em>ready</em>.</>]} />
            <div className="v3-plan-row">
              <article className="v3-plan v3-reveal" style={{ '--d': '0ms' }}>
                <span className="v3-hud v3-gold">Demo</span>
                <strong className="v3-plan__price">Free</strong>
                <p>10 Martingale trades on a practice balance. No card to start.</p>
                <Link to={startHref}>Start free Demo <ArrowRight size={15} /></Link>
              </article>
              <article className="v3-plan v3-reveal" style={{ '--d': '90ms' }}>
                <span className="v3-hud v3-gold">Basic</span>
                <strong className="v3-plan__price">$69 <small>one-time</small></strong>
                <p>Unlimited Martingale controls. Avalisa Bot mode is not included.</p>
                <Link to="/pricing#basic">View Basic</Link>
              </article>
              <article className="v3-plan v3-plan--pro v3-reveal" style={{ '--d': '180ms' }}>
                <span className="v3-hud v3-gold">Pro</span>
                <strong className="v3-plan__price">$119 <small>one-time</small></strong>
                <span className="v3-plan__alt">or $29/month, recurring</span>
                <p>Unlimited Martingale and Avalisa Bot 4-rule mode (Pro).</p>
                <Link to="/pricing#pro">View Pro</Link>
                <Link className="v3-plan__more" to="/pricing#pro">Compare Pro options <ArrowRight size={15} /></Link>
              </article>
            </div>
            <div className="v3-partner v3-reveal">
              <p><b>New to Pocket Option?</b> Open a new account through our link and Pro is granted once the partner system confirms it.</p>
              <div>
                <a href={AFFILIATE_LINK} target="_blank" rel="noreferrer">Open Pocket Option <ArrowUpRight size={15} /></a>
                <Link to="/pricing">See all plans <ArrowRight size={15} /></Link>
              </div>
              <small>We may earn a commission.</small>
            </div>
          </div>
        </section>

        {/* 05 — Trust, FAQ, final CTA */}
        <section className="v3-sec v3-trust" id="trust" aria-labelledby="trust-title">
          <span className="v3-num" aria-hidden="true">05</span>
          <div className="v3-wrap">
            <SectionLabel index="05">Trust</SectionLabel>
            <Lines id="trust-title" lines={['Your broker account', <>stays <em>yours</em>.</>]} />
            <div className="v3-trust__rows">
              <article className="v3-trust__row v3-reveal">
                <span className="v3-hud v3-gold">Privacy</span>
                <h3>Avalisa never sees your Pocket Option password.</h3>
                <p>You log in to Pocket Option yourself. Your balance and account stay in your own browser session.</p>
              </article>
              <article className="v3-trust__row v3-reveal">
                <span className="v3-hud v3-gold">Setup</span>
                <h3>Read every step before you sign up.</h3>
                <p>The phone and desktop instructions are public. <Link to="/guide">Open the setup guide <ArrowRight size={14} /></Link></p>
              </article>
              <article className="v3-trust__row v3-reveal">
                <span className="v3-hud v3-gold">Support</span>
                <h3>Questions go to our support inbox.</h3>
                <p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will help you set up.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="v3-sec v3-faq" id="faq" aria-labelledby="faq-title">
          <div className="v3-wrap v3-split">
            <div className="v3-split__head">
              <span className="v3-hud v3-gold">Common questions</span>
              <Lines id="faq-title" className="v3-h3" as="h2" lines={['A few useful', <><em>answers</em>.</>]} />
            </div>
            <div className="v3-faq__list">
              {FAQ.map(([question, answer]) => (
                <details key={question} className="v3-reveal"><summary>{question}</summary><p>{answer}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="v3-final" aria-labelledby="final-title">
          <div className="v3-final__portrait v3-reveal">
            <img src="/assets/v3/avalisa-final.webp" alt="Avalisa, the Avalisa PO Bot mascot" width="1122" height="1402" loading="lazy" decoding="async" />
            <span className="v3-hud">Avalisa · your rule runner</span>
          </div>
          <div className="v3-final__copy">
            <span className="v3-hud v3-gold">Start on Demo</span>
            <Lines id="final-title" lines={['Try the controls', <>at your <em>own</em> pace.</>]} />
            <p className="v3-lede v3-reveal">Start with 10 free Martingale trades on a practice balance. No card, no Pocket Option password.</p>
            <div className="v3-hero__actions v3-reveal">
              <Link className="v3-btn" to={startHref}>{HERO.cta}<span className="v3-btn__icon" aria-hidden="true"><ArrowUpRight size={17} /></span></Link>
              <Link className="v3-textlink" to="/pricing">Compare plans <ArrowRight size={15} /></Link>
            </div>
            <p className="v3-risk">Trading involves risk. Start on a demo account.</p>
          </div>
        </section>
      </main>
      {showSticky && <div className="home-sticky"><span>10 free Demo trades · No card</span><Link to={startHref}>Start free Demo <ArrowRight size={16} /></Link></div>}
    </div>
  );
}

