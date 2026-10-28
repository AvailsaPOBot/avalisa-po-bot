import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, CreditCard, Minus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import '../styles/luxury.css';
import '../styles/landing-v3.css';
import '../styles/pages-v3.css';
import PageHead, { PageLabel } from '../components/v3/PageHead';
import {
  appendCheckoutEmail,
  WHOP_BASIC_CHECKOUT_URL,
  WHOP_PRO_CHECKOUT_URL,
} from '../lib/checkout';
import { AFFILIATE_LINK } from '../lib/affiliate';

const API_BASE = import.meta.env.REACT_APP_API_URL || 'https://avalisa-backend.onrender.com';
const PRICING_VIEW_SESSION_KEY = 'avalisa-pricing-view-sent';

export function trackCheckoutClick(plan) {
  const url = `${API_BASE}/api/funnel/checkout-click`;
  const body = JSON.stringify({ plan });

  try {
    const beacon = typeof navigator !== 'undefined' ? navigator.sendBeacon : null;
    if (typeof beacon === 'function' && beacon.call(navigator, url, new Blob([body], { type: 'application/json' }))) {
      return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch (err) {
    // Checkout navigation must not depend on analytics.
  }
}

export function trackPricingView() {
  const url = `${API_BASE}/api/funnel/pricing-view`;

  try {
    const beacon = typeof navigator !== 'undefined' ? navigator.sendBeacon : null;
    if (typeof beacon === 'function' && beacon.call(navigator, url)) {
      return;
    }
    fetch(url, {
      method: 'POST',
      keepalive: true,
    }).catch(() => {});
  } catch (err) {
    // Rendering the pricing page must not depend on analytics.
  }
}

// Answers checked against the plan cards above and the support fact sheet.
// Keep the $29/month line explicit: it is the only option that renews.
const PRICING_FAQ = [
  {
    q: 'What is the difference between Basic and Pro?',
    a: 'Basic ($69) unlocks unlimited Martingale trading, cloud settings sync and trade history. Pro adds Avalisa Bot mode, the rule-based signal mode, alongside Martingale. Choose Basic if Martingale is all you need, Pro if you want both modes.',
  },
  {
    q: 'Is it a subscription?',
    a: 'Basic is a one-time $69 payment and never renews. For Pro you choose at checkout: $119 one-time, which also never renews, or $29/month, which is a recurring subscription that renews monthly until you cancel. Both Pro options unlock the same features.',
  },
  {
    q: 'What can I test with the free Demo plan?',
    a: 'Demo includes 10 Martingale trades, webapp bot access, the dashboard, all supported timeframes and basic trade history. Run it on a Pocket Option demo account first to see how the bot behaves before you pay.',
  },
  {
    q: 'How do I get Pro through Pocket Option?',
    a: 'Register a new Pocket Option account through our link (we earn a commission from Pocket Option when you do), then link that Pocket Option ID in your Avalisa dashboard under Settings. If Pocket Option has already confirmed the registration came through our link, Pro is granted straight away; otherwise the request waits for a manual review. Pro granted this way does not expire.',
  },
  {
    q: 'Does it work on a phone?',
    a: 'Yes. On a computer Avalisa is a Chrome extension; on an iPhone or Android phone it runs through a free bookmark you save from avalisabot.vercel.app/webapp, which opens the Avalisa panel on the Pocket Option trading page.',
  },
  {
    q: 'Does it work on real accounts or only demo?',
    a: 'Both. The extension places trades the same way on a demo or a real Pocket Option account. Start on demo, and remember Martingale raises the stake after each loss, so a losing streak can empty a balance.',
  },
  {
    q: 'How do I cancel the $29/month Pro?',
    a: 'Cancel the subscription in Whop, where you bought it. When it ends, your licence returns to the free Demo plan; your account, settings and trade history are kept, and subscribing again upgrades it again. Basic and the $119 Pro option never renew, so there is nothing to cancel.',
  },
  {
    q: 'Does Avalisa need my Pocket Option password?',
    a: 'No. You log in to Pocket Option yourself, and Avalisa works on the Pocket Option page already open in your own browser, logged in as you. It does not move accounts or funds. Only ever type your Pocket Option password on Pocket Option\'s own site.',
  },
  {
    q: 'What changes from Demo to Pro?',
    a: 'Pro unlocks unlimited trades and both Martingale mode and Avalisa Bot mode (the rule-based signal mode, which is Pro-only).',
  },
  {
    q: 'Do I need a card for Demo?',
    a: 'No. Signing up and the 10 free Demo trades ask for no payment details; a card (or Apple/Google Pay) is only asked at the paid-plan checkout on this page.',
  },
  {
    q: 'How do I pay for a paid plan?',
    a: 'Card, Apple Pay or Google Pay, through the checkout on this page.',
  },
  {
    q: 'If I buy Basic first, do I get credit toward Pro?',
    a: 'No. There is no credit or discount; Pro is always its full price ($119 one-time or $29/month).',
  },
  {
    q: 'How do I cancel the $29/month Pro subscription, and what happens after?',
    a: "Email avalisapobot@gmail.com and we'll cancel it for you. After the subscription is cancelled or ends, your licence goes back to the free Demo plan (10 trades). Your account, settings and trade history are kept, and subscribing again upgrades it again.",
  },
  {
    q: 'Do I need to deposit money to use Avalisa PO Bot?',
    a: "No — you don't need to deposit money to use Avalisa PO Bot. The free Demo plan includes 10 Martingale trades, webapp bot access, dashboard access, and basic trade history. Signing up and using those 10 free Demo trades asks for no card or payment details. We recommend starting on a DEMO account. A real Pocket Option account is optional — the bot works on both.",
  },
];

export default function Pricing() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentPlan = user?.license?.plan || null;
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalBusyPlan, setPaypalBusyPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [proBilling, setProBilling] = useState('one-time');
  const captureStarted = useRef(false);
  const pricingViewSent = useRef(false);

  useEffect(() => {
    if (pricingViewSent.current) return;
    pricingViewSent.current = true;

    let alreadySent = false;
    try {
      alreadySent = sessionStorage.getItem(PRICING_VIEW_SESSION_KEY) === 'true';
    } catch (err) {
      // Storage can be blocked; analytics must remain best-effort.
    }
    if (alreadySent) return;

    try {
      sessionStorage.setItem(PRICING_VIEW_SESSION_KEY, 'true');
    } catch (err) {
      // If storage is blocked, still send the signal rather than breaking the page.
    }

    trackPricingView();
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/payments/paypal/status`)
      .then((r) => r.json())
      .then((data) => setPaypalEnabled(Boolean(data?.enabled)))
      .catch(() => setPaypalEnabled(false));
  }, []);

  useEffect(() => {
    if (!location.hash) return;

    const targetId = location.hash.slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;

    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [location.hash]);

  useEffect(() => {
    const search = new URLSearchParams(location.search || '');
    const paypalState = search.get('paypal');
    const orderId = search.get('token');
    if (paypalState === 'cancelled') {
      toast('PayPal checkout cancelled.');
      return;
    }
    if (paypalState !== 'approved' || !orderId || captureStarted.current) return;

    captureStarted.current = true;
    toast.loading('Confirming PayPal payment...', { id: 'paypal-capture' });
    api.post(`/api/payments/paypal/orders/${encodeURIComponent(orderId)}/capture`)
      .then(async () => {
        const { data: refreshedUser } = await api.get('/api/auth/me');
        localStorage.setItem('user', JSON.stringify(refreshedUser));
        toast.success('Payment confirmed. Your Avalisa access is active.', { id: 'paypal-capture' });
        window.location.href = '/dashboard';
      })
      .catch((err) => {
        toast.error(err.response?.data?.error || 'PayPal payment could not be confirmed. Contact support.', { id: 'paypal-capture' });
      });
  }, [location.search]);

  const email = user?.email || '';
  async function startPayPalCheckout(planId) {
    if (!user) {
      toast.error('Sign in or create an Avalisa account before PayPal checkout.');
      navigate('/login?authError=sign_in_before_paypal_checkout');
      return;
    }

    setPaypalBusyPlan(planId);
    try {
      const { data } = await api.post('/api/payments/paypal/orders', { plan: planId });
      window.location.href = data.approvalUrl;
    } catch (err) {
      toast.error(err.response?.data?.error || 'PayPal checkout is not available yet.');
      setPaypalBusyPlan(null);
    }
  }

  const plans = [
    {
      id: 'demo',
      name: 'Demo',
      price: '$0',
      period: 'free',
      description: 'Try the workflow before choosing a paid plan.',
      cta: 'Create free account',
      href: '/register',
      features: ['10 Martingale trades', 'Webapp Bot access', 'Dashboard access', 'All supported timeframes', 'Basic trade history'],
    },
    {
      id: 'basic',
      name: 'Basic',
      price: '$69',
      period: 'one-time',
      description: 'Unlimited Martingale trading, past the demo\u2019s 10-trade limit.',
      cta: 'Buy Basic — $69',
      href: appendCheckoutEmail(WHOP_BASIC_CHECKOUT_URL, email),
      paypalPlan: 'basic',
      external: true,
      featured: false,
      features: ['Unlimited Martingale', 'Step cap and payout filter', 'Cloud settings sync', 'Desktop + phone /webapp', 'No Avalisa Bot mode', 'No credit toward Pro later'],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$119',
      period: 'one-time',
      description: 'Both trading modes with no trade limit.',
      cta: proBilling === 'one-time' ? 'Buy Pro — $119 one-time' : 'Subscribe to Pro — $29/month',
      href: appendCheckoutEmail(WHOP_PRO_CHECKOUT_URL, email),
      paypalPlan: 'lifetime',
      external: true,
      featured: true,
      features: ['Unlimited Martingale', 'Avalisa Bot: Low 2/4, Mid 3/4, High 4/4 rules', 'Step cap and payout filter', 'Desktop + phone /webapp'],
    },
  ];


  const selectedPaymentPlan = plans.find((plan) => plan.id === selectedPlan);
  const planTags = { demo: 'START HERE', basic: 'MARTINGALE ONLY', pro: 'FOR ANY POCKET OPTION ACCOUNT' };

  return (
    <main className="v3 v3p v3p-pricing">
      <PageHead
        id="pricing-title"
        eyebrow="Pricing · Demo · Basic · Pro"
        title={<>Simple, <em>transparent</em> pricing.</>}
        sub="Every Avalisa account starts with 10 free Demo trades. No card required."
        aside={(
          <figure className="v3p-portrait v3p-portrait--small">
            <img src="/assets/v3/avalisa-final.webp" alt="Avalisa, the Avalisa PO Bot mascot" width="1122" height="1402" decoding="async" />
            <figcaption className="v3-hud">Avalisa · your rule runner</figcaption>
          </figure>
        )}
      >
        <div className="v3-glass v3p-strip">
          <span><strong>New here?</strong> Start with 10 Free Demo Trades. No card required.</span>
          <Link className="v3-textlink" to="/register">Start free Demo <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
      </PageHead>

      <section className="v3p-sec v3p-plans" aria-label="Plans">
        <div className="v3-wrap">
          <PageLabel index="01" total="04">Plans</PageLabel>
          <div className="v3p-plan-grid">
            {plans.map((plan, index) => {
              const current = currentPlan === plan.id || (currentPlan === 'free' && plan.id === 'demo') || (currentPlan === 'lifetime' && plan.id === 'pro');
              const targeted = location.hash === `#${plan.id}`;
              return (
                <article
                  aria-current={current ? 'true' : undefined}
                  className={`v3p-plan ${plan.featured ? 'is-featured' : ''} ${targeted ? 'is-targeted' : ''}`}
                  id={plan.id}
                  key={plan.id}
                >
                  <div className="v3p-plan__top">
                    <span className="v3-hud">{`Plan 0${index + 1}`}</span>
                    {plan.featured && <b className="v3p-plan__badge">MOST POPULAR</b>}
                  </div>
                  <small className="v3-hud v3-gold v3p-plan__tag">{planTags[plan.id]}</small>
                  <h2 className="v3p-plan__name">{plan.name}</h2>
                  <p className="v3p-plan__price">{plan.price}<small>{plan.period}</small></p>
                  {plan.id === 'pro' && <div className="v3p-billing" role="group" aria-label="Pro billing option">
                    <button type="button" aria-pressed={proBilling === 'one-time'} className={proBilling === 'one-time' ? 'is-selected' : ''} onClick={() => setProBilling('one-time')}>$119 One-Time</button>
                    <button type="button" aria-pressed={proBilling === 'monthly'} className={proBilling === 'monthly' ? 'is-selected' : ''} onClick={() => setProBilling('monthly')}>$29/month · recurring</button>
                  </div>}
                  {plan.id === 'pro' && <p className="lux-price__alt v3p-plan__alt">$119 one-time or $29 / month recurring subscription</p>}
                  <p className="v3p-plan__desc">{plan.description}</p>
                  <ul className="v3p-plan__features">
                    {plan.features.map((item) => {
                      const excluded = item.startsWith('No ');
                      return (
                        <li key={item} className={excluded ? 'is-excluded' : undefined}>
                          {excluded ? <Minus size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} {item}
                        </li>
                      );
                    })}
                  </ul>
                  {(plan.id === 'basic' || plan.id === 'pro') && <p className="v3p-plan__tip">Use the same email on Whop as your Avalisa account so the licence can match automatically.</p>}
                  <div className="v3p-plan__cta">
                    {current ? (
                      <button type="button" className="v3p-btn-line" disabled>Current Plan</button>
                    ) : plan.external ? (
                      plan.paypalPlan ? (
                        <button type="button" className={plan.featured ? 'v3-btn v3p-btn-block' : 'v3p-btn-line'} aria-label={`${plan.cta} · Choose payment method`} onClick={() => setSelectedPlan(plan.id)}>{plan.cta}</button>
                      ) : (
                        plan.href ? (
                          <a className="v3p-btn-line" href={plan.href} target="_blank" rel="noreferrer">{plan.cta}</a>
                        ) : (
                          <button type="button" className="v3p-btn-line" disabled>Checkout temporarily unavailable</button>
                        )
                      )
                    ) : plan.id === 'basic' || plan.id === 'pro' ? (
                      <button type="button" className="v3p-btn-line" onClick={() => setSelectedPlan(plan.id)}>{plan.cta}</button>
                    ) : (
                      <Link className="v3p-btn-line" to={plan.href}>{plan.cta}</Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="v3p-sec v3p-partner" aria-labelledby="partner-pro-title">
        <span className="v3-num" aria-hidden="true">02</span>
        <div className="v3-wrap v3p-split">
          <div>
            <PageLabel index="02" total="04">For new Pocket Option accounts</PageLabel>
            <h2 className="v3-h3" id="partner-pro-title">Get Pro at no charge through our <em>partner</em> link</h2>
            <p className="v3-lede v3p-partner__lede">Pro granted this way does not expire.</p>
          </div>
          <div className="v3-glass v3p-partner__panel">
            <ol className="v3p-numbered">
              <li><span aria-hidden="true">01</span><p>Register a <strong>new</strong> Pocket Option account through our link.</p></li>
              <li><span aria-hidden="true">02</span><p>Link its numeric Pocket Option ID in Avalisa Dashboard → Settings.</p></li>
              <li><span aria-hidden="true">03</span><p>If the partner system confirms the referral, Pro unlocks instantly; otherwise it is queued for admin verification.</p></li>
            </ol>
            <a className="v3-btn" href={AFFILIATE_LINK} target="_blank" rel="noreferrer">Open Pocket Option to register<span className="v3-btn__icon" aria-hidden="true"><ArrowUpRight size={17} /></span></a>
            <small>We may earn a commission when you register through this link.</small>
          </div>
        </div>
      </section>

      <section className="v3p-sec v3p-compare" aria-labelledby="plan-comparison-title">
        <div className="v3-wrap">
          <PageLabel index="03" total="04">Compare plans</PageLabel>
          <h2 className="v3-h3" id="plan-comparison-title">What each plan <em>includes</em></h2>
          <p className="v3-hud v3p-swipe" aria-hidden="true">Swipe to compare all plans →</p>
          <div className="v3p-table-wrap" role="region" aria-label="Plan comparison table" tabIndex={0}>
            <table className="v3p-table v3p-table--compare">
              <thead><tr><th scope="col">Feature</th><th scope="col">Demo plan<br/><small>$0</small></th><th scope="col">Basic plan<br/><small>$69 one-time</small></th><th scope="col" className="is-pro">Pro plan<br/><small>$119 once or $29/month recurring</small></th><th scope="col">Partner Pro<br/><small>$0 with new account</small></th></tr></thead>
              <tbody>
                <tr><th scope="row">Trade limit</th><td>10 trades</td><td>Unlimited</td><td className="is-pro">Unlimited</td><td>Unlimited</td></tr>
                <tr><th scope="row">Martingale step cap</th><td className="is-yes">✓</td><td className="is-yes">✓</td><td className="is-pro is-yes">✓</td><td className="is-yes">✓</td></tr>
                <tr><th scope="row">Minimum payout filter</th><td className="is-yes">✓</td><td className="is-yes">✓</td><td className="is-pro is-yes">✓</td><td className="is-yes">✓</td></tr>
                <tr><th scope="row">Avalisa Bot 4-rule mode</th><td className="is-no">—</td><td className="is-no">—</td><td className="is-pro is-yes">✓</td><td className="is-yes">✓</td></tr>
                <tr><th scope="row">Desktop Chrome + phone /webapp</th><td className="is-yes">✓</td><td className="is-yes">✓</td><td className="is-pro is-yes">✓</td><td className="is-yes">✓</td></tr>
                <tr><th scope="row">Licence expiry</th><td>Demo allowance</td><td>Never</td><td className="is-pro">Never once / active while subscribed</td><td>Never</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="v3p-sec v3p-faq" aria-labelledby="pricing-faq-title">
        <div className="v3-wrap v3p-split">
          <div>
            <PageLabel index="04" total="04">Common questions</PageLabel>
            <h2 className="v3-h3" id="pricing-faq-title">Pricing <em>questions</em></h2>
          </div>
          <div className="v3-faq__list">
            {PRICING_FAQ.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className="v3-wrap v3p-riskline">
        <p className="v3-risk">Trading involves risk; Martingale raises the stake after losses. Start on Demo.</p>
      </div>

      {selectedPaymentPlan && (
        <div className="v3p-modal" role="dialog" aria-modal="true" aria-labelledby="payment-choice-title">
          <button type="button" className="v3p-modal__backdrop" aria-label="Close payment choices" onClick={() => setSelectedPlan(null)} />
          <section className="v3p-modal__panel v3-glass">
            <button type="button" className="v3p-modal__close" onClick={() => setSelectedPlan(null)}><X size={14} aria-hidden="true" />Close</button>
            <p className="v3-hud v3-gold">Payment Method</p>
            <h2 id="payment-choice-title">{selectedPaymentPlan.name} {selectedPaymentPlan.price}</h2>
            {selectedPaymentPlan.id === 'pro' && <p className="v3p-modal__alt">{proBilling === 'monthly' ? '$29/month is a recurring subscription.' : '$119 is a one-time payment.'} Both options unlock the same Pro features.</p>}
            <p className="v3p-modal__copy">Choose the checkout provider you prefer. Your Avalisa license activates after payment confirmation.</p>
            <div className="v3p-modal__choices">
              {selectedPaymentPlan.href ? (
                <a
                  href={selectedPaymentPlan.href}
                  target="_blank"
                  rel="noreferrer"
                  className="v3p-choice"
                  onClick={() => trackCheckoutClick(selectedPaymentPlan.id)}
                >
                  <strong>Whop</strong>
                  <span>Current checkout path</span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </a>
              ) : (
                /* No Whop URL configured -> say so, exactly as the PayPal option does.
                   Previously this rendered href="#", so the button looked live and did
                   nothing; before that it pointed at a removed product and sent buyers
                   to Whop's "Product not found" page. Both lie to a paying customer. */
                <div className="v3p-choice is-disabled" aria-disabled="true">
                  <strong>Whop</strong>
                  <span>Whop checkout is temporarily unavailable</span>
                </div>
              )}
              {/* Only offer PayPal once the backend has it configured. A greyed-out
                  "PayPal will appear after backend setup" told buyers the store was
                  unfinished at the moment they were deciding to pay. */}
              {paypalEnabled && (
                <button
                  type="button"
                  className="v3p-choice v3p-choice--paypal"
                  disabled={paypalBusyPlan === selectedPaymentPlan.paypalPlan}
                  onClick={() => startPayPalCheckout(selectedPaymentPlan.paypalPlan)}
                >
                  <strong><CreditCard size={16} aria-hidden="true" /> PayPal</strong>
                  <span>Pay with PayPal account or supported card</span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
