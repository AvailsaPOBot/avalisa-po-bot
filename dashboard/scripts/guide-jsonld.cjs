#!/usr/bin/env node
// Writes Article + FAQPage JSON-LD into every guide's <head>, built from the page's own
// title, description and "?" headings. Re-run after editing a guide: node scripts/guide-jsonld.cjs
const fs = require('fs');
const path = require('path');

const guideDirectory = path.resolve(__dirname, '..', 'public', 'guide');
const START = '<!-- jsonld:start -->';
const END = '<!-- jsonld:end -->';

function text(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(html, pattern) {
  return text(html.match(pattern)?.[1] || '');
}

// A question is an <h2>/<h3> ending in "?"; its answer is the first <p> before the next heading.
function faqPairs(html) {
  const body = html.slice(html.search(/<body\b/i));
  const headingPattern = /<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings = [...body.matchAll(headingPattern)];
  const pairs = [];
  headings.forEach((heading, index) => {
    const question = text(heading[2]);
    if (!question.endsWith('?')) return;
    const from = heading.index + heading[0].length;
    const to = index + 1 < headings.length ? headings[index + 1].index : body.length;
    const paragraph = body.slice(from, to).match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const answer = paragraph && text(paragraph[1]);
    if (answer) pairs.push({ question, answer });
  });
  return pairs;
}

function buildJsonLd(html) {
  const url = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
  const graph = [{
    '@type': 'Article',
    headline: attr(html, /<title>([\s\S]*?)<\/title>/i),
    description: attr(html, /<meta name="description" content="([^"]*)"/i),
    url,
    mainEntityOfPage: url,
    image: 'https://avalisabot.vercel.app/images/share-card.png',
    publisher: { '@type': 'Organization', name: 'Avalisa PO Bot', url: 'https://avalisabot.vercel.app/' },
  }];
  const pairs = faqPairs(html);
  if (pairs.length) {
    graph.push({
      '@type': 'FAQPage',
      url,
      mainEntity: pairs.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    });
  }
  // An embedded YouTube video: <div class="video-embed" data-video-id data-video-name ...>
  const video = html.match(/<div class="video-embed" data-video-id="([^"]+)" data-video-name="([^"]+)" data-video-description="([^"]+)" data-upload-date="([^"]+)" data-duration="([^"]+)"/);
  if (video) {
    const [, id, name, description, uploadDate, duration] = video;
    graph.push({
      '@type': 'VideoObject',
      name: text(name),
      description: text(description),
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      uploadDate,
      duration,
      contentUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      publisher: { '@type': 'Organization', name: 'Avalisa PO Bot', url: 'https://avalisabot.vercel.app/' },
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function withJsonLd(html) {
  const json = JSON.stringify(buildJsonLd(html), null, 2).replace(/</g, '\\u003c');
  const block = `${START}\n  <script type="application/ld+json">\n${json}\n  </script>\n  ${END}`;
  const existing = new RegExp(`${START}[\\s\\S]*?${END}`);
  return existing.test(html) ? html.replace(existing, block) : html.replace('</head>', `  ${block}\n</head>`);
}

if (require.main === module) {
  for (const file of fs.readdirSync(guideDirectory).filter((name) => name.endsWith('.html'))) {
    const target = path.join(guideDirectory, file);
    const html = fs.readFileSync(target, 'utf8');
    const next = withJsonLd(html);
    if (next !== html) fs.writeFileSync(target, next);
  }
}

module.exports = { faqPairs, buildJsonLd, withJsonLd, text };
