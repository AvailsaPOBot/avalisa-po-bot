const fs = require('fs');
const path = require('path');
const { withRelated, related } = require('../scripts/guide-related.cjs');

const guideDirectory = path.resolve(__dirname, '..', 'public', 'guide');
const guides = fs.readdirSync(guideDirectory).filter((file) => file.endsWith('.html'));

describe('guide related links', () => {
  test('the map covers every guide and only points at guides that exist', () => {
    expect(Object.keys(related).sort()).toEqual([...guides].sort());
    for (const [file, targets] of Object.entries(related)) {
      for (const target of targets) {
        expect(target).not.toBe(file);
        expect(guides).toContain(target);
      }
    }
  });

  test.each(guides)('%s has a current Related guides line', (file) => {
    const html = fs.readFileSync(path.join(guideDirectory, file), 'utf8');
    expect(withRelated(file, html)).toBe(html);
    expect(html.match(/<!-- related:start -->/g) || []).toHaveLength(1);
  });

  test('every guide is linked from at least one other guide', () => {
    const linked = new Set();
    for (const file of guides) {
      const html = fs.readFileSync(path.join(guideDirectory, file), 'utf8');
      for (const [, target] of html.matchAll(/href="(?:https:\/\/avalisabot\.vercel\.app)?\/guide\/([a-z0-9-]+\.html)"/g)) {
        if (target !== file) linked.add(target);
      }
    }
    expect(guides.filter((file) => !linked.has(file))).toEqual([]);
  });
});
