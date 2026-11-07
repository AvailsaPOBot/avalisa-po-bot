/**
 * The promo code we ADVERTISE must be the one our affiliate link actually CARRIES.
 *
 * Until 2026-08-27 the landing page said "use code 50START" while every affiliate
 * link in the product sent code=WELCOME50. Anyone who typed what they were told
 * lost the Pocket Option first-deposit bonus — and we lost the first-time deposit
 * behind it. Nothing looked broken; the two facts simply lived in different files.
 *
 * This test reads BOTH from source and fails if they ever disagree again.
 */
const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8');

test('every advertised promo code matches the code the affiliate link carries', () => {
  const landing = read('pages/Landing.jsx');
  const affiliate = read('lib/affiliate.js');

  // What the link actually applies.
  const linkCodes = [...affiliate.matchAll(/[?&]code=([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
  expect(linkCodes.length).toBeGreaterThan(0);
  const carried = new Set(linkCodes);
  expect(carried.size).toBe(1);
  const theCode = [...carried][0];

  // What we tell the customer.
  const declared = (landing.match(/AFFILIATE_PROMO_CODE\s*=\s*'([^']+)'/) || [])[1];
  expect(declared).toBe(theCode);

  // And no OTHER bonus-looking code may appear in the VISIBLE COPY. Comments are
  // stripped first — this file documents the old wrong code on purpose, and a test
  // that cannot tell code from prose would force us to delete the explanation.
  const visible = landing
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  const strays = [...visible.matchAll(/\b([A-Z]{3,}\d{2,}|\d{2,}[A-Z]{3,})\b/g)]
    .map((m) => m[1])
    .filter((c) => c !== theCode && !/^UTM|^REACT/.test(c));
  expect(strays).toEqual([]);
});

test('no deployed static page advertises a code the affiliate link does not carry', () => {
  // dashboard/public/redesign-v2.html said 50START while the links carried WELCOME50.
  // It now lives in dashboard/design-spec/ (not deployed); this stops it coming back.
  const publicDir = path.join(__dirname, '..', 'public');
  const html = fs.readdirSync(publicDir, { recursive: true })
    .filter((f) => f.endsWith('.html'));
  expect(html.length).toBeGreaterThan(0);
  for (const file of html) {
    expect(fs.readFileSync(path.join(publicDir, file), 'utf8'), file).not.toMatch(/\b50START\b/);
  }
});
