import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Admin from './Admin';
import api from '../lib/api';

vi.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: vi.fn(), error: vi.fn() },
}));

const USERS = [
  {
    id: 'u-demo', email: 'demo@example.com', poUserId: null, createdAt: '2026-11-20T10:00:00.000Z', lastActiveAt: null, online: false,
    license: { plan: 'free', tradesUsed: 10, tradesLimit: 10, aiTradesAllowance: 0, aiTradesUsed: 0 },
  },
  {
    id: 'u-basic', email: 'basic@example.com', poUserId: '555111', createdAt: '2026-10-01T10:00:00.000Z', lastActiveAt: null, online: false,
    license: { plan: 'basic', tradesUsed: 4, tradesLimit: null, aiTradesAllowance: 0, aiTradesUsed: 0 },
  },
  {
    id: 'u-pro', email: 'pro@example.com', poUserId: '777222', createdAt: '2026-09-01T10:00:00.000Z', lastActiveAt: null, online: false,
    license: { plan: 'lifetime', tradesUsed: 40, tradesLimit: null, aiTradesAllowance: 100, aiTradesUsed: 3 },
  },
];

function mockAdminRequests() {
  api.get.mockImplementation(url => {
    if (url === '/api/admin/claims') return Promise.resolve({ data: [] });
    if (url === '/api/admin/users') return Promise.resolve({ data: { users: USERS } });
    if (url === '/api/admin/activity') return Promise.resolve({ data: {
      onlineNow: 0, active24h: 0, active7d: 1, active30d: 0, dormant: 1, neverActive: 1, totalUsers: 3, everTraded: 2,
    } });
    if (url.startsWith('/api/admin/users/') && url.endsWith('/trades')) return Promise.resolve({ data: { trades: [] } });
    if (url === '/api/admin/token-usage') return Promise.resolve({ data: { month: '2026-11', budget: 10000, users: [] } });
    if (url === '/api/admin/funnel') return Promise.resolve({ data: { funnel: [] } });
    if (url === '/api/admin/ai-settings') return Promise.resolve({ data: {} });
    return Promise.resolve({ data: {} });
  });
}

beforeEach(() => {
  api.get.mockReset();
  api.patch.mockReset();
  mockAdminRequests();
});

function usersTable() {
  return screen.getAllByRole('table').find(table => within(table).queryByText('Last active'));
}

test('an empty claims queue is one quiet line', async () => {
  render(<Admin />);

  expect(await screen.findByText('No claims waiting.')).toBeInTheDocument();
});

test('the plan filter narrows the users table', async () => {
  render(<Admin />);
  await screen.findByText('pro@example.com');

  fireEvent.click(screen.getByRole('button', { name: /^Pro\b/ }));

  const table = usersTable();
  expect(within(table).getByText('pro@example.com')).toBeInTheDocument();
  expect(within(table).queryByText('demo@example.com')).not.toBeInTheDocument();
  expect(within(table).queryByText('basic@example.com')).not.toBeInTheDocument();
});

test('saving a plan change from the drawer patches that user', async () => {
  api.patch.mockResolvedValue({ data: { success: true } });
  render(<Admin />);
  await screen.findByText('demo@example.com');

  fireEvent.click(screen.getByRole('button', { name: 'Manage demo@example.com' }));

  const drawer = await screen.findByRole('dialog');
  fireEvent.change(within(drawer).getByLabelText('Plan'), { target: { value: 'lifetime' } });
  fireEvent.click(within(drawer).getByRole('button', { name: 'Save changes' }));

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/api/admin/users/u-demo', { plan: 'lifetime' }));
});

test('Escape closes the drawer', async () => {
  render(<Admin />);
  await screen.findByText('demo@example.com');

  fireEvent.click(screen.getByRole('button', { name: 'Manage demo@example.com' }));
  await screen.findByRole('dialog');
  fireEvent.keyDown(document, { key: 'Escape' });

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
