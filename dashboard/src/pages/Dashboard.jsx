import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { AFFILIATE_LINK } from '../lib/affiliate';
import { useAuth } from '../hooks/useAuth';
import { usePhoneLike } from '../lib/device';
import PageHero, { MascotAvatar } from '../components/presenter/PageHero';
import { TradeButton } from '../components/AccountMenu';
import '../styles/pz-dashboard.css';

// Member home. Bot setup lives in the bot itself (Chrome extension panel or the phone Webapp
// Bot) and admin tools live on /admin, so this page only shows the account, next steps and
// the user's own trades.

const REVIEW_ASK_STORAGE_KEY = 'avalisa-review-ask-complete';
const CHROME_WEB_STORE_URL = 'https://chromewebstore.google.com/detail/avalisa-po-bot/mkcpdbnlofljijfjiglkodddicpgdapa';
const CHROME_WEB_STORE_REVIEW_URL = `${CHROME_WEB_STORE_URL}/reviews`;
const INSTALL_STEP_STORAGE_KEY = 'avalisa-install-step-dismissed';
const HISTORY_TYPES = [
  { id: 'real', label: 'Real' },
  { id: 'demo', label: 'Demo' },
  { id: 'all', label: 'All' },
];

// Ask people with an informed opinion, but the threshold must be REACHABLE. It was 20, while
// the Demo plan caps at 10 trades for the LIFETIME of the account, so no free user could ever
// see it. 8 is 80% of the free tier and lands just before the paywall, not at it.
const REVIEW_ASK_MIN_TRADES = 8;

const STRATEGY_LABELS = {
  martingale: 'Martingale',
  ai: 'Avalisa Bot',
};

const PLAN_COPY = {
  free: { name: 'Demo', lede: 'You are on the free Demo plan.', includes: 'The Martingale strategy with a limited number of bot trades, to try Avalisa.' },
  basic: { name: 'Basic', lede: 'You are on the Basic plan.', includes: 'The Martingale strategy plus 10 Avalisa Bot strategy trades.' },
  lifetime: { name: 'Pro', lede: 'You are on the Pro plan.', includes: 'Every strategy, with unlimited Avalisa Bot strategy trades.' },
};

function strategyLabel(strategy) {
  return STRATEGY_LABELS[strategy] || strategy || 'Martingale';
}

function sentenceCase(value) {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

// The BLACK10 deposit-bonus promo runs 12-30 November 2026; the note's link
// shows only while the current UTC date is on or before the end date.
const BLACK10_PROMO_END_UTC = Date.UTC(2026, 10, 30);

function isBlack10PromoActive(now = new Date()) {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) <= BLACK10_PROMO_END_UTC;
}

function readFlag(key) {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch (err) {
    return false;
  }
}

function writeFlag(key) {
  try {
    window.localStorage.setItem(key, 'true');
  } catch (err) {
    // Storage can be unavailable in privacy-restricted browsers; hiding for this session is enough.
  }
}

function completedTradeCount(s) {
  return ['wins', 'losses', 'ties'].reduce((total, result) => total + (Number(s?.[result]) || 0), 0);
}

function resultChip(result) {
  if (result === 'win') return 'pz-chip--good';
  if (result === 'loss') return 'pz-chip--bad';
  return 'pz-chip--warn';
}

