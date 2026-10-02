# Stripe checkout implementation report

Date: 2026-10-02  
Worktree: `/Volumes/Disk/2-Projects/Avalisa PO Bot/po-stripe`  
Branch: `claude/stripe-po-bot`

## Implemented

- Added the exact-pinned official `stripe` Node package (`22.6.2`) to `backend/package.json` and updated `backend/package-lock.json`.
- Added an account-checked Stripe client and Checkout configuration in `backend/src/lib/stripe.js`. Stripe remains disabled when the secret key is absent, account verification fails, or the configured account is the Avalisa Estate account.
- Added public Stripe status and authenticated Checkout endpoints in `backend/src/routes/payments.js`.
- Added a raw-body verified Stripe webhook in `backend/src/routes/webhooks.js`. One-time purchases use `activatePaidLicense`; Pro monthly access follows the existing expiring Whop license rule and `shouldRevokeLicense`. Duplicate checkout deliveries use the existing payment reference idempotency. Unmapped buyers are reported through `recordUnmappedPurchase`.
- Added Stripe alert reasons and session reference details in `backend/src/lib/purchaseAlert.js`.
- Added mocked Stripe tests in `backend/test/stripe.test.js`.
- No Prisma schema change or migration was made. Whop activation/deactivation and PayPal capture behavior were left intact. The existing Whop full-payload debug log was removed to comply with the no-payload-logging rule; it logged no longer, while payment handling remains unchanged.

## Render environment

Set these only after the Board creates and approves the separate PO Bot Stripe account:

- `STRIPE_SECRET_KEY` — secret API key from the PO Bot Stripe account. The service refuses to enable Stripe if account verification fails or the returned account is the Estate account.
- `STRIPE_WEBHOOK_SECRET` — signing secret for the webhook endpoint below.

Optional:

- `SITE_URL` — success/cancel URL origin. Defaults to `FRONTEND_URL`, then `https://avalisabot.vercel.app`.

No Stripe variable was added to `REQUIRED_ENV`; missing Stripe keys do not prevent startup. `FRONTEND_URL` already exists and remains supported as the URL fallback.

## Stripe webhook configuration

Configure this endpoint in the new PO Bot Stripe account:

`https://avalisa-backend.onrender.com/api/webhooks/stripe`

Subscribe to:

- `checkout.session.completed`
- `invoice.paid`
- `customer.subscription.deleted`
- `customer.subscription.updated`

The last two events revoke only the matching expiring Stripe monthly Pro license when its status is canceled or unpaid; one-time and affiliate references are not selected by the Stripe subscription lookup.

## Verification and limits

- `node --test backend/test/stripe.test.js` — passed.
- `node --test backend/test/*.test.js` — passed, 158 tests.
- Boot import with `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` unset — passed.
- No live Stripe account/key or Render configuration was used. The webhook has not been registered in Stripe and nothing was deployed.
- `git status` includes a pre-existing untracked `docs/design/stripe-po-bot-job.md`; this file was not created or edited as part of implementation.

## Claude QC — 2026-10-02

Reviewed the full diff and reran everything (160/160 backend tests after the fixes below; boot import with Stripe vars unset passes once the pre-existing `DATABASE_URL` guard is satisfied).

Two fixes made by Claude:
1. **Account check no longer sticks on failure.** A single failed `accounts.retrieve()` at first use used to disable Stripe until the next Render restart. It now retries on the next call; the Estate-account guard still latches. Test: `a failed account check is retried…`.
2. **Checkout refuses plans that would overwrite access the customer already owns** (409 with a plain message): permanent Pro buying anything; active monthly Pro buying monthly again; permanent Basic buying Basic or Pro monthly (monthly writes an expiring licence, so cancelling would drop a $69 Basic owner to Demo). Basic → Pro one-time and expired-monthly → anything stay allowed. Test mutation-checked (guard removed → test fails).

Known, shared with the Whop path (not changed here): a monthly Pro subscriber who buys Pro one-time keeps being billed monthly until they cancel the subscription. Handle in the pricing UI copy when Stripe goes live.

Go-live order: Board creates the PO Bot Stripe account → test-mode keys via the clipboard script → Render env → register the webhook → end-to-end test purchase in test mode → only then live keys.
