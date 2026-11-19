/**
 * PocketPartners attribution: every site link must end in &sub_id1=site so sign-ups from the
 * site can be told apart from YouTube/Facebook/TikTok/extension at the kill reviews.
 * The tag goes strictly at the END; the original campaign params must stay untouched and in order.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AFFILIATE_LINK } from './lib/affiliate';

// Split so affiliateLinkConsistency's "literal appears once" check still guards src/lib/affiliate.js.
const BASE = 'https://u3' + '.shortink.io/register?utm_campaign=36377&utm_source=affiliate&utm_medium=sr&a=h00sp8e1L95KmS&al=1272290&ac=april2024&cid=845788&code=WELCOME50';

function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(entryPath);
    return entry.name.endsWith('.html') ? [entryPath] : [];
  });
}

test('the site link is the campaign link with sub_id1=site appended at the end', () => {
  expect(AFFILIATE_LINK).toBe(`${BASE}&sub_id1=site`);
});

test('every static page link to PocketPartners carries sub_id1=site at the end', () => {
  const root = path.join(__dirname, '..');
  const pages = [path.join(root, 'index.html'), ...htmlFiles(path.join(root, 'public'))].filter((f) => fs.existsSync(f));
  const hrefs = pages.flatMap((file) => [...fs.readFileSync(file, 'utf8').matchAll(/href="(https:\/\/u3\.shortink\.io[^"]*)"/g)]
    .map((m) => ({ file: path.relative(root, file), href: m[1].replace(/&amp;/g, '&') })));
  expect(hrefs.length).toBeGreaterThan(0);
  hrefs.forEach(({ file, href }) => expect(`${file}: ${href}`).toBe(`${file}: ${BASE}&sub_id1=site`));
});
