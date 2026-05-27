---
phase: 03-threshold-alerts
plan: "02"
subsystem: alerts
tags: [tdd, pure-function, crossing-detection, alerts, typescript]
dependency_graph:
  requires:
    - "03-01 (SubscriptionRow type, db.ts)"
  provides:
    - "app/lib/alerts.ts: pure detectCrossings + Crossing type"
  affects:
    - "03-03 (email builder imports Crossing type)"
    - "03-04 (sweep orchestrator calls detectCrossings)"
tech_stack:
  added: []
  patterns:
    - "Pure function pattern — zero I/O, fully fixture-testable"
    - "Pick<SubscriptionRow> sub parameter — loose coupling to DB types"
    - "Map<string, number> priorSnapshot — mirrors getLatestSnapshot return"
    - "TDD: RED commit then GREEN commit"
key_files:
  created:
    - app/lib/alerts.ts
    - tests/alerts.detectCrossings.test.mjs
  modified: []
decisions:
  - "void (sub.metric as never) for exhaustive switch default — satisfies TypeScript and eslint"
  - "Math.max(1, window_days) to guard velocity against window_days=0 without special-casing the caller"
  - "import type from db.ts — types-only import keeps alerts.ts free of runtime DB dependency"
  - "formatStars() using toLocaleString('en-US') for human-readable threshold in reason string"
metrics:
  duration_minutes: 3
  completed_date: "2026-05-27"
  tasks_completed: 2
  files_created: 2
---

# Phase 3 Plan 02: detectCrossings Pure Module Summary

**One-liner:** Pure `detectCrossings(sub, latestRepos, priorSnapshot)` implementing all three alert metrics (stars_abs / stars_pct / velocity) with divide-by-zero/no-baseline guards, exported `Crossing` type, and 19 passing fixture tests (TDD RED → GREEN).

## What Was Built

### `app/lib/alerts.ts`

The pure heart of the alert engine. Takes a subscription config, the current repo list, and a prior snapshot Map; returns `Crossing[]` with no side effects.

**Exported types:**
- `Crossing` — `{ fullName, stars, metric, value, reason }` consumed by Plans 03-03 and 03-04

**Exported function:**
- `detectCrossings(sub, latestRepos, priorSnapshot)` — synchronous, returns Crossing[]

**Metrics implemented:**
- `stars_abs` — `repo.stars >= sub.threshold`. value = current stars.
- `stars_pct` — `((now - prior) / prior) * 100 >= sub.threshold`. Skips repos with no prior baseline or prior ≤ 0 (T-03-04 divide-by-zero + false-fire guard). value = growth %.
- `velocity` — `(now - prior) / max(1, window_days) >= sub.threshold`. Skips repos with no prior baseline. Uses `Math.max(1, window_days)` to guard against zero window. value = stars/day.

**reason strings** are plain text (no HTML) — escaping is the email layer's job (T-03-05).

### `tests/alerts.detectCrossings.test.mjs`

19 fixture tests using `node:test` + `node:assert/strict`. No D1, no network.

| Suite | Tests |
|-------|-------|
| stars_abs | above, exactly-at, below, multi-repo |
| stars_pct | ≥ threshold, exactly-at, below, no-prior (no false fire), prior=0 guard, multi-repo |
| velocity | ≥ threshold, exactly-at, below, no-prior, window_days=0 guard, multi-repo |
| purity | sync return, empty input, no mutation |

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | 4530342 | test(03-02): add failing detectCrossings fixture tests |
| GREEN (feat) | c5dd320 | feat(03-02): implement pure detectCrossings |
| REFACTOR | — | Not needed — implementation was clean on first pass |

## Verification Performed

- `node --test tests/alerts.detectCrossings.test.mjs` — 19 pass, 0 fail
- `grep -n "fetch\|import.*db\|prepare\|Date\.now"` on alerts.ts — only comment lines (purity confirmed)
- `npx eslint app/lib/alerts.ts tests/alerts.detectCrossings.test.mjs` — 0 errors, 0 warnings
- `npm run build` — compiled successfully

## Deviations from Plan

None — plan executed exactly as written. The void-cast exhaustiveness pattern is a micro-style choice within the default branch, not a behavioral deviation.

## Known Stubs

None. This module is fully implemented. All metrics return real computed values.

## Threat Flags

None. `detectCrossings` touches no I/O, DB, network, or trust boundary. All threat mitigations (T-03-04, T-03-05) are implemented as specified.

## Self-Check: PASSED

- `app/lib/alerts.ts` — FOUND
- `tests/alerts.detectCrossings.test.mjs` — FOUND
- RED commit `4530342` — FOUND
- GREEN commit `c5dd320` — FOUND
- 19/19 tests passing — CONFIRMED
- build green — CONFIRMED
- eslint clean — CONFIRMED
