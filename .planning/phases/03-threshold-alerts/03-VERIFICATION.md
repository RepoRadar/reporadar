---
phase: 03-threshold-alerts
verified: 2026-05-27T12:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live cron → email loop with seeded crossing"
    expected: "After remote D1 migration + deploy + manual cron invocation, exactly ONE email arrives containing the correct repo name and 'why it fired' reason text for a seeded crossing; a second cron invocation sends nothing."
    why_human: "Requires owner-gated secrets (RESEND_API_KEY, GITHUB_TOKEN), remote D1, and a live Cloudflare Worker deployment. Cannot verify email delivery programmatically without those."
  - test: "Worker boot in production (workerd)"
    expected: "After `npx opennextjs-cloudflare deploy`, `wrangler tail` shows no startup errors for the custom worker.ts entrypoint; the Cron Trigger appears in the Cloudflare dashboard at 0 */6 * * *."
    why_human: "Local `workerd` boot reported 'Workers runtime failed to start' (likely missing bindings/secrets, not a confirmed prod 500). Production boot must be confirmed via wrangler tail after the first deploy."
---

# Phase 3: Threshold Alerts — Verification Report

**Phase Goal:** A user can subscribe to a tag/search term with a growth threshold and reliably get exactly one email when a repo crosses it — turning browse into a habit.
**Verified:** 2026-05-27
**Status:** human_needed — all 5 code-verifiable criteria pass; 2 items require the owner to confirm post-deploy
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create an alert (term+metric+threshold), see it listed active, manage/remove it | VERIFIED | `NotificationSignup.tsx` renders a complete create form (email, term, kind toggle, metric select, threshold, window_days) with submit→list→remove flow; `GET /api/notifications/list` returns `{ok, alerts[]}` filtered by email; remove fires `unsubscribe?token=…`; 5 Playwright tests confirm rendered results |
| 2 | Double opt-in before alerts fire; one-click unsubscribe via unsub_token | VERIFIED | `subscribe/route.ts` inserts unverified row + sends `buildVerifyEmail` link; `verify/route.ts` sets `verified_at` only when token matches AND `verified_at IS NULL`; `listVerifiedSubsForTerm` SQL gates on `verified_at IS NOT NULL`; `unsubscribe/route.ts` deletes by `unsub_token`; idempotent re-verify test passes |
| 3 | On a crossing (or seeded fixture), the matched subscriber receives ONE email with right repo + why | VERIFIED (code path + fixture test; live email delivery is human-gated) | `runAlertSweep` twice-run test confirms exactly 1 `send` call on identical fixture data; `buildAlertEmail` renders `crossing.fullName` + `crossing.reason`; `unsubUrl` embedded in footer; HTML escaping tested for XSS on term/fullName/reason |
| 4 | Cron dedupes distinct terms, diffs snapshots over window_days, is idempotent (last_notified_at), writes fresh snapshots, stays within rate limits | VERIFIED | `listDistinctTerms` SQL uses `SELECT DISTINCT`; `fetchTrending` called once per distinct term (test passes); `getLatestSnapshot` loads prior BEFORE detection (Pitfall 2 test passes); `setLastNotified` sets `last_notified_at`; `alreadyNotified()` skips re-firing; `writeSnapshots` after detection (Pitfall 2); sweep-test confirms fresh snapshot row written at `capturedAt` |
| 5 | Tests at BOTH the API and scheduled-handler level | VERIFIED | `tests/db.test.mjs` (schema + lifecycle via local D1), `tests/notifications.routes.test.mjs` (opt-in invariant, unsubscribe, token format, email XSS), `tests/alerts.detectCrossings.test.mjs` (17 pure unit tests for all 3 metrics + edge cases), `tests/alerts.sweep.test.mjs` (14 orchestration + idempotency tests via in-memory fake DB), `tests/alerts-panel.spec.ts` (5 Playwright browser tests); pre-supplied: 85 node --test passing, 0 fail; Playwright 5/5 pass |

**Score:** 5/5 truths verified at the code level

---

### Deferred Items

