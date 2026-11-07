/**
 * A paying customer must never be sent to a dead checkout.
 *
 * History: the Whop product behind REACT_APP_WHOP_BASIC_URL was removed, so the
 * live pricing page sent buyers to Whop's "Product not found" page. The earlier
 * fallback (href="#") was no better — it looked live and silently did nothing.
 * The environment override was removed because it silently reintroduced dead URLs.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import Pricing from './pages/Pricing';

const LIVE_BASIC_CHECKOUT_URL = 'https://whop.com/checkout/plan_1LhtddKS4Of4Z/';
const LIVE_PRO_CHECKOUT_URL = 'https://whop.com/checkout/plan_Q1ZYGwVvBg3E0/';

let mockLocation = { pathname: '/pricing', hash: '' };

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => mockLocation,
  useNavigate: () => vi.fn(),
}));

vi.mock('./lib/api', () => ({
  __esModule: true,
  default: { get: vi.fn().mockResolvedValue({ data: { enabled: false } }), post: vi.fn() },
  API_BASE: 'https://test-api.example',
}));

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

describe('checkout availability', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  // PayPal is off (api mock above), so each CTA is a direct Whop link with no modal.
  function whopCheckout(planIndex) {
    return screen.findByRole('link', { name: planIndex === 0 ? /basic/i : /pro — \$119/i });
  }

  function expectNoRetiredCheckoutHrefs() {
    const hrefs = Array.from(document.querySelectorAll('a'))
      .map((link) => link.getAttribute('href') || '');
    hrefs.forEach((href) => {
      expect(href).not.toContain('basic-plan-7d-48b3');
      expect(href).not.toContain('lifetime-plan-df-e6c6');
    });
  }

  test('the Basic Whop checkout link equals the canonical live product URL', async () => {
    render(<Pricing />);
    expect(await whopCheckout(0)).toHaveAttribute('href', LIVE_BASIC_CHECKOUT_URL);
  });

  test('the Pro Whop checkout link equals the canonical live product URL', async () => {
    render(<Pricing />);
    expect(await whopCheckout(1)).toHaveAttribute('href', LIVE_PRO_CHECKOUT_URL);
  });

  test('a bogus Basic Whop environment value cannot override the rendered checkout', async () => {
    vi.stubEnv('REACT_APP_WHOP_BASIC_URL', 'https://whop.com/avalisabot/basic-plan-7d-48b3/');
    render(<Pricing />);
    expect(await whopCheckout(0)).toHaveAttribute('href', LIVE_BASIC_CHECKOUT_URL);
  });

  test('no rendered pricing checkout href contains either retired Whop slug', async () => {
    render(<Pricing />);
    await whopCheckout(0);
    expectNoRetiredCheckoutHrefs();
    await whopCheckout(1);
    expectNoRetiredCheckoutHrefs();
  });
});

describe('checkout with PayPal enabled', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  // One-click only applies while Whop is the sole rail; a second rail must keep the chooser.
  test('the CTA opens the payment-method chooser and no direct Whop CTA is rendered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ enabled: true }) }));
    render(<Pricing />);
    const chooser = await screen.findAllByRole('button', { name: /choose payment method/i });
    expect(chooser).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /buy pro — \$119/i })).toBeNull();
    fireEvent.click(chooser[0]);
    expect(await screen.findByRole('link', { name: /whop/i })).toHaveAttribute('href', LIVE_BASIC_CHECKOUT_URL);
  });
});

describe('advertised billing options', () => {
  // Whop sells Pro at $119 once AND $29/month. The site showed only $119, so the
  // cheaper entry point was invisible — a silent conversion loss, not a bug anyone
  // would have reported.
  test('the Pro card advertises the monthly option', async () => {
    render(<Pricing />);
    // Scope to the price card: the pricing FAQ also mentions $29/month.
    const alt = await screen.findByText(/\$29\s*\/\s*month/i, { selector: '.lux-price__alt' });
    expect(alt).toBeTruthy();
  });
});
