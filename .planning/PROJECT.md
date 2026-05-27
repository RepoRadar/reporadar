# RepoRadar

## What This Is

RepoRadar is a dashboard that surfaces trending GitHub repos as agent-rendered, scored cards. Users tune 10 weighted dimensions (sliders + a draggable radar hex), filter by sort priority, search by tag or freeform text, and deploy a bespoke generative-UI surface for any repo. It is for builders deciding what open-source to adopt; the tagline is "Find the most meaningful repo to build upon as efficiently as possible." Originally built for the AI Tinkerers Generative UI Hackathon (header text frozen until results are declared), this milestone turns it from a demo into a credible, retained, monetizable product.

## Core Value

A builder can reliably find — and be alerted to — the most meaningful repo to build upon, and get an honest, reasoned read on whether and how to adopt it.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- Shareable search URLs (`?topic`/`?q`/`?sort`/`?window`) — already shipped
- SSR data caching + `s-maxage`/SWR headers on `/api/repos` — already shipped
- Single-select tags + center "Loading…" state — already shipped
- Stale-result guard + bounded GitHub/translation fetches — already shipped
- Tuning re-rank pulse — already shipped
- Notifications v1 scaffold (in-memory + dummy email) — shipped as scaffold, replaced by Phase 3
- Feedback intake (`/api/feedback`, `FeedbackWidget`) — already shipped, extended in Phase 2

### Active

<!-- Current scope. Building toward these. -->

- [ ] App-owned, fine-scoped GitHub token + tag caching/batching (Phase 1)
- [ ] Email delivery provider + `sendEmail()` lib (Phase 1)
- [ ] Credibility batch: changelog, blog, contact form, suggestion box, donation link, analytics (Phase 2)
- [ ] Threshold alerts: D1 subscriptions + snapshots, cron job, double opt-in email, Alerts UI (Phase 3)
- [ ] Repo Intelligence: talk-to-a-repo chat, adoption report, concierge recommendation (Phase 4)
- [ ] On-demand per-repo audio overview (Phase 5)
- [ ] Premium + Stripe entitlements and gating (Phase 6)
- [ ] HN / Product Hunt launch readiness (Phase 7)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Auth / accounts in WS1 — credibility batch is static/simple; accounts arrive only as needed for entitlements
- Payments in WS1 — donation is an outbound link only; real billing is Phase 6
- Comments / UGC — not core to current value; "Built-with" public showcase is a separate later track
- SMS / push alerts — email-only for v1
- Per-repo (vs per-term) alerts — deferred
- Full-source RAG / embeddings, GitHub OAuth "connect your GitHub" — Repo Intelligence v2, not this milestone
- Public "Built-with" showcase (profiles, moderation) — separate track; concierge does not require it
- Multi-host produced audio episodes, episode feed/RSS — only if usage justifies
- Multiple paid tiers — start with one tier
- Hackathon UI changes — header + AGENTS.md UI contracts frozen until results declared

## Context

- **Stack:** Next.js 16 (App Router, Turbopack). Breaking changes vs. older versions — read the relevant doc under `node_modules/next/dist/docs/` before changing any Next behavior.
- **Deploy:** Cloudflare Workers via OpenNext (`@opennextjs/cloudflare`, `wrangler.jsonc`). `npm run deploy` builds + deploys; `npx wrangler rollback <version-id>` reverts.
- **Bindings:** R2 (`reporadar-opennext-cache`), D1 (used by per-deploy surfaces), Images, a self-reference Worker; separate deploy Worker in `workers/deploy`.
- **Integrations:** CopilotKit (chat/actions), Gemini (`GOOGLE_API_KEY`, translation), ElevenLabs (`ELEVENLABS_API_KEY`, TTS already wired).
- **Reuse, don't rebuild:** `app/lib/github.ts` `fetchTrending` (5-tier search, single `AbortSignal.timeout`, uses `GITHUB_TOKEN`, fail-fast); `app/api/repos/route.ts` (in-memory cache + SWR + bounded translation); `app/components/RepoRadarApp.tsx` (central state, `runQuery`, `tuneWeights`/`tunePriorities`); `app/lib/translate.ts` (batched Gemini, module-cached); notifications v1 (`app/api/notifications/subscribe`, `tests/notifications.spec.ts`); feedback (`app/api/feedback`, `FeedbackWidget`).
- **Prod realities:** per-isolate caches + a rate-limited GitHub token mean a clean local build can still 500/stall in prod (has happened twice). Today's rate-limit failures trace to a shared personal `gh` token.
- **Team / governance:** board of three (Christo / Craig / Priyanshu). Every workstream ships on its own branch → PR → green gates → board review → human-gated deploy. Agents never auto-merge or auto-deploy.

