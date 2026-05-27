---
phase: 3
slug: threshold-alerts
created: 2026-05-27
sampling_rate: per-requirement (unit + API + scheduled-handler + browser QA)
source: derived from 03-RESEARCH.md § Validation Architecture
---

# Phase 3 Validation Strategy — Threshold Alerts

Validation is **locally complete without deploy** (local D1 via `wrangler d1 migrations apply reporadar --local` + `node --test` + Playwright against the local dev server). Remote migration apply, cron deploy, and the live sweep with the prod `GITHUB_TOKEN` are owner/deploy-gated and explicitly out of the automated gate.

## Test Map

| Req | Truth to validate | Test type | Test artifact | Command |
|-----|-------------------|-----------|---------------|---------|
| ALRT-01 | Subscriptions + repo_snapshots persist in D1 (parameterized SQL) | unit/contract | `tests/notifications.routes.test.mjs` driving `tests/_localD1.mjs` | `node --test tests/notifications.routes.test.mjs` |
| ALRT-02 | `detectCrossings` returns the right repos per metric (stars_abs/stars_pct/velocity) | unit (pure) | `tests/alerts.test.mjs` (fixtures) | `node --test tests/alerts.test.mjs` |
| ALRT-03 | Sweep sends EXACTLY ONE email on a crossing; **running twice sends none extra** (idempotency via last_notified_at) | unit (env-injected `runAlertSweep`, `sendEmail` spy) | `tests/alerts.sweep.test.mjs` | `node --test tests/alerts.sweep.test.mjs` |
| ALRT-03 | Sweep dedupes distinct terms, detects BEFORE writing snapshots, stays in rate budget (fetchTrendingCached coalesce) | unit | `tests/alerts.sweep.test.mjs` | same |
| ALRT-04 | Double opt-in (verified_at gate) + one-click unsubscribe (unsub_token); unverified subs never fire | unit/contract + API | `tests/notifications.routes.test.mjs` | `node --test tests/notifications.routes.test.mjs` |
| ALRT-05 | Alerts UI: create term+metric+threshold+window, list active, remove/unsubscribe — rendered results match input | browser QA | `tests/alerts-panel.spec.ts` (Playwright, local dev server) | `npm run test:alerts` |

## Idempotency (headline) — explicit assertion
`runAlertSweep(fakeEnv)` is called twice on identical fixture data; the `sendEmail` spy must record exactly **1** call total. This is the ALRT-03 gate truth.

## Deploy-gated (NOT in the automated gate — owner/human steps)
- `wrangler d1 migrations apply reporadar --remote`
- Deploy with custom `main: worker.ts` (research open-question A1 — local build/`--dry-run` verify first)
- Live cron sweep with prod app-owned `GITHUB_TOKEN`

## Coverage status
All 5 requirements have a planned, locally-runnable test artifact. `sendEmail` no-ops without a key, so tests assert it was **called** (not delivery). Wave 0 (plan 03-01) installs the `node --test` runner + `tests/_localD1.mjs` helper.
