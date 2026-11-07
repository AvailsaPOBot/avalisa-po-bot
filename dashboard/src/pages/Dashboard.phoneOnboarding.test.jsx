import { render, screen, waitFor } from '@testing-library/react';
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
const REAL_MATCH_MEDIA = window.matchMedia;

function mockViewport(isPhone) {
  window.matchMedia = vi.fn((query) => ({ matches: query === '(max-width: 767px)' ? isPhone : false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

async function renderDashboard(demoStats = NONE) {
  api.get.mockImplementation((url) => {
    if (url === '/api/settings') return Promise.resolve({ data: SETTINGS });
    if (url.startsWith('/api/trades/history?type=real&limit=500')) return Promise.resolve({ data: { stats: NONE } });
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
afterEach(() => { window.matchMedia = REAL_MATCH_MEDIA; });

test('phone user with 0 trades gets the "set up on this phone" card with a Phone setup button', async () => {
  mockViewport(true);
  await renderDashboard();
  const card = await screen.findByTestId('install-step-card');

  expect(card).toHaveTextContent('Next step: set up on this phone');
  expect(card).not.toHaveTextContent('install the Avalisa extension');
  const primary = screen.getByRole('link', { name: 'Phone setup' });
  expect(primary).toHaveAttribute('href', '/webapp');
  expect(primary).toHaveClass('btn-primary');
  expect(screen.queryByRole('link', { name: 'Add to Chrome' })).toBeNull();
  expect(card).toHaveTextContent('Start on a demo account. Trading involves risk.');
  expect(card).not.toHaveTextContent(/profit|earn|income|guarantee|win rate/i);
});

test('phone card hides once the user has a trade, like the desktop card', async () => {
  mockViewport(true);
  await renderDashboard({ ...NONE, losses: 1 });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/trades/history?type=demo&limit=50'));
  expect(screen.queryByTestId('install-step-card')).toBeNull();
});

test('desktop card is unchanged', async () => {
  mockViewport(false);
  await renderDashboard();
  const card = await screen.findByTestId('install-step-card');
  expect(card).toHaveTextContent('Next step: install the Avalisa extension');
  expect(screen.getByRole('link', { name: 'Add to Chrome' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Phone setup' })).toBeNull();
});
