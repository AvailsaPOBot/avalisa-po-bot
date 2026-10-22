import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));

describe('homepage landing', () => {
  beforeEach(() => {
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });

  test('renders its main heading and both conversion destinations', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: /automate pocket option trades with rules you control/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /start 10 free demo trades/i }).some((link) => link.getAttribute('href') === '/register')).toBe(true);
    expect(screen.getByRole('link', { name: 'Compare Pro options' })).toHaveAttribute('href', '/pricing#pro');
  });

  test('shows all eight homepage sections', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    ['top', 'how-it-works', 'controls', 'demo', 'pricing', 'trust', 'faq'].forEach((id) => expect(document.getElementById(id)).toBeInTheDocument());
    expect(screen.getByText('Try the controls at your own pace.')).toBeInTheDocument();
  });

  test('offers Avalisa Bot mode as Pro and excludes prohibited claims from rendered copy', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /avalisa bot pro/i })).toBeInTheDocument();
    const text = document.body.textContent;
    expect(text).not.toMatch(/\bguarantee\b|\bprofit\b|\bpassive income\b|\bwin rate\b|\bAI\b/i);
  });

  test('updates the step exposure calculator from its visible controls', () => {
    render(<MemoryRouter><Landing /></MemoryRouter>);
    expect(screen.getByText('Maximum cycle exposure: $150 · 15× base stake')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Martingale recovery steps'), { target: { value: '2' } });
    expect(screen.getByText('Steps 2 means 3 trades in a cycle')).toBeInTheDocument();
    expect(screen.getByText('Maximum cycle exposure: $70 · 7× base stake')).toBeInTheDocument();
  });
});
