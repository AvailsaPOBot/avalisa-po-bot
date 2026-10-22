import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import '../styles/luxury.css';
import { AVALISA_CHARACTER_IMAGE } from '../lib/brandAssets';
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

  return (
    <main className="lux-pricing-page">
      <section className="lux-price-hero lux-shell">
        <div>
          <p className="lux-kicker">Pricing</p>
          <h1>Simple, transparent pricing.</h1>
          <p>Every Avalisa account starts with 10 free Demo trades. No card required.</p>
        </div>
      </section>

      <section className="lux-shell pricing-demo-banner">
        <span><strong>New here?</strong> Start with 10 Free Demo Trades. No card required.</span>
        <Link to="/register">Start free Demo <span aria-hidden="true">→</span></Link>
      </section>

      <section className="lux-shell lux-pricing-grid lux-pricing-grid--page">
        {plans.map((plan) => {
          const current = currentPlan === plan.id || (currentPlan === 'free' && plan.id === 'demo') || (currentPlan === 'lifetime' && plan.id === 'pro');
          const targeted = location.hash === `#${plan.id}`;
          return (
            <article
              aria-current={current ? 'true' : undefined}
              className={`lux-price ${plan.featured ? 'is-featured' : ''} ${targeted ? 'is-targeted' : ''}`}
              id={plan.id}
              key={plan.id}
            >
              {plan.featured && <b>MOST POPULAR</b>}
              <small className="pricing-plan-tag">{plan.id === 'demo' ? 'START HERE' : plan.id === 'basic' ? 'MARTINGALE ONLY' : 'FOR ANY POCKET OPTION ACCOUNT'}</small>
              <span>{plan.name}</span>
              <h3>{plan.price}<small>{plan.period}</small></h3>
              {plan.id === 'pro' && <div className="pricing-billing" role="group" aria-label="Pro billing option">
                <button type="button" aria-pressed={proBilling === 'one-time'} className={proBilling === 'one-time' ? 'is-selected' : ''} onClick={() => setProBilling('one-time')}>$119 One-Time</button>
                <button type="button" aria-pressed={proBilling === 'monthly'} className={proBilling === 'monthly' ? 'is-selected' : ''} onClick={() => setProBilling('monthly')}>$29/month · recurring</button>
              </div>}
              {plan.id === 'pro' && <p className="lux-price__alt">$119 one-time or $29 / month recurring subscription</p>}
              <p>{plan.description}</p>
              <ul>{plan.features.map((item) => <li key={item}><Check size={14} /> {item}</li>)}</ul>
              {(plan.id === 'basic' || plan.id === 'pro') && <p className="pricing-email-tip">Use the same email on Whop as your Avalisa account so the licence can match automatically.</p>}
              {current ? (
                <button type="button" disabled>Current Plan</button>
              ) : plan.external ? (
                plan.paypalPlan ? (
                  <button type="button" aria-label={`${plan.cta} · Choose payment method`} onClick={() => setSelectedPlan(plan.id)}>{plan.cta}</button>
                ) : (
                  plan.href ? (
                    <a href={plan.href} target="_blank" rel="noreferrer">{plan.cta}</a>
                  ) : (
                    <button type="button" disabled>Checkout temporarily unavailable</button>
                  )
                )
              ) : plan.id === 'basic' || plan.id === 'pro' ? (
                <button type="button" onClick={() => setSelectedPlan(plan.id)}>{plan.cta}</button>
              ) : (
                <Link to={plan.href}>{plan.cta}</Link>
              )}
            </article>
          );
        })}
      </section>

      <section className="lux-shell pricing-partner-card" aria-labelledby="partner-pro-title">
        <div>
          <p className="lux-kicker">For new Pocket Option accounts</p>
          <h2 id="partner-pro-title">Get Pro at no charge through our partner link</h2>
          <ol>
            <li>Register a <strong>new</strong> Pocket Option account through our link.</li>
            <li>Link its numeric Pocket Option ID in Avalisa Dashboard → Settings.</li>
            <li>If the partner system confirms the referral, Pro unlocks instantly; otherwise it is queued for admin verification.</li>
          </ol>
          <p>Pro granted this way does not expire.</p>
          <a className="pricing-partner-link" href={AFFILIATE_LINK} target="_blank" rel="noreferrer">Open Pocket Option to register <span aria-hidden="true">→</span></a>
          <small>We may earn a commission when you register through this link.</small>
        </div>
        <img src={AVALISA_CHARACTER_IMAGE} alt="Avalisa brand character" loading="lazy" />
      </section>

      <section className="lux-shell pricing-comparison" aria-labelledby="plan-comparison-title">
        <p className="lux-kicker">Compare plans</p><h2 id="plan-comparison-title">What each plan includes</h2>
        <div className="pricing-table-wrap"><table><thead><tr><th>Feature</th><th>Demo plan<br/><small>$0</small></th><th>Basic plan<br/><small>$69 one-time</small></th><th>Pro plan<br/><small>$119 once or $29/month recurring</small></th><th>Partner Pro<br/><small>$0 with new account</small></th></tr></thead><tbody>
          <tr><th>Trade limit</th><td>10 trades</td><td>Unlimited</td><td>Unlimited</td><td>Unlimited</td></tr>
          <tr><th>Martingale step cap</th><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><th>Minimum payout filter</th><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><th>Avalisa Bot 4-rule mode</th><td>—</td><td>—</td><td>✓</td><td>✓</td></tr>
          <tr><th>Desktop Chrome + phone /webapp</th><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
          <tr><th>Licence expiry</th><td>Demo allowance</td><td>Never</td><td>Never once / active while subscribed</td><td>Never</td></tr>
        </tbody></table></div>
      </section>

      <section className="lux-price-faq lux-shell" aria-labelledby="pricing-faq-title">
        <h2 id="pricing-faq-title">Pricing questions</h2>
        {PRICING_FAQ.map(({ q, a }) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>

      <p className="lux-risk-note lux-shell">
        Trading involves risk; Martingale raises the stake after losses. Start on Demo.
      </p>

      {selectedPaymentPlan && (
        <div className="lux-payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-choice-title">
          <button type="button" className="lux-payment-modal__backdrop" aria-label="Close payment choices" onClick={() => setSelectedPlan(null)} />
          <section className="lux-payment-modal__panel">
            <button type="button" className="lux-payment-modal__close" onClick={() => setSelectedPlan(null)}>Close</button>
            <p className="lux-kicker">Payment Method</p>
            <h2 id="payment-choice-title">{selectedPaymentPlan.name} {selectedPaymentPlan.price}</h2>
            {selectedPaymentPlan.id === 'pro' && <p className="lux-payment-modal__alt">{proBilling === 'monthly' ? '$29/month is a recurring subscription.' : '$119 is a one-time payment.'} Both options unlock the same Pro features.</p>}
            <p className="lux-payment-modal__copy">Choose the checkout provider you prefer. Your Avalisa license activates after payment confirmation.</p>
            <div className="lux-payment-choice-grid">
              {selectedPaymentPlan.href ? (
                <a
                  href={selectedPaymentPlan.href}
                  target="_blank"
                  rel="noreferrer"
                  className="lux-payment-choice"
                  onClick={() => trackCheckoutClick(selectedPaymentPlan.id)}
                >
                  <strong>Whop</strong>
                  <span>Current checkout path</span>
                </a>
              ) : (
                /* No Whop URL configured -> say so, exactly as the PayPal option does.
                   Previously this rendered href="#", so the button looked live and did
                   nothing; before that it pointed at a removed product and sent buyers
                   to Whop's "Product not found" page. Both lie to a paying customer. */
                <div className="lux-payment-choice lux-payment-choice--disabled" aria-disabled="true">
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
                  className="lux-payment-choice lux-payment-choice--paypal"
                  disabled={paypalBusyPlan === selectedPaymentPlan.paypalPlan}
                  onClick={() => startPayPalCheckout(selectedPaymentPlan.paypalPlan)}
                >
                  <CreditCard size={16} />
                  <strong>PayPal</strong>
                  <span>Pay with PayPal account or supported card</span>
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
