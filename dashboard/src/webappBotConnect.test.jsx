import { describe, expect, it, vi } from 'vitest';
import { handBackSession, PO_ORIGINS } from './pages/WebappBotConnect';

describe('Webapp Bot connect hand-back', () => {
  it('posts the session only to Pocket Option origins, never with a wildcard', () => {
    const opener = { postMessage: vi.fn() };
    expect(handBackSession(opener, 'jwt-1', { id: 'u1', email: 'a@b.c', isAdmin: true })).toBe(true);
    const origins = opener.postMessage.mock.calls.map(([, origin]) => origin);
    expect(origins).toEqual(PO_ORIGINS);
    expect(origins).not.toContain('*');
    origins.forEach(origin => expect(origin).toMatch(/^https:\/\/(m\.)?(po\.trade|po\.cash|pocketoption\.com)$/));
    // Only what the panel needs leaves this site.
    expect(opener.postMessage.mock.calls[0][0]).toEqual({
      type: 'avalisa-webapp-session', token: 'jwt-1', user: { id: 'u1', email: 'a@b.c' },
    });
  });

  it('does nothing without an opener or a token', () => {
    expect(handBackSession(null, 'jwt-1', {})).toBe(false);
    const opener = { postMessage: vi.fn() };
    expect(handBackSession(opener, null, {})).toBe(false);
    expect(opener.postMessage).not.toHaveBeenCalled();
  });
});
