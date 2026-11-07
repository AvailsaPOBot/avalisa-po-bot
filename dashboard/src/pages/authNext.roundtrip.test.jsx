import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Webapp from './Webapp';
import Register from './Register';
import Login from './Login';
import AuthCallback from './AuthCallback';
import { safeNext, stashNext, takeNext, withNext } from '../lib/authNext';

const { registerMock, loginMock } = vi.hoisted(() => ({ registerMock: vi.fn(), loginMock: vi.fn() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, register: registerMock, login: loginMock }) }));
vi.mock('../lib/api', () => ({ API_BASE: 'https://api.example.test' }));
vi.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const REAL_MATCH_MEDIA = window.matchMedia;

function mockViewport(isPhone) {
  window.matchMedia = vi.fn((query) => ({ matches: query === '(max-width: 767px)' ? isPhone : false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}{location.search}</output>;
}

function renderApp(initial) {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/webapp" element={<Webapp />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

function fillAndSubmitRegister() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'buyer@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: /create avalisa account/i }));
}

beforeEach(() => {
  registerMock.mockReset().mockResolvedValue({});
  loginMock.mockReset().mockResolvedValue({});
  window.sessionStorage.clear();
  window.localStorage.clear();
  mockViewport(false);
  // Leaving for Google / Facebook is a real navigation, which jsdom does not implement.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  window.matchMedia = REAL_MATCH_MEDIA;
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

describe('authNext helpers', () => {
  test('accepts same-site paths only', () => {
    expect(safeNext('/webapp')).toBe('/webapp');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('/\\evil.example')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });

  test('withNext keeps the path readable and drops unsafe values', () => {
    expect(withNext('/register', '/webapp')).toBe('/register?next=/webapp');
    expect(withNext('/register', 'https://evil.example')).toBe('/register');
    expect(withNext('/login', null)).toBe('/login');
  });

  test('a stashed path is read back once, and stale ones are ignored', () => {
    stashNext('/webapp');
    expect(takeNext()).toBe('/webapp');
    expect(takeNext()).toBeNull();

    window.sessionStorage.setItem('avalisa-auth-next', JSON.stringify({ path: '/webapp', at: Date.now() - 31 * 60 * 1000 }));
    expect(takeNext()).toBeNull();
  });
});

describe('?next=/webapp round trip', () => {
  test('/webapp "create an account" -> /register?next=/webapp -> signup lands back on /webapp', async () => {
    renderApp('/webapp');
    const create = screen.getByRole('link', { name: 'create an account' });
    expect(create).toHaveAttribute('href', '/register?next=/webapp');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=/webapp');

    fireEvent.click(create);
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/register?next=/webapp');

    fillAndSubmitRegister();
    await waitFor(() => expect(registerMock).toHaveBeenCalledWith('buyer@example.com', 'password123'));
    expect(await screen.findByRole('heading', { name: 'Run Avalisa on this device.' })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/webapp$/);
  });

  test('/login "Create Avalisa account" keeps ?next, and /register "Sign in" gives it back', () => {
    const { unmount } = renderApp('/login?next=/webapp');
    expect(screen.getByRole('link', { name: 'Create Avalisa account' })).toHaveAttribute('href', '/register?next=/webapp');
    unmount();

    renderApp('/register?next=/webapp');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=/webapp');
  });

  test('/login without ?next links to a plain /register', () => {
    renderApp('/login');
    expect(screen.getByRole('link', { name: 'Create Avalisa account' })).toHaveAttribute('href', '/register');
  });

  test('an unsafe ?next is ignored and the visitor goes to the dashboard', async () => {
    renderApp('/register?next=https://evil.example');
    fillAndSubmitRegister();
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
  });

  test('Google / Facebook sign-up parks next for /auth/callback, which reads it back', async () => {
    renderApp('/register?next=/webapp');
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));
    expect(JSON.parse(window.sessionStorage.getItem('avalisa-auth-next')).path).toBe('/webapp');

    window.history.replaceState(null, '', '/auth/callback#token=abc123&provider=google');
    render(<MemoryRouter initialEntries={['/auth/callback']}><AuthCallback /></MemoryRouter>);
    await waitFor(() => expect(window.localStorage.getItem('jwt')).toBe('abc123'));
    // /auth/callback consumed the parked path when it redirected.
    expect(window.sessionStorage.getItem('avalisa-auth-next')).toBeNull();
  });

  test('OAuth start from /login parks its own ?next too', () => {
    renderApp('/login?next=/webapp');
    fireEvent.click(screen.getByRole('button', { name: /continue with facebook/i }));
    expect(JSON.parse(window.sessionStorage.getItem('avalisa-auth-next')).path).toBe('/webapp');
  });

  test('desktop signup with no next goes to the dashboard and parks nothing for OAuth', async () => {
    renderApp('/register');
    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));
    expect(window.sessionStorage.getItem('avalisa-auth-next')).toBeNull();
    fillAndSubmitRegister();
    expect(await screen.findByRole('heading', { name: 'Dashboard page' })).toBeInTheDocument();
  });

  test('phone signup with no next goes to /webapp (email and OAuth)', async () => {
    mockViewport(true);
    const { unmount } = renderApp('/register');
    fireEvent.click(screen.getByRole('button', { name: /sign up with facebook/i }));
    expect(JSON.parse(window.sessionStorage.getItem('avalisa-auth-next')).path).toBe('/webapp');
    window.sessionStorage.clear();
    unmount();

    renderApp('/register');
    fillAndSubmitRegister();
    expect(await screen.findByRole('heading', { name: 'Run Avalisa on this device.' })).toBeInTheDocument();
  });
});

describe('/register layout changes', () => {
  test('phone shortcut shows on phones only, under the subtitle', () => {
    mockViewport(true);
    const { unmount } = renderApp('/register');
    const hint = screen.getByText(/Testing on your phone first\?/);
    expect(hint.querySelector('a')).toHaveAttribute('href', '/webapp');
    expect(hint.querySelector('a')).toHaveTextContent('Phone setup');
    expect(screen.getByText(/Free to start\. The Demo includes 10 trades/).compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    mockViewport(false);
    renderApp('/register');
    expect(screen.queryByText(/Testing on your phone first\?/)).toBeNull();
  });

  test('password warning sits right under the password field; partner card sits below the form fields', () => {
    const { container } = renderApp('/register');
    const password = container.querySelector('input[autocomplete="new-password"]').closest('label');
    const warning = screen.getByText(/Never enter your Pocket Option password here/i);
    const confirm = screen.getByLabelText(/confirm password/i).closest('label');
    const partner = screen.getByRole('link', { name: /we earn a commission/i });
    const submit = screen.getByRole('button', { name: /create avalisa account/i });

    expect(password.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(warning.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(submit.compareDocumentPosition(partner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(partner).toHaveTextContent('New to Pocket Option? Open an account through our link (we earn a commission), then add your Pocket Option ID in Settings to request Pro.');
  });
});
