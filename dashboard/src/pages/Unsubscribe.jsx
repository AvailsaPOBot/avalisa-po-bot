import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '../lib/api';
import '../styles/luxury.css';

// Landing page for the unsubscribe link in marketing emails. Mail scanners
// open links on page load, so nothing here opts anyone out until the visitor
// actually clicks the button.
export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('idle');

  async function unsubscribe() {
    if (!token || status === 'loading') return;
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE}/api/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      setStatus(res.status === 200 ? 'done' : 'invalid');
    } catch (_) {
      setStatus('invalid');
    }
  }

  const invalid = !token || status === 'invalid';

  return (
    <main className="lux-not-found">
      <section>
        <p className="lux-kicker">Unsubscribe</p>
        {invalid && (
          <p>This link is not valid. Email avalisapobot@gmail.com and we will remove you.</p>
        )}
        {status === 'done' && <p>You are unsubscribed from these emails.</p>}
        {!invalid && status !== 'done' && (
          <>
            <p>Click the button to stop receiving these emails.</p>
            <button
              type="button"
              onClick={unsubscribe}
              disabled={status === 'loading'}
            >
              Unsubscribe
            </button>
          </>
        )}
      </section>
    </main>
  );
}