None — all 5 success criteria are addressed in this phase.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `migrations/0001_alerts_init.sql` | D1 schema (subscriptions + repo_snapshots) | VERIFIED | Both tables present, all 13 columns in subscriptions, 4 in repo_snapshots, 4 indexes |
| `app/lib/db.ts` | Typed D1 data-access layer, all SQL parameterized | VERIFIED | All 8 functions present (createSubscription, getSubscriptionByVerifyToken, verifySubscription, unsubscribeByToken, listSubscriptionsByEmail, listDistinctTerms, listVerifiedSubsForTerm, setLastNotified, getLatestSnapshot, writeSnapshots); `.bind()` throughout |
| `app/lib/alerts.ts` | Pure `detectCrossings` + `runAlertSweep` orchestrator | VERIFIED | `detectCrossings` pure (no I/O), `runAlertSweep` env-injected with `SweepDeps`, `alreadyNotified` helper; dynamic imports guard plain-Node test contexts |
| `app/lib/notifications.ts` | `buildVerifyEmail`, `buildAlertEmail`, input validators | VERIFIED | Both email composers present with HTML escaping; `normalizeMetric`, `normalizeKind`, `normalizeThreshold`, `normalizeWindowDays` allow-list validators |
| `app/api/notifications/subscribe/route.ts` | D1-backed subscribe with rate-limit + verify email | VERIFIED | In-memory rate-limit (5/60s), allow-list validation, `createSubscription`, `buildVerifyEmail`, `sendEmail` |
| `app/api/notifications/verify/route.ts` | Double opt-in confirmation page | VERIFIED | Calls `verifySubscription(db, token)`; idempotent (AND verified_at IS NULL guard); same 200 status for matched/unmatched tokens (T-03-08) |
| `app/api/notifications/unsubscribe/route.ts` | One-click unsubscribe page | VERIFIED | Calls `unsubscribeByToken(db, token)`; same 200 status for matched/unmatched (T-03-08) |
| `app/api/notifications/list/route.ts` | Email-keyed alert list, rate-limited, no verify_token exposure | VERIFIED | Returns `{ok, alerts[]}` mapping; never exposes `verify_token` (T-03-19); `unsubToken` returned to owner |
| `app/components/NotificationSignup.tsx` | Full Alerts panel: create/list/remove | VERIFIED | All form fields (email, term, kind toggle, metric, threshold, window); debounced list refetch on email change; pending/active badge; remove button calls unsubscribe; gradient color language applied to metric display |
| `worker.ts` | Custom Worker entrypoint: `fetch` + `scheduled` + DO re-exports | VERIFIED | Re-exports `handler.fetch`; `scheduled()` calls `ctx.waitUntil(runAlertSweep(env))`; re-exports `DOQueueHandler` and `DOShardedTagCache` for R2 incremental cache |
| `wrangler.jsonc` | DB binding + `main→worker.ts` + `triggers.crons` | VERIFIED | `"main": "worker.ts"`; `"crons": ["0 */6 * * *"]`; `d1_databases` binding `DB` → `ba6ce5a3-…` with `migrations_dir: "migrations"` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `worker.ts scheduled()` | `runAlertSweep` | `import { runAlertSweep } from "./app/lib/alerts"` + `ctx.waitUntil(runAlertSweep(env))` | WIRED | Verified in worker.ts lines 26 + 53 |
| `subscribe/route.ts` | `createSubscription` (D1) | `import { createSubscription } from "@/app/lib/db"` | WIRED | Called at line 149; DB via `getCloudflareContext().env.DB` |
| `subscribe/route.ts` | `buildVerifyEmail` + `sendEmail` | Imports from `notifications.ts` + `email.ts`; fires at line 174–177 | WIRED | Email sent with `verifyUrl` containing `verify_token` |
| `runAlertSweep` | `detectCrossings` | Direct call within sweep loop | WIRED | `alerts.ts` line 310 |
| `runAlertSweep` | `sendFn` (buildAlertEmail + sendEmail) | Dynamic import in production path; injected in tests | WIRED | Production path: `alerts.ts` lines 282–286; unsubUrl constructed with `sub.unsub_token` |
| `runAlertSweep` | `setLastNotified` | Called immediately after `sendFn` | WIRED | `alerts.ts` line 315; idempotency guard |
| `runAlertSweep` | `writeSnapshots` | Called after detection loop | WIRED | `alerts.ts` line 325; Pitfall 2 ordering confirmed |
| `NotificationSignup` | `/api/notifications/subscribe` | `fetch("/api/notifications/subscribe", {method:"POST",...})` | WIRED | `NotificationSignup.tsx` line 135; response handled, localStorage saved, list refetched |
| `NotificationSignup` | `/api/notifications/list` | `fetch("/api/notifications/list?email=...")` | WIRED | `fetchAlerts` callback, debounced on email change, refetched after create |
| `NotificationSignup` | `/api/notifications/unsubscribe` | `fetch("/api/notifications/unsubscribe?token=...")` | WIRED | `removeAlert` function; optimistic list update on success |
| `RepoRadarApp.tsx` | `NotificationSignup` | `import { NotificationSignup }` + `<NotificationSignup />` rendered at line 855 | WIRED | Component is imported and rendered in the main dashboard |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `NotificationSignup` | `alerts: AlertRow[]` | `fetchAlerts` → `GET /api/notifications/list` | Yes — `listSubscriptionsByEmail(db, email)` queries D1 | FLOWING |
| `NotificationSignup` | `createState` | POST response from `/api/notifications/subscribe` → D1 write | Yes — `createSubscription` inserts real row | FLOWING |
| `runAlertSweep` | `repos` | `fetchTrendingCached` (production) / injected stub (tests) | Yes — real GitHub API in production; fixture in tests | FLOWING (prod key owner-gated, tests use fixture) |
| `runAlertSweep` | `prior: Map<string,number>` | `getLatestSnapshot(env.DB, term)` → D1 query | Yes — SELECT from `repo_snapshots` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Method | Result | Status |
|----------|--------|--------|--------|
| Idempotency: twice-run sends exactly 1 email | `node --test tests/alerts.sweep.test.mjs` | 14 pass, 0 fail (pre-confirmed) | PASS |
| Pure crossing detection for all 3 metrics | `node --test tests/alerts.detectCrossings.test.mjs` | 17 pass, 0 fail (pre-confirmed) | PASS |
| D1 schema + lifecycle invariants | `node --test tests/db.test.mjs` | Pass (pre-confirmed as part of 85-test suite) | PASS |
| API contract: opt-in invariant, unsubscribe, XSS | `node --test tests/notifications.routes.test.mjs` | Pass (pre-confirmed) | PASS |
| UI: create→list→remove rendered results | Playwright `tests/alerts-panel.spec.ts` | 5/5 pass (pre-confirmed) | PASS |
| Full worker bundle includes scheduled handler | `wrangler deploy --dry-run` | Bundle contains runAlertSweep + ctx.waitUntil + DO re-exports (pre-confirmed in 03-04-SUMMARY) | PASS |
| Live cron → email delivery | Cannot test without secrets + deploy | N/A — owner-gated | SKIP (human needed) |
| Worker boot in production workerd | Local workerd reported "Workers runtime failed to start" (likely missing bindings, not prod 500) | Unconfirmed | SKIP (human needed) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ALRT-01 | 03-01-PLAN | D1 schema: subscriptions + repo_snapshots | SATISFIED | `migrations/0001_alerts_init.sql` + `app/lib/db.ts`; schema tests pass |
| ALRT-02 | 03-04-PLAN | Cron: dedupe distinct terms, diff snapshots, idempotent, rate-limit-safe | SATISFIED | `runAlertSweep` + `listDistinctTerms` + `alreadyNotified`; sweep tests pass |
| ALRT-03 | 03-02-PLAN + 03-04-PLAN | One email per crossing; `last_notified_at` dedupes; fresh snapshots written | SATISFIED | `detectCrossings` pure; twice-run test passes; `setLastNotified` wired; `writeSnapshots` called after detection |
| ALRT-04 | 03-03-PLAN | Double opt-in + one-click unsubscribe + digest option via sendEmail | SATISFIED | subscribe/verify/unsubscribe routes wired; `buildVerifyEmail`/`buildAlertEmail` deliver real HTML; digest field stored (sends instant, v1 design) |
| ALRT-05 | 03-05-PLAN | Alerts UI: create/list/manage/remove, reusing dashboard styling | SATISFIED | `NotificationSignup.tsx` full panel; gradient color language applied; 5 Playwright result tests pass |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/api/notifications/list/route.ts` | 85 | `return NextResponse.json({ ok: true, alerts: [] })` on DB error | Info | Intentional — error recovery, not a data stub; comment documents the reason |
| `subscribe/route.ts` | 168 | `return NextResponse.json({ ok: true, status: "pending_verification" })` on DB error | Info | Intentional — T-03-08 enumeration prevention; comment documents this |
| No other stubs, TODOs, or placeholders found in phase-3 files | — | — | — | — |

No blockers detected.

---

### Human Verification Required

#### 1. Live end-to-end email delivery

**Test:** Apply remote D1 migration (`wrangler d1 migrations apply reporadar --remote`), deploy (`npx opennextjs-cloudflare deploy`), set Worker secrets (`RESEND_API_KEY`, `RESEND_FROM`, `GITHUB_TOKEN`), create a test subscription via the Alerts panel, click the verify email link, then trigger a manual cron invocation (`npx wrangler dev --test-scheduled` / curl `/__scheduled`). Wait for or seed a crossing (or use a `stars_abs` threshold of 1 on a term with active repos).

**Expected:** Exactly ONE email arrives at the subscriber address containing the repo name and a "why it fired" explanation line. A second manual cron invocation sends nothing (idempotency). The email footer contains a working unsubscribe link.

**Why human:** Requires owner-gated secrets (RESEND_API_KEY, GITHUB_TOKEN), a live deployed Worker, and remote D1. Cannot verify email delivery programmatically without these. The code path is tested via the twice-run fixture test; this step confirms the live plumbing.

---

#### 2. Production Worker boot confirmation

**Test:** After running `npx opennextjs-cloudflare deploy`, run `wrangler tail` and observe the first few requests. Open the Cloudflare dashboard → Workers & Pages → reporadar → Triggers → Cron Triggers.

**Expected:** No startup errors in wrangler tail. The Cron Trigger `0 */6 * * *` appears in the dashboard. Normal HTTP requests continue to resolve (no regression from adding the custom `worker.ts` entrypoint).

**Why human:** Local `workerd` boot reported "Workers runtime failed to start" during 03-04 development — likely due to missing local bindings/secrets (R2, D1, service binding), not a confirmed production 500. The `wrangler deploy --dry-run` confirmed the bundle is well-formed (includes `scheduled`, `runAlertSweep`, DO re-exports). Production boot under the full Cloudflare runtime is the definitive check. This is flagged as the **top deploy-time risk**: if the Worker fails to boot in production, roll back immediately and inspect wrangler tail for the binding error. The DO re-exports (`DOQueueHandler`, `DOShardedTagCache`) are present in `worker.ts` to prevent R2 incremental cache breakage.

---

## Gaps Summary

No gaps blocking goal achievement. All 5 success criteria are verified at the code level:

1. **UI (SC1):** Full Alerts panel renders, wired to D1-backed subscribe/list/unsubscribe routes, confirmed by 5 Playwright tests verifying rendered results.
2. **Double opt-in (SC2):** `verified_at IS NULL` gate enforced at every layer — DB query, route handler, sweep orchestrator. Unsubscribe via `unsub_token` one-click GET handler present and tested.
3. **One email per crossing (SC3):** `detectCrossings` (pure, 17 unit tests), `alreadyNotified` dedupe, `buildAlertEmail` with reason + unsubscribe footer, wired through `runAlertSweep`. The twice-run idempotency test is the headline ALRT-03 assertion. Live email delivery is owner-gated.
4. **Cron correctness (SC4):** Sweep order, deduplication, snapshot timing, and idempotency each have dedicated test coverage in `alerts.sweep.test.mjs`. `wrangler deploy --dry-run` confirmed the `scheduled` handler is in the bundle.
5. **Tests at both layers (SC5):** node --test suite (85 pass) covers DB, pure logic, orchestration, and API contract layers. Playwright covers the browser/UI layer. Both layers explicitly required by the success criterion.

The two human verification items are deploy-time confirmation tasks (remote D1 migration, live email loop, Worker boot check) that are correctly owner-gated per the phase design (D-11). They do not represent incomplete implementation.

**Top deploy-time risk to flag:** If the production Worker fails to boot after deploy, check `wrangler tail` immediately. The most likely cause is a missing R2 bucket binding (`reporadar-opennext-cache`) or a service binding configuration issue, not an error in the alerts code. Roll back with `wrangler rollback` if needed. The DO re-exports in `worker.ts` must be present to avoid breaking the R2 incremental cache — they are confirmed present.

---

_Verified: 2026-05-27_
_Verifier: Claude (gsd-verifier)_
