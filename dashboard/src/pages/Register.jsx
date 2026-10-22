import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Gift, Lock, Mail, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../lib/api';
import { AFFILIATE_LINK } from '../lib/affiliate';
import '../styles/luxury.css';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const affiliateIntent = searchParams.get('intent') === 'affiliate';

  useEffect(() => {
    const authError = searchParams.get('authError');
    if (authError) toast.error(authError.replaceAll('_', ' '));
  }, [searchParams]);

  function startSocialAuth(provider) {
    window.location.href = `${API_BASE}/api/auth/oauth/${provider}?from=register`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters');

    setLoading(true);
    try {
      await register(form.email, form.password);
      toast.success('Account created. Welcome to Avalisa.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lux-auth-page">
      <section className="lux-auth-shell register-layout">
        <aside className="register-next-panel">
          <p className="lux-kicker">Your first run</p>
          <h1>Start with a free Demo.</h1>
          <ol>
            <li><span>01</span><div><strong>Now · about 30 seconds</strong><p>Create your free Avalisa account, or continue with Google or Facebook.</p></div></li>
            <li><span>02</span><div><strong>Instant</strong><p>Get 10 Free Demo Trades automatically. No card required.</p></div></li>
            <li><span>03</span><div><strong>Next screen</strong><p>Choose phone setup at <Link to="/webapp">/webapp</Link> or install the desktop Chrome extension. Start on a Pocket Option demo balance.</p></div></li>
          </ol>
          <div className="register-security"><Lock size={17}/><p>Create a password for Avalisa. <strong>Never enter your Pocket Option password here.</strong></p></div>
          {affiliateIntent && <p className="register-intent-note">After you register a new Pocket Option account through our link, link its numeric ID in Dashboard → Settings. Pro unlocks when the referral is confirmed; otherwise it is queued for admin verification.</p>}
        </aside>
        <form className="lux-auth-card" onSubmit={handleSubmit}>
          <div className="lux-auth-brand"><img className="brand-signature brand-signature--auth" src="/images/brand/avalisa-signature-logo-gold.png" alt="Avalisa PO Bot" /></div>
          <h2>Create your account</h2>
          <p>Free to start. The Demo includes 10 trades. Try them on a Pocket Option demo balance first.</p>

          <a className="lux-auth-offer" href={AFFILIATE_LINK} target="_blank" rel="noreferrer">
            <Gift size={18} />
            <span>New to Pocket Option? Open an account through our link (we earn a commission), then add your Pocket Option ID in Settings to request Pro.</span>
          </a>

          <label><Mail size={15} /> Email<input type="email" required placeholder="you@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
          <label><Lock size={15} /> Password<span className="register-password-field"><input type={showPassword ? 'text' : 'password'} required placeholder="Min 8 characters" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /><button type="button" className="register-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          <label><ShieldCheck size={15} /> Confirm password<input type="password" required placeholder="Repeat password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} /></label>

          <button type="submit" disabled={loading}>{loading ? 'Creating account...' : 'Create Avalisa Account'}</button>
          <div className="lux-auth-social-row">
            <button type="button" className="lux-auth-social" onClick={() => startSocialAuth('google')}>
              <span className="lux-auth-provider-icon is-google">G</span>
              Sign up with Google
            </button>
            <button type="button" className="lux-auth-social" onClick={() => startSocialAuth('facebook')}>
              <span className="lux-auth-provider-icon is-facebook">f</span>
              Sign up with Facebook
            </button>
          </div>
          <p className="lux-auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>
        <p className="lux-risk-note register-risk-note">Trading involves risk. Start on a Pocket Option Demo balance.</p>

      </section>
    </main>
  );
}
