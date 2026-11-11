import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
  strategy: 'martingale',
  timeframe: 'M1',
  direction: 'alternating',
  delaySeconds: 2,
  startAmount: 1,
  martingaleMultiplier: 2,
  martingaleSteps: 3,
};

const BLACK10_LINK_TEXT = 'BLACK10 guide';
const BLACK10_HREF = '/guide/pocket-option-black10-deposit-bonus.html';

async function renderApprovedProNote() {
  authMock.user = { email: 'pro@example.com', poUserId: '123456', license: { plan: 'lifetime' } };
  api.get.mockImplementation((url) => {
    if (url === '/api/settings') return Promise.resolve({ data: SETTINGS });
    if (url === '/api/license/claim/status') return Promise.resolve({ data: { claimStatus: 'approved' } });
    if (url.startsWith('/api/trades/history?')) return Promise.resolve({ data: { trades: [], stats: { wins: 0, losses: 0, ties: 0 } } });
    return Promise.resolve({ data: {} });
  });
  render(<Dashboard />);
  await screen.findByText('Your free Pro plan is active.');
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  api.get.mockReset();
  authMock.user = null;
});

test('before the promo end date (UTC) the note carries the BLACK10 link', async () => {
  vi.setSystemTime('2026-11-15T12:00:00Z');
  await renderApprovedProNote();
  const link = screen.getByRole('link', { name: BLACK10_LINK_TEXT });
  expect(link).toHaveAttribute('href', BLACK10_HREF);
  expect(link.closest('p')).toHaveTextContent(
    "Pocket Option's BLACK10 deposit bonus runs 12-30 November 2026. Read the terms first in our",
  );
  expect(link.closest('p').textContent).toBe(
    'Keep testing on your demo account for as long as you like. When you feel ready to look at a real account, our demo-to-real guide is here. Pocket Option\'s BLACK10 deposit bonus runs 12-30 November 2026. Read the terms first in our BLACK10 guide. Never deposit money you can\'t afford to lose.',
  );
});

test('on the last day of the promo (2026-11-30 UTC) the link is still present', async () => {
  vi.setSystemTime('2026-11-30T23:59:59Z');
  await renderApprovedProNote();
  expect(screen.getByRole('link', { name: BLACK10_LINK_TEXT })).toHaveAttribute('href', BLACK10_HREF);
});

test('after the promo end date the note renders without the link', async () => {
  vi.setSystemTime('2026-12-01T00:00:00Z');
  await renderApprovedProNote();
  expect(screen.queryByRole('link', { name: BLACK10_LINK_TEXT })).not.toBeInTheDocument();
  const note = screen.getByText(/Never deposit money you can't afford to lose\./).closest('p');
  expect(note.textContent).toBe(
    'Keep testing on your demo account for as long as you like. When you feel ready to look at a real account, our demo-to-real guide is here. Never deposit money you can\'t afford to lose.',
  );
});