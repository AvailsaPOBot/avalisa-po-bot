import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import api from '../lib/api';

const authMock = vi.hoisted(() => ({ user: null }));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: authMock.user }) }));

const SETTINGS = {
  strategy: 'martingale', timeframe: 'M1', direction: 'alternating',
  delaySeconds: 2, startAmount: 1, martingaleMultiplier: 2, martingaleSteps: 3,
};

async function renderDashboard(user) {
  authMock.user = user;
  api.get.mockImplementation((url) => {
    if (url === '/api/settings') return Promise.resolve({ data: SETTINGS });
    if (url.startsWith('/api/trades/history?')) return Promise.resolve({ data: { trades: [], stats: { wins: 0, losses: 0, ties: 0 } } });
    return Promise.resolve({ data: {} });
  });
  render(<Dashboard />);
  await screen.findByText('Save Settings');
}

beforeEach(() => {
  api.get.mockReset();
  api.put.mockReset();
});

test('paid unlinked users see the Pocket Option ID card and can submit the UID', async () => {
  await renderDashboard({ email: 'paid@example.com', poUserId: null, license: { plan: 'basic' } });
  expect(screen.getByTestId('po-uid-link-card')).toHaveTextContent('Link your Pocket Option ID so the bot recognises your plan even when you are not signed in to the panel');
  api.put.mockResolvedValue({ data: { poUserId: '987654' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Pocket Option ID' }), { target: { value: '987654' } });
  fireEvent.click(screen.getByRole('button', { name: 'Link ID' }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/auth/po-user-id', { poUserId: '987654' }));
  await waitFor(() => expect(screen.queryByTestId('po-uid-link-card')).not.toBeInTheDocument());
});

test('server error text is shown when linking fails', async () => {
  await renderDashboard({ email: 'paid@example.com', poUserId: null, license: { plan: 'lifetime' } });
  api.put.mockRejectedValue({ response: { status: 409, data: { error: 'That PO User ID is already linked to another account' } } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Pocket Option ID' }), { target: { value: '555123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Link ID' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That PO User ID is already linked to another account');
});

test.each([
  ['free', { plan: 'free' }, null],
  ['already linked', { plan: 'basic' }, '123456'],
])('does not show the linking card for %s accounts', async (_label, license, poUserId) => {
  await renderDashboard({ email: 'user@example.com', poUserId, license });
  expect(screen.queryByTestId('po-uid-link-card')).not.toBeInTheDocument();
});
