// /admin — owner-only working screen. Order of the page: what needs action (claims), the few
// numbers that matter, then tabs: Users (table + side drawer with every per-user action), Growth
// (funnel) and System (AI token usage and AI settings). Styles: presenter.css + pz-admin.css.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Search, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { MascotAvatar } from '../components/presenter/PageHero';
import '../styles/pz-admin.css';

const ONLINE_CAVEAT = 'In-memory, since last backend restart; reflects this backend instance only.';
const DAY = 24 * 60 * 60 * 1000;
// The backend returns at most this many users per request (newest first).
const USERS_PAGE_CAP = 50;

const PLAN_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'free', label: 'Demo' },
  { key: 'basic', label: 'Basic' },
  { key: 'lifetime', label: 'Pro' },
];

const PLAN_OPTIONS = [
  { value: 'free', label: 'Demo (10 trades)' },
  { value: 'basic', label: 'Basic ($69, Martingale)' },
  { value: 'lifetime', label: 'Pro ($119, unlimited + AI)' },
];

const COLUMNS = [
  { key: 'email', label: 'Email' },
  { key: 'plan', label: 'Plan' },
  { key: 'licenseState', label: 'Status' },
  { key: 'tradesUsed', label: 'Trades used / limit', num: true },
  { key: 'poUserId', label: 'PO UID' },
  { key: 'createdAt', label: 'Joined' },
  { key: 'lastActiveAt', label: 'Last active' },
];

// Funnel events in the order a visitor normally meets them. The backend returns { type, count }
// sorted by count, so the order here is ours; types not listed are shown after, without a rate.
const FUNNEL_STEPS = [
  { type: 'affiliate_link_served', label: 'Affiliate link served (extension)' },
  { type: 'pricing_view', label: 'Pricing page viewed' },
  { type: 'signup', label: 'Signed up' },
  { type: 'checkout_click', label: 'Checkout clicked' },
  { type: 'po_uid_autolinked', label: 'PO UID linked' },
  { type: 'affiliate_postback_received', label: 'Affiliate postback received' },
];
const FUNNEL_OTHER_LABELS = { login: 'Logins', affiliate_postback_rejected: 'Affiliate postbacks rejected' };

const ACTIVITY_SEGMENTS = [
  { key: 'active24h', label: 'Last 24h', tone: 'a' },
  { key: 'active7d', label: '1–7 days', tone: 'b' },
  { key: 'active30d', label: '8–30 days', tone: 'c' },
  { key: 'dormant', label: 'Dormant 30+ days', tone: 'd' },
  { key: 'neverActive', label: 'Never active', tone: 'e' },
];

function planName(plan) {
  if (plan === 'lifetime') return 'Pro';
  if (plan === 'free') return 'Demo';
  return plan ? `${plan.charAt(0).toUpperCase()}${plan.slice(1)}` : 'No licence';
}

function hitTradeLimit(user) {
  const license = user.license;
  return Boolean(license && license.tradesLimit != null && (license.tradesUsed || 0) >= license.tradesLimit);
}

function licenseState(user) {
  if (!user.license) return 'No licence';
  if (hitTradeLimit(user)) return 'Trade limit reached';
  return 'Active';
}

function sortableValue(user, key) {
  if (key === 'plan') return user.license?.plan || '';
  if (key === 'licenseState') return licenseState(user);
  if (key === 'tradesUsed') return user.license?.tradesUsed || 0;
  return user[key] || '';
}

