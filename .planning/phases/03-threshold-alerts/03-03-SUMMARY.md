---
phase: 03-threshold-alerts
plan: "03"
subsystem: notifications
tags: [d1, double-opt-in, email, tdd, security]
dependency_graph:
  requires:
    - 03-01 (db.ts: createSubscription, verifySubscription, unsubscribeByToken, listVerifiedSubsForTerm)
    - 01-xx (email.ts: sendEmail, escapeHtml)
    - 03-02 (alerts.ts: Crossing type)
  provides:
    - D1-backed subscribe/verify/unsubscribe routes (ALRT-04)
    - buildVerifyEmail + buildAlertEmail composers
    - allow-list validators (normalizeMetric/normalizeKind/normalizeThreshold/normalizeWindowDays)
  affects:
    - 03-04 (alert sweep: imports buildAlertEmail + listVerifiedSubsForTerm)
tech_stack:
  added:
    - cloudflare-env.d.ts (CloudflareEnv.DB binding type for TypeScript)
    - allowImportingTsExtensions: true in tsconfig (enables .ts extension in node --test imports)
  patterns:
    - Double opt-in: store UNVERIFIED + verify_token → email → GET /verify?token → verified_at set
    - Token-as-capability: crypto.randomUUID() CSPRNG, strict token lookup, generic responses
    - escapeHtml on every user-controlled interpolation in HTML emails (T-03-07)
    - In-memory per-IP fixed-window rate-limit 5/60s (mirrors contact/route.ts, T-03-09)
key_files:
  created:
    - app/api/notifications/verify/route.ts
    - app/api/notifications/unsubscribe/route.ts
    - cloudflare-env.d.ts
    - tests/notifications.composers.test.mjs
    - tests/notifications.routes.test.mjs
  modified:
    - app/api/notifications/subscribe/route.ts (full rewrite — removed in-memory array)
    - app/lib/notifications.ts (replaced buildDummyTrendEmail with real composers + validators)
    - tsconfig.json (allowImportingTsExtensions: true)
    - package.json (--test-concurrency=1 to prevent SQLite BUSY when D1 tests run in parallel)
decisions:
  - "allowImportingTsExtensions: true added to tsconfig so ./email.ts imports resolve in node --test without breaking Turbopack build (noEmit: true satisfies the TS requirement)"
  - "CloudflareEnv.DB typed via cloudflare-env.d.ts (declared by wrangler typegen convention) — required for Turbopack type-check to accept env.DB"
  - "package.json test script updated to --test-concurrency=1 to avoid SQLite BUSY when db.test.mjs + notifications.routes.test.mjs run simultaneously against local D1"
  - "T-03-08: verify/unsubscribe routes return 200 for both matched and unmatched tokens — no token validity oracle"
metrics:
  duration: "13 min"
  completed: "2026-05-27"
  tasks_completed: 3
  files_changed: 9
---

# Phase 3 Plan 03: D1-backed Subscribe/Verify/Unsubscribe + Real Emails Summary

**One-liner:** D1 double opt-in (UNVERIFIED + verify_token → email → GET /verify → verified_at), one-click unsub, real HTML emails with escapeHtml on all interpolations, allow-list validators, and 39 node --test passing

## What Was Built

Replaced the in-memory v1 subscribe route (ephemeral `queuedNotifications` array + `buildDummyTrendEmail` stub) with a production-quality double opt-in flow:

### Task 1: Real email composers + validators (notifications.ts)

- `buildVerifyEmail({ email, verifyUrl })` — on-brand HTML email with escaped email field and verify button link
- `buildAlertEmail({ term, crossing, unsubUrl })` — HTML email with repo card, escaped term/fullName/reason, and unsubscribe footer link (D-07)
- `normalizeMetric` / `normalizeKind`: allow-list validators returning null for unknown values (T-03-11)
- `normalizeThreshold`: rejects zero/negative/non-numbers (T-03-11)
- `normalizeWindowDays`: clamped to [1, 90] integer range (T-03-11)
- All existing exports retained: `normalizeEmail`, `normalizeSources`, `normalizeDigest`

### Task 2: D1-backed routes (subscribe + verify + unsubscribe)

