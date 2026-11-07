import { fireEvent, render, screen } from '@testing-library/react';
import Unsubscribe from './Unsubscribe';

const { search } = vi.hoisted(() => ({ search: { value: 'token=abc' } }));
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [new URLSearchParams(search.value)],
}));
vi.mock('../lib/api', () => ({ API_BASE: 'https://api.example.test' }));

const INVALID = 'This link is not valid. Email avalisapobot@gmail.com and we will remove you.';
const DONE = 'You are unsubscribed from these emails.';

beforeEach(() => {
  search.value = 'token=abc';
  global.fetch = vi.fn().mockResolvedValue({ status: 200 });
});

test('opening the page sends nothing; only the click posts the token', async () => {
  render(<Unsubscribe />);
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
  expect(await screen.findByText(DONE)).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith('https://api.example.test/api/unsubscribe', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ token: 'abc' }),
  }));
});

test('after success the button is gone, so a second click cannot turn it into an error', async () => {
  render(<Unsubscribe />);
  fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
  await screen.findByText(DONE);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('a 400 and a network failure both show the invalid message', async () => {
  global.fetch.mockResolvedValueOnce({ status: 400 });
  const { unmount } = render(<Unsubscribe />);
  fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
  expect(await screen.findByText(INVALID)).toBeInTheDocument();
  unmount();
  global.fetch.mockRejectedValueOnce(new Error('offline'));
  render(<Unsubscribe />);
  fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
  expect(await screen.findByText(INVALID)).toBeInTheDocument();
});

test('no token shows the invalid message and no button', () => {
  search.value = '';
  render(<Unsubscribe />);
  expect(screen.getByText(INVALID)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});
