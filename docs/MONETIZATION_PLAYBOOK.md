# Monetization Playbook

Operational guide for the four revenue streams (ADR 0005). Prices and affiliate IDs live in `data/monetization/`.

## R1 — Sponsored Top-3 slots

- **Base price:** US$ 29/month or US$ 249/year per slot (country × category). Up to 3 slots per country/category.
- **Tier pricing** in `data/monetization/pricing.json`:

| Tier | Countries (v1.0) | Monthly | Yearly |
|---|---|---|---|
| 1 | US, GB, DE, JP, FR, CA, AU, NL, CH, KR | US$ 39 | US$ 349 |
| 2 | IT, ES, BR, MX, IN, ID, SA, TR | US$ 29 | US$ 249 |
| 3 | CN, RU | US$ 19 | US$ 169 |

  Tier 3 is priced low because sponsor demand from outlets in those markets is uncertain; revisit with data.
- **Editorial review before activation:** reject gambling, adult, scams, unlicensed streaming, content farms and anything that isn't news or media. Rejection triggers a refund.

### LemonSqueezy setup

1. Create a store; create one product "NewsMap sponsored slot" with two subscription variants (monthly, yearly) per tier.
2. Put the variant IDs in `data/monetization/pricing.json`.
3. Create a webhook to `https://<domain>/api/webhooks/lemonsqueezy` with events: `subscription_created`, `subscription_updated`, `subscription_payment_success`, `subscription_payment_failed`, `subscription_cancelled`, `subscription_expired`, `order_refunded`. Copy the signing secret.
4. Secrets: `wrangler secret put LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`.
5. Test mode first: run a full purchase, approval, cancellation and refund in test mode before switching keys.

Without `LEMONSQUEEZY_API_KEY` the checkout runs in simulation mode (local development and E2E tests).

## R2 — Contextual affiliates

Configured in `data/monetization/affiliates.json`. Programs to apply to: NordVPN, ExpressVPN, Surfshark, Proton VPN (privacy context); PressReader (legitimate access to paid newspapers); a financial data or newsletter program (economy pages).

| Page context | Offer | Allowed copy |
|---|---|---|
| sports, broadcast | VPN | Privacy on public Wi-Fi; following local news while traveling |
| politics, investigative | VPN | Privacy and protection from tracking |
| economy | Financial newsletters/data | Market content and tools |
| outlet with metered/hard paywall | PressReader | Read full digital editions legitimately |

**Forbidden copy:** bypassing paywalls, unblocking broadcasts or sports streams, evading geo-blocking, or anything encouraging terms-of-service or legal violations. Offers are hidden for visitors in countries where VPNs are restricted (`vpn-restricted-countries.json`) and when the visitor is in the page's own country.

Every affiliate block shows "Affiliate link — we may earn a commission" with a link to `/disclosures/`.

## R3 — Display ads (disabled at launch)

Turn on only when all hold:
1. AdSense approved the site (apply after the 20 countries are published and pages are indexed).
2. Google Privacy & Messaging (TCF-certified CMP) configured for EEA, UK and Switzerland.
3. The ads CSP profile is deployed.
4. `ADS_ENABLED=true`.

Placement rules: fixed-size containers only (leaderboard 728×90 desktop / 320×100 mobile, one in-feed between category rows, sticky sidebar on wide screens). Never above the country's first category row; never inside a category column; never more than three per page.

Network thresholds (verify current requirements before applying): AdSense has no traffic minimum; Ezoic and Mediavine-style networks require meaningful monthly sessions — move only when RPM data justifies it.

## R4 — Newsletter (post-launch)

Requires an e-mail provider (Amazon SES or similar free tier), double opt-in, unsubscribe link, consent records and a retention policy before any capture form ships.
