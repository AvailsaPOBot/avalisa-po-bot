import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AFFILIATE_LINK } from '../lib/affiliate';
import { usePhoneLike } from '../lib/device';
import AccountMenu, { TradeButton } from './AccountMenu';

const navItems = [
  { label: 'How It Works', href: '/#how' },
  { label: 'Controls', href: '/#controls' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Free Pro', href: '/free-pro' },
  { label: 'Setup Guide', href: '/guide' },
  { label: 'Phone Setup', href: '/webapp' },
];

function Brand() {
  return (
    <Link to="/" className="pz-nav__brand">
      <img src="/assets/presenter/avalisa-logo.webp" alt="Avalisa PO Bot" width="520" height="274" />
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const phone = usePhoneLike();

  const plan = user?.license?.plan || 'free';
  const planLabel = plan === 'lifetime' ? 'pro' : plan === 'free' ? 'demo' : plan;

  function handleLogout() {
    logout();
    navigate('/');
    setMenuOpen(false);
  }

  return (
    <header className="pz-nav">
      <div className="pz-nav__inner">
        <Brand />

        <nav className="pz-nav__links" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item.label} href={item.href}>{item.label}</a>
          ))}
        </nav>

        <div className="pz-nav__actions">
          {user ? (
            <AccountMenu />
          ) : (
            <>
              <Link to="/login">Log In</Link>
              <Link to="/register" className="pz-btn pz-btn--sm">Start 10 Free Demo Trades</Link>
              <a href={AFFILIATE_LINK} className="pz-nav__po" target="_blank" rel="noreferrer">Pocket Option</a>
            </>
          )}
        </div>

        {phone && <Link to="/webapp" className="pz-nav__phone">Phone setup</Link>}

        <button
          className="pz-nav__menu"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="pz-nav__mobile">
          <Link to="/webapp" className="pz-btn pz-btn--sm" onClick={() => setMenuOpen(false)}>Phone setup</Link>
          {navItems.filter((item) => item.href !== '/webapp').map((item) => (
            <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>
          ))}
          {user ? (
            <>
              <TradeButton className="pz-btn pz-btn--sm" onNavigate={() => setMenuOpen(false)} />
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard ({planLabel})</Link>
              {user.isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>}
              <button type="button" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)}>Log In</Link>
              <Link to="/register" className="pz-btn pz-btn--sm" onClick={() => setMenuOpen(false)}>Start 10 Free Demo Trades</Link>
              <a href={AFFILIATE_LINK} className="pz-nav__po" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>Pocket Option</a>
            </>
          )}
        </div>
      )}
    </header>
  );
}