function displayError(error, fallback) {
  return error?.response?.data?.error || fallback;
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatDate(value, includeTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return includeTime
    ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString([], { dateStyle: 'medium' });
}

function formatAgo(value) {
  if (!value) return 'Never';
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return '—';
  if (ms < 60 * 60 * 1000) return 'Within the hour';
  if (ms < DAY) return `${Math.floor(ms / (60 * 60 * 1000))}h ago`;
  if (ms < 30 * DAY) return `${Math.floor(ms / DAY)}d ago`;
  return formatDate(value);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function activityStatus(user) {
  const lastActive = user.lastActiveAt ? formatDate(user.lastActiveAt, true) : 'never recorded';
  if (user.online) {
    return { tone: 'good', label: `Online now. Last active: ${lastActive}. In-memory, since last backend restart.` };
  }
  if (user.lastActiveAt && Date.now() - new Date(user.lastActiveAt).getTime() <= 7 * DAY) {
    return { tone: 'warn', label: `Active in the last 7 days. Last active: ${lastActive}.` };
  }
  return { tone: 'idle', label: `Dormant or never active. Last active: ${lastActive}.` };
}

function UserActivityDot({ user }) {
  const status = activityStatus(user);
  const toneClass = status.tone === 'good' ? ' pz-dot--good' : status.tone === 'warn' ? ' pz-dot--warn' : '';
  return <span role="img" aria-label={status.label} title={status.label} className={`pz-dot${toneClass}`} />;
}

function PlanChip({ plan }) {
  const tone = plan === 'lifetime' ? '' : plan === 'basic' ? ' pz-chip--good' : ' pz-chip--plain';
  return <span className={`pz-chip${tone}`}>{planName(plan)}</span>;
}

function StatusChip({ user }) {
  const state = licenseState(user);
  const tone = state === 'Active' ? 'pz-chip--good' : state === 'Trade limit reached' ? 'pz-chip--warn' : 'pz-chip--plain';
  return <span className={`pz-chip ${tone}`}>{state}</span>;
}

function TradesCell({ license }) {
  if (!license) return <span className="pza-dim">—</span>;
  const used = license.tradesUsed ?? 0;
  if (license.tradesLimit == null) return <>{used}<span className="pza-dim"> / no limit</span></>;
  const full = used >= license.tradesLimit;
  return <span className={full ? 'pza-warn' : undefined}>{used}<span className="pza-dim"> / {license.tradesLimit}</span></span>;
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="pz-note pz-note--bad pza-error" role="alert">
      <span>{message}</span>
      <button type="button" className="pz-btn pz-btn--quiet pz-btn--sm" onClick={onRetry}>Try again</button>
    </div>
  );
}

function Loading({ children }) {
  return <p className="pza-loading" role="status">{children}</p>;
}

/* ------------------------------------------------------------------ drawer */

function Drawer({ titleId, onClose, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    panelRef.current?.querySelector('[data-autofocus]')?.focus();
    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [onClose]);

  return (
    <div className="pz-overlay pza-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panelRef} className="pz-drawer pza-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {children}
      </div>
    </div>
  );
}

function DrawerHead({ titleId, title, sub, onClose }) {
  return (
    <div className="pza-drawer__head">
      <div className="pza-drawer__titles">
        <h2 id={titleId} className="pza-drawer__title">{title}</h2>
        {sub && <p className="pza-drawer__sub">{sub}</p>}
      </div>
      <button type="button" className="pz-btn pz-btn--quiet pz-btn--sm pza-iconbtn" onClick={onClose} aria-label="Close" data-autofocus>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

function GrantDrawer({ onClose, onGranted }) {
  const titleId = useId();
  const [identifier, setIdentifier] = useState('');
  const [plan, setPlan] = useState('lifetime');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!identifier.trim()) return;
    setSaving(true);
    setResult(null);
    try {
      const response = await api.post('/api/admin/grant-access', { identifier: identifier.trim(), plan });
      const message = response.data?.message || `${planName(plan)} access granted.`;
      setResult({ ok: true, message });
      toast.success(message);
      setIdentifier('');
      onGranted();
    } catch (error) {
      const message = displayError(error, 'Could not grant access.');
      setResult({ ok: false, message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer titleId={titleId} onClose={onClose}>
      <DrawerHead titleId={titleId} title="Grant access" sub="Find an existing account by email or Pocket Option UID and set its plan. Trades used resets to 0." onClose={onClose} />
      <form className="pza-form" onSubmit={submit}>
        <label className="pz-field">
          Email or Pocket Option UID
          <input className="pz-input" value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="name@example.com or 12345678" autoComplete="off" />
        </label>
        <label className="pz-field">
          Plan
          <select className="pz-select" value={plan} onChange={event => setPlan(event.target.value)}>
            {PLAN_OPTIONS.filter(option => option.value !== 'free').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className="pza-actions">
          <button type="submit" className="pz-btn pz-btn--sm" disabled={saving || !identifier.trim()}>{saving ? 'Granting…' : 'Grant access'}</button>
          <button type="button" className="pz-btn pz-btn--quiet pz-btn--sm" onClick={onClose}>Cancel</button>
        </div>
        {result && <p className={`pz-note ${result.ok ? 'pz-note--good' : 'pz-note--bad'}`} role="status">{result.message}</p>}
      </form>
    </Drawer>
  );
}

function UserDrawer({ user, onClose, onChanged, onDeleted }) {
  const titleId = useId();
  const license = user.license;
  const [plan, setPlan] = useState(license?.plan || 'free');
  const [poUid, setPoUid] = useState(user.poUserId || '');
  const [savingUser, setSavingUser] = useState(false);
  const [allowance, setAllowance] = useState(String(license?.aiTradesAllowance ?? 0));
  const [savingAllowance, setSavingAllowance] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [trades, setTrades] = useState([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradesError, setTradesError] = useState('');

  useEffect(() => {
    setPlan(user.license?.plan || 'free');
    setPoUid(user.poUserId || '');
    setAllowance(String(user.license?.aiTradesAllowance ?? 0));
  }, [user]);

  const loadTrades = useCallback(async () => {
    setTradesLoading(true);
    setTradesError('');
    try {
      const response = await api.get(`/api/admin/users/${user.id}/trades`);
      setTrades(response.data?.trades || []);
    } catch (error) {
      setTradesError(displayError(error, 'Could not load this user’s trades.'));
    } finally {
      setTradesLoading(false);
    }
  }, [user.id]);

  useEffect(() => { loadTrades(); }, [loadTrades]);

  const planChanged = plan !== (license?.plan || 'free');
  const poUidChanged = poUid.trim() !== (user.poUserId || '');

  async function saveUser(event) {
    event.preventDefault();
    const body = {};
    if (planChanged) body.plan = plan;
    if (poUidChanged) body.poUserId = poUid.trim();
    if (!Object.keys(body).length) return;
    setSavingUser(true);
    try {
      await api.patch(`/api/admin/users/${user.id}`, body);
      toast.success('User updated.');
      onChanged();
    } catch (error) {
      toast.error(displayError(error, 'Could not update this user.'));
    } finally {
      setSavingUser(false);
    }
  }

  async function saveAllowance(event) {
    event.preventDefault();
    const value = Number.parseInt(allowance, 10);
    if (!Number.isFinite(value) || value < 0 || String(value) !== allowance.trim()) {
      toast.error('Enter a whole number, 0 or more.');
      return;
    }
    setSavingAllowance(true);
    try {
      await api.patch('/api/admin/grant-ai-allowance', { userId: user.id, aiTradesAllowance: value });
      toast.success('AI allowance updated.');
      onChanged();
    } catch (error) {
      toast.error(displayError(error, 'Could not update the AI allowance.'));
    } finally {
      setSavingAllowance(false);
    }
  }

  async function deleteUser() {
    setDeleting(true);
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      toast.success(`${user.email} deleted.`);
      onDeleted();
    } catch (error) {
      toast.error(displayError(error, 'Could not delete this user.'));
      setDeleting(false);
    }
  }

  const status = activityStatus(user);

  return (
    <Drawer titleId={titleId} onClose={onClose}>
      <DrawerHead titleId={titleId} title={user.email} sub={status.label} onClose={onClose} />

      <dl className="pza-facts">
        <div><dt>Plan</dt><dd><PlanChip plan={license?.plan} /></dd></div>
        <div><dt>Status</dt><dd><StatusChip user={user} /></dd></div>
        <div><dt>Trades used</dt><dd className="pza-num"><TradesCell license={license} /></dd></div>
        <div><dt>AI trades</dt><dd className="pza-num">{license ? `${license.aiTradesUsed ?? 0} / ${license.aiTradesAllowance ?? 0}` : '—'}</dd></div>
        <div><dt>PO UID</dt><dd className="pza-mono">{user.poUserId || '—'}</dd></div>
        <div><dt>Strategy</dt><dd>{user.currentStrategy || '—'}</dd></div>
        <div><dt>Joined</dt><dd>{formatDate(user.createdAt, true)}</dd></div>
        <div><dt>Last active</dt><dd>{formatDate(user.lastActiveAt, true)}</dd></div>
        <div><dt>Latest balance</dt><dd className="pza-num">{user.latestBalance != null ? `$${Number(user.latestBalance).toFixed(2)}` : '—'}</dd></div>
      </dl>

      <section className="pza-dsec" aria-labelledby={`${titleId}-acc`}>
        <h3 id={`${titleId}-acc`} className="pza-h3">Plan and Pocket Option UID</h3>
        <form className="pza-form" onSubmit={saveUser}>
          <div className="pza-form__row">
            <label className="pz-field">
              Plan
              <select className="pz-select" value={plan} onChange={event => setPlan(event.target.value)}>
                {PLAN_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="pz-field">
              PO UID
              <input className="pz-input pza-mono" value={poUid} onChange={event => setPoUid(event.target.value)} placeholder="Empty clears it" autoComplete="off" />
            </label>
          </div>
          {!license && <p className="pza-hint">This account has no licence yet, so a plan change may fail. Use Grant access instead.</p>}
          <div className="pza-actions">
            <button type="submit" className="pz-btn pz-btn--sm" disabled={savingUser || (!planChanged && !poUidChanged)}>{savingUser ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </section>

      {license && (
        <section className="pza-dsec" aria-labelledby={`${titleId}-ai`}>
          <h3 id={`${titleId}-ai`} className="pza-h3">AI trades allowance</h3>
          <form className="pza-form" onSubmit={saveAllowance}>
            <div className="pza-form__inline">
              <label className="pz-field">
                Allowance (used {license.aiTradesUsed ?? 0})
                <input className="pz-input pza-num" type="number" min="0" step="1" inputMode="numeric" value={allowance} onChange={event => setAllowance(event.target.value)} />
              </label>
              <button type="submit" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={savingAllowance || allowance === String(license.aiTradesAllowance ?? 0)}>{savingAllowance ? 'Saving…' : 'Set allowance'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="pza-dsec" aria-labelledby={`${titleId}-trades`}>
        <h3 id={`${titleId}-trades`} className="pza-h3">Recent real trades</h3>
        {tradesLoading ? <Loading>Loading trades…</Loading>
          : tradesError ? <ErrorState message={tradesError} onRetry={loadTrades} />
          : trades.length === 0 ? <p className="pza-quiet">No real trades for this user.</p>
          : (
            <div className="pz-tablewrap pza-tablewrap--inset">
              <table className="pz-table pza-table pza-table--compact">
                <thead><tr><th>Time</th><th>Pair</th><th>Direction</th><th className="num">Amount</th><th>Result</th><th className="num">Balance</th></tr></thead>
                <tbody>{trades.map(trade => (
                  <tr key={trade.id}>
                    <td>{formatDate(trade.createdAt, true)}</td>
                    <td className="pza-mono">{trade.pair}</td>
                    <td>{trade.direction}</td>
                    <td className="num">{trade.amount != null ? `$${Number(trade.amount).toFixed(2)}` : '—'}</td>
                    <td className={trade.result === 'win' ? 'pza-good' : trade.result === 'loss' ? 'pza-bad' : undefined}>{trade.result}</td>
                    <td className="num">{trade.balanceAfter != null ? `$${Number(trade.balanceAfter).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      </section>

      <section className="pza-dsec pza-dsec--danger" aria-labelledby={`${titleId}-del`}>
        <h3 id={`${titleId}-del`} className="pza-h3">Delete user</h3>
        {confirmDelete ? (
          <div className="pz-note pz-note--bad pza-confirm" role="alert">
            <p>Delete {user.email} with all their trades, settings and licence? This cannot be undone.</p>
            <div className="pza-actions">
              <button type="button" className="pz-btn pz-btn--danger pz-btn--sm" onClick={deleteUser} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes, delete for good'}</button>
              <button type="button" className="pz-btn pz-btn--quiet pz-btn--sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Keep user</button>
            </div>
          </div>
        ) : (
          <button type="button" className="pz-btn pz-btn--danger pz-btn--sm" onClick={() => setConfirmDelete(true)}>Delete user…</button>
        )}
      </section>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ blocks */

function ClaimsBlock({ claims, loading, error, onRetry, onAct, actingId, rejectingId, setRejectingId }) {
  return (
    <section className="pza-block" aria-labelledby="pza-claims-h">
      <div className="pza-block__head">
        <h2 id="pza-claims-h" className="pza-h2">Needs you</h2>
        {!loading && !error && claims.length > 0 && <span className="pz-chip pz-chip--warn">{claims.length} claim{claims.length === 1 ? '' : 's'} waiting</span>}
      </div>
      {loading ? <Loading>Loading claims…</Loading>
        : error ? <ErrorState message={error} onRetry={onRetry} />
        : claims.length === 0 ? <p className="pza-quiet">No claims waiting.</p>
        : (
          <div className="pz-tablewrap">
            <table className="pz-table pza-table">
              <thead><tr><th>Email</th><th>Pocket Option UID</th><th>Submitted</th><th className="pza-right">Decision</th></tr></thead>
              <tbody>{claims.map(claim => {
                const busy = actingId === claim.userId;
                return (
                  <tr key={claim.userId}>
                    <td>{claim.email}</td>
                    <td className="pza-mono">{claim.claimedPoUid || '—'}</td>
                    <td>{formatDate(claim.submittedAt, true)}</td>
                    <td className="pza-right">
                      {rejectingId === claim.userId ? (
                        <span className="pza-actions pza-actions--end">
                          <button type="button" className="pz-btn pz-btn--danger pz-btn--sm" disabled={busy} onClick={() => onAct(claim.userId, 'reject')}>{busy ? 'Rejecting…' : 'Confirm reject'}</button>
                          <button type="button" className="pz-btn pz-btn--quiet pz-btn--sm" onClick={() => setRejectingId(null)}>Cancel</button>
                        </span>
                      ) : (
                        <span className="pza-actions pza-actions--end">
                          <button type="button" className="pz-btn pz-btn--sm" disabled={busy} onClick={() => onAct(claim.userId, 'approve')}>{busy ? 'Saving…' : 'Approve'}</button>
                          <button type="button" className="pz-btn pz-btn--danger pz-btn--sm" disabled={busy} onClick={() => setRejectingId(claim.userId)}>Reject</button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
    </section>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div className="pz-stat pza-tile">
      <span className="pz-stat__n">{value}</span>
      <span className="pz-stat__l">{label}</span>
      {sub && <span className="pza-tile__sub">{sub}</span>}
    </div>
  );
}

function NumbersBlock({ users, usersState, activity, activityState }) {
  const derived = useMemo(() => {
    const weekAgo = Date.now() - 7 * DAY;
    const plans = { lifetime: 0, basic: 0, free: 0 };
    let newThisWeek = 0;
    let atLimit = 0;
    for (const user of users) {
      if (user.createdAt && new Date(user.createdAt).getTime() >= weekAgo) newThisWeek += 1;
      if (user.license?.plan in plans) plans[user.license.plan] += 1;
      if (hitTradeLimit(user)) atLimit += 1;
    }
    return { newThisWeek, plans, paid: plans.lifetime + plans.basic, atLimit };
  }, [users]);

  const capped = users.length >= USERS_PAGE_CAP;
  const listNote = capped ? `Of the ${users.length} newest users` : null;
  const fromUsers = value => (usersState.loading ? '…' : usersState.error ? '—' : value);
  const fromActivity = value => (activityState.loading ? '…' : activityState.error ? '—' : value);

  const segments = ACTIVITY_SEGMENTS.map(segment => ({ ...segment, value: Number(activity?.[segment.key] || 0) }));
  const segmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <section className="pza-block" aria-labelledby="pza-numbers-h">
      <div className="pza-block__head">
        <h2 id="pza-numbers-h" className="pza-h2">Numbers</h2>
      </div>
      <div className="pza-tiles">
        <Tile label="Total users" value={fromActivity(formatNumber(activity?.totalUsers))} />
        <Tile label="Active in 7 days" value={fromActivity(formatNumber((activity?.active24h || 0) + (activity?.active7d || 0)))} />
        <Tile label="New in 7 days" value={fromUsers(`${derived.newThisWeek}${capped && derived.newThisWeek >= users.length ? '+' : ''}`)} sub={listNote} />
        <Tile label="Paid or Pro users" value={fromUsers(derived.paid)} sub={usersState.loading || usersState.error ? null : `${derived.plans.lifetime} Pro · ${derived.plans.basic} Basic · ${derived.plans.free} Demo${capped ? ` · newest ${users.length}` : ''}`} />
        <Tile label="Hit the trade limit" value={fromUsers(derived.atLimit)} sub={usersState.loading || usersState.error ? null : (derived.atLimit ? 'Upgrade candidates' : listNote)} />
      </div>
      {usersState.error && <ErrorState message={usersState.error} onRetry={usersState.retry} />}

      <div className="pza-activity">
        <div className="pza-activity__head">
          <h3 className="pza-h3">Activity</h3>
          {!activityState.loading && !activityState.error && (
            <span className="pz-chip pz-chip--plain pza-online" title={activity?.onlineNowCaveat || ONLINE_CAVEAT}>
              <span className={`pz-dot${activity?.onlineNow ? ' pz-dot--good' : ''}`} aria-hidden="true" />
              <span>Online now</span>
              <strong className="pza-num">{activity?.onlineNow ?? 0}</strong>
            </span>
          )}
        </div>
        {activityState.loading ? <Loading>Loading activity…</Loading>
          : activityState.error ? <ErrorState message={activityState.error} onRetry={activityState.retry} />
          : (
            <>
              <div className="pza-bar" role="img" aria-label={segments.map(segment => `${segment.label}: ${segment.value}`).join(', ')}>
                {segmentTotal === 0
                  ? <span className="pza-bar__seg pza-bar__seg--e" style={{ flexGrow: 1 }} />
                  : segments.filter(segment => segment.value > 0).map(segment => (
                    <span key={segment.key} className={`pza-bar__seg pza-bar__seg--${segment.tone}`} style={{ flexGrow: segment.value }} title={`${segment.label}: ${segment.value}`} />
                  ))}
              </div>
              <ul className="pza-legend">
                {segments.map(segment => (
                  <li key={segment.key}>
                    <span className={`pza-swatch pza-bar__seg--${segment.tone}`} aria-hidden="true" />
                    {segment.label} <strong className="pza-num">{segment.value}</strong>
                  </li>
                ))}
                {activity?.everTraded != null && <li className="pza-legend__aside">Ever traded <strong className="pza-num">{activity.everTraded}</strong></li>}
              </ul>
            </>
          )}
      </div>
    </section>
  );
}

function UsersPanel({ users, usersState, onManage, onGrant, searchResults, setSearchResults }) {
  const [query, setQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'createdAt', direction: 'desc' });
  const [serverSearch, setServerSearch] = useState({ loading: false, error: '', term: '' });

  const source = searchResults ?? users;

  const planCounts = useMemo(() => {
    const counts = { all: source.length, free: 0, basic: 0, lifetime: 0 };
    for (const user of source) if (user.license?.plan in counts) counts[user.license.plan] += 1;
    return counts;
  }, [source]);

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    let list = planFilter === 'all' ? source : source.filter(user => user.license?.plan === planFilter);
    if (search && !searchResults) {
      list = list.filter(user => [user.email, user.poUserId, planName(user.license?.plan), licenseState(user)]
        .some(value => String(value || '').toLowerCase().includes(search)));
    }
    return [...list].sort((a, b) => {
      const left = sortableValue(a, sort.key);
      const right = sortableValue(b, sort.key);
      const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [planFilter, query, searchResults, sort, source]);

  function changeSort(key) {
    setSort(current => (current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' }));
  }

  async function searchServer(event) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    setServerSearch({ loading: true, error: '', term });
    try {
      const response = await api.get('/api/admin/users', { params: { search: term } });
      setSearchResults(response.data?.users || []);
      setServerSearch({ loading: false, error: '', term });
    } catch (error) {
      setServerSearch({ loading: false, error: displayError(error, 'Could not search users.'), term });
    }
  }

  function clearServerSearch() {
    setSearchResults(null);
    setServerSearch({ loading: false, error: '', term: '' });
    setQuery('');
  }

  function exportUsers() {
    const header = ['Email', 'PO UID', 'Plan', 'Licence state', 'Trades used', 'Trades limit', 'AI allowance', 'AI used', 'Joined', 'Last active'];
    const rows = visibleUsers.map(user => [
      user.email,
      user.poUserId || '',
      planName(user.license?.plan),
      licenseState(user),
      user.license?.tradesUsed ?? 0,
      user.license?.tradesLimit ?? '',
      user.license?.aiTradesAllowance ?? '',
      user.license?.aiTradesUsed ?? '',
      user.createdAt || '',
      user.lastActiveAt || '',
    ]);
    const csv = [header, ...rows].map(row => row.map(csvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'avalisa-admin-users.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pza-panel">
      <div className="pza-toolbar">
        <form className="pza-search" onSubmit={searchServer} role="search">
          <Search size={16} className="pza-search__icon" aria-hidden="true" />
          <label className="pza-sr" htmlFor="pza-user-search">Search users</label>
          <input id="pza-user-search" className="pz-input pza-search__input" value={query} onChange={event => { setQuery(event.target.value); if (searchResults) setSearchResults(null); }} placeholder="Search email, UID, plan…" />
        </form>
        <div className="pza-filters" role="group" aria-label="Filter by plan">
          {PLAN_FILTERS.map(filter => (
            <button key={filter.key} type="button" className={`pza-filter${planFilter === filter.key ? ' is-on' : ''}`} aria-pressed={planFilter === filter.key} onClick={() => setPlanFilter(filter.key)}>
              {filter.label} <span className="pza-num pza-dim">{planCounts[filter.key]}</span>
            </button>
          ))}
        </div>
        <div className="pza-toolbar__end">
          <button type="button" className="pz-btn pz-btn--sm" onClick={onGrant}><UserPlus size={15} aria-hidden="true" /> Grant access</button>
          <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" onClick={exportUsers} disabled={!visibleUsers.length}><Download size={15} aria-hidden="true" /> Export CSV</button>
        </div>
      </div>

      {usersState.loading ? <Loading>Loading users…</Loading>
        : usersState.error ? <ErrorState message={usersState.error} onRetry={usersState.retry} />
        : (
          <>
            <p className="pza-caption">
              {searchResults
                ? <>Server results for “{serverSearch.term}”: {visibleUsers.length} shown. <button type="button" className="pza-linkbtn" onClick={clearServerSearch}>Back to newest users</button></>
                : <>Showing {visibleUsers.length} of the {users.length} newest users{query.trim() ? <> · older accounts: press Enter to search all</> : null}.</>}
            </p>
            {serverSearch.loading && <Loading>Searching all users…</Loading>}
            {serverSearch.error && <ErrorState message={serverSearch.error} onRetry={() => searchServer({ preventDefault() {} })} />}
            {source.length === 0 && !searchResults ? <p className="pz-empty">No users returned by the admin endpoint.</p>
              : visibleUsers.length === 0 ? <p className="pz-empty">No users match{query.trim() ? ` “${query.trim()}”` : ''}{planFilter !== 'all' ? ` on ${planName(planFilter)}` : ''}.</p>
              : (
                <div className="pz-tablewrap">
                  <table className="pz-table pza-table pza-users">
                    <thead>
                      <tr>
                        {COLUMNS.map(column => (
                          <th key={column.key} className={column.num ? 'num' : undefined} aria-sort={sort.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}>
                            <button type="button" className="pza-sort" onClick={() => changeSort(column.key)}>
                              {column.label}
                              {sort.key === column.key && <span aria-hidden="true">{sort.direction === 'asc' ? '↑' : '↓'}</span>}
                            </button>
                          </th>
                        ))}
                        <th><span className="pza-sr">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUsers.map(user => (
                        <tr key={user.id} className="pza-row" onClick={() => onManage(user)}>
                          <td><span className="pza-who"><UserActivityDot user={user} /><span className="pza-email">{user.email}</span></span></td>
                          <td><PlanChip plan={user.license?.plan} /></td>
                          <td><StatusChip user={user} /></td>
                          <td className="num"><TradesCell license={user.license} /></td>
                          <td className="pza-mono">{user.poUserId || <span className="pza-dim">—</span>}</td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td title={user.lastActiveAt ? formatDate(user.lastActiveAt, true) : undefined}>{formatAgo(user.lastActiveAt)}</td>
                          <td className="pza-right">
                            <button type="button" className="pz-btn pz-btn--quiet pz-btn--sm" onClick={event => { event.stopPropagation(); onManage(user); }} aria-label={`Manage ${user.email}`}>Manage</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}
    </div>
  );
}

function GrowthPanel({ funnel, loading, error, onRetry }) {
  const { steps, others, max } = useMemo(() => {
    const byType = new Map(funnel.map(item => [item.type || item.event, Number(item.count || 0)]));
    const known = FUNNEL_STEPS.filter(step => byType.has(step.type)).map(step => ({ ...step, count: byType.get(step.type) }));
    const knownTypes = new Set(FUNNEL_STEPS.map(step => step.type));
    const rest = funnel
      .filter(item => !knownTypes.has(item.type || item.event))
      .map((item, index) => ({ type: item.type || item.event || `event-${index}`, label: FUNNEL_OTHER_LABELS[item.type] || item.label || item.type || item.event || `Event ${index + 1}`, count: Number(item.count || 0) }));
    const top = Math.max(1, ...known.map(step => step.count), ...rest.map(item => item.count));
    return { steps: known, others: rest, max: top };
  }, [funnel]);

  if (loading) return <Loading>Loading funnel…</Loading>;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!funnel.length) return <p className="pz-empty">Funnel analytics are not enabled yet, or no events were recorded.</p>;

  return (
    <div className="pza-panel">
      <p className="pza-caption">All recorded funnel events. The rate is each step against the step above it.</p>
      {steps.length > 0 && (
        <ol className="pza-funnel">
          {steps.map((step, index) => {
            const previous = index > 0 ? steps[index - 1].count : null;
            const rate = previous ? Math.round((step.count / previous) * 1000) / 10 : null;
            return (
              <li key={step.type} className="pza-funnel__row">
                <span className="pza-funnel__label">{step.label}</span>
                <span className="pza-funnel__track"><span className="pza-funnel__fill" style={{ width: `${Math.max(1.5, (step.count / max) * 100)}%` }} /></span>
                <span className="pza-funnel__count pza-num">{formatNumber(step.count)}</span>
                <span className="pza-funnel__rate pza-num">{rate == null ? '' : `${rate}%`}</span>
              </li>
            );
          })}
        </ol>
      )}
      {others.length > 0 && (
        <>
          <h3 className="pza-h3 pza-funnel__other">Other events</h3>
          <ul className="pza-funnel">
            {others.map(item => (
              <li key={item.type} className="pza-funnel__row">
                <span className="pza-funnel__label">{item.label}</span>
                <span className="pza-funnel__track"><span className="pza-funnel__fill pza-funnel__fill--muted" style={{ width: `${Math.max(1.5, (item.count / max) * 100)}%` }} /></span>
                <span className="pza-funnel__count pza-num">{formatNumber(item.count)}</span>
                <span className="pza-funnel__rate" />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SystemPanel({ tokenUsage, tokenState, aiSettings, aiState, onTokensReset }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [budget, setBudget] = useState('10000');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!aiSettings) return;
    setPrompt(aiSettings.ai_strategy_prompt || '');
    setBudget(String(aiSettings.ai_token_budget_per_user || '10000'));
  }, [aiSettings]);

  const usageRows = tokenUsage?.users || [];
  const totalTokens = usageRows.reduce((sum, row) => sum + Number(row.tokensUsed || 0), 0);

  async function resetTokens() {
    setResetting(true);
    try {
      const response = await api.post('/api/admin/token-reset');
      toast.success(`Token usage reset. ${response.data?.recordsDeleted ?? 0} records removed.`);
      setConfirmReset(false);
      onTokensReset();
    } catch (error) {
      toast.error(displayError(error, 'Could not reset token usage.'));
    } finally {
      setResetting(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const value = Number.parseInt(budget, 10);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('The token budget must be a whole number, 0 or more.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/api/admin/ai-settings', { ai_strategy_prompt: prompt, ai_token_budget_per_user: String(value) });
      toast.success('AI settings saved.');
      aiState.retry();
      tokenState.retry();
    } catch (error) {
      toast.error(displayError(error, 'Could not save AI settings.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pza-panel pza-system">
      <section className="pza-sysblock" aria-labelledby="pza-tokens-h">
        <div className="pza-block__head">
          <h3 id="pza-tokens-h" className="pza-h3">AI token usage{tokenUsage?.month ? `, ${tokenUsage.month}` : ''}</h3>
          {!tokenState.loading && !tokenState.error && (confirmReset ? (
            <span className="pza-actions">
              <button type="button" className="pz-btn pz-btn--danger pz-btn--sm" onClick={resetTokens} disabled={resetting}>{resetting ? 'Resetting…' : 'Confirm reset for everyone'}</button>
              <button type="button" className="pz-btn pz-btn--quiet pz-btn--sm" onClick={() => setConfirmReset(false)} disabled={resetting}>Cancel</button>
            </span>
          ) : (
            <button type="button" className="pz-btn pz-btn--danger pz-btn--sm" onClick={() => setConfirmReset(true)}>Reset this month…</button>
          ))}
        </div>
        {tokenState.loading ? <Loading>Loading token usage…</Loading>
          : tokenState.error ? <ErrorState message={tokenState.error} onRetry={tokenState.retry} />
          : (
            <>
              <p className="pza-caption">Top {usageRows.length || 10} users this month · budget {formatNumber(tokenUsage?.budget)} tokens per user{confirmReset ? ' · reset deletes every user’s usage for this month' : ''}.</p>
              {usageRows.length === 0 ? <p className="pza-quiet">No token usage this month.</p> : (
                <div className="pz-tablewrap">
                  <table className="pz-table pza-table">
                    <thead><tr><th>User</th><th className="num">Tokens</th><th className="num">Of budget</th></tr></thead>
                    <tbody>{usageRows.map(row => (
                      <tr key={row.email}>
                        <td>{row.email}</td>
                        <td className="num">{formatNumber(row.tokensUsed)}</td>
                        <td className={`num${row.percentOfBudget >= 80 ? ' pza-warn' : ''}`}>{row.isAdmin ? 'Unlimited' : `${row.percentOfBudget ?? 0}%`}</td>
                      </tr>
                    ))}</tbody>
                    <tfoot><tr><td>Total shown</td><td className="num">{formatNumber(totalTokens)}</td><td /></tr></tfoot>
                  </table>
                </div>
              )}
            </>
          )}
      </section>

      <section className="pza-sysblock" aria-labelledby="pza-ai-h">
        <h3 id="pza-ai-h" className="pza-h3">AI settings</h3>
        {aiState.loading ? <Loading>Loading AI settings…</Loading>
          : aiState.error ? <ErrorState message={aiState.error} onRetry={aiState.retry} />
          : (
            <form className="pza-form" onSubmit={saveSettings}>
              <label className="pz-field">
                Strategy prompt
                <textarea className="pz-input pza-textarea" rows={10} value={prompt} onChange={event => setPrompt(event.target.value)} />
              </label>
              <label className="pz-field pza-field--narrow">
                Monthly token budget per user
                <input className="pz-input pza-num" type="number" min="0" step="1" inputMode="numeric" value={budget} onChange={event => setBudget(event.target.value)} />
              </label>
              <div className="pza-actions">
                <button type="submit" className="pz-btn pz-btn--sm" disabled={saving}>{saving ? 'Saving…' : 'Save AI settings'}</button>
              </div>
            </form>
          )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'growth', label: 'Growth' },
  { key: 'system', label: 'System' },
];

export default function Admin() {
  const [claims, setClaims] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [activity, setActivity] = useState(null);
  const [tokenUsage, setTokenUsage] = useState(null);
  const [funnel, setFunnel] = useState([]);
  const [aiSettings, setAiSettings] = useState(null);
  const [loading, setLoading] = useState({ claims: true, users: true, activity: true, tokenUsage: true, funnel: true, aiSettings: true });
  const [errors, setErrors] = useState({});
  const [updatedAt, setUpdatedAt] = useState(null);
  const [actingClaimId, setActingClaimId] = useState(null);
  const [rejectingClaimId, setRejectingClaimId] = useState(null);
  const [tab, setTab] = useState('users');
  const [drawer, setDrawer] = useState(null); // null | { mode: 'grant' } | { mode: 'user', userId }
  const tabRefs = useRef({});

  const makeLoader = useCallback((key, url, apply, fallback) => async () => {
    setLoading(current => ({ ...current, [key]: true }));
    setErrors(current => ({ ...current, [key]: '' }));
    try {
      const response = await api.get(url);
      apply(response.data);
    } catch (error) {
      setErrors(current => ({ ...current, [key]: displayError(error, fallback) }));
    } finally {
      setLoading(current => ({ ...current, [key]: false }));
    }
  }, []);

  const loaders = useMemo(() => ({
    claims: makeLoader('claims', '/api/admin/claims', data => setClaims(Array.isArray(data) ? data : []), 'Could not load pending claims.'),
    users: makeLoader('users', '/api/admin/users', data => setUsers(data?.users || []), 'Could not load users.'),
    activity: makeLoader('activity', '/api/admin/activity', data => setActivity(data || null), 'Could not load user activity.'),
    tokenUsage: makeLoader('tokenUsage', '/api/admin/token-usage', data => setTokenUsage(data || { users: [] }), 'Could not load token usage.'),
    funnel: makeLoader('funnel', '/api/admin/funnel', data => setFunnel(Array.isArray(data?.funnel) ? data.funnel : []), 'Could not load funnel data.'),
    aiSettings: makeLoader('aiSettings', '/api/admin/ai-settings', data => setAiSettings(data || {}), 'Could not load AI settings.'),
  }), [makeLoader]);

  const refreshAll = useCallback(async () => {
    await Promise.all(Object.values(loaders).map(load => load()));
    setUpdatedAt(new Date());
  }, [loaders]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const block = key => ({ loading: loading[key], error: errors[key], retry: loaders[key] });

  async function actOnClaim(userId, action) {
    setActingClaimId(userId);
    try {
      const payload = action === 'reject' ? { userId, reason: 'not_found' } : { userId };
      await api.post(`/api/admin/claims/${action}`, payload);
      toast.success(action === 'approve' ? 'Claim approved. Pro access is active.' : 'Claim rejected.');
      setRejectingClaimId(null);
      await Promise.all([loaders.claims(), loaders.users()]);
    } catch (error) {
      toast.error(displayError(error, `Could not ${action} this claim.`));
    } finally {
      setActingClaimId(null);
    }
  }

  const closeDrawer = useCallback(() => setDrawer(null), []);

  async function reloadUsers() {
    setSearchResults(null);
    await loaders.users();
  }

  const drawerUser = drawer?.mode === 'user'
    ? (searchResults || []).concat(users).find(user => user.id === drawer.userId) || drawer.snapshot
    : null;

  function onTabKey(event, index) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TABS.length - 1;
    setTab(TABS[next].key);
    tabRefs.current[TABS[next].key]?.focus();
  }

  return (
    <main className="pz pza">
      <div className="pz-wrap pza-wrap">
        <header className="pza-head">
          <MascotAvatar size={48} />
          <div className="pza-head__copy">
            <h1 className="pz-display pza-title">Admin</h1>
            <p className="pza-head__meta">{updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading…'}</p>
          </div>
          <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm pza-head__refresh" onClick={refreshAll} aria-label="Refresh admin data">
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
        </header>

        <ClaimsBlock
          claims={claims}
          loading={loading.claims}
          error={errors.claims}
          onRetry={loaders.claims}
          onAct={actOnClaim}
          actingId={actingClaimId}
          rejectingId={rejectingClaimId}
          setRejectingId={setRejectingClaimId}
        />

        <NumbersBlock users={users} usersState={block('users')} activity={activity} activityState={block('activity')} />

        <div className="pza-tabsblock">
          <div className="pz-tabs" role="tablist" aria-label="Admin sections">
            {TABS.map((item, index) => (
              <button
                key={item.key}
                ref={node => { tabRefs.current[item.key] = node; }}
                type="button"
                role="tab"
                id={`pza-tab-${item.key}`}
                aria-controls={`pza-panel-${item.key}`}
                aria-selected={tab === item.key}
                tabIndex={tab === item.key ? 0 : -1}
                className="pz-tab"
                onClick={() => setTab(item.key)}
                onKeyDown={event => onTabKey(event, index)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`pza-panel-${tab}`} aria-labelledby={`pza-tab-${tab}`} className="pza-tabpanel">
            {tab === 'users' && (
              <UsersPanel
                users={users}
                usersState={block('users')}
                searchResults={searchResults}
                setSearchResults={setSearchResults}
                onManage={user => setDrawer({ mode: 'user', userId: user.id, snapshot: user })}
                onGrant={() => setDrawer({ mode: 'grant' })}
              />
            )}
            {tab === 'growth' && <GrowthPanel funnel={funnel} loading={loading.funnel} error={errors.funnel} onRetry={loaders.funnel} />}
            {tab === 'system' && (
              <SystemPanel
                tokenUsage={tokenUsage}
                tokenState={block('tokenUsage')}
                aiSettings={aiSettings}
                aiState={block('aiSettings')}
                onTokensReset={loaders.tokenUsage}
              />
            )}
          </div>
        </div>
      </div>

      {drawer?.mode === 'grant' && <GrantDrawer onClose={closeDrawer} onGranted={reloadUsers} />}
      {drawerUser && (
        <UserDrawer
          key={drawerUser.id}
          user={drawerUser}
          onClose={closeDrawer}
          onChanged={reloadUsers}
          onDeleted={() => { closeDrawer(); reloadUsers(); loaders.activity(); }}
        />
      )}
    </main>
  );
}
