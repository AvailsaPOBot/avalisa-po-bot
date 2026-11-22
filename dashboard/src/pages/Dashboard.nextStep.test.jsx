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

const auth = vi.hoisted(() => ({ user: null }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: auth.user }) }));

const SETTINGS = { strategy: 'martingale', timeframe: 'M1', direction: 'alternating', delaySeconds: 2, startAmount: 1, martingaleMultiplier: 2, martingaleSteps: 3 };
const NONE = { wins: 0, losses: 0, ties: 0, winRate: 0, totalProfit: '0.00' };
const TRADED = { ...NONE, losses: 1 };

const card = () => screen.queryByTestId('next-step-card');

async function renderDashboard({ plan = 'free', claimStatus = 'none', demoStats = TRADED } = {}) {
  auth.user = { email: 'demo user@example.com', license: { plan } };
  api.get.mockImplementation((url) => {
    if (url === '/api/settings') return Promise.resolve({ data: SETTINGS });
    if (url === '/api/license/claim/status') return claimStatus === 'loading' ? new Promise(() => {}) : Promise.resolve({ data: { claimStatus } });
    if (url.startsWith('/api/trades/history?type=real&limit=500')) return Promise.resolve({ data: { stats: NONE } });
    if (url.startsWith('/api/trades/history?type=demo&limit=50')) return Promise.resolve({ data: { trades: [], stats: demoStats } });
    if (url.startsWith('/api/trades/history?')) return Promise.resolve({ data: { trades: [] } });
    return Promise.resolve({ data: {} });
  });
  render(<Dashboard />);
  await screen.findByText('Save Settings');
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/trades/history?type=demo&limit=50'));
}

beforeEach(() => {
  api.get.mockReset();
  window.localStorage.clear();
});

test('a Demo user who has traded sees the next step with the monthly checkout and the guide', async () => {
  await renderDashboard();

  await waitFor(() => expect(card()).toBeInTheDocument());
  expect(screen.getByRole('link', { name: /Get Pro/ })).toHaveAttribute(
    'href',
    'https://whop.com/checkout/plan_fOVwXMLBMl0g9/?email=demo%20user%40example.com',
  );
  expect(screen.getByRole('link', { name: 'Read the demo-to-real guide' })).toHaveAttribute('href', '/guide/pocket-option-demo-to-real-account.html');
  expect(card()).toHaveTextContent('renews every month until you cancel');
  expect(card()).toHaveTextContent("never deposit money you can't afford to lose");
});

test('no next step before the first trade', async () => {
  await renderDashboard({ demoStats: NONE });

  expect(card()).not.toBeInTheDocument();
});

test('no next step for a paid plan', async () => {
  await renderDashboard({ plan: 'basic' });

  expect(card()).not.toBeInTheDocument();
});

test.each(['pending', 'approved'])('no next step while the free-Pro claim is %s', async (claimStatus) => {
  await renderDashboard({ claimStatus });

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/license/claim/status'));
  await waitFor(() => expect(card()).not.toBeInTheDocument());
});

test('dismissing the next step persists', async () => {
  await renderDashboard();
  await waitFor(() => expect(card()).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

  expect(card()).not.toBeInTheDocument();
  expect(window.localStorage.getItem('avalisa-next-step-dismissed')).toBe('true');
});

test('no next step while the claim status is still loading', async () => {
  await renderDashboard({ claimStatus: 'loading' });
  await screen.findByText('Save Settings');

  expect(card()).not.toBeInTheDocument();
});
