/**
 * Board 2026-10-06: enforce the minimum payout on every trade. Live Demo run B traded
 * BHD/CNY at 88% (floor 90%) at ladder steps 1 and 2 because the monitor ran only when
 * martingaleStep === 0. The monitor now runs before every trade and, when it halts
 * mid-ladder, preserves the ladder so Start resumes the recovery.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const content = fs.readFileSync(path.join(__dirname, '../extension/content.js'), 'utf8');

const start = content.indexOf('// Payout monitor — before EVERY trade');
assert.ok(start > 0, 'payout monitor block present');
const block = content.slice(start, content.indexOf('// Signal-mode guard', start));
assert.ok(!/martingaleStep\s*===\s*0\s*\)\s*\{\s*\n\s*const pay/.test(content), 'monitor is no longer gated on step 0');
assert.match(block, /const pay = await checkPayoutBeforeTrade\(/, 'monitor runs unconditionally');
assert.match(block, /await preservePausedLadder\('payout_halt'\)/, 'a mid-ladder halt preserves the ladder');
assert.match(block, /ladder saved, press Start to resume/, 'the user is told the ladder is saved');

const scan = content.slice(content.indexOf('async function chooseAvalisaOpportunity'), content.indexOf('if (current.action !== \'SKIP\') return current;'));
assert.match(scan, /currentBelowFloor/, 'Avalisa current-pair scan applies the payout floor');

console.log('extension-payout-every-trade: ok');
