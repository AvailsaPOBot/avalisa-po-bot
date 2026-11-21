import { render, screen } from '@testing-library/react';
import { AFFILIATE_LINK, affiliateLinkFor } from '../lib/affiliate';
import FreePro from './FreePro';

let mockSearch = '';
let mockUser = null;
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}));
vi.mock('../components/Navbar', () => ({ default: () => null }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }));

beforeEach(() => { mockSearch = ''; mockUser = null; });

test('affiliateLinkFor keeps every attribution parameter and only swaps sub_id1', () => {
  expect(affiliateLinkFor()).toBe(AFFILIATE_LINK);
  expect(affiliateLinkFor('junk')).toBe(AFFILIATE_LINK);
  const yt = affiliateLinkFor('YT');
  expect(yt).toBe(AFFILIATE_LINK.replace('sub_id1=site', 'sub_id1=yt'));
  for (const key of ['ac=april2024', 'cid=845788', 'al=1272290', 'code=WELCOME50']) expect(yt).toContain(key);
});

test('every Pocket Option button carries the channel tag from ?src=', () => {
  mockSearch = 'src=fb';
  render(<FreePro />);
  const outbound = screen.getAllByRole('link').filter((a) => a.getAttribute('href').startsWith(new URL(AFFILIATE_LINK).origin));
  expect(outbound.length).toBeGreaterThanOrEqual(3);
  outbound.forEach((a) => expect(a.getAttribute('href')).toContain('sub_id1=fb'));
});

test('copy discloses the commission, keeps the risk line, and makes no outcome claim', () => {
  const { container } = render(<FreePro />);
  const text = container.textContent;
  expect(text).toMatch(/We earn a commission/);
  expect(text).toMatch(/Trading involves risk/);
  expect(text).not.toMatch(/affiliate/i);
  expect(text).not.toMatch(/profit(?!\.)|win rate|guaranteed (profit|income)|make money/i);
  expect(text).toMatch(/\$119/);
});

test('a signed-in visitor is sent to Dashboard settings, not the sign-up form', () => {
  mockUser = { email: 'a@b.c' };
  render(<FreePro />);
  expect(screen.queryByText('Create Avalisa account')).toBeNull();
  expect(screen.getByText('Open your Dashboard').closest('a')).toHaveAttribute('href', '/dashboard#free-pro');
});
