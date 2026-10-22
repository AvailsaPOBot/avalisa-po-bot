import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AFFILIATE_LINK } from '../lib/affiliate';
import AccountMenu, { TradeButton } from './AccountMenu';

const navItems = [
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Controls', href: '/#controls' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Setup Guide', href: '/guide' },
  { label: 'Phone Setup', href: '/webapp' },
];

function Brand() {
  return (
    <Link to="/" className="site-brand">
      <span className="site-brand__primary">
        <img className="brand-signature brand-signature--nav" src="/images/brand/avalisa-signature-logo-gold.png" alt="Avalisa PO Bot" />
      </span>
      <span className="site-brand__badge">PO Bot</span>
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const plan = user?.license?.plan || 'free';
  const planLabel = plan === 'lifetime' ? 'pro' : plan === 'free' ? 'demo' : plan;

  function handleLogout() {
    logout();
    navigate('/');
    setMenuOpen(false);
  }

  return (
    <header className="site-nav site-nav--glass">
      <div className="site-nav__inner">
        <Brand />

        <nav className="site-nav__links" aria-label="Primary navigation">
          {navItems.map((item) => (
            <a key={item.label} href={item.href}>{item.label}</a>
          ))}
        </nav>

        <div className="site-nav__actions">
          {user ? (
            <AccountMenu />
          ) : (
            <>
              <Link to="/login">Log In</Link>
              <Link to="/register" className="site-nav__cta">Start 10 Free Demo Trades</Link>
              <a href={AFFILIATE_LINK} className="site-nav__po" target="_blank" rel="noreferrer">Pocket Option</a>
            </>
          )}
        </div>

        <button
          className="site-nav__menu"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <div className="site-nav__mobile">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>
          ))}
          {user ? (
            <>
              <TradeButton className="site-nav__cta" onNavigate={() => setMenuOpen(false)} />
              <Link to="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard ({planLabel})</Link>
              {user.isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>}
              <button type="button" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMenuOpen(false)}>Log In</Link>
              <Link to="/register" className="site-nav__cta" onClick={() => setMenuOpen(false)}>Start 10 Free Demo Trades</Link>
              <a href={AFFILIATE_LINK} className="site-nav__po" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>Pocket Option</a>
            </>
          )}
        </div>
      )}
    </header>
  );
}
