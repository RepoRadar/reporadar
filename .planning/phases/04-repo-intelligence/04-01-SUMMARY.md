---
phase: 04-repo-intelligence
plan: 01
subsystem: api
tags: [octokit, github-api, scoring, typescript, node-test, tdd]

requires:
  - phase: 03-threshold-alerts
    provides: scoring.ts, types.ts, github.ts patterns used by repoContext.ts

provides:
  - "app/lib/repoContext.ts: fetchRepoContext(fullName) returning README body, capped file tree, 10 RepoRadar dimensions, overall score, and link helpers"
  - "RepoContext type (contract for 04-02 and 04-03)"
  - "Pure helpers: trimReadme, capTree, isValidFullName, blobUrl, treeUrl"

affects: [04-02-repo-chat-endpoint, 04-03-chat-page]

tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN: test stub committed before implementation"
    - "Private octokit singleton duplicated in repoContext.ts (not imported from github.ts, which does not export it)"
    - "repos.get first for default_branch, then getReadme + git.getTree in parallel via Promise.allSettled"
    - "AbortSignal.timeout(6000) on git.getTree to degrade cleanly for giant monorepos"

key-files:
  created:
    - app/lib/repoContext.ts
    - tests/repochat.context.test.mjs
  modified:
    - app/lib/scoring.ts (import paths changed from ./types to ./types.ts for node --test compatibility)

key-decisions:
  - "Duplicate the octokit singleton in repoContext.ts: github.ts does not export it, and importing a private from a sibling module breaks encapsulation"
  - "repos.get called first (serial) to read default_branch, then getReadme + git.getTree in parallel: avoids the Promise.allSettled workaround of double-fetching repos.get"
  - "AbortSignal.timeout(6000) passed via request.signal on git.getTree: degrades tree to [] on timeout rather than failing the whole context fetch (T-04-02)"
  - "scoring.ts import paths updated to use .ts extensions: pre-existing extensionless imports broke node --test transitive resolution; the .ts extension convention is already standard across alerts.ts, notifications.ts, and the new repoContext.ts"
  - "DIMENSION_ORDER re-exported from repoContext.ts: downstream prompt builders need the canonical order alongside RepoContext without a second import"

patterns-established:
  - "repoContext pattern: serial meta fetch then parallel content fetches with per-fetch error tolerance"
  - "Pure helper seams extracted from async functions so node --test can import them without a running Worker"

requirements-completed: [INTL-01]

duration: 4min
completed: 2026-05-28
---

# Phase 04 Plan 01: Repo context fetch library

**Server-side grounding bundle for the repo chat: README body (capped at 12k chars), recursive file tree (capped at 200 paths, dirs first), all 10 RepoRadar dimensions via scoreRepo, and GitHub blob/tree link helpers.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-28T08:48:22Z
- **Completed:** 2026-05-28T08:51:43Z
- **Tasks:** 2 of 2
- **Files modified:** 3

## Accomplishments

- Created `app/lib/repoContext.ts` (225 lines) exporting `fetchRepoContext`, `RepoContext` type, and five pure helpers.
- Created `tests/repochat.context.test.mjs` with 20 unit tests covering all pure seams; all pass.
- Updated `scoring.ts` import paths from `./types` to `./types.ts` (needed for `node --test` transitive module resolution).

## RepoContext type shape

```typescript
export type RepoContext = {
  fullName: string;
  owner: string;
  repo: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  createdAt: string | undefined;
  pushedAt: string;
  homepage: string | null;
  topics: string[];
  readme: { text: string; truncated: boolean };
  treePaths: string[];
  treePathsTruncated: boolean;
  dimensions: Dimensions;      // all 10, each 0..100
  overall: number;             // 0..1
  htmlUrl: string;
};
```

## Exported helper signatures

```typescript
export function isValidFullName(fullName: string): boolean
export function trimReadme(raw: string): { text: string; truncated: boolean }
export function capTree(items: { path: string; type: string }[]): { paths: string[]; truncated: boolean }
export function blobUrl(fullName: string, path: string): string
export function treeUrl(fullName: string, path: string): string
export async function fetchRepoContext(fullName: string): Promise<RepoContext>
export type { RepoContext }
export { DIMENSION_ORDER }
```

## GitHub API gotchas (for 04-02 and 04-03)

- `git.getTree` requires `recursive: "1"` as a **string**, not a boolean. Passing `true` makes GitHub silently return only top-level entries.
- `repos.getReadme` must include `mediaType: { format: "raw" }` to get the Markdown string. Without it the response is base64-encoded JSON and the data field is an object, not a string.
- `AbortSignal.timeout()` is passed via the octokit `request.signal` option, not a top-level parameter.
- `git.getTree` response has a `truncated: boolean` field (true when GitHub's own 100k-entry or 7 MB limit is hit). Combine with the `capTree` truncation flag: `treePathsTruncated = apiTruncated || capResult.truncated`.
- The octokit singleton must NOT be imported from `github.ts` (it is a private, non-exported symbol). Duplicate the singleton in any new lib file that needs it.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] scoring.ts used extensionless imports that broke node --test**

- **Found during:** Task 2 (GREEN)
- **Issue:** `scoring.ts` imported `"./types"` (no `.ts` extension). Node's ESM resolver treats `.ts` as an unknown extension and throws `ERR_MODULE_NOT_FOUND` when resolving transitively from `repoContext.ts` under `node --test`. `notifications.ts` and `alerts.ts` (built later) already used `.ts` extensions.
- **Fix:** Changed the two `from "./types"` imports in `scoring.ts` to `from "./types.ts"`. Zero behavior change; `tsc --noEmit` and all existing tests remain green.
- **Files modified:** `app/lib/scoring.ts`
- **Commit:** included in `feat(04-01)` task 2 commit

## Known Stubs

None. `fetchRepoContext` makes real GitHub API calls. The pure helpers are fully implemented. No placeholders or hardcoded empty values in the exported surface.

## Threat Flags

No new threat surface beyond what the plan's threat model already covers. `fetchRepoContext` does not expose any new network endpoints; it is a server-side library function.

## Self-Check: PASSED

- [x] `app/lib/repoContext.ts` exists
- [x] `tests/repochat.context.test.mjs` exists
- [x] Commit `180d934` (RED test stub) confirmed in git log
- [x] Commit `0d68afa` (GREEN implementation) confirmed in git log
- [x] `node --test tests/repochat.context.test.mjs` exits 0 (20 pass, 0 fail)
- [x] `npx tsc --noEmit` exits 0
- [x] `grep -c '—' app/lib/repoContext.ts` returns 0