## Constraints

- **Process**: Each workstream on its own branch off `main` → PR → green gates → board review → human-gated deploy. Agents NEVER auto-merge or auto-deploy. — keeps a human in the loop for prod.
- **Gates**: Before any PR — `npm run build` clean (TS passes); `npx eslint <changed files>` adds NO new errors (the 2 pre-existing `set-state-in-effect` in `RepoRadarApp.tsx` are baseline); relevant Playwright green. — defines "mergeable."
- **Verification**: For anything touching search/query/UI, confirm the RENDERED OUTPUT matches the input (type real queries, click real controls). Asserting a URL/flag/state changed is NOT sufficient. — a slow/failed fetch can leave stale cards under a new chip.
- **Prod cadence**: Always build → deploy → hammer the live route → be ready to `wrangler rollback`. Prod smoke: `npm run test:smoke` (prod-only, `workers: 2`); local tests via `playwright.local.config.ts`. Deploy is human-gated, so an autonomous executor STOPS at the green PR. — clean local build can still 500 in prod.
- **Next.js 16**: Read the relevant local doc under `node_modules/next/dist/docs/` before changing any Next behavior. — breaking changes vs. training data.
- **Hackathon freeze**: Keep the "AI Tinkerers Generative UI Hackathon" header + AGENTS.md UI contracts intact until results declared. No change may reduce demo quality, clarity, reliability, or win chance. — protects the entry.
- **GitHub rate budget**: Scheduled polling must dedupe distinct terms, batch, cache, back off, never block on slow upstream, and must use a dedicated app-owned token (not a human's). — shared token is today's failure source.
- **Honest recommendations**: Repo Intelligence output must be directional and honest — lead with reasoning + pros/cons; effort/time as reasoned ranges, not false precision; no generic top-stars. — hype-y/wrong recs kill trust.
- **Privacy**: Users paste proprietary product/stack details — be explicit about handling; do not log/retain without consent. — trust-critical for paid/team use.
- **Cost gating**: Deep/multi-model analysis and audio generation have real per-call cost; meter/gate them server-side (not UI-only). Multi-model synthesis (fast + Opus) reserved for paid artifacts. — protects unit economics.
- **Human-supplied secrets**: The app-owned `GITHUB_TOKEN` (Phase 1) and the real email-provider API key (Phase 1) can only be minted by the owner. An autonomous executor builds the code/stubs and STOPS, flagging the human handoff. — secrets are owner-only.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fixed build order WS1→WS6 (prereqs first) | Each earlier workstream unlocks/derisks the next; premium/launch only after real usage justifies them | — Pending |
| Prerequisites (token + email lib) as their own Phase 1 | They gate WS2 and onward; both involve owner-only secrets — a clean stop point for autonomous work | — Pending |
| Resend (or equivalent) as email provider | Simplest on Cloudflare Workers | — Pending |
| Email-only alerts, per-term (not per-repo) | Lean retention hook; SMS/push and per-repo deferred | — Pending |
| Repo Intelligence v1 = single strong model, shallow GitHub API, pasted stack | Multi-model + RAG + OAuth are cost/latency-heavy; defer to v2 | — Pending |
| Multi-model synthesis (fast + Opus) reserved for paid artifacts | Cost + latency must be gated to paid surfaces only | — Pending |
| One paid tier to start; build billing only when people try to pay | Avoid premature monetization complexity | — Pending |

---
*Last updated: 2026-05-27 after ingest-driven project initialization*
