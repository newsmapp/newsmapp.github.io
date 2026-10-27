# 0013. Payments through a Merchant of Record (LemonSqueezy)

- Status: accepted
- Date: 2026-10-27

## Context

Sponsors are outlets worldwide. Selling subscriptions directly means registering for and remitting VAT/sales tax in many jurisdictions, handling invoices, chargebacks and fraud — too much for a solo owner.

## Decision

- LemonSqueezy as Merchant of Record: it is the legal seller, collects and remits taxes, issues invoices and pays out net revenue.
- Checkout is created server-side after reserving a slot (30-minute hold enforced by a partial unique index). The webhook verifies `X-Signature` (HMAC-SHA256 over the raw body, constant-time comparison) and is idempotent through `webhook_events`.
- Lifecycle handled: created, updated, payment success, payment failed (7-day grace), cancelled (active until period end), expired, refunded.
- Full simulation mode when `LEMONSQUEEZY_API_KEY` is absent.

## Alternatives considered

- Stripe directly: lower fees, but the owner carries global tax compliance.
- Paddle: equivalent Merchant of Record; LemonSqueezy chosen for simpler setup. Switching later only affects the payment adapter.

## Consequences

- Higher per-transaction fee (roughly 5% + US$ 0.50; verify current pricing) in exchange for no tax operations.
