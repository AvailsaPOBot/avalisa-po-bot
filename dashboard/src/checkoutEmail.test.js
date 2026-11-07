import { appendCheckoutEmail, WHOP_PRO_CHECKOUT_URL } from './lib/checkout';

// Whop's plan checkout fills the email field from ?email= (seen signed out, 5 Nov 2026).
// checkout[email]= left it blank. The licence is matched on this email.
test('checkout email uses the parameter Whop reads', () => {
  expect(appendCheckoutEmail(WHOP_PRO_CHECKOUT_URL, 'a+b@example.com'))
    .toBe('https://whop.com/checkout/plan_Q1ZYGwVvBg3E0/?email=a%2Bb%40example.com');
});

test('no email leaves the link untouched', () => {
  expect(appendCheckoutEmail(WHOP_PRO_CHECKOUT_URL, '')).toBe(WHOP_PRO_CHECKOUT_URL);
});
