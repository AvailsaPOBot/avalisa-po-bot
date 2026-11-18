import axios from 'axios';

export const API_BASE = import.meta.env.REACT_APP_API_URL || 'https://avalisa-backend.onrender.com';

const api = axios.create({ baseURL: API_BASE });

// Attach JWT on every request
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('jwt');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// A 401 from the sign-in calls means "wrong email or password", not "session
// expired". Redirecting there reloads /login and drops the error toast, so the
// visitor sees a silent reload and never learns what to do next.
export function isAuthAttempt(url = '') {
  return /\/api\/auth\/(login|register|reset-password|forgot-password)\b/.test(url);
}

// Auto-logout on 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !isAuthAttempt(err.config?.url)) {
      localStorage.removeItem('jwt');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
