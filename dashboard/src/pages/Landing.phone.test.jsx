import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));

const REAL_MATCH_MEDIA = window.matchMedia;
const REAL_UA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

function mockViewport(isPhone) {
  window.matchMedia = vi.fn((query) => ({
    matches: query === '(max-width: 767px)' ? isPhone : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function scrollDown() {
  Object.defineProperty(window, 'scrollY', { value: 800, configurable: true });
  fireEvent.scroll(window);
}

const renderLanding = () => render(<MemoryRouter><Landing /></MemoryRouter>);
const hero = () => document.querySelector('.v3-hero__copy');

afterEach(() => {
  window.matchMedia = REAL_MATCH_MEDIA;
  if (REAL_UA) Object.defineProperty(window.navigator, 'userAgent', REAL_UA);
  else delete window.navigator.userAgent;
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

describe('homepage on a phone', () => {
  beforeEach(() => mockViewport(true));

  test('hero primary CTA goes to /webapp with the phone label and sub-line, risk line stays below', () => {
    renderLanding();
    const cta = within(hero()).getByRole('link', { name: 'Start on this phone' });
    expect(cta).toHaveAttribute('href', '/webapp');
    expect(within(hero()).queryByRole('link', { name: /start 10 free demo trades/i })).toBeNull();

    const sub = within(hero()).getByText('10 free Demo trades in Safari or Chrome. No app to install.');
    const risk = within(hero()).getByText('Trading involves risk. Start on a demo account.');
    expect(cta.compareDocumentPosition(sub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sub.compareDocumentPosition(risk) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('sticky bar CTA is "Phone setup" -> /webapp', () => {
    renderLanding();
    scrollDown();
    const sticky = document.querySelector('.home-sticky');
    expect(sticky).not.toBeNull();
    expect(within(sticky).getByRole('link', { name: /phone setup/i })).toHaveAttribute('href', '/webapp');
  });

  test('header has a visible Phone setup pill and the mobile menu leads with Phone setup', () => {
    renderLanding();
    const header = document.querySelector('header.site-nav');
    const pill = header.querySelector('a.site-nav__phone');
    expect(pill).toHaveTextContent('Phone setup');
    expect(pill).toHaveAttribute('href', '/webapp');

    fireEvent.click(screen.getByRole('button', { name: /toggle menu/i }));
    const first = document.querySelector('.site-nav__mobile').firstElementChild;
    expect(first).toHaveTextContent('Phone setup');
    expect(first).toHaveAttribute('href', '/webapp');
  });

  test('a mobile user agent alone (wide viewport) is also treated as a phone', () => {
    mockViewport(false);
    Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/15E148 Safari/604.1', configurable: true });
    renderLanding();
    expect(within(hero()).getByRole('link', { name: 'Start on this phone' })).toHaveAttribute('href', '/webapp');
  });
});

describe('homepage on desktop', () => {
  beforeEach(() => mockViewport(false));

  test('hero stays "Start 10 free Demo trades" -> /register, with no phone pill or sub-line', () => {
    renderLanding();
    expect(within(hero()).getByRole('link', { name: /start 10 free demo trades/i })).toHaveAttribute('href', '/register');
    expect(screen.queryByText('Start on this phone')).toBeNull();
    expect(screen.queryByText(/No app to install\./)).toBeNull();
    expect(document.querySelector('a.site-nav__phone')).toBeNull();
  });

  test('sticky bar CTA stays "Start free Demo" -> /register', () => {
    renderLanding();
    scrollDown();
    const sticky = document.querySelector('.home-sticky');
    expect(within(sticky).getByRole('link', { name: /start free demo/i })).toHaveAttribute('href', '/register');
  });
});
