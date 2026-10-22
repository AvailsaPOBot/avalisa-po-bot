import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Register from './Register';

const { registerMock, navigateMock } = vi.hoisted(() => ({ registerMock: vi.fn(), navigateMock: vi.fn() }));
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams('intent=affiliate')],
}));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ register: registerMock }) }));
vi.mock('../lib/api', () => ({ API_BASE: 'https://api.example.test' }));

beforeEach(() => { registerMock.mockReset().mockResolvedValue({}); navigateMock.mockReset(); });

test('registration keeps the demo and affiliate claim steps, and warns against using a Pocket Option password', () => {
  render(<Register />);
  expect(screen.getByRole('heading', { name: 'Start with a free Demo.' })).toBeInTheDocument();
  expect(screen.getByText(/10 Free Demo Trades automatically/i)).toBeInTheDocument();
  expect(screen.getByText(/Never enter your Pocket Option password here/i)).toBeInTheDocument();
  expect(screen.getByText(/queued for admin verification/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /we earn a commission/i })).toHaveAttribute('href', expect.stringMatching(/^https:/));
  expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign up with facebook/i })).toBeInTheDocument();
});

test('email registration validates confirmation and redirects to dashboard after success', async () => {
  render(<Register />);
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'buyer@example.com' } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'password123' } });
  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different123' } });
  fireEvent.click(screen.getByRole('button', { name: /create avalisa account/i }));
  expect(registerMock).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
  fireEvent.click(screen.getByRole('button', { name: /create avalisa account/i }));
  await waitFor(() => expect(registerMock).toHaveBeenCalledWith('buyer@example.com', 'password123'));
  expect(navigateMock).toHaveBeenCalledWith('/dashboard');
});
