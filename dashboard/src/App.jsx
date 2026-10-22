import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

import Landing from './pages/Landing';
import FloatingChat from './components/FloatingChat';
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Support = lazy(() => import('./pages/Support'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Guide = lazy(() => import('./pages/Guide'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Webapp = lazy(() => import('./pages/Webapp'));
const WebappBotConnect = lazy(() => import('./pages/WebappBotConnect'));
const Admin = lazy(() => import('./pages/Admin'));

function AppShell() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  // Cross-page hash links (e.g. "Webapp Bot" -> /#webapp from /register) load the
  // landing route but React Router does not scroll to the anchor, so the visitor lands
  // at the top of the home page and thinks the link is broken. Scroll to it ourselves;
  // retry briefly because the target section mounts after the route renders.
  // React Router keeps the previous scroll position across route changes, so opening a
  // page from a scrolled one lands the visitor partway down it. Reset to the top unless
  // the URL points at a specific section.
  useEffect(() => {
    if (location.hash) return;
    window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!location.hash) return undefined;
    const id = decodeURIComponent(location.hash.slice(1));
    let frame = 0;
    let timer = null;
    const tryScroll = () => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      frame += 1;
      if (frame < 20) timer = window.setTimeout(tryScroll, 100);
    };
    timer = window.setTimeout(tryScroll, 60);
    return () => { if (timer) window.clearTimeout(timer); };
  }, [location.pathname, location.hash]);

  return (
    <>
      {!isLanding && <Navbar />}
      <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/support" element={<Support />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/guide" element={<Guide />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/admin" element={
          <AdminRoute><Admin /></AdminRoute>
        } />
        <Route path="/webapp" element={<Webapp />} />
        <Route path="/webapp-bot/connect" element={<WebappBotConnect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      {isLanding && <FloatingChat deferUntilScroll />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(10, 10, 15, 0.96)',
              color: '#f5efe4',
              border: '1px solid rgba(216, 162, 74, 0.36)',
              boxShadow: '0 18px 48px rgba(0, 0, 0, 0.42)',
            },
          }}
        />
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