export default function Dashboard() {
  const { user } = useAuth();
  const phone = usePhoneLike();
  const plan = user?.license?.plan || 'free';
  const planCopy = PLAN_COPY[plan] || PLAN_COPY.free;
  const isAdmin = user?.isAdmin || false;

  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [demoStats, setDemoStats] = useState(null);
  const [historyType, setHistoryType] = useState('real');
  const [installStepDismissed, setInstallStepDismissed] = useState(() => readFlag(INSTALL_STEP_STORAGE_KEY));
  const [reviewAskCompleted, setReviewAskCompleted] = useState(() => readFlag(REVIEW_ASK_STORAGE_KEY));

  const [poUid, setPoUid] = useState('');
  const [poUidSaving, setPoUidSaving] = useState(false);
  const [poUidError, setPoUidError] = useState('');
  const [poUidLinked, setPoUidLinked] = useState(false);

  const [claimPoUid, setClaimPoUid] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimResult, setClaimResult] = useState(null);
  const [claimStatus, setClaimStatus] = useState(null); // null | 'none' | 'pending' | 'approved' | 'rejected'
  const [claimNotice, setClaimNotice] = useState(null);

  const loadClaimStatus = useCallback(async () => {
    if (plan !== 'free' && plan !== 'lifetime') return;
    try {
      const res = await api.get('/api/license/claim/status');
      setClaimStatus(res.data.claimStatus || 'none');
      setClaimNotice({
        message: res.data.claimMessage || null,
        registerUrl: res.data.registerUrl || null,
        pricingUrl: res.data.pricingUrl || '/pricing',
      });
    } catch (err) { /* silent */ }
  }, [plan]);

  // Stats always use real trades only
  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/api/trades/history?type=real&limit=500');
      setStats(res.data.stats);
    } catch (err) { /* silent */ }
  }, []);

  // Demo-account trades count too: most new users start on a Pocket Option demo
  // account, and the install step and review ask must see that activity.
  const loadDemoStats = useCallback(async () => {
    try {
      const res = await api.get('/api/trades/history?type=demo&limit=50');
      setDemoStats(res.data.stats || null);
    } catch (err) { /* silent */ }
  }, []);

  const loadHistory = useCallback(async (type) => {
    try {
      const res = await api.get(`/api/trades/history?type=${type}&limit=50`);
      setHistory(res.data.trades || []);
    } catch (err) { /* silent */ }
  }, []);

  useEffect(() => { loadStats(); loadDemoStats(); }, [loadStats, loadDemoStats]);
  useEffect(() => { loadHistory(historyType); }, [loadHistory, historyType]);
  useEffect(() => { loadClaimStatus(); }, [loadClaimStatus]);

  const showClaimCard = plan === 'free' && !user?.poUserId && claimStatus !== 'approved';

  // "Get Pro free" links to /dashboard#free-pro; the router does not scroll to hashes.
  useEffect(() => {
    if (!showClaimCard || typeof window === 'undefined' || window.location.hash !== '#free-pro') return;
    document.getElementById('free-pro')?.scrollIntoView?.({ block: 'start' });
  }, [showClaimCard]);

  async function submitClaim() {
    if (!claimPoUid.trim()) return;
    setClaimLoading(true);
    setClaimResult(null);
    try {
      const res = await api.post('/api/license/claim', { poUid: claimPoUid.trim() });
      setClaimResult({ success: true, message: res.data.message });
      setClaimStatus(res.data.status === 'approved' ? 'approved' : 'pending');
    } catch (err) {
      setClaimResult({ success: false, message: err.response?.data?.error || 'Failed to submit claim' });
    } finally {
      setClaimLoading(false);
    }
  }

  async function linkPoUid(event) {
    event.preventDefault();
    setPoUidSaving(true);
    setPoUidError('');
    try {
      await api.put('/api/auth/po-user-id', { poUserId: poUid.trim() });
      setPoUidLinked(true);
      toast.success('Pocket Option ID linked.');
    } catch (err) {
      setPoUidError(err.response?.data?.error || 'Failed to link Pocket Option ID');
    } finally {
      setPoUidSaving(false);
    }
  }

  function dismissInstallStep() {
    setInstallStepDismissed(true);
    writeFlag(INSTALL_STEP_STORAGE_KEY);
  }

  function completeReviewAsk() {
    setReviewAskCompleted(true);
    writeFlag(REVIEW_ASK_STORAGE_KEY);
  }

  const completedTrades = completedTradeCount(stats) + completedTradeCount(demoStats);
  const shouldShowReviewAsk = completedTrades >= REVIEW_ASK_MIN_TRADES && !reviewAskCompleted;
  // New accounts landed here with no pointer to the extension, so most never placed a
  // trade. Until the first trade (real or demo), lead with the install step.
  const shouldShowInstallStep = stats !== null && demoStats !== null && completedTrades === 0 && !installStepDismissed;
  const showPoUidCard = (plan === 'basic' || plan === 'lifetime') && !user?.poUserId && !poUidLinked;
  const showFreeProActive = plan === 'lifetime' && claimStatus === 'approved';
  const showInstantApproval = plan === 'free' && claimStatus === 'approved' && claimResult?.success;
  const hasNextStep = shouldShowInstallStep || showPoUidCard || showFreeProActive || showInstantApproval || showClaimCard;

  const tradesUsed = user?.license?.tradesUsed;
  const tradesLimit = user?.license?.tradesLimit;
  const hasTradeCount = tradesUsed != null && tradesLimit != null;

  const claimForm = (
    <div className="pzd-claimform">
      <label className="pz-field" htmlFor="claim-po-uid">
        Your Pocket Option UID
        <input
          id="claim-po-uid"
          type="number"
          inputMode="numeric"
          className="pz-input"
          placeholder="e.g. 128532137"
          value={claimPoUid}
          onChange={e => setClaimPoUid(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitClaim()}
        />
      </label>
      <button type="button" onClick={submitClaim} disabled={claimLoading || !claimPoUid.trim()} className="pz-btn">
        {claimLoading ? 'Submitting...' : 'Submit Claim'}
      </button>
      {claimResult && (
        <div className={`pz-note ${claimResult.success ? 'pz-note--good' : 'pz-note--bad'}`} role="status">
          {claimResult.message}
        </div>
      )}
    </div>
  );

  return (
    <div className="pz pzd">
      <PageHero
        compact
        pose="glance"
        title="Your account"
        lede={(
          <>
            <span className="pzd-email">{user?.email}</span>
            <br />
            {planCopy.lede}
          </>
        )}
      >
        <TradeButton className="pz-btn" label="Open the bot" />
        <Link to="/guide" className="pz-btn pz-btn--ghost">Setup guide</Link>
      </PageHero>

      <div className="pz-wrap pzd-body">
        <div className="pzd-grid">
          <div className="pzd-main">
            {hasNextStep && (
              <section className="pzd-next" aria-labelledby="next-step-heading">
                <h2 id="next-step-heading" className="pzd-h2">Next step</h2>

                {shouldShowInstallStep && phone && (
                  <section className="pz-card pzd-card" aria-labelledby="install-step-heading" data-testid="install-step-card">
                    <h3 id="install-step-heading" className="pz-card__title">Next step: set up on this phone</h3>
                    <p className="pz-card__sub">The bot runs on the Pocket Option page in your phone&apos;s browser, with nothing to install. Your account is ready — save the Avalisa bookmark once and you can start.</p>
                    <ol className="pzd-steps">
                      <li>Open Phone setup and copy the bookmark code.</li>
                      <li>Save it as a bookmark in Safari (iPhone) or Chrome (Android).</li>
                      <li>Open Pocket Option on its Demo balance and run the Avalisa bookmark there.</li>
                    </ol>
                    <div className="pzd-actions pzd-actions--stack">
                      <Link to="/webapp" className="pz-btn">Phone setup</Link>
                      <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer" className="pz-btn pz-btn--ghost">Using a computer? Chrome extension</a>
                      <button type="button" onClick={dismissInstallStep} className="pz-btn pz-btn--quiet">I&apos;ve set it up</button>
                    </div>
                    <p className="pzd-fine">Start on a demo account. Trading involves risk.</p>
                  </section>
                )}

                {shouldShowInstallStep && !phone && (
                  <section className="pz-card pzd-card" aria-labelledby="install-step-heading" data-testid="install-step-card">
                    <h3 id="install-step-heading" className="pz-card__title">Next step: install the Avalisa extension</h3>
                    <p className="pz-card__sub">The bot runs inside Chrome on Pocket Option. Your account is ready — trades start once the extension is installed.</p>
                    <ol className="pzd-steps">
                      <li>Add Avalisa PO Bot from the Chrome Web Store.</li>
                      <li>Open Pocket Option in Chrome and sign in to the bot panel with this email and your Avalisa password. Signed up with Google or Facebook? <Link to="/forgot-password" className="pz-link">Create a password first</Link>.</li>
                      <li>Switch Pocket Option to a demo account and run a few test trades first.</li>
                    </ol>
                    <div className="pzd-actions">
                      <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer" className="pz-btn">Add to Chrome</a>
                      <Link to="/guide" className="pz-btn pz-btn--ghost">Setup guide</Link>
                      <Link to="/webapp" className="pz-btn pz-btn--ghost">On a phone? Use the Webapp Bot</Link>
                      <button type="button" onClick={dismissInstallStep} className="pz-btn pz-btn--quiet">I&apos;ve installed it</button>
                    </div>
                  </section>
                )}

                {showPoUidCard && (
                  <section className="pz-card pzd-card" aria-labelledby="po-uid-heading" data-testid="po-uid-link-card">
                    <h3 id="po-uid-heading" className="pz-card__title">Link your Pocket Option ID</h3>
                    <p className="pz-card__sub">Link your Pocket Option ID so the bot recognises your plan even when you are not signed in to the panel.</p>
                    <form onSubmit={linkPoUid} className="pzd-inline-form">
                      <label className="pz-field">
                        Pocket Option ID
                        <input
                          className="pz-input"
                          inputMode="numeric"
                          pattern="[0-9]{3,20}"
                          value={poUid}
                          onChange={event => setPoUid(event.target.value)}
                          required
                          aria-label="Pocket Option ID"
                        />
                      </label>
                      <button type="submit" className="pz-btn" disabled={poUidSaving || !/^\d{3,20}$/.test(poUid.trim())}>
                        {poUidSaving ? 'Linking...' : 'Link ID'}
                      </button>
                    </form>
                    {poUidError && <p className="pz-note pz-note--bad pzd-gap" role="alert">{poUidError}</p>}
                  </section>
                )}

                {showFreeProActive && (
                  <section className="pz-card pzd-card" aria-labelledby="free-pro-active-heading">
                    <h3 id="free-pro-active-heading" className="pz-card__title">Your free Pro plan is active.</h3>
                    <p className="pz-card__sub">
                      Keep testing on your demo account for as long as you like. When you feel ready to look at a real account, our <a href="/guide/pocket-option-demo-to-real-account.html" className="pz-link">demo-to-real guide</a> is here.
                      {' '}
                      {isBlack10PromoActive() && (
                        <>
                          {'Pocket Option\'s BLACK10 deposit bonus runs 12-30 November 2026. Read the terms first in our '}
                          <a href="/guide/pocket-option-black10-deposit-bonus.html" className="pz-link">BLACK10 guide</a>
                          {'. '}
                        </>
                      )}
                      Never deposit money you can&apos;t afford to lose.
                    </p>
                  </section>
                )}

                {/* Instant approval: the claim card hides, so the server's message shows here until the next load */}
                {showInstantApproval && (
                  <div className="pz-note pz-note--good" role="status">{claimResult.message}</div>
                )}

                {showClaimCard && (
                  <section id="free-pro" className="pz-card pzd-card" aria-labelledby="free-pro-heading">
                    <h3 id="free-pro-heading" className="pz-card__title">Link your Pocket Option account</h3>
                    <p className="pz-card__sub">
                      Created a NEW Pocket Option account through our link? Enter its numeric ID (shown on your Pocket Option profile) to claim free Pro.
                    </p>

                    {claimStatus === 'pending' ? (
                      <div className="pz-note pz-note--warn pzd-gap">
                        Your ID is in. Pro turns on once Pocket Option confirms the account was registered through our link — sometimes that needs a manual check, so there is no fixed timeframe. We email you when it&apos;s done.
                      </div>
                    ) : claimStatus === 'rejected' ? (
                      <div className="pzd-stack pzd-gap">
                        <div className="pz-note pz-note--bad">
                          {claimNotice?.message || 'We could not match that ID to a new registration through our link. Free Pro only covers accounts created through the link — if this account already existed, a paid plan unlocks it straight away.'}
                        </div>
                        <div className="pzd-actions">
                          <a href={AFFILIATE_LINK} target="_blank" rel="noreferrer" className="pz-btn">Register a NEW account</a>
                          <Link to={claimNotice?.pricingUrl?.replace('https://avalisabot.vercel.app', '') || '/pricing'} className="pz-btn pz-btn--ghost">Make payment</Link>
                        </div>
                        {claimForm}
                      </div>
                    ) : (
                      <div className="pzd-gap">{claimForm}</div>
                    )}
                  </section>
                )}
              </section>
            )}

            <section className="pzd-trades" aria-labelledby="trades-heading">
              <h2 id="trades-heading" className="pzd-h2">Your trades</h2>

              {stats && (
                <div className="pz-card pzd-stats">
                  {[
                    { label: 'Total trades', value: (stats.wins || 0) + (stats.losses || 0) },
                    { label: 'Win rate', value: `${stats.winRate || 0}%` },
                    { label: 'Wins', value: stats.wins || 0 },
                    { label: 'Total P&L', value: `${parseFloat(stats.totalProfit) < 0 ? '-' : ''}$${String(stats.totalProfit || '0.00').replace('-', '')}`, tone: parseFloat(stats.totalProfit) >= 0 ? 'pzd-pos' : 'pzd-neg' },
                  ].map(s => (
                    <div key={s.label} className="pz-stat">
                      <span className={`pz-stat__n ${s.tone || ''}`.trim()}>{s.value}</span>
                      <span className="pz-stat__l">{s.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pz-card pzd-history">
                <div className="pzd-history__head">
                  <h3 className="pz-card__title">Trade history</h3>
                  <div className="pzd-seg" role="group" aria-label="Show trades from">
                    {HISTORY_TYPES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={historyType === t.id}
                        onClick={() => setHistoryType(t.id)}
                        className="pzd-seg__btn"
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                {history.length === 0 ? (
                  <div className="pz-empty pzd-empty">
                    <MascotAvatar size={64} />
                    <p>No trades yet. Start the bot on Pocket Option.</p>
                  </div>
                ) : (
                  <div className="pz-tablewrap">
                    <table className="pz-table pzd-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Pair</th>
                          <th>Direction</th>
                          <th>Strategy</th>
                          <th>Timeframe</th>
                          <th className="num">Amount</th>
                          <th>Result</th>
                          <th className="num">Balance after</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(t => (
                          <tr key={t.id}>
                            <td className="pzd-date">{new Date(t.createdAt).toLocaleString()}</td>
                            <td>{t.pair}</td>
                            <td className={t.direction === 'call' ? 'pzd-pos' : 'pzd-neg'}>{sentenceCase(t.direction)}</td>
                            <td>{strategyLabel(t.strategy)}</td>
                            <td>{t.timeframe || '—'}</td>
                            <td className="num">${Number(t.amount || 0).toFixed(2)}</td>
                            <td><span className={`pz-chip ${resultChip(t.result)}`}>{sentenceCase(t.result)}</span></td>
                            <td className="num">{t.balanceAfter != null ? `$${Number(t.balanceAfter).toFixed(2)}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            {shouldShowReviewAsk && (
              <section className="pz-card pzd-card pzd-review" aria-labelledby="review-ask-heading" data-testid="review-ask-card">
                <h2 id="review-ask-heading" className="pz-card__title">Share your experience with Avalisa</h2>
                <p className="pz-card__sub">Reviews help other traders find the bot. If something is not working, our support team can help.</p>
                <div className="pzd-actions">
                  <a href={CHROME_WEB_STORE_REVIEW_URL} target="_blank" rel="noopener noreferrer" onClick={completeReviewAsk} className="pz-btn pz-btn--ghost">
                    Rate Avalisa on the Chrome Web Store
                  </a>
                  <Link to="/support" onClick={completeReviewAsk} className="pz-btn pz-btn--ghost">Something is not working</Link>
                  <button type="button" onClick={completeReviewAsk} className="pz-btn pz-btn--quiet pz-btn--sm">Dismiss</button>
                </div>
              </section>
            )}
          </div>

          <aside className="pzd-side" aria-label="Plan and bot">
            <section className="pz-card pzd-card pzd-plan" aria-labelledby="plan-heading">
              <div className="pzd-plan__head">
                <h2 id="plan-heading" className="pz-card__title">Your plan</h2>
                <span className={`pz-chip ${plan === 'lifetime' ? 'pz-chip--good' : 'pz-chip--plain'}`}>{planCopy.name} plan</span>
              </div>
              <p className="pz-card__sub">{planCopy.includes}</p>
              {hasTradeCount && (
                <p className="pzd-usage">
                  <span className="pz-muted">Trades used</span>
                  <strong>{tradesUsed} of {tradesLimit}</strong>
                </p>
              )}
              {plan !== 'lifetime' && (
                <div className="pzd-actions">
                  <Link to="/pricing" className="pz-btn pz-btn--sm">Upgrade</Link>
                  {showClaimCard && <a href="#free-pro" className="pz-link">Get Pro free</a>}
                </div>
              )}
            </section>

            <section className="pz-card pzd-card pzd-botset" aria-labelledby="bot-settings-heading">
              <h2 id="bot-settings-heading" className="pz-card__title">Bot settings live in the bot</h2>
              <p className="pz-card__sub">Stake, steps, minimum payout and strategy are set in the Avalisa panel on Pocket Option, so they stay with the bot wherever you run it.</p>
              <div className="pzd-links">
                <a href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer" className="pz-link">Chrome extension</a>
                <Link to="/webapp" className="pz-link">Bot on this phone</Link>
              </div>
            </section>

            {isAdmin && (
              <section className="pz-card pzd-card pzd-admin" aria-labelledby="admin-heading">
                <h2 id="admin-heading" className="pz-card__title">Admin console</h2>
                <p className="pz-card__sub">Users, claims and bot configuration are managed on the admin page.</p>
                <Link to="/admin" className="pz-btn pz-btn--ghost pz-btn--sm">Open admin console</Link>
              </section>
            )}
          </aside>
        </div>

        <p className="pzd-support pz-muted">
          Questions about your account? <Link to="/support" className="pz-link">Contact support</Link>.
        </p>
      </div>
    </div>
  );
}
