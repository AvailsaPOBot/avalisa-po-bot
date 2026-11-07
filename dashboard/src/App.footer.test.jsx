import { render } from '@testing-library/react';
import App from './App';

vi.mock('./hooks/useAuth', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ user: null, logout: vi.fn() }),
}));

test('the shared footer links to Phone setup on every viewport', () => {
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<App />);
  const footer = document.querySelector('footer.site-shared-footer');
  const labels = Array.from(footer.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')]);
  expect(labels).toEqual([['Pricing', '/pricing'], ['Setup guide', '/guide'], ['Phone setup', '/webapp'], ['Privacy', '/privacy']]);
});
