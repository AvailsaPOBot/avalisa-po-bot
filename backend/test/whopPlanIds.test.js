const test = require('node:test');
const assert = require('node:assert/strict');

const { PLAN_IDS, getPaidPlanFromWhop } = require('../src/lib/plans');
const { whopRecurrence } = require('../src/lib/pendingPurchase');

// 2026-10-21: Whop sent payment webhooks with only a plan id (price 0, no name); the two
// real Basic purchases that day were recorded as no_plan_match and never activated.
test('Whop plan id alone maps to the right plan', () => {
  assert.equal(getPaidPlanFromWhop({ planId: 'plan_1LhtddKS4Of4Z', priceInCents: 0, planName: '' }), PLAN_IDS.BASIC);
  assert.equal(getPaidPlanFromWhop({ planId: 'plan_7TS0m5lXOcgBd' }), PLAN_IDS.BASIC);
  assert.equal(getPaidPlanFromWhop({ planId: 'plan_Q1ZYGwVvBg3E0' }), PLAN_IDS.PRO);
  assert.equal(getPaidPlanFromWhop({ planId: 'plan_GpuDizsiFQ0l9' }), PLAN_IDS.PRO);
  assert.equal(getPaidPlanFromWhop({ planId: 'plan_fOVwXMLBMl0g9' }), PLAN_IDS.PRO);
  assert.equal(getPaidPlanFromWhop({ planId: 'plan_unknown123456' }), null);
});

test('one-time Whop plans stay permanent (expiresAt null)', () => {
  for (const id of ['plan_1LhtddKS4Of4Z', 'plan_Q1ZYGwVvBg3E0']) {
    const r = whopRecurrence({ plan: { id } });
    assert.equal(r.isRecurring, false);
    assert.equal(r.expiresAt, null);
  }
});

test('the $29/month plan is recurring and never permanent, even with no renewal date', () => {
  const now = new Date('2026-10-21T00:00:00Z');
  const r = whopRecurrence({ plan_id: 'plan_fOVwXMLBMl0g9' }, now);
  assert.equal(r.isRecurring, true);
  assert.ok(r.expiresAt instanceof Date);
  assert.ok(r.expiresAt > now);
});
