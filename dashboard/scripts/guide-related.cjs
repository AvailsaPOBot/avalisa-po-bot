#!/usr/bin/env node
// Writes a "Related guides" line after each guide's "Next reads", from scripts/guide-related.json
// (page -> 3 related pages). Link text is the target page's own <title>; links already in the page's
// "Next reads" are skipped. Re-run after editing the map or a title: node scripts/guide-related.cjs
const fs = require('fs');
const path = require('path');
const { text } = require('./guide-jsonld.cjs');

const guideDirectory = path.resolve(__dirname, '..', 'public', 'guide');
const related = require('./guide-related.json');
const START = '<!-- related:start -->';
const END = '<!-- related:end -->';

function title(file) {
  const html = fs.readFileSync(path.join(guideDirectory, file), 'utf8');
  return text(html.match(/<title>([\s\S]*?)<\/title>/i)[1]);
}

function escape(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function withRelated(file, html) {
  const existing = new RegExp(`\\s*${START}[\\s\\S]*?${END}`);
  const base = html.replace(existing, '');
  const nextReads = base.match(/<p class="next-reads">[\s\S]*?<\/p>/)?.[0] || '';
  const links = (related[file] || [])
    .filter((target) => target !== file && !nextReads.includes(`/guide/${target}"`))
    .map((target) => `<a href="/guide/${target}">${escape(title(target))}</a>`);
  if (!links.length) return base;
  const block = `  ${START}\n        <p class="next-reads"><strong>Related guides:</strong> ${links.join(' &middot; ')}</p>\n        ${END}`;
  return base.replace('</article>', `${block}\n      </article>`);
}

if (require.main === module) {
  for (const file of fs.readdirSync(guideDirectory).filter((name) => name.endsWith('.html'))) {
    const target = path.join(guideDirectory, file);
    const html = fs.readFileSync(target, 'utf8');
    const next = withRelated(file, html);
    if (next !== html) fs.writeFileSync(target, next);
  }
}

module.exports = { withRelated, related };
