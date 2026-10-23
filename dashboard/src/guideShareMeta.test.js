const fs = require('fs');
const path = require('path');

const guideDirectory = path.resolve(__dirname, '..', 'public', 'guide');
const guides = fs.readdirSync(guideDirectory).filter((file) => file.endsWith('.html'));

function metaContent(html, attribute, value) {
  const tag = (html.match(/<meta\b[^>]*>/gi) || [])
    .find((candidate) => new RegExp(`\\b${attribute}=["']${value}["']`, 'i').test(candidate));
  return tag?.match(/\bcontent=["']([^"']*)["']/i)?.[1];
}

describe('guide share preview metadata', () => {
  test.each(guides)('%s has og:url, og:image and a large Twitter card', (file) => {
    const html = fs.readFileSync(path.join(guideDirectory, file), 'utf8');
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];

    expect(metaContent(html, 'property', 'og:url')).toBe(canonical);
    const image = new URL(metaContent(html, 'property', 'og:image'));
    expect(image.protocol).toBe('https:');
    expect(fs.existsSync(path.resolve(guideDirectory, '..', image.pathname.slice(1)))).toBe(true);
    expect(metaContent(html, 'name', 'twitter:card')).toBe('summary_large_image');
  });
});
