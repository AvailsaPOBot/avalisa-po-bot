import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { affiliateLinkFor } from '../lib/affiliate';
import '../styles/luxury.css';
import '../styles/landing-v3.css';
import '../styles/pages-v3.css';
import '../styles/free-pro.css';

// /free-pro — the page clip descriptions and the extension can point at instead of the bare
// Pocket Option link. Clips brought 72 clicks on 18-19 Nov and 0 registrations: nobody was told
// why to sign up through our link. This page says why, in what order, and what does not qualify.
// Facts mirror public/guide/free-pro-with-new-account.html and the Dashboard claim card.
// No outcome claims (2113). Pricing must match the plan table ($119 one-time).

const PRO_FEATURES = [
  'Unlimited trades',
  'Martingale and Avalisa Bot 4-rule mode',
  'Works on Demo and Real accounts',
  'Never billed, never expires',
];

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

export default function FreePro() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const pocketOptionHref = affiliateLinkFor(searchParams.get('src'));
  const accountHref = user ? '/dashboard?tab=settings' : '/register?intent=affiliate';

  useEffect(() => {
    const previous = document.title;
    document.title = 'Free Pro with a new Pocket Option account | Avalisa PO Bot';
    return () => { document.title = previous; };
  }, []);

  return (
    <main className="v3 v3p fp">
      <section className="fp-head" aria-labelledby="fp-title">
        <div className="v3p-head__bg" aria-hidden="true"><div className="v3-grain" /></div>
        <div className="v3-wrap fp-head__grid">
          <div className="fp-head__copy">
            <p className="v3-hud v3p-eyebrow"><i className="v3-dot" aria-hidden="true" />For new Pocket Option accounts</p>
            <h1 className="v3p-h1" id="fp-title">Get Avalisa Pro <em>free</em>.</h1>
            <p className="v3p-sub">
              Open a new Pocket Option account through our link, add its ID in Avalisa, and the Pro plan
              that normally costs $119 is yours at no charge.
            </p>
            <div className="v3-hero__actions">
              <a className="v3-btn" href={pocketOptionHref} target="_blank" rel="noreferrer">
                Open a new Pocket Option account
                <span className="v3-btn__icon" aria-hidden="true"><ArrowUpRight size={17} /></span>
              </a>
              <a className="v3-textlink" href="#fp-steps">How it works <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
            <p className="v3-risk">Opens Pocket Option in a new tab. Keep this page open for steps 2 and 3.</p>
          </div>

          <div className="fp-visual">
          <img className="fp-visual__img" src="/assets/v3/avalisa-final.webp" alt="Avalisa, the Avalisa PO Bot mascot" width="1122" height="1402" fetchPriority="high" decoding="async" />
          <aside className="fp-pass" aria-label="What Pro includes">
            <div className="fp-pass__top">
              <span className="fp-pass__brand">Avalisa <b>Pro</b></span>
              <span className="fp-pass__chip" aria-hidden="true" />
            </div>
            <p className="fp-pass__price">
              <strong>$0</strong>
              <span><s>$119 one-time</s> with a new account</span>
            </p>
            <ul className="fp-pass__list">
              {PRO_FEATURES.map((item) => <li key={item}><Check size={15} aria-hidden="true" />{item}</li>)}
            </ul>
            <p className="fp-pass__foot">Granted once Pocket Option confirms your sign-up came through our link.</p>
          </aside>
          </div>
        </div>
      </section>

      <section className="fp-sec" id="fp-steps" aria-labelledby="fp-steps-title">
        <div className="v3-wrap">
          <h2 className="fp-h2" id="fp-steps-title">Three steps, in this order.</h2>
          <ol className="fp-route">
            <li className="fp-stop">
              <span className="fp-stop__n" aria-hidden="true">1</span>
              <div className="fp-stop__body">
                <h3>Open a new Pocket Option account</h3>
                <p>Register a fresh account through our button. If you use an ad blocker, pause it for this step so Pocket Option records where you came from.</p>
                <a className="fp-stop__action" href={pocketOptionHref} target="_blank" rel="noreferrer">Open Pocket Option <ArrowUpRight size={15} aria-hidden="true" /></a>
              </div>
            </li>
            <li className="fp-stop">
              <span className="fp-stop__n" aria-hidden="true">2</span>
              <div className="fp-stop__body">
                <h3>{user ? 'You already have an Avalisa account' : 'Create your free Avalisa account'}</h3>
                <p>{user
                  ? 'Signed in. Go straight to step 3.'
                  : 'Email, Google or Facebook. You get 10 Demo trades right away, so you can try the controls while Pro is confirmed.'}
                </p>
                {!user && <Link className="fp-stop__action" to={accountHref}>Create Avalisa account <ArrowRight size={15} aria-hidden="true" /></Link>}
              </div>
            </li>
            <li className="fp-stop">
              <span className="fp-stop__n" aria-hidden="true">3</span>
              <div className="fp-stop__body">
                <h3>Add your Pocket Option ID</h3>
                <p>Your ID is the number on your Pocket Option profile. Paste it in Avalisa under Dashboard, Settings, “Link Your Pocket Option Account”. Pro turns on at once when Pocket Option has confirmed the sign-up; otherwise it waits for a quick manual check.</p>
                <Link className="fp-stop__action" to={user ? '/dashboard?tab=settings' : '/login?next=%2Fdashboard%3Ftab%3Dsettings'}>Open Dashboard settings <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            </li>
          </ol>
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
        <div className="v3-wrap fp-close__inner">
          <div>
            <h2 className="fp-h2" id="fp-close-title">Start with step 1.</h2>
            <p className="v3p-sub">It takes about two minutes. Your Pocket Option password stays with Pocket Option; Avalisa never asks for it.</p>
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
