import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';
import { AFFILIATE_LINK } from '../lib/affiliate';

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));

const renderLanding = () => render(<MemoryRouter><Landing /></MemoryRouter>);

describe('homepage landing', () => {
  beforeEach(() => {
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  });

  test('renders the hero heading and both hero calls to action', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 1, name: /set your rules\. let avalisa run the steps\./i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /start 10 free demo trades/i }).every((link) => link.getAttribute('href') === '/register')).toBe(true);
    expect(screen.getAllByRole('link', { name: /see how it works/i })[0]).toHaveAttribute('href', '#how');
    expect(screen.getByRole('link', { name: /compare pro options/i })).toHaveAttribute('href', '/pricing#pro');
  });

  test('shows the hero mascot and every section', () => {
    renderLanding();
    expect(screen.getAllByRole('img', { name: /avalisa, the avalisa po bot mascot/i }).length).toBe(2);
    ['top', 'how', 'how-it-works', 'controls', 'phone', 'pricing', 'trust', 'faq'].forEach((id) => expect(document.getElementById(id)).toBeInTheDocument());
    expect(screen.getByText('Try the controls')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open the setup guide/i })).toHaveAttribute('href', '/guide');
    expect(screen.getAllByRole('link', { name: /open phone setup/i }).every((link) => link.getAttribute('href') === '/webapp')).toBe(true);
  });

  test('keeps the plan facts: Demo is 10 Martingale trades, Avalisa Bot 4-rule mode is Pro', () => {
    renderLanding();
    const text = document.body.textContent;
    expect(text).toMatch(/10 Martingale trades/);
    expect(text).toMatch(/Avalisa Bot 4-rule mode is Pro/);
    expect(text).toMatch(/\$69/);
    expect(text).toMatch(/\$119/);
    expect(text).toMatch(/\$29\/month/);
    expect(text.match(/Trading involves risk\. Start on a demo account\./g).length).toBeGreaterThan(0);
  });

  test('the affiliate link carries the commission disclosure', () => {
    renderLanding();
    expect(screen.getByRole('link', { name: /open pocket option/i })).toHaveAttribute('href', AFFILIATE_LINK);
    expect(screen.getByText('We may earn a commission.')).toBeInTheDocument();
  });

  test('excludes prohibited claims and wording from rendered copy', () => {
    renderLanding();
    const text = document.body.textContent;
    expect(text).not.toMatch(/\bguarantee|\bprofit|\bpassive income\b|\bwin[- ]rate\b|\bAI\b|artificial intelligence|machine learning/i);
    expect(text).not.toMatch(/\bv\d+(\.\d+)*\b|version \d/i);
  });

  test('updates the step exposure calculator from its visible controls', () => {
    renderLanding();
    expect(screen.getByText('Maximum cycle exposure: $150 · 15× base stake')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Martingale recovery steps'), { target: { value: '2' } });
    expect(screen.getByText('Steps 2 means 3 trades in a cycle')).toBeInTheDocument();
    expect(screen.getByText('Maximum cycle exposure: $70 · 7× base stake')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /stop bot/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Stopped by you');
  });

  test('keeps the sticky CTA lift for the floating chat button', () => {
    const css = fs.readFileSync(path.resolve(__dirname, '..', 'styles', 'home.css'), 'utf8');
    expect(css).toMatch(/body:has\(\.home-sticky\) \.floating-chat-button/);
  });
});
