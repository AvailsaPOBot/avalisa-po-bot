import fs from 'node:fs';
import path from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import Guide from './Guide';

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('../lib/api', () => ({ API_BASE: 'https://api.example.test' }));

test('guide setup switcher and static index cover the phone path and every static guide', () => {
  render(<Guide />);
  fireEvent.click(screen.getByRole('button', { name: /phone \/ tablet/i }));
  expect(screen.getAllByRole('link', { name: /Open phone setup/i })[0]).toHaveAttribute('href', '/webapp');
  expect(screen.getByRole('heading', { name: /set a martingale step cap/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/pocket option id/i)).toBeInTheDocument();

  const summary = screen.getByText(/browse all 55 guides/i);
  fireEvent.click(summary);
  const publicGuides = path.resolve(__dirname, '../../public/guide');
  const staticFiles = fs.readdirSync(publicGuides).filter((file) => file.endsWith('.html'));
  for (const file of staticFiles) {
    expect(document.querySelector(`a[href="/guide/${file}"]`), `${file} has a guide link`).not.toBeNull();
  }
});
