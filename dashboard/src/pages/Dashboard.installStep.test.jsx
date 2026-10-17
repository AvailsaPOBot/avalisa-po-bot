import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import api from '../lib/api';

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'new@example.com', license: { plan: 'free' } } }),
}));

const SETTINGS = { strategy: 'martingale', timeframe: 'M1', direction: 'alternating', delaySeconds: 2, startAmount: 1, martingaleMultiplier: 2, martingaleSteps: 3 };
const NONE = { wins: 0, losses: 0, ties: 0, winRate: 0, totalProfit: '0.00' };

const installCard = () => screen.queryByTestId('install-step-card');
const reviewCard = () => screen.queryByTestId('review-ask-card');

async function renderDashboard(realStats, demoStats) {
  api.get.mockImplementation((url) => {
    if (url === '/api/settings') return Promise.resolve({ data: SETTINGS });
    if (url.startsWith('/api/trades/history?type=real&limit=500')) return Promise.resolve({ data: { stats: realStats } });
    if (url.startsWith('/api/trades/history?type=demo&limit=50')) return Promise.resolve({ data: { trades: [], stats: demoStats } });
    if (url.startsWith('/api/trades/history?')) return Promise.resolve({ data: { trades: [] } });
    return Promise.resolve({ data: {} });
  });
  render(<Dashboard />);
  await screen.findByText('Save Settings');
}

beforeEach(() => {
  api.get.mockReset();
  window.localStorage.clear();
});

test('a brand-new account with no trades sees the install step with the Web Store link', async () => {
  await renderDashboard(NONE, NONE);

  await waitFor(() => expect(installCard()).toBeInTheDocument());
  const add = screen.getByRole('link', { name: 'Add to Chrome' });
  expect(add).toHaveAttribute('href', 'https://chromewebstore.google.com/detail/avalisa-po-bot/mkcpdbnlofljijfjiglkodddicpgdapa');
  expect(screen.getByRole('link', { name: /Webapp Bot/ })).toHaveAttribute('href', '/webapp');
});

test('the install step hides once any demo-account trade exists', async () => {
  await renderDashboard(NONE, { ...NONE, losses: 1 });

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/trades/history?type=demo&limit=50'));
  expect(installCard()).not.toBeInTheDocument();
});

test('the install step hides once any real trade exists', async () => {
  await renderDashboard({ ...NONE, wins: 1 }, NONE);

  expect(installCard()).not.toBeInTheDocument();
});

test('dismissing the install step persists', async () => {
  await renderDashboard(NONE, NONE);
  await waitFor(() => expect(installCard()).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: /installed it/ }));

  expect(installCard()).not.toBeInTheDocument();
  expect(window.localStorage.getItem('avalisa-install-step-dismissed')).toBe('true');
});

test('the review ask counts demo-account trades, not only real ones', async () => {
  await renderDashboard(NONE, { ...NONE, wins: 5, losses: 3 });

  await waitFor(() => expect(reviewCard()).toBeInTheDocument());
});

test('install step makes no outcome or earnings claims', async () => {
  await renderDashboard(NONE, NONE);
  await waitFor(() => expect(installCard()).toBeInTheDocument());

  expect(installCard()).not.toHaveTextContent(/profit|earn|income|guarantee|win rate/i);
});
