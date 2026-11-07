import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Guide from './Guide';

vi.mock('../lib/api', () => ({ API_BASE: 'https://api.example.test' }));

const REAL_MATCH_MEDIA = window.matchMedia;

function mockViewport(isPhone) {
  window.matchMedia = vi.fn((query) => ({ matches: query === '(max-width: 767px)' ? isPhone : false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

const quickStart = () => document.querySelector('.v3p-quick__start');
const renderGuide = () => render(<MemoryRouter><Guide /></MemoryRouter>);

afterEach(() => { window.matchMedia = REAL_MATCH_MEDIA; });

test('on a phone the Quick Start opens on Phone / Tablet with a Phone setup button and no extension buttons', () => {
  mockViewport(true);
  renderGuide();
  const block = within(quickStart());

  expect(block.getByRole('button', { name: /phone \/ tablet/i })).toHaveAttribute('aria-pressed', 'true');
  expect(block.getByRole('button', { name: /desktop chrome/i })).toHaveAttribute('aria-pressed', 'false');
  const cta = block.getAllByRole('link', { name: 'Phone setup' })[0];
  expect(cta).toHaveAttribute('href', '/webapp');
  expect(block.queryByRole('link', { name: /install the extension/i })).toBeNull();
  expect(block.queryByRole('link', { name: /get the extension/i })).toBeNull();
});

test('a phone that picks Desktop Chrome still gets no Chrome Web Store button', () => {
  mockViewport(true);
  renderGuide();
  screen.getByRole('button', { name: /desktop chrome/i }).click();
  const block = within(quickStart());
  expect(block.queryByRole('link', { name: /install the extension/i })).toBeNull();
  expect(block.getAllByRole('link', { name: 'Phone setup' })[0]).toHaveAttribute('href', '/webapp');
});

test('on desktop the Quick Start still opens on Desktop Chrome with the extension buttons', () => {
  mockViewport(false);
  renderGuide();
  const block = within(quickStart());
  expect(block.getByRole('button', { name: /desktop chrome/i })).toHaveAttribute('aria-pressed', 'true');
  expect(block.getByRole('link', { name: /install the extension/i })).toHaveAttribute('href', expect.stringContaining('chromewebstore.google.com'));
  expect(block.getByRole('link', { name: /get the extension/i })).toBeInTheDocument();
});

test('the seven-part walkthrough text is untouched', () => {
  mockViewport(true);
  renderGuide();
  expect(screen.getByText('Install and sign in')).toBeInTheDocument();
  expect(screen.getByText('Add the extension')).toBeInTheDocument();
  expect(screen.getByText(/Part 01 \/ 07/)).toBeInTheDocument();
});
