# 0012. Privacy, consent and compliance

- Status: accepted
- Date: 2026-10-27

## Context
Visitors come from the EU, UK, Brazil and the US. Ads require a certified consent platform in the EEA/UK. Advertisers and affiliate programs require disclosures.

## Decision
- **v1.0 sets no cookies.** Theme preference is stored in `localStorage`; first-party analytics uses a daily-rotating salted hash and no persistent identifiers.
- **Ads only with a TCF-certified CMP** (Google Privacy & Messaging) configured for EEA, UK and Switzerland, and only when `ADS_ENABLED=true`.
- Required pages: privacy (LGPD/GDPR controller, bases, retention, rights, contact), terms, disclosures (affiliates and sponsorships, FTC/CONAR style), methodology, corrections.
- Contact e-mails in submissions and corrections are anonymized 24 months after closure.
- Third-party data (RSF, World Bank) is attributed on every page that uses it.
- Final legal texts are approved by the owner.

## Alternatives considered
- Third-party analytics with cookies: consent banner on day one, worse performance.

## Consequences
- No consent banner is needed at launch, which removes a common source of layout shift and friction.
