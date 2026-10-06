/**
 * Avalisa PO Bot v2 - API client helpers
 * Shared backend fetch helpers used by content.js flows.
 */

const FETCH_TIMEOUT_MS = 15000;

function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(tid));
}

async function apiPost(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.jwt) headers['Authorization'] = `Bearer ${state.jwt}`;
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiGet(path) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.jwt) headers['Authorization'] = `Bearer ${state.jwt}`;
  const res = await fetchWithTimeout(`${API_BASE}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// Session hints carried on license responses (backend 2026-10-06). A 30-day token
// that aged out used to be served the anonymous free plan while the panel still showed
// the user signed in, so a Pro customer saw "DEMO" and an upgrade prompt. Now the
// backend renews week-old tokens (`refreshedToken`) and flags unusable ones
// (`sessionExpired`); this applies both. Returns true when the session must end.
function applySessionHints(data, { onExpired } = {}) {
  if (!data || !state.jwt) return false;
  if (data.refreshedToken) {
    // Set state first: the storage listener ignores a token equal to state.jwt.
    state.jwt = data.refreshedToken;
    try { chrome.storage.local.set({ jwt: data.refreshedToken }); } catch (_) {}
  }
  if (data.sessionExpired) {
    if (typeof onExpired === 'function') onExpired();
    return true;
  }
  return false;
}
