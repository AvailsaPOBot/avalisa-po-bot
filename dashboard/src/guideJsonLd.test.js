const fs = require('fs');
const path = require('path');
const { withJsonLd, text } = require('../scripts/guide-jsonld.cjs');

const guideDirectory = path.resolve(__dirname, '..', 'public', 'guide');
const guides = fs.readdirSync(guideDirectory).filter((file) => file.endsWith('.html'));

function jsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  expect(blocks).toHaveLength(1);
  return JSON.parse(blocks[0][1]);
}

describe('guide structured data', () => {
  test.each(guides)('%s has current Article JSON-LD and FAQ answers taken from the page', (file) => {
    const html = fs.readFileSync(path.join(guideDirectory, file), 'utf8');
    expect(withJsonLd(html)).toBe(html);

    const graph = jsonLd(html)['@graph'];
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    const article = graph.find((node) => node['@type'] === 'Article');
    expect(article.url).toBe(canonical);
    expect(article.headline).toBeTruthy();

    const pageText = text(html.slice(html.search(/<body\b/i)));
    const faq = graph.find((node) => node['@type'] === 'FAQPage');
    for (const item of faq?.mainEntity || []) {
      expect(item.name.endsWith('?')).toBe(true);
      expect(pageText).toContain(item.name);
      expect(pageText).toContain(item.acceptedAnswer.text);
    }
  });
});