- **POST /api/notifications/subscribe**: parses JSON, validates all fields via allow-list normalizers, rate-limits per IP (5/60s, T-03-09), mints `crypto.randomUUID()` tokens (T-03-06), calls `createSubscription(db, {...})`, sends verify email via `sendEmail(buildVerifyEmail(...))` — no-ops gracefully without `RESEND_API_KEY`, returns generic `{ ok: true, status: "pending_verification" }` (T-03-08)
- **GET /api/notifications/verify?token=**: calls `verifySubscription(db, token)`, returns HTML confirmation page; same 200 status for matched/unmatched (T-03-08)
- **GET /api/notifications/unsubscribe?token=**: calls `unsubscribeByToken(db, token)`, returns HTML unsub page; same 200 for matched/unmatched (T-03-08)

### Task 3: Test suite (39 total tests across 2 files)

- `notifications.composers.test.mjs` (27 tests): buildVerifyEmail/buildAlertEmail structure, XSS escape assertions for every user-controlled field, normalizeMetric/normalizeKind/normalizeThreshold/normalizeWindowDays edge cases
- `notifications.routes.test.mjs` (12 tests): ALRT-04 invariant (unverified excluded from verified queries), verify token idempotency, unsubscribe token lifecycle, UUID v4 shape, and redundant escape assertions via composers

## Security Coverage (Threat Register)

| Threat | Status |
|--------|--------|
| T-03-06 Spoofing — token guessability | crypto.randomUUID() 122-bit CSPRNG |
| T-03-07 Tampering — HTML injection in emails | escapeHtml on email, term, fullName, reason; tested with hostile inputs |
| T-03-08 Info Disclosure — enumeration via subscribe/verify/unsub | Same response body and 200 status for matched/unmatched |
| T-03-09 DoS — subscribe flood | In-memory 5/60s per-IP rate-limit (x-forwarded-for) |
| T-03-10 EoP — alerts to unverified addresses | verified_at IS NOT NULL invariant tested in db contract suite |
| T-03-11 Input Validation — metric/kind/threshold/window_days | Allow-list normalizers; all 4 reject invalid → 400 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] cloudflare-env.d.ts with CloudflareEnv.DB binding type**

- **Found during:** Task 2 — Turbopack type-check failed with "Property 'DB' does not exist on type 'CloudflareEnv'"
- **Fix:** Created `cloudflare-env.d.ts` declaring `interface CloudflareEnv { DB: D1Database; }` per the `wrangler types` convention documented in wrangler.jsonc
- **Files modified:** cloudflare-env.d.ts (new)
- **Commit:** fbe6c8a

**2. [Rule 2 - Missing] allowImportingTsExtensions in tsconfig**

- **Found during:** Task 1 GREEN — node --test couldn't resolve `./email` from notifications.ts because it lacked the `.ts` extension; adding the extension requires `allowImportingTsExtensions: true`
- **Fix:** Added `"allowImportingTsExtensions": true` to tsconfig.json (valid with `noEmit: true`; Turbopack accepts it)
- **Files modified:** tsconfig.json
- **Commit:** 5e12d24

**3. [Rule 1 - Bug] SQLite BUSY errors when running full test suite in parallel**

- **Found during:** Task 3 final check — `node --test 'tests/*.test.*'` caused SQLITE_BUSY contention between db.test.mjs and notifications.routes.test.mjs sharing the same local D1 SQLite file
- **Fix:** Added `--test-concurrency=1` to the `test` script in package.json; all 71 tests pass sequentially
- **Files modified:** package.json
- **Commit:** 775b2e7

## Known Stubs

None. All email HTML is real (not placeholder text). Composers use real escapeHtml. The `sendEmail` call no-ops without `RESEND_API_KEY` (by design per D-04 — graceful degradation, not a stub).

## Threat Flags

None. No new network endpoints or auth paths beyond the three routes defined in this plan. The routes were specified in the threat model (T-03-06 through T-03-11) and all mitigations are applied.

## Self-Check: PASSED

All created/modified files exist on disk:
- FOUND: app/lib/notifications.ts
- FOUND: app/api/notifications/subscribe/route.ts
- FOUND: app/api/notifications/verify/route.ts
- FOUND: app/api/notifications/unsubscribe/route.ts
- FOUND: tests/notifications.composers.test.mjs
- FOUND: tests/notifications.routes.test.mjs
- FOUND: cloudflare-env.d.ts

All commits present:
- FOUND: 6a24214 (RED composer tests)
- FOUND: 5e12d24 (GREEN composers + validators)
- FOUND: 2d0d651 (route contract tests)
- FOUND: fbe6c8a (D1-backed routes + cloudflare-env.d.ts)
- FOUND: 775b2e7 (Task 3 tests + concurrency fix)
