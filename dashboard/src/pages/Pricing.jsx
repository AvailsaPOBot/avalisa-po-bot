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
      price: '10',
      period: 'trades',
      description: 'Existing users can test the workflow before upgrading.',
      cta: 'Open Pocket Option',
      href: AFFILIATE_LINK,
      external: true,
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
      featured: true,
      features: ['Unlimited Martingale', 'Cloud settings sync', 'Trade history'],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$119',
      period: 'one-time',
      // Whop sells Pro at BOTH $119 once and $29/month (added 2026-08-27). The buyer
      // picks at checkout ("Choose your plan"). The site showed only $119, so nobody
      // learned the cheaper entry point existed — a silent conversion loss.
      altBilling: 'or $29 / month',
      description: 'Unlock Martingale and Avalisa Bot with no trade limit.',
      cta: 'Buy Pro — $119',
      href: appendCheckoutEmail(WHOP_PRO_CHECKOUT_URL, email),
      paypalPlan: 'lifetime',
      external: true,
      features: ['Unlimited trades', 'Martingale mode', 'Avalisa Bot mode', 'Free via our Pocket Option link (once confirmed)'],
    },
  ];

  const selectedPaymentPlan = plans.find((plan) => plan.id === selectedPlan);

  return (
    <main className="lux-pricing-page">
      <section className="lux-price-hero lux-shell">
        <div>
          <p className="lux-kicker">Pricing</p>
          <h1>Simple, transparent pricing.</h1>
        </div>
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
              <span>{plan.name}</span>
              <h3>{plan.price}<small>{plan.period}</small></h3>
              {plan.altBilling && <p className="lux-price__alt">{plan.altBilling}</p>}
              <p>{plan.description}</p>
              <ul>{plan.features.map((item) => <li key={item}><Check size={14} /> {item}</li>)}</ul>
              {current ? (
                <button type="button" disabled>Current Plan</button>
              ) : plan.external ? (
                plan.paypalPlan ? (
                  <button type="button" onClick={() => setSelectedPlan(plan.id)}>Choose payment method</button>
                ) : (
                  plan.href ? (
                    <a href={plan.href} target="_blank" rel="noreferrer">{plan.cta}</a>
                  ) : (
                    <button type="button" disabled>Checkout temporarily unavailable</button>
                  )
                )
              ) : (
                <Link to={plan.href}>{plan.cta}</Link>
              )}
            </article>
          );
        })}
        <aside className="lux-price-guide lux-price-guide--page">
          <img src={AVALISA_CHARACTER_IMAGE} alt="Avalisa, the Avalisa PO Bot brand ambassador" />
          <div>
            <strong>Want Pro through Pocket Option?</strong>
            <p>Register through our Pocket Option link, then link that Pocket Option ID in your Avalisa dashboard settings to claim Pro.</p>
            <a href={AFFILIATE_LINK} target="_blank" rel="noreferrer">Open Pocket Option</a>
          </div>
        </aside>
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
        Trading involves risk. Avalisa does not guarantee profits. Martingale raises the stake after each loss, so a losing streak can empty a balance. Use demo mode first and only trade money you can afford to lose.
      </p>

      {selectedPaymentPlan && (
        <div className="lux-payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-choice-title">
          <button type="button" className="lux-payment-modal__backdrop" aria-label="Close payment choices" onClick={() => setSelectedPlan(null)} />
          <section className="lux-payment-modal__panel">
            <button type="button" className="lux-payment-modal__close" onClick={() => setSelectedPlan(null)}>Close</button>
            <p className="lux-kicker">Payment Method</p>
            <h2 id="payment-choice-title">{selectedPaymentPlan.name} {selectedPaymentPlan.price}</h2>
            {selectedPaymentPlan.altBilling && (
              // Say it here too: the buyer chooses one-time vs monthly on Whop's page,
              // so the modal must not imply $119 is the only option.
              <p className="lux-payment-modal__alt">{selectedPaymentPlan.altBilling} — choose at checkout</p>
            )}
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
