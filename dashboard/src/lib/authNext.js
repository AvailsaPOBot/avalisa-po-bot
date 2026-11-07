// "Where to go after sign-in" (?next=/webapp) carried through register, login and OAuth.
//
// The backend OAuth flow only round-trips a `from` value in its state token, so it cannot
// carry `next`. Before leaving for Google / Facebook we park the path in sessionStorage and
// /auth/callback reads it back. Same-site paths only; never an absolute URL.
const STORAGE_KEY = 'avalisa-auth-next';
const MAX_AGE_MS = 30 * 60 * 1000;

export function safeNext(raw) {
  if (typeof raw !== 'string') return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}

// `/register?next=%2Fwebapp`-style link target; falls back to the bare path.
export function withNext(path, next) {
  const safe = safeNext(next);
  // Keep slashes readable (?next=/webapp); everything else is percent-encoded.
  return safe ? `${path}?next=${encodeURIComponent(safe).replaceAll('%2F', '/')}` : path;
}

export function stashNext(next) {
  const safe = safeNext(next);
  try {
    if (!safe) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ path: safe, at: Date.now() }));
  } catch (_) {
    // Storage can be blocked (private tabs); the visitor just lands on the default page.
  }
}

export function clearNext() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    // ignore
  }
}

// Read and clear the parked path. Stale entries (abandoned OAuth attempts) are ignored.
export function takeNext() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.at) > MAX_AGE_MS) return null;
    return safeNext(parsed.path);
  } catch (_) {
    return null;
  }
}
