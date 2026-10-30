const fs = require('fs');
const path = require('path');

// The homepage is the only page Google had indexed (Search Console, 30 Oct 2026):
// its raw HTML must link every guide, or Google never finds a crawl path to them.
const dashboardDirectory = path.resolve(__dirname, '..');
const guideDirectory = path.join(dashboardDirectory, 'public', 'guide');
const indexHtml = fs.readFileSync(path.join(dashboardDirectory, 'index.html'), 'utf8');
const rootFallback = indexHtml.match(/<div id="root">([\s\S]*?)<\/div>/)?.[1] ?? '';
const guides = fs.readdirSync(guideDirectory).filter((file) => file.endsWith('.html'));

describe('homepage crawl links', () => {
  test('the root fallback links every guide page', () => {
    const missing = guides.filter((file) => !rootFallback.includes(`href="/guide/${file}"`));

    expect(missing).toEqual([]);
  });

  test('every guide linked from the fallback exists', () => {
    const linked = [...rootFallback.matchAll(/href="\/guide\/([^"]+\.html)"/g)].map((match) => match[1]);

    expect(linked.length).toBe(guides.length);
    linked.forEach((file) => expect(guides).toContain(file));
  });

  test('links pricing and the guide hub', () => {
    expect(rootFallback).toContain('href="/pricing"');
    expect(rootFallback).toContain('href="/guide"');
  });
});
