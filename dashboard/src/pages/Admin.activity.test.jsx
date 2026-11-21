import { render, screen } from '@testing-library/react';
import Admin from './Admin';
import api from '../lib/api';

vi.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

function mockAdminRequests() {
  api.get.mockImplementation(url => {
    if (url === '/api/admin/claims') return Promise.resolve({ data: [] });
    if (url === '/api/admin/users') return Promise.resolve({ data: { users: [{
      id: 'online-user', email: 'online@example.com', poUserId: null, createdAt: '2026-08-27T10:00:00.000Z',
      lastActiveAt: '2026-08-27T11:30:00.000Z', online: true,
      license: { plan: 'basic', tradesUsed: 0, tradesLimit: null, aiTradesAllowance: 10, aiTradesUsed: 0 },
    }] } });
    if (url === '/api/admin/activity') return Promise.resolve({ data: {
      onlineNow: 1, onlineNowCaveat: 'In-memory, since last backend restart; reflects this backend instance only.',
      active24h: 1, active7d: 0, active30d: 0, dormant: 0, neverActive: 0, totalUsers: 1,
    } });
    if (url === '/api/admin/token-usage') return Promise.resolve({ data: { users: [] } });
    if (url === '/api/admin/funnel') return Promise.resolve({ data: { funnel: [] } });
    return Promise.resolve({ data: {} });
  });
}

beforeEach(() => {
  api.get.mockReset();
  mockAdminRequests();
});

test('online-now chip shows the count and carries the backend restart caveat', async () => {
  render(<Admin />);

  // The seven activity cards became one stacked bar plus an "Online now" chip; the caveat moved
  // from visible card text into the chip's title attribute.
  const label = await screen.findByText('Online now');
  const chip = label.closest('[title]');
  expect(chip).toHaveAttribute('title', expect.stringMatching(/since last backend restart/i));
  expect(chip).toHaveTextContent('Online now1');
  expect(screen.getByRole('img', { name: /last 24h: 1/i })).toBeInTheDocument();
});

test('an online user has a green dot with a non-colour-only label', async () => {
  render(<Admin />);

  const dot = await screen.findByRole('img', { name: /online now\. last active:/i });
  expect(dot).toHaveClass('pz-dot--good');
  expect(dot).toHaveAttribute('title', expect.stringMatching(/since last backend restart/i));
});
