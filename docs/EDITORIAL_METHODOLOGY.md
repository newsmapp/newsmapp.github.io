# Editorial Methodology

The rules behind every label NewsMap shows. The public `/methodology/` page is rendered from this document's substance; the owner approves the final wording.

## Inclusion

An outlet is listed when it:

- publishes original news or analysis regularly (not only aggregation or press releases);
- has an identifiable publisher or owner;
- is reachable over HTTPS.

## Verification

1. Candidates are drafted (by people or tools) and health-checked: HTTP status, final URL, redirects and the site's own `<title>` are recorded.
2. The owner verifies each candidate against the outlet's own site and at least one independent source, then sets `status: verified` and `verified_at`.
3. Facts with consequences (owner, founding year, ownership type, political lean) carry a source URL in `sources`.
4. Weekly health checks flag broken or moved sites; changes to verified records are applied by the owner.

## Paywall

| Label          | Meaning                                               |
| -------------- | ----------------------------------------------------- |
| Free           | All articles readable without payment or registration |
| Metered        | A number of free articles per period, then payment    |
| Freemium       | Some sections free, premium sections paid             |
| Paywall (hard) | Nearly all content requires a subscription            |

Checked by visiting the site without an account; recorded as of `verified_at`.

## Ownership type

| Label            | Meaning                                                                  | Source required |
| ---------------- | ------------------------------------------------------------------------ | --------------- |
| Private          | Owned by a company or individuals                                        | no              |
| Public service   | Publicly funded with editorial independence guaranteed by law or charter | no              |
| State-controlled | Editorial line controlled by a government or ruling party                | **yes**         |
| Nonprofit        | Owned by a foundation, trust or nonprofit                                | no              |
| Cooperative      | Owned by employees or readers                                            | no              |
| Unknown          | Ownership could not be established                                       | no              |

## Political lean

- Default is **unrated**. NewsMap does not assign political lean on its own judgment.
- A lean is shown only when a recognized, published rating exists, cited in `political_lean.source_url`.
- "Mixed" is used when recognized sources disagree materially.

## Ranking

Positions within a category are editorial: national reach, publication frequency, originality of reporting, and longevity, in that order of weight. Sponsored placements never change organic positions; they appear above them, separated and labeled "Sponsored".

## Corrections

Anyone can request a correction at `/corrections/`. Requests are reviewed by the owner; accepted corrections are applied to the catalog and take effect on the next build. Requesters who leave an e-mail are notified; e-mails are anonymized 24 months after the request closes.
