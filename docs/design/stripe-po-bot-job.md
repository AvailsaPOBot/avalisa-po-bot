# Job — Stripe checkout for Avalisa PO Bot (backend only, flag-off by default)

Owner: Claude (spec, security review, deploy). Implementer: Codex.
Worktree: `/Volumes/Disk/2-Projects/Avalisa PO Bot/po-stripe` (branch `claude/stripe-po-bot`, off `main`).

## Context (Board decision 2 Oct 2026: "A + B")
- **A:** Whop stays the merchant of record and keeps working exactly as today. The Whop webhook (`/api/webhooks/whop`) and PayPal code must not change behaviour.
- **B:** add Stripe as a second checkout, on a **separate Stripe account created only for PO Bot**. It must never run on the Avalisa Estate Stripe account `acct_1ULZYMIIeEBWWtbW` (binary-options risk could freeze Estate's balance).
- Until the Board adds keys, Stripe is OFF and the backend behaves exactly as today.

## Hard rules
- Work only in this worktree. Never touch `/Volumes/Disk/2-Projects/Avalisa PO Bot/AvalisaPOBot-V2-Audit`.
- Change only `backend/` (plus `docs/design/`). No `extension/`, no `dashboard/`.
- Do NOT commit, push, deploy, or run `prisma migrate`. **No Prisma schema change.** If you find one is unavoidable, stop and explain in the report instead.
- Do NOT add any Stripe variable to `REQUIRED_ENV` in `backend/src/index.js`. Missing keys = Stripe disabled, server still boots.
- Never log secrets, full webhook payloads, or card/customer details.
- Reuse the existing license path: `backend/src/lib/licenseActivation.js` (`activatePaidLicense`), `backend/src/lib/plans.js` (`PLAN_IDS`, `shouldRevokeLicense`, entitlements), `backend/src/lib/purchaseAlert.js` (`recordUnmappedPurchase`). Read how `routes/webhooks.js` handles Whop activation/deactivation and PayPal capture, and match it. Pro is stored internally as `PLAN_IDS.PRO = 'lifetime'`; follow whatever the Whop path does for the $29/month subscription (expiry/revocation), do not invent a new model.
- Reference implementation for Stripe Checkout + webhook patterns (TypeScript, read-only): `/Volumes/Disk/2-Projects/Avalisa Estate/avalisa-estate/src/lib/stripe.ts` and its webhook route. Adapt; don't copy Estate branding or THB pricing.

## Build
1. Add the official `stripe` npm package to `backend/package.json` with an exact pinned version.
2. `backend/src/lib/stripe.js`:
   - `getStripe()` returns a client only when `STRIPE_SECRET_KEY` is set, else `null`.
   - **Estate-account guard:** on first use, call `stripe.accounts.retrieve()` (cache the result). If the account id is `acct_1ULZYMIIeEBWWtbW`, treat Stripe as disabled and `console.error` a clear message. Export `isStripeEnabled()` that is false when keys are missing, the guard tripped, or the guard check failed.
3. Routes in `backend/src/routes/payments.js` (same router as PayPal):
   - `GET /api/payments/stripe/status` → `{ enabled: boolean }` (no auth).
   - `POST /api/payments/stripe/checkout` (auth, `authMiddleware`) body `{ plan: 'basic' | 'pro' | 'pro_monthly' }` → `{ url }`. 503 `{ error: 'Stripe checkout is not available' }` when disabled. 400 on unknown plan.
     - Prices inline via `price_data`, USD: basic 6900 one-time, pro 11900 one-time, pro_monthly 2900 recurring monthly. Take the amounts from the existing plan/price constants if they exist in `plans.js`/`paypal.js`; otherwise define them once in `lib/stripe.js`.
     - Product names: `Avalisa PO Bot Basic`, `Avalisa PO Bot Pro`, `Avalisa PO Bot Pro (monthly)`.
     - `mode: 'payment'` for one-time, `'subscription'` for monthly. `client_reference_id = user.id`, `customer_email = user.email`.
     - `metadata = { project: 'avalisa-po-bot', userId, plan }` on the session, and the same on `payment_intent_data.metadata` (one-time) or `subscription_data.metadata` (monthly).
     - `success_url = ${SITE_URL}/dashboard?checkout=success`, `cancel_url = ${SITE_URL}/pricing?checkout=cancelled`, where `SITE_URL` defaults to `https://avalisabot.vercel.app` (use an existing env/constant if the codebase has one).
     - Let Stripe choose payment methods (no hardcoded `payment_method_types`), so cards/Apple Pay/Google Pay follow the account's dashboard settings.
4. Webhook `POST /api/webhooks/stripe` in `backend/src/routes/webhooks.js`, registered with `express.raw({ type: 'application/json' })` like Whop (it is already mounted before `express.json()`):
   - 503 when Stripe is disabled. Verify with `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`; 400 on failure or missing secret.
   - Ignore (200 `{received:true, ignored:true}`) any event whose object's `metadata.project !== 'avalisa-po-bot'`.
   - `checkout.session.completed` with `payment_status === 'paid'` (or `mode === 'subscription'` and status complete) → find the user by `metadata.userId` (fall back to `client_reference_id`, then email) → `activatePaidLicense` with the mapped plan. **Idempotent:** the same session id delivered twice must not double-grant, extend, or send a second notice. If no user matches → `recordUnmappedPurchase` like Whop/PayPal, still return 200.
   - `invoice.paid` for a `pro_monthly` subscription → keep/renew access the same way the Whop path treats a renewal.
   - `customer.subscription.deleted` (and `customer.subscription.updated` with status `canceled`/`unpaid`) → revoke using the same rule as Whop deactivation (`shouldRevokeLicense`). Never revoke one-time purchases or affiliate-granted Pro.
   - Return 500 on handler errors so Stripe retries.
5. Tests `backend/test/stripe.test.js` with `node:test`, Stripe client mocked (no network): disabled → status false + checkout 503; Estate-account guard disables; checkout builds correct mode/amount/metadata for each plan; bad signature → 400; wrong `metadata.project` ignored; completed session grants the right plan; duplicate delivery is idempotent; subscription deleted revokes monthly Pro only; unmapped buyer records an alert.

## Acceptance (Claude will run these)
1. `cd backend && node --test test/*.test.js` — all pass, including every pre-existing test unchanged.
2. `node -e "require('./backend/src/index.js')"` style boot check with no Stripe env set does not throw (or document the repo's existing boot test and run it).
3. `git status --short` shows changes only under `backend/` and `docs/design/`.
4. `grep -rn "acct_1ULZYMIIeEBWWtbW" backend/src` → only the guard.
5. Write `docs/design/stripe-po-bot-REPORT.md`: files changed, env vars the Board must set on Render (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, any others), the exact webhook URL and event list to configure in the new Stripe account, and anything you could not do. Do not claim actions you did not take.
