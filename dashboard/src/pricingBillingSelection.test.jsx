import { fireEvent, render, screen } from '@testing-library/react';
import Pricing from './pages/Pricing';

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/pricing', hash: '', search: '' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('./lib/api', () => ({ __esModule: true, default: { get: vi.fn().mockResolvedValue({ data: { enabled: false } }), post: vi.fn() } }));
vi.mock('./hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));

test('Pro billing selection updates its primary checkout action and retains the Whop product URL', async () => {
  render(<Pricing />);
  const monthly = screen.getByRole('button', { name: '$29/month · recurring' });
  fireEvent.click(monthly);
  expect(monthly).toHaveAttribute('aria-pressed', 'true');
  // PayPal is off here, so the monthly CTA goes straight to Whop; the card states the recurring price.
  expect(await screen.findByRole('link', { name: /subscribe to pro — \$29\/month/i })).toHaveAttribute(
    'href',
    'https://whop.com/checkout/plan_fOVwXMLBMl0g9/',
  );
  expect(screen.getByText('/month recurring')).toBeInTheDocument();
});

test('each Pro billing state links to its own Whop plan', () => {
  render(<Pricing />);
  const oneTime = screen.getByRole('link', { name: /buy pro — \$119 one-time/i });
  expect(oneTime).toHaveAttribute('href', 'https://whop.com/checkout/plan_Q1ZYGwVvBg3E0/');
  fireEvent.click(screen.getByRole('button', { name: '$29/month · recurring' }));
  const monthly = screen.getByRole('link', { name: /subscribe to pro — \$29\/month/i });
  expect(monthly).toHaveAttribute('href', 'https://whop.com/checkout/plan_fOVwXMLBMl0g9/');
});
