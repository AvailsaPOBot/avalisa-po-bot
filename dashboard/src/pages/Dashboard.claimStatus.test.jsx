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

async function submit(response) {
  authMock.user = { email: 'free@example.com', poUserId: null, license: { plan: 'free' } };
  api.get.mockImplementation((url) => {
    if (url === '/api/settings') return Promise.resolve({ data: SETTINGS });
    if (url.startsWith('/api/trades/history?')) return Promise.resolve({ data: { trades: [], stats: { wins: 0, losses: 0, ties: 0 } } });
    if (url === '/api/license/claim/status') return Promise.resolve({ data: { claimStatus: 'none' } });
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: response });
  render(<Dashboard />);
  const input = await screen.findByPlaceholderText('e.g. 128532137');
  fireEvent.change(input, { target: { value: '128532137' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit Claim' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/license/claim', { poUid: '128532137' }));
}

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

test('an auto-approved claim shows the server message, not the pending banner', async () => {
  await submit({ status: 'approved', message: 'Pro access granted!' });
  expect(await screen.findByText('Pro access granted!')).toBeInTheDocument();
  expect(screen.queryByText(/Your ID is in/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Submit Claim' })).not.toBeInTheDocument();
});

test('a queued claim still shows the pending banner', async () => {
  await submit({ status: 'pending', message: 'Claim submitted.' });
  expect(await screen.findByText(/Your ID is in/)).toBeInTheDocument();
  expect(screen.queryByText('Pro access granted!')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Submit Claim' })).not.toBeInTheDocument();
});
