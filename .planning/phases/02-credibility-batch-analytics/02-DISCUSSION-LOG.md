# Phase 2: Credibility Batch + Analytics - Discussion Log

> Audit trail only. Decisions live in CONTEXT.md.

**Date:** 2026-05-27 · **Mode:** --auto · **Phase:** 02-credibility-batch-analytics

## Content rendering (changelog/blog)
| Option | Selected |
|--------|----------|
| Bundled TS content modules + react-markdown, force-static (no runtime fs) | ✓ |
| `@next/mdx` route pages | (loader/config + Workers risk) |
| `fs.readFileSync` at request time | ✗ rejected — breaks on Cloudflare Workers (no runtime fs) |

**Why:** prod is Workers/OpenNext with no runtime filesystem; a clean local build has 500'd in prod twice. Static + bundled content is the safe path.

## Contact delivery
| Option | Selected |
|--------|----------|
| `/api/contact` → `sendEmail()` (Phase 1) to `CONTACT_TO`, validate + in-memory rate-limit | ✓ |
| Queue to D1 | (heavier; defer) |

## Suggestion box
| Option | Selected |
|--------|----------|
| EXTEND FeedbackWidget + /api/feedback with a `type` toggle (feature vs feedback) | ✓ |
| New separate widget | ✗ rejected — brief says extend, don't duplicate |

## Analytics
| Option | Selected |
|--------|----------|
| CF Web Analytics beacon (pageviews) + provider-agnostic `track()` for events | ✓ |
| Lock an events backend now (Plausible/Umami) | (needs account; deferred — abstraction keeps it swappable) |

## Donation
| Option | Selected |
|--------|----------|
| Footer outbound "Buy us a coffee" link via `DONATION_URL` (placeholder, confirm handle) | ✓ |

## Human handoffs (config only, no rework): CONTACT_TO, DONATION_URL, NEXT_PUBLIC_CF_BEACON_TOKEN, + events-backend product decision.
## Claude's Discretion: route-group layout, rate-limit sizing, Prose styling.
## Deferred: MDX/CMS, RSS, real analytics events backend, Stripe donations.
