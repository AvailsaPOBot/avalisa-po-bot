import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import Pricing from './Pricing';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../lib/api', () => ({ __esModule: true, default: { get: vi.fn(), post: vi.fn() } }));

const REAL_MATCH_MEDIA = window.matchMedia;

function mockViewport(isPhone) {
  window.matchMedia = vi.fn((query) => ({ matches: query === '(max-width: 767px)' ? isPhone : false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}) });
});
afterEach(() => { window.matchMedia = REAL_MATCH_MEDIA; });

const renderPricing = () => render(<MemoryRouter><Pricing /></MemoryRouter>);
const demoCard = () => document.getElementById('demo');

test('all four /webapp mentions are links to /webapp (every viewport)', () => {
  mockViewport(false);
  renderPricing();
  const names = ['Webapp Bot access', 'Desktop + phone /webapp', 'Desktop Chrome + phone /webapp', 'avalisabot.vercel.app/webapp'];
  for (const name of names) {
    const links = screen.getAllByRole('link', { name });
    expect(links.length, name).toBeGreaterThan(0);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/webapp'));
  }
  expect(screen.getAllByRole('link', { name: 'Desktop + phone /webapp' })).toHaveLength(2);
  const faq = screen.getByText('Does it work on a phone?').closest('details');
  expect(within(faq).getByRole('link', { name: 'avalisabot.vercel.app/webapp' })).toHaveAttribute('href', '/webapp');
});

test('on a phone the Demo card leads with Phone setup and keeps Create free account as secondary', () => {
  mockViewport(true);
  renderPricing();
  const card = within(demoCard());
  const links = card.getAllByRole('link').filter((link) => ['Phone setup', 'Create free account'].includes(link.textContent));
  expect(links.map((link) => link.textContent)).toEqual(['Phone setup', 'Create free account']);
  expect(links[0]).toHaveAttribute('href', '/webapp');
  expect(links[0].className).toMatch(/v3-btn/);
  expect(links[1]).toHaveAttribute('href', '/register');
});

test('on desktop the Demo card is unchanged: Create free account only', () => {
  mockViewport(false);
  renderPricing();
  const card = within(demoCard());
  expect(card.getByRole('link', { name: 'Create free account' })).toHaveAttribute('href', '/register');
  expect(card.queryByRole('link', { name: 'Phone setup' })).toBeNull();
});

test('prices, checkout wording and the risk line are untouched', () => {
  mockViewport(true);
  renderPricing();
  expect(document.body.textContent).toMatch(/\$69/);
  expect(document.body.textContent).toMatch(/\$119/);
  expect(document.body.textContent).toMatch(/\$29\/month/);
  expect(screen.getByText('Trading involves risk; Martingale raises the stake after losses. Start on Demo.')).toBeInTheDocument();
});

test('the sticky FEATURE column shrinks to ~120px under 640px', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles', 'pages-v3.css'), 'utf8');
  expect(css).toMatch(/@media \(max-width: 639px\)[^}]*\{[^}]*\.v3p-compare \.v3p-table th:first-child[^}]*width: 120px/s);
});
