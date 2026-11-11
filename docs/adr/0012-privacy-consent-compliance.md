# 0012. Privacy, consent and compliance

- Status: accepted, amended by [0014](0014-free-static-hosting-on-github-pages.md) (2026-11-11)

> Amendment (ADR 0014): there is no analytics, no ads and no form backend any more, so the project holds no personal data. Corrections are public GitHub issues; GitHub, as host, processes visitors' IP addresses under its own privacy statement. The disclosures page now states that the site has no ads, sponsorships or affiliate links.

- Date: 2026-10-27

## Context

Visitors come from the EU, UK, Brazil and the US. Ads require a certified consent platform in the EEA/UK. Advertisers and affiliate programs require disclosures.

## Decision

- **v1.0 sets no cookies.** Theme preference is stored in `localStorage`; first-party analytics uses a daily-rotating salted hash and no persistent identifiers.
- **Ads only with a TCF-certified CMP** (Google Privacy & Messaging) configured for EEA, UK and Switzerland, and only when `ADS_ENABLED=true`.
- Required pages: privacy (LGPD/GDPR controller, bases, retention, rights, contact), terms, disclosures (affiliates and sponsorships, FTC/CONAR style), methodology, corrections.
- Contact e-mails in submissions and corrections are anonymized 24 months after closure; free suggestions and corrections never closed are anonymized 24 months after they were sent. Billing contacts of running listings are kept.
- Third-party data (RSF, World Bank) is attributed on every page that uses it.
- Final legal texts are approved by the owner.

## Alternatives considered

- Third-party analytics with cookies: consent banner on day one, worse performance.

## Consequences

- No consent banner is needed at launch, which removes a common source of layout shift and friction.
