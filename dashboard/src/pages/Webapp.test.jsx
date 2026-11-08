import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Webapp from './Webapp';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));

const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const INSTAGRAM_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.20.113 (iPhone15,2; iOS 17_4; en_US; en-US; scale=3.00; 1170x2532; 576219391)';
const TIKTOK_ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 BytedanceWebview/d8a21c6';
const ANDROID_WEBVIEW = 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36';
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

const REAL_UA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

function setUserAgent(value) {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true });
}

const renderWebapp = () => render(<MemoryRouter><Webapp /></MemoryRouter>);

afterEach(() => {
  if (REAL_UA) Object.defineProperty(window.navigator, 'userAgent', REAL_UA);
  else delete window.navigator.userAgent;
});

describe('/webapp in-app browser gate', () => {
  test.each([
    ['Instagram', INSTAGRAM_IPHONE],
    ['TikTok', TIKTOK_ANDROID],
    ['Android WebView', ANDROID_WEBVIEW],
  ])('shows for %s, with the steps still visible below it', (_name, ua) => {
    setUserAgent(ua);
    renderWebapp();

    const gate = screen.getByTestId('webview-gate');
    expect(within(gate).getByRole('heading', { name: 'Open this page in Safari (iPhone) or Chrome (Android)' })).toBeInTheDocument();
    expect(within(gate).getByRole('button', { name: /copy page link/i })).toBeInTheDocument();
    expect(gate).toHaveTextContent('Tap ••• in the corner and choose Open in Browser');

    const firstStep = screen.getAllByRole('listitem')[0];
    expect(firstStep).toBeVisible();
    expect(gate.compareDocumentPosition(firstStep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy bookmark code/i })).toBeInTheDocument();
  });

  test('"Copy page link" copies this page\'s address', async () => {
    setUserAgent(INSTAGRAM_IPHONE);
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderWebapp();

    fireEvent.click(screen.getByRole('button', { name: /copy page link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    expect(await screen.findByRole('button', { name: /link copied/i })).toBeInTheDocument();
  });

  test.each([['Safari on iPhone', SAFARI_IPHONE], ['Chrome on Android', CHROME_ANDROID]])('does not show in %s', (_name, ua) => {
    setUserAgent(ua);
    renderWebapp();
    expect(screen.queryByTestId('webview-gate')).toBeNull();
  });
});

describe('/webapp phone steps', () => {
  test('Copy bookmark code is the only button above step 1; Open Pocket Option lives inside its step', () => {
    setUserAgent(SAFARI_IPHONE);
    const { container } = renderWebapp();

    const actions = container.querySelector('.lux-webapp-actions');
    expect(within(actions).getAllByRole('button')).toHaveLength(1);
    expect(within(actions).getByRole('button', { name: /copy bookmark code/i })).toBeInTheDocument();
    expect(within(actions).queryByRole('link')).toBeNull();

    const steps = container.querySelectorAll('.lux-webapp-steps--phone > li');
    const poStep = Array.from(steps).find((li) => li.textContent.includes('Open Pocket Option on Demo'));
    expect(poStep).toBeDefined();
    const open = within(poStep).getByRole('link', { name: /open pocket option/i });
    expect(open).toHaveAttribute('href', expect.stringContaining('po.trade'));
    expect(poStep).toHaveTextContent('Start on a demo account. Trading involves risk.');
    // The button sits after the two bookmark steps.
    const poIndex = Array.from(steps).indexOf(poStep);
    expect(poIndex).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('link', { name: /open pocket option/i })).toHaveLength(1);
  });

  test('Android lists Open Pocket Option on Demo as step 2, after saving the bookmark', () => {
    setUserAgent(CHROME_ANDROID);
    const { container } = renderWebapp();
    const steps = Array.from(container.querySelectorAll('.lux-webapp-steps--phone > li'));
    expect(steps[0]).toHaveTextContent('Save the Avalisa bookmark');
    expect(steps[1]).toHaveTextContent('Open Pocket Option on Demo');
    expect(within(steps[1]).getByRole('link', { name: /open pocket option/i })).toBeInTheDocument();
  });

  test('iPhone step 1 covers both Safari bars and says Add Bookmark', () => {
    setUserAgent(SAFARI_IPHONE);
    renderWebapp();
    expect(screen.getByText('Tap Copy bookmark code above. Then tap Share at the bottom of Safari (or the menu in the address bar), choose Add Bookmark, name it Avalisa and tap Save.')).toBeInTheDocument();
  });
});

describe('/webapp account copy', () => {
  test('the account card is optional and links carry ?next=/webapp', () => {
    setUserAgent(SAFARI_IPHONE);
    renderWebapp();
    const card = screen.getByText('Avalisa account (optional)').closest('article');
    expect(card).toHaveTextContent('Optional for your first run: 10 free Demo trades work on this phone without an account. See plans after the free trades. Sign in or create an account to sync settings or use Basic/Pro.');
    expect(within(card).getByRole('link', { name: 'See plans after the free trades' })).toHaveAttribute('href', '/pricing');
    expect(within(card).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login?next=/webapp');
    expect(within(card).getByRole('link', { name: 'create an account' })).toHaveAttribute('href', '/register?next=/webapp');
    expect(card).not.toHaveTextContent(/licence the bot checks before it can run/i);
  });

  test('the second list is unnumbered cards: only one numbered list remains', () => {
    setUserAgent(SAFARI_IPHONE);
    const { container } = renderWebapp();
    expect(container.querySelectorAll('ol')).toHaveLength(1);
    expect(container.querySelectorAll('.lux-webapp-notes article')).toHaveLength(2);
    expect(container.querySelector('.lux-webapp-notes .lux-webapp-steps__mark')).toBeNull();
  });

  test('risk line is still there and no outcome claims were added', () => {
    setUserAgent(SAFARI_IPHONE);
    const { container } = renderWebapp();
    expect(container).toHaveTextContent('Trading involves risk and Avalisa does not guarantee profits.');
    expect(container.textContent).not.toMatch(/\bAI\b|win rate|guaranteed/i);
  });
});
