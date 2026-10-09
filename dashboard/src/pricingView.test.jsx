import { render, screen } from '@testing-library/react';
import Pricing from './pages/Pricing';

let mockLocation = { pathname: '/pricing', hash: '', search: '' };

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  useLocation: () => mockLocation,
  useNavigate: () => vi.fn(),
}));

vi.mock('./lib/api', () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));

function mockInitialRequests() {
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });
}

describe('pricing view analytics', () => {
  let originalSendBeacon;
  let originalSessionStorageDescriptor;

  beforeEach(() => {
    mockLocation = { pathname: '/pricing', hash: '', search: '' };
    window.sessionStorage.clear();
    mockInitialRequests();
    originalSendBeacon = navigator.sendBeacon;
    originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: originalSendBeacon });
    if (originalSessionStorageDescriptor) {
      Object.defineProperty(window, 'sessionStorage', originalSessionStorageDescriptor);
    }
  });

  test('mounting Pricing fires the pricing-view beacon exactly once', () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });

    render(<Pricing />);

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toMatch(/\/api\/funnel\/pricing-view$/);
    expect(beacon.mock.calls[0]).toHaveLength(1);
  });

  test('mounting Pricing again in the same session sends nothing', () => {
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });

    const firstMount = render(<Pricing />);
    firstMount.unmount();
    render(<Pricing />);

    expect(beacon).toHaveBeenCalledTimes(1);
  });

  test('blocked sessionStorage still leaves the pricing page rendered without throwing', () => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(() => { throw new Error('storage blocked'); }),
        setItem: vi.fn(() => { throw new Error('storage blocked'); }),
      },
    });
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: vi.fn(() => true) });

    expect(() => render(<Pricing />)).not.toThrow();
    expect(screen.getByRole('heading', { name: 'Simple, transparent pricing.' })).toBeInTheDocument();
  });
});
