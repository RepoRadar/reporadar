---
phase: 01-prerequisites
plan: "02"
subsystem: github-cache
tags: [cache, rate-limiting, github, env-contract]
dependency_graph:
  requires: []
  provides: [fetchTrendingCached, env-contract]
  affects: [app/api/repos/route.ts, app/lib/trendingCache.ts]
tech_stack:
  added: []
  patterns: [TTL-map-cache, in-flight-coalescing, env-template]
key_files:
  created:
    - app/lib/trendingCache.ts
    - .dev.vars.example
  modified:
    - app/api/repos/route.ts
decisions:
  - "D-07: trendingCache.ts is a separate module (not added to github.ts) — keeps concerns isolated and reusable by cron"
  - "D-08: Cache key = topic|query|since|page|perPage with lowercased topic"
  - "D-09: In-flight Map<string,Promise<Repo[]>> coalesces concurrent identical calls to ONE upstream GitHub request"
  - "D-10: Only non-empty results cached — transient rate-limited [] does not persist"
  - "D-11: repos route local Map+TTL_MS removed; SWR headers and 4s translation race preserved exactly"
  - "D-12/D-13: .dev.vars.example committed with GITHUB_TOKEN human-handoff note; executor did not mint the token"
  - "Bounded growth cap 500 entries with LRU-style eviction added as threat-model guard"
metrics:
  duration_min: 2
  completed_date: "2026-05-27"
  tasks_completed: 2
  files_modified: 3
---

# Phase 01 Plan 02: fetchTrendingCached Cache+Coalesce Wrapper Summary

**One-liner:** TTL Map + in-flight coalescing wrapper over fetchTrending, repos route refactored to use it, env contract template committed with GitHub token human-handoff note.

## What Was Built

### Task 1 — app/lib/trendingCache.ts

New module exporting `fetchTrendingCached(params)` that wraps the existing `fetchTrending` without changing its signature, 5-tier search logic, or AbortSignal fail-fast behavior.

Key properties:
- Module-level `Map<string, {at, data}>` TTL cache (5 min, matching previous repos-route TTL)
- Module-level `Map<string, Promise<Repo[]>>` for in-flight coalescing — N concurrent calls with identical keys share ONE upstream GitHub call
- Cache key: `topic|query|since|page|perPage` with lowercased topic normalization (so `Rust` and `rust` share an entry)
- Only non-empty results cached — an empty `[]` from a rate-limited/aborted tier does not stick for the full TTL
- Bounded to 500 entries with oldest-entry eviction guard (threat model: unbounded growth)

### Task 2 — app/api/repos/route.ts refactor + .dev.vars.example

**repos route:** Replaced local `const cache = new Map(...)` and `const TTL_MS = 5 * 60 * 1000` with `import { fetchTrendingCached }`. The `fetchTrending` import was removed (only `fetchRepo` remains from github.ts). All other behavior preserved exactly:
- `s-maxage=300, stale-while-revalidate=3600` Cache-Control header on success response
- 4-second bounded `Promise.race` translation guard
- `enrich` Promise.all block (applied after the base pool is returned from cache, keeping the wrapper reusable for the cron which never enriches)
- `export const runtime = "nodejs"`

**.dev.vars.example:** Committed template listing `GITHUB_TOKEN=`, `RESEND_API_KEY=`, `RESEND_FROM=`, `GOOGLE_API_KEY=`, `ELEVENLABS_API_KEY=`, `NEXTJS_ENV=` with inline comments. Includes the GITHUB_TOKEN human-handoff note: owner mints fine-scoped (public-repo read) token and sets prod via `wrangler secret put GITHUB_TOKEN`. The executor did not mint or rotate this token (D-12).

## Verification

- `npm run build` exits 0 (both tasks)
- `npx eslint app/lib/trendingCache.ts app/api/repos/route.ts` — no output, no new errors
- RESULTS check (AGENTS.md requirement — verify results not mechanics):
  - Default trending: returned `codecrafters-io/build-your-own-x`, `sindresorhus/awesome`, `freeCodeCamp/freeCodeCamp` — correct
  - `?q=Cloudflare+Workers&limit=5` → 5/5 repos relevant (cloudflare.com repos, Workers-topic repos)
  - Topic case normalization: `?topic=Rust` and `?topic=rust` returned identical results from shared cache entry

## TDD Note

The plan specified `tdd="true"` for Task 1 and asked for `app/lib/trendingCache.test.ts`. No unit test runner is configured in `package.json` (only `@playwright/test` for smoke tests). Per plan instructions, the test file was not created. Behavioral verification was performed via the dev server + real HTTP requests instead. A future plan can add Vitest if unit coverage of the cache logic is desired.

## Deviations from Plan

### Auto-added: bounded growth eviction guard

**1. [Rule 2 - Missing critical functionality] Added CACHE_MAX_ENTRIES cap with LRU-style eviction**
- **Found during:** Task 1 implementation review
- **Issue:** Plan's threat model noted "cache map must be bounded against unbounded growth" but the plan's code snippet did not include eviction logic
- **Fix:** Added `const CACHE_MAX_ENTRIES = 500` constant and oldest-entry deletion when the cap is reached
- **Files modified:** app/lib/trendingCache.ts
- **Commit:** 997068e

No other deviations — plan executed as written.

## Known Stubs

None. Both created files are fully wired: `fetchTrendingCached` calls real `fetchTrending`; the repos route calls the real wrapper; `.dev.vars.example` is a template (intentional empty values — users fill them in locally).

## Threat Flags

None. No new network endpoints, auth paths, or trust boundary changes introduced. The cache wrapper is internal module-to-module; the repos route surface is unchanged.

## Self-Check: PASSED

Files exist:
- app/lib/trendingCache.ts — FOUND
- app/api/repos/route.ts — FOUND (modified)
- .dev.vars.example — FOUND

Commits:
- 997068e (Task 1 — trendingCache.ts)
- a2d68cf (Task 2 — repos route refactor + .dev.vars.example)
