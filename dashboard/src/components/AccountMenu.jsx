import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, LogOut, Smartphone, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { tradeTarget } from '../lib/tradeLaunch';

export function planLabelFor(user) {
  const plan = user?.license?.plan || 'free';
  return plan === 'lifetime' ? 'pro' : plan === 'free' ? 'demo' : plan;
}

// The one button a signed-in user needs most: take me to the bot. Where that is depends
// on the device (see lib/tradeLaunch.js).
export function TradeButton({ className = '', label = 'Trade', onNavigate }) {
  const target = tradeTarget();
  const content = (<><TrendingUp size={16} /> {label}</>);
  const cls = `account-trade ${className}`.trim();
  return target.external ? (
    <a href={target.href} className={cls} target="_blank" rel="noreferrer" title={target.hint} onClick={onNavigate}>{content}</a>
  ) : (
    <Link to={target.href} className={cls} title={target.hint} onClick={onNavigate}>{content}</Link>
  );
}

// Signed-in header cluster: Dashboard, a profile menu, and Trade. Replaces "Log in" and
// "Register", which kept showing after sign-in and made people think they were signed out.
export default function AccountMenu({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  if (!user) return null;
  const initial = (user.email || '?').trim().charAt(0).toUpperCase();
  const plan = planLabelFor(user);

  function done() { setOpen(false); onNavigate?.(); }
  function handleLogout() { logout(); done(); navigate('/'); }

  return (
    <div className="account-menu" ref={ref}>
      <Link to="/dashboard" className="account-menu__link" onClick={done}>Dashboard</Link>
      <div className="account-menu__profile">
        <button
          type="button"
          className="account-menu__avatar"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true">{initial}</span>
          <ChevronDown size={14} />
        </button>
        {open && (
          <div className="account-menu__dropdown" role="menu">
            <div className="account-menu__who">
              <span className="account-menu__badge-avatar" aria-hidden="true">{initial}</span>
              <div>
                <strong>{user.email}</strong>
                <span className={`account-menu__plan is-${plan}`}>{plan} plan</span>
              </div>
            </div>
            <Link role="menuitem" to="/dashboard" onClick={done}><LayoutDashboard size={16} /> Dashboard</Link>
            <Link role="menuitem" to="/webapp" onClick={done}><Smartphone size={16} /> Bot on this device</Link>
            {user.isAdmin && <Link role="menuitem" to="/admin" onClick={done}>Admin</Link>}
            <button role="menuitem" type="button" onClick={handleLogout}><LogOut size={16} /> Log out</button>
          </div>
        )}
      </div>
      <TradeButton onNavigate={done} />
    </div>
  );
}
