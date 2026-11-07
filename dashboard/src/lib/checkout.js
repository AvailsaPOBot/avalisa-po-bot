// Public Whop products are intentionally version-controlled: an environment
// override can silently send every buyer to a deleted checkout.
// Direct plan checkouts: each button opens the plan it names. The Pro product page leads
// with $29/month and hides $119 behind "+1 option". Ids mapped in backend/src/lib/plans.js.
export const WHOP_BASIC_CHECKOUT_URL = 'https://whop.com/checkout/plan_1LhtddKS4Of4Z/';
export const WHOP_PRO_CHECKOUT_URL = 'https://whop.com/checkout/plan_Q1ZYGwVvBg3E0/';
export const WHOP_PRO_MONTHLY_CHECKOUT_URL = 'https://whop.com/checkout/plan_fOVwXMLBMl0g9/';

export function appendCheckoutEmail(checkoutUrl, email) {
  if (!email) return checkoutUrl;

  const separator = checkoutUrl.includes('?') ? '&' : '?';
  return `${checkoutUrl}${separator}email=${encodeURIComponent(email)}`;
}
