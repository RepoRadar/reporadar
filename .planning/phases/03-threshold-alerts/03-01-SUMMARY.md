---
phase: 03-threshold-alerts
plan: "01"
subsystem: data-foundation
tags: [d1, migrations, db, test-runner, parameterized-sql, tdd]
dependency_graph:
  requires: []
  provides:
    - migrations/0001_alerts_init.sql
    - app/lib/db.ts (subscriptions + snapshots data-access)
    - wrangler.jsonc DB binding
    - tests/_localD1.mjs (local D1 test helper)
    - node --test runner (npm test)
  affects:
    - wrangler.jsonc (added d1_databases block)
    - package.json (added "test" script)
tech_stack:
  added:
    - node:test (built-in, zero deps) — unit/integration test runner
    - wrangler d1 migrations — schema versioning
  patterns:
    - Parameterized D1 via .bind() — zero string interpolation
    - db.batch() for multi-row snapshot inserts
    - TDD RED/GREEN pattern for db.ts contract
key_files:
  created:
    - migrations/0001_alerts_init.sql
    - app/lib/db.ts
    - tests/_localD1.mjs
    - tests/db.test.mjs
  modified:
    - wrangler.jsonc (d1_databases binding added)
    - package.json (test script added)
decisions:
  - "node --test 'tests/*.test.*' (glob) not tests/ (directory) — node v25 errors on directory arg"
  - "import type { D1Database } from '@cloudflare/workers-types' explicit import needed for Next.js TS checker (not globally ambient in tsconfig)"
  - "writeSnapshots uses ON CONFLICT ... DO UPDATE SET stars so re-inserting same (term, full_name, captured_at) is idempotent"
  - "execLocal uses SQL-escaped single quotes for test helper ('' escaping) not .bind(); db.ts itself uses .bind()"
  - "Remote migration apply is owner-gated handoff — NOT run in this plan (D-11)"
metrics:
  duration: "7 min"
  completed_date: "2026-05-27"
  tasks_completed: 3
  files_created_or_modified: 6
---

# Phase 3 Plan 01: Data Foundation — D1 Migration + DB Binding + db.ts Summary

**One-liner:** D1 migration creates `subscriptions`+`repo_snapshots` tables; parameterized `db.ts` with all typed SQL functions; `node --test` harness + local-D1 helper; `wrangler.jsonc` binds existing `reporadar` DB.

## What Was Built

### Task 1 — node --test runner + local-D1 test helper
- Added `"test": "node --test 'tests/*.test.*'"` script to `package.json` (zero new npm deps)
- Created `tests/_localD1.mjs` exporting `applyMigrations()`, `execLocal(sql)`, `queryLocal(sql)` — all shell out to `wrangler d1 execute reporadar --local` so tests drive a real miniflare D1

### Task 2 — Migration + wrangler.jsonc binding
- Created `migrations/0001_alerts_init.sql` with both `CREATE TABLE IF NOT EXISTS subscriptions` and `CREATE TABLE IF NOT EXISTS repo_snapshots` plus 4 indexes per plan spec (D-02)
- Added `d1_databases` binding to `wrangler.jsonc` pointing to the existing `reporadar` database (`ba6ce5a3-54e5-449a-9371-178eda6de8a3`) with `migrations_dir: "migrations"`
- `main` (.open-next/worker.js) and `triggers.crons` deliberately unchanged (Plan 04 owns those)
- Migration applied locally: `wrangler d1 migrations apply reporadar --local` — 7 commands executed, status OK

### Task 3 (TDD) — app/lib/db.ts
- RED commit: `tests/db.test.mjs` with 13 tests across 4 describe blocks covering schema presence, parameterization contract, subscription lifecycle, and snapshot lifecycle
- GREEN commit: `app/lib/db.ts` with all 10 exported typed functions per plan contract

## Local D1 Verification Evidence

After applying the migration locally, both tables confirmed present:

```json
[{"results": [
  {"name": "_cf_METADATA"},
  {"name": "d1_migrations"},
  {"name": "repo_snapshots"},
  {"name": "sqlite_sequence"},
  {"name": "subscriptions"}
], "success": true}]
```

Subscriptions schema verified (all 13 columns: id, email, kind, term, metric, threshold, window_days, digest, created_at, verified_at, last_notified_at, verify_token, unsub_token). All `NOT NULL` constraints match the migration.

Single-quote term `it's-a-test` round-trips intact (SQLi guard validated via test T-02).

## Exported Functions (app/lib/db.ts)

