# Synthesis Summary

Entry point for `gsd-roadmapper`. Synthesized from classified docs in
`/Users/cro/dev/reporadar/.planning/intel/classifications/`.

Mode: new (net-new bootstrap)
Precedence: ADR > SPEC > PRD > DOC

## Doc counts by type
- SPEC: 1 (BUILD-BRIEF.md — manifest-declared, precedence 0, high confidence)
- ADR: 0
- PRD: 0
- DOC: 0
- UNKNOWN/low-confidence: 0
- Total: 1

## Decisions locked
- 0 (no ADRs in ingest set)
- See: /Users/cro/dev/reporadar/.planning/intel/decisions.md

## Requirements extracted
- 9 scoped requirements (incl. 2 prerequisites)
  - PRE-github-token — dedicated app-owned GitHub token (before WS2)
  - PRE-email-provider — email delivery provider + `sendEmail()` (before WS2)
  - REQ-credibility-batch (WS1) — changelog, blog, contact, suggestion box, donation, analytics
  - REQ-threshold-alerts (WS2) — D1 subscriptions + snapshots, cron job, email delivery, Alerts UI
  - REQ-repo-intelligence (WS3) — talk-to-repo chat, adoption report, concierge recommendation
  - REQ-audio-overview (WS4) — per-repo Gemini→ElevenLabs→R2 audio overview
  - REQ-premium-stripe (WS5) — Stripe Checkout + webhook + D1 entitlements + gating
  - REQ-launch-prep (WS6) — HN/PH launch readiness checklist
- Build order is fixed (WS1→WS2→WS3→WS4→WS5→WS6); see CON-sequencing-order.
- See: /Users/cro/dev/reporadar/.planning/intel/requirements.md

## Constraints
- 13 total
  - protocol: 5 (branch/PR/board/deploy, prod build-deploy-rollback, Next16 local docs,
    Cloudflare/OpenNext deploy, reuse-existing-features, sequencing) 
  - nfr: 7 (pre-PR gates, verify-results-not-mechanics, hackathon UI freeze, GitHub rate budget,
    recs directional/honest, proprietary-input privacy, metered/paid cost)
  - schema: 0
  - api-contract: 0
  (Note: 6 protocol + 7 nfr = 13; sequencing counted under protocol.)
- See: /Users/cro/dev/reporadar/.planning/intel/constraints.md

## Context topics
- 4 (product identity, already-shipped, key files to reuse, cross-references)
- See: /Users/cro/dev/reporadar/.planning/intel/context.md

## Conflicts
- 0 blockers
- 0 competing-variants
- 0 auto-resolved
- Detail: /Users/cro/dev/reporadar/.planning/INGEST-CONFLICTS.md

## Notes for downstream
- BUILD-BRIEF.md is typed SPEC but is a hybrid: governance/operating rules were synthesized as
  constraints; workstream goals + acceptance criteria were synthesized as scoped requirements
  (per ingest instruction). The roadmapper should treat the 6 workstreams as the sequenced
  milestone and the 13 constraints as cross-cutting governance applied to every workstream.
- Prerequisites PRE-github-token and PRE-email-provider gate WS2 and onward.

## Per-type intel files
- /Users/cro/dev/reporadar/.planning/intel/decisions.md
- /Users/cro/dev/reporadar/.planning/intel/requirements.md
- /Users/cro/dev/reporadar/.planning/intel/constraints.md
- /Users/cro/dev/reporadar/.planning/intel/context.md
