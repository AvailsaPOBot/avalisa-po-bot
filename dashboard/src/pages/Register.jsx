import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Eye, EyeOff, Gift, Lock, Mail, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { API_BASE } from '../lib/api';
import { AFFILIATE_LINK } from '../lib/affiliate';
import '../styles/luxury.css';
import '../styles/landing-v3.css';
import '../styles/pages-v3.css';

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

  // DOM order: form first, so on a phone the form is the first thing under the header and
  // keyboard / screen-reader users reach it first. On desktop the grid places the portrait and
  // the editorial heading on the left.
  return (
    <main className="v3 v3p v3p-register">
      <div className="v3-wrap v3p-reg">
        <form className="v3p-reg__form v3-glass" onSubmit={handleSubmit} aria-labelledby="register-form-title">
          <p className="v3-hud v3-gold v3p-reg__kicker"><i className="v3-dot" aria-hidden="true" />Free account · 10 Demo trades</p>
          <h2 id="register-form-title">Create your account</h2>
          <p className="v3p-reg__subtitle">Free to start. The Demo includes 10 trades. Try them on a Pocket Option demo balance first.</p>

          <a className="v3p-reg__offer" href={AFFILIATE_LINK} target="_blank" rel="noreferrer">
            <Gift size={18} aria-hidden="true" />
            <span>New to Pocket Option? Open an account through our link (we earn a commission), then add your Pocket Option ID in Settings to request Pro.</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>

          <label className="v3p-field"><span className="v3p-field__label"><Mail size={14} aria-hidden="true" /> Email</span><input type="email" required autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
          <label className="v3p-field"><span className="v3p-field__label"><Lock size={14} aria-hidden="true" /> Password</span><span className="v3p-field__wrap"><input type={showPassword ? 'text' : 'password'} required autoComplete="new-password" placeholder="Min 8 characters" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /><button type="button" className="v3p-field__toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
          <label className="v3p-field"><span className="v3p-field__label"><ShieldCheck size={14} aria-hidden="true" /> Confirm password</span><input type="password" required autoComplete="new-password" placeholder="Repeat password" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} /></label>

          <button type="submit" className="v3-btn v3p-btn-block" disabled={loading}>{loading ? 'Creating account...' : 'Create Avalisa Account'}</button>
          <div className="v3p-reg__or" aria-hidden="true"><span>or</span></div>
          <div className="v3p-reg__social">
            <button type="button" className="v3p-btn-line" onClick={() => startSocialAuth('google')}>
              <span className="v3p-provider is-google" aria-hidden="true">G</span>
              Sign up with Google
            </button>
            <button type="button" className="v3p-btn-line" onClick={() => startSocialAuth('facebook')}>
              <span className="v3p-provider is-facebook" aria-hidden="true">f</span>
              Sign up with Facebook
            </button>
          </div>
          <p className="v3p-reg__switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>

        <section className="v3p-reg__visual" aria-labelledby="register-title">
          <img src="/assets/v3/avalisa-final.webp" alt="Avalisa, the Avalisa PO Bot mascot" width="1122" height="1402" decoding="async" fetchPriority="high" />
          <div className="v3p-reg__shade" aria-hidden="true"><div className="v3-grain" /></div>
          <div className="v3p-reg__visualcopy">
            <p className="v3-hud v3-gold">Your first run</p>
            <h1 className="v3p-h1" id="register-title">Start with a free <em>Demo</em>.</h1>
          </div>
        </section>

        <aside className="v3p-reg__next" aria-label="What happens next">
          <ol className="v3p-numbered v3p-numbered--steps">
            <li><span aria-hidden="true">01</span><div><strong>Now · about 30 seconds</strong><p>Create your free Avalisa account, or continue with Google or Facebook.</p></div></li>
            <li><span aria-hidden="true">02</span><div><strong>Instant</strong><p>Get 10 Free Demo Trades automatically. No card required.</p></div></li>
            <li><span aria-hidden="true">03</span><div><strong>Next screen</strong><p>Choose phone setup at <Link to="/webapp">/webapp</Link> or install the desktop Chrome extension. Start on a Pocket Option demo balance.</p></div></li>
          </ol>
          <div className="v3p-note v3p-note--safe"><Lock size={17} aria-hidden="true" /><p>Create a password for Avalisa. <strong>Never enter your Pocket Option password here.</strong></p></div>
          {affiliateIntent && <p className="v3p-note v3p-note--gold">After you register a new Pocket Option account through our link, link its numeric ID in Dashboard → Settings. Pro unlocks when the referral is confirmed; otherwise it is queued for admin verification.</p>}
          <p className="v3-risk">Trading involves risk. Start on a Pocket Option Demo balance.</p>
        </aside>
      </div>
    </main>
  );
}