| Function | Returns | Notes |
|----------|---------|-------|
| `createSubscription(db, sub)` | `Promise<void>` | Inserts unverified row |
| `getSubscriptionByVerifyToken(db, token)` | `Promise<SubscriptionRow\|null>` | T-03-03: no leak |
| `verifySubscription(db, token)` | `Promise<boolean>` | Sets verified_at; boolean via meta.changes |
| `unsubscribeByToken(db, token)` | `Promise<boolean>` | Deletes row; boolean via meta.changes |
| `listSubscriptionsByEmail(db, email)` | `Promise<SubscriptionRow[]>` | All, verified or not |
| `listDistinctTerms(db)` | `Promise<{term;kind}[]>` | WHERE verified_at IS NOT NULL |
| `listVerifiedSubsForTerm(db, term)` | `Promise<SubscriptionRow[]>` | WHERE verified_at IS NOT NULL |
| `setLastNotified(db, id, isoTime)` | `Promise<void>` | Crossing-dedupe update |
| `getLatestSnapshot(db, term)` | `Promise<Map<string,number>>` | MAX(captured_at) group |
| `writeSnapshots(db, term, repos, capturedAt)` | `Promise<void>` | db.batch() multi-row |

`writeSnapshots` authoritative 4-arg signature confirmed: `(db, term, repos: {fullName;stars}[], capturedAt: string)` — Plan 03-04 depends on this.

## Test Results

```
13 tests, 4 suites, 13 pass, 0 fail
Duration: ~24s (miniflare D1 + wrangler subprocess overhead)
```

## Gates

- `npm test` — 13/13 pass
- `npm run build` — compiled successfully, TypeScript clean
- `npx eslint app/lib/db.ts tests/db.test.mjs tests/_localD1.mjs` — 0 errors, 0 warnings

## TDD Gate Compliance

| Gate | Commit |
|------|--------|
| RED (test) | e82d044 |
| GREEN (feat) | 726b56c |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjusted npm test script glob pattern**
- **Found during:** Task 1 verification
- **Issue:** `node --test tests/` (directory arg) fails on Node v25 with "Cannot find module" — the test runner requires a glob or explicit file path
- **Fix:** Changed script to `node --test 'tests/*.test.*'` which works correctly
- **Files modified:** `package.json`
- **Commit:** `4fd6522`

**2. [Rule 1 - Bug] Added explicit D1Database type import**
- **Found during:** Task 3 build verification
- **Issue:** `D1Database` is not globally ambient in the main Next.js tsconfig (only auto-ambient in wrangler-bundled workers); TS checker errored: "Cannot find name 'D1Database'"
- **Fix:** Added `import type { D1Database } from "@cloudflare/workers-types";` to `app/lib/db.ts`
- **Files modified:** `app/lib/db.ts`
- **Commit:** `726b56c`

## Human Handoff (Deploy-Gated)

Per CONTEXT D-11, the following step MUST be performed by the owner before Phase 3 goes live:

```bash
# Apply migration to the REMOTE production D1 database
wrangler d1 migrations apply reporadar --remote
```

This is intentionally NOT done here. The executor verified everything locally only. Remote migration applies to the shared `reporadar` production DB — owner decision required.

## Known Stubs

None — `db.ts` contains only typed data-access functions with no stub values. No hardcoded empty returns or placeholder text.

## Threat Flags

No new network endpoints, auth paths, or external-facing surfaces introduced in this plan. All security mitigations applied:

| Threat | Mitigation | Evidence |
|--------|-----------|----------|
| T-03-01 (SQLi) | All values via `.bind()`, zero interpolation | `grep -nE "prepare\(\s*[\`\"'][^\`\"']*\$\{" app/lib/db.ts` returns empty |
| T-03-02 (shared DB) | Additive migration only; `deploys` table untouched | Verified via `SELECT name FROM sqlite_master` |
| T-03-03 (token leak) | verifySubscription/unsubscribeByToken return boolean | Callers can respond generically |

## Self-Check

### Created files exist:
- migrations/0001_alerts_init.sql — FOUND
- app/lib/db.ts — FOUND
- tests/_localD1.mjs — FOUND
- tests/db.test.mjs — FOUND

### Commits exist:
- 4fd6522 — chore(03-01): add node --test runner + local-D1 test helper
- 4d67af8 — feat(03-01): D1 migration + bind reporadar DB in wrangler.jsonc
- e82d044 — test(03-01): add failing db.test.mjs — schema + parameterization contract
- 726b56c — feat(03-01): implement app/lib/db.ts — parameterized D1 data-access

## Self-Check: PASSED
