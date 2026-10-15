import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { tradeTarget, PO_DESKTOP_TRADE_URL } from './lib/tradeLaunch';

// Board, 2026-10-16: after signing in, the site still said "Log in" (it is painted into the
// home-page hero art), so people thought they were signed out and could not find the bot.
let mockUser = null;
vi.mock('./hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser, logout: vi.fn() }) }));
vi.mock('./lib/useLenis', () => ({ useLenis: () => {} }));

async function renderLanding() {
  const { default: Landing } = await import('./pages/Landing');
  return render(<MemoryRouter><Landing /></MemoryRouter>);
}

describe('signed-in header', () => {
  afterEach(() => { mockUser = null; });

  test('a signed-in visitor gets Dashboard and Trade, never Log in', async () => {
    mockUser = { id: 'u1', email: 'a@b.c', license: { plan: 'lifetime' } };
    await renderLanding();
    expect(screen.queryByRole('link', { name: /^log in$/i })).toBeNull();
    expect(screen.getAllByRole('link', { name: /dashboard/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /trade/i }).length).toBeGreaterThan(0);
  });

  test('a signed-out visitor still gets Log in and Register', async () => {
    await renderLanding();
    expect(screen.getAllByRole('link', { name: /log in/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /account menu/i })).toBeNull();
  });
});

describe('Trade button destination', () => {
  test('desktop Chrome opens Pocket Option, where the extension runs', () => {
    expect(tradeTarget('desktop-chromium')).toMatchObject({ href: PO_DESKTOP_TRADE_URL, external: true });
    expect(PO_DESKTOP_TRADE_URL).toMatch(/^https:\/\/pocketoption\.com\//);
  });
  test('phones go to the Webapp Bot; other desktop browsers to the Chrome explainer', () => {
    ['ios', 'ipados', 'android', 'desktop-other'].forEach((p) => {
      expect(tradeTarget(p)).toMatchObject({ href: '/webapp', external: false });
    });
  });
});
