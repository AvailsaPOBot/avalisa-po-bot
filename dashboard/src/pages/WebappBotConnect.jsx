import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/luxury.css';

// Pocket Option's own pages, where the phone Webapp Bot panel runs. The session is posted
// to these origins only; the browser drops it for any other opener.
export const PO_ORIGINS = [
  'https://m.po.trade',
  'https://po.trade',
  'https://m.po.cash',
  'https://po.cash',
  'https://m.pocketoption.com',
  'https://pocketoption.com',
];

// The panel on Pocket Option's page opens this page to sign in, so the Avalisa password is
// typed on the Avalisa site (where the phone offers the right saved password) and never on
// Pocket Option's page. Once signed in, this page hands the session back to that tab.
export function handBackSession(opener, token, user) {
  if (!opener || !token) return false;
  const message = { type: 'avalisa-webapp-session', token, user: user ? { id: user.id, email: user.email } : null };
  PO_ORIGINS.forEach(origin => {
    try { opener.postMessage(message, origin); } catch (_) { /* opener closed */ }
  });
  return true;
}

export default function WebappBotConnect() {
  const { user } = useAuth();
  const [state, setState] = useState('pending');

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('jwt');
    const sent = handBackSession(window.opener, token, user);
    setState(sent ? 'sent' : 'no-opener');
    if (sent) window.setTimeout(() => { try { window.close(); } catch (_) {} }, 1200);
  }, [user]);

  if (!user) return <Navigate to="/login?next=/webapp-bot/connect" replace />;

  return (
    <main className="lux-webapp-page">
      <section className="lux-webapp-shell">
        <p className="lux-kicker">Webapp Bot</p>
        {state === 'no-opener' ? (
          <>
            <h1>Signed in, but the Pocket Option tab was not found.</h1>
            <p className="lux-webapp-intro">
              Go back to the Pocket Option tab, tap the Avalisa bookmark, and press
              Sign in to Avalisa in the panel again.
            </p>
          </>
        ) : (
          <>
            <h1>Signed in as {user.email}.</h1>
            <p className="lux-webapp-intro">
              Go back to the Pocket Option tab — the Avalisa panel now uses your plan.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
