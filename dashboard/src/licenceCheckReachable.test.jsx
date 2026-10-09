/**
 * #137 — a paying customer must be able to find out he has already paid.
 *
 * This pins INTENT, not wording (#117): the three outcomes must be
 * DISTINGUISHABLE from each other, and a failed lookup must never be rendered
 * as "you have no licence" — that false negative is what told a Pro customer
 * his purchase was gone and nearly sold him a second copy.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Guide from './pages/Guide';

// Link is stubbed. The stub is deliberately dumb: this suite is about the entitlement
// branches, not about routing.
vi.mock('react-router-dom', () => ({
  Link: ({ children }) => children,
}));

// The API module is mocked so no real network client loads. API_BASE is the
// only export Guide uses.
vi.mock('./lib/api', () => ({ API_BASE: 'https://backend.test' }));

const renderGuide = () => render(<Guide />);

const submit = (uid) => {
  fireEvent.change(screen.getByLabelText(/pocket option id/i), { target: { value: uid } });
  fireEvent.click(screen.getByRole('button', { name: /^check$/i }));
};

afterEach(() => { delete global.fetch; });

const mockOnce = (body, ok = true) => {
  global.fetch = vi.fn().mockResolvedValue({ ok, json: async () => body });
};

test('the entitlement lookup is reachable from the guide and calls the real route', async () => {
  mockOnce({ linked: true, plan: 'lifetime' });
  renderGuide();
  submit('5131350');

  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toMatch(/\/api\/license\/po-entitlement$/);
  expect(JSON.parse(init.body)).toEqual({ poUid: '5131350' });
});

test('a licensed account is told it already has the plan, and is NOT asked to buy', async () => {
  mockOnce({ linked: true, plan: 'lifetime' });
  renderGuide();
  submit('5131350');

  const answer = await screen.findByText(/already has Pro/i);
  expect(answer).toBeInTheDocument();
  expect(screen.queryByText(/no paid licence linked/i)).not.toBeInTheDocument();
});

test('basic and pro are reported distinctly — a plan label is never guessed', async () => {
  mockOnce({ linked: true, plan: 'basic' });
  renderGuide();
  submit('5131350');

  expect(await screen.findByText(/already has Basic/i)).toBeInTheDocument();
  expect(screen.queryByText(/already has Pro/i)).not.toBeInTheDocument();
});

test('an unlinked id is told to email us before paying twice', async () => {
  mockOnce({ linked: false, plan: 'free' });
  renderGuide();
  submit('123456');

  expect(await screen.findByText(/no paid licence linked/i)).toBeInTheDocument();
  expect(screen.queryByText(/already has/i)).not.toBeInTheDocument();
});

test('a failed lookup is NEVER rendered as "no licence"', async () => {
  global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
  renderGuide();
  submit('5131350');

  expect(await screen.findByText(/not an answer either way/i)).toBeInTheDocument();
  expect(screen.queryByText(/no paid licence linked/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/already has/i)).not.toBeInTheDocument();
});

test('a non-numeric id is rejected client-side without calling the server', async () => {
  global.fetch = vi.fn();
  renderGuide();
  submit('someone@example.com');

  expect(await screen.findByText(/digits only/i)).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});
