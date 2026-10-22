import { fireEvent, render, screen } from '@testing-library/react';
import Pricing from './pages/Pricing';

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => ({ pathname: '/pricing', hash: '', search: '' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('./lib/api', () => ({ __esModule: true, default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('./hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));

test('Pro billing selection updates its primary checkout action and retains the Whop product URL', async () => {
  render(<Pricing />);
  const monthly = screen.getByRole('button', { name: '$29/month · recurring' });
  fireEvent.click(monthly);
  expect(monthly).toHaveAttribute('aria-pressed', 'true');
  const primary = screen.getByRole('button', { name: /subscribe to pro — \$29\/month/i });
  fireEvent.click(primary);
  expect(await screen.findByRole('link', { name: /whop/i })).toHaveAttribute(
    'href',
    'https://whop.com/avalisabot/products/pro-9d-c997/',
  );
  expect(screen.getByText(/\$29\/month is a recurring subscription/i)).toBeInTheDocument();
});
