# Constraints

Synthesized from classified SPEC documents. Each constraint is preserved with source attribution.

---

## CON-branch-pr-board-deploy
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ Governance rule 1; Definition of done)
- type: protocol
- content:
  Each workstream lives on its own branch off `main` → opens a PR → must pass green gates →
  board review (Christo / Craig / Priyanshu) → human-gated deploy. Agents do NOT auto-merge
  and do NOT deploy. Applies to every workstream (WS1–WS6).

## CON-pre-pr-gates
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ Governance rule 2)
- type: nfr
- content:
  Gates required before a PR is mergeable:
  - `npm run build` clean (TypeScript passes).
  - `npx eslint <changed files>` adds NO new errors. The 2 pre-existing
    `set-state-in-effect` warnings in `app/components/RepoRadarApp.tsx` are an accepted baseline.
  - Relevant Playwright suite green.

## CON-verify-results-not-mechanics
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ Governance rule 3; AGENTS.md Verification Expectations)
- type: nfr
- content:
  For anything touching search / query / UI, verification must confirm the RENDERED OUTPUT
  matches the input — type real queries, click real controls, confirm returned cards match.
  Asserting that a URL / flag / state changed is NOT sufficient.

## CON-prod-build-deploy-rollback
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ Governance rule 4)
- type: protocol
- content:
  Prod runs on Cloudflare Workers with per-isolate caches and a rate-limited GitHub token. A
  clean local build can still 500 / stall in prod (has happened twice). Required cadence for
  every deploy: build → deploy → hammer the live route → be ready to `npx wrangler rollback <version-id>`.
  Prod smoke suite: `npm run test:smoke` (prod-only, `workers: 2`). Local feature tests via
  `playwright.local.config.ts`.

## CON-hackathon-ui-freeze
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ Governance rule 5)
- type: nfr
- content:
  Keep the "AI Tinkerers Generative UI Hackathon" header and the UI contracts in `AGENTS.md`
  intact until hackathon results are declared. Ship only changes that improve real users or
  the demo. No change may reduce demo quality, clarity, reliability, or win chance.

## CON-next16-read-local-docs
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ 0 Stack)
- type: protocol
- content:
  Stack is Next.js 16 (App Router, Turbopack) with breaking changes vs. older versions. Read
  the relevant doc under `node_modules/next/dist/docs/` before changing any Next behavior.
  Enforced by `AGENTS.md`.

## CON-cloudflare-opennext-deploy
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ 0 Stack)
- type: protocol
- content:
  Deployment target is Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`, `wrangler.jsonc`).
  `npm run deploy` builds + deploys; `npx wrangler rollback <version-id>` reverts. Bindings
  available: R2 (`reporadar-opennext-cache`), D1, Images, a self-reference Worker; separate
  deploy Worker in `workers/deploy`.

## CON-github-rate-budget
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (Prerequisite A; WS2 scheduled job)
- type: nfr
- content:
  GitHub polling must respect rate limits: dedupe distinct subscribed terms, batch, cache, and
  back off; never block on a slow upstream. The alerts job must NOT share a human's rate budget —
  it requires a dedicated app-owned token (see PRE-github-token).

## CON-recs-directional-honest
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (WS3 Hard constraints; acceptance)
- type: nfr
- content:
  Repo Intelligence recommendations/estimates must be directional and honest: lead with
  reasoning + pros/cons; present effort/time as ranges with rationale, not false precision.
  Hype-y or wrong recommendations kill trust. Output must be verified for accuracy, not just
  that it ran (no generic top-stars results).

## CON-proprietary-input-privacy
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (WS3 Hard constraints; acceptance)
- type: nfr
- content:
  Users paste proprietary product/stack details. Handling must be explicit; do not log or
  retain without consent. Trust-critical, especially for paid/team use.

## CON-metered-paid-cost
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (WS3 Hard constraints; WS4; WS5)
- type: nfr
- content:
  Deep / multi-model analysis and audio generation have real per-call cost and must be
  metered / gated. Multi-model synthesis (fast model for breadth + Opus for depth) is reserved
  for PAID artifacts only. Server-side entitlement gating (not UI-only).

## CON-reuse-existing-features
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ 0 What already shipped; WS1; WS2)
- type: protocol
- content:
  Build on existing scaffolding rather than duplicating:
  - Suggestion box extends `/api/feedback` + `FeedbackWidget`; do not duplicate.
  - Alerts build on notifications v1 (`app/api/notifications/subscribe`,
    `tests/notifications.spec.ts`), replacing in-memory/dummy email with real persistence + delivery.
  - Reuse `app/lib/github.ts` `fetchTrending`, `app/api/repos/route.ts` caching, CopilotKit
    chat, ElevenLabs TTS, Gemini translation.
  Do NOT rebuild already-shipped features (shareable URLs, SSR caching, single-select tags,
  stale-result guard, tuning re-rank pulse).

## CON-sequencing-order
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ Sequencing)
- type: protocol
- content:
  Build order is fixed; each earlier workstream unlocks/derisks the later ones:
  WS1 (credibility + analytics) → WS2 (threshold alerts) → WS3 (Repo Intelligence) →
  WS4 (audio overview) → WS5 (premium + Stripe) → WS6 (HN/PH launch).
  Premium (WS5) and public launch (WS6) come LAST, only after real usage data justifies them.
  Prerequisites PRE-github-token and PRE-email-provider must complete before WS2.
