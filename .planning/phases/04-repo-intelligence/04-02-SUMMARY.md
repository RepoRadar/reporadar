---
phase: 04-repo-intelligence
plan: 02
subsystem: api
tags: [gemini, streaming, tool-loop, rate-limit, prompt-injection, intl-04]

requires:
  - phase: 04-01
    provides: "fetchRepoContext, isValidFullName, blobUrl, RepoContext type"

provides:
  - "POST /api/repo-chat: streaming Gemini 2.5 Flash chat endpoint with hybrid tool loop"
  - "app/lib/repoChatPrompt.ts: buildSystemPrompt, stripEmDashes, validateToolArgs, checkRateLimit, REPO_CHAT_TOOLS"
  - "Three passing unit test files for the pure seams (28 tests total)"

affects: [04-04, 04-06]

tech-stack:
  added: []
  patterns:
    - "Hybrid Gemini tool loop: buffer round, discard pre-tool text, enqueue final text once"
    - "Validate-before-stream: all 503/400/429/502 checks return NextResponse.json before ReadableStream opens"
    - "UNTRUSTED DATA delimiters in system prompt for prompt-injection defense (T-04-05)"
    - "Per-IP fixed-window rate limiter (20/60s) mirroring contact/route.ts"
    - "TDD RED/GREEN with node --test + node:assert/strict and .ts imports"

key-files:
  created:
    - app/lib/repoChatPrompt.ts
    - app/api/repo-chat/route.ts
    - tests/repochat.style.test.mjs
    - tests/repochat.tools.test.mjs
    - tests/repochat.ratelimit.test.mjs
  modified: []

key-decisions:
  - "Hybrid tool loop: buffer the entire round, never enqueue mid-round; discard pre-tool text when sawToolCall is true so final answer streams exactly once"
  - "role:'function' (not 'tool') for tool responses in @google/generative-ai 0.24.1"
  - "stripEmDashes uses Unicode escape /\\u2014/ so the source file contains zero literal em dashes"
  - "toolExecutor imports Octokit lazily to avoid module load in plain-Node test context"
  - "INTL-04: only err.message + coarse metadata (fullName, msgCount) in catch blocks; zero message-body logging"

patterns-established:
  - "validate-before-stream pattern: all HTTP error responses precede new ReadableStream(...)"
  - "Gemini hybrid tool loop with MAX_TOOL_ROUNDS=3 cap"

requirements-completed: [INTL-01, INTL-04]

duration: 35min
completed: 2026-05-28
---

# Phase 04, Plan 02: Chat Brain Summary

**Streaming /api/repo-chat with a Gemini 2.5 Flash hybrid tool loop, per-IP rate limiter, em-dash backstop, and INTL-04 no-logging posture.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-05-28
- **Tasks:** 3 of 3
- **Files created:** 5

## Accomplishments

- Built `app/lib/repoChatPrompt.ts`: system prompt builder (PRD §9 verbatim), em-dash backstop via `—` Unicode escape, tool arg validation with path-traversal guard, per-IP rate limiter.
- Built `app/api/repo-chat/route.ts`: streaming `runtime="nodejs"` POST handler. All validation before the ReadableStream. Hybrid Gemini tool loop (buffer round, discard pre-tool text, emit final text once). `role:"function"` for tool responses per 0.24.1 API.
- 28 unit tests across three files, all green. `tsc --noEmit` clean. Zero literal em dashes in either shipped file.

## Request/Response Contract

**`POST /api/repo-chat`**

Request body (JSON):
```json
{ "fullName": "owner/repo", "messages": [{ "role": "user", "content": "..." }] }
```

- `fullName`: must match `/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/`
- `messages`: array of `{ role: "user" | "assistant" | "model", content: string }`; capped to last 10 turns, each content capped at 2000 chars; last message must have `role: "user"`

Success response:
- `200 text/plain; charset=utf-8` streamed body (token by token)
- Headers: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`

Error responses (all JSON, returned before stream opens):
- `503 { ok: false, error: "Chat is not available right now." }` - GOOGLE_API_KEY absent
- `400 { ok: false, error: "..." }` - invalid fullName, bad messages shape, last message not user
- `429 { ok: false, error: "You're sending messages quickly. Give it a few seconds." }` - rate limit
- `502 { ok: false, error: "Could not load this repo." }` - GitHub context fetch failed

The client reads the streaming body with `response.body.getReader()` and appends chunks as they arrive.

## Task Commits

1. **Task 1: Unit test stubs (RED)** - `9b05479` (test)
2. **Task 2: repoChatPrompt.ts implementation (GREEN)** - `7c25185` (feat)
3. **Task 3: /api/repo-chat streaming route** - `5dc50b1` (feat)

## Files Created

- `app/lib/repoChatPrompt.ts` - Pure helpers: buildSystemPrompt, stripEmDashes, validateToolArgs, checkRateLimit, REPO_CHAT_TOOLS
- `app/api/repo-chat/route.ts` - Streaming POST handler with Gemini hybrid tool loop
- `tests/repochat.style.test.mjs` - Unit tests for stripEmDashes (7 tests)
- `tests/repochat.tools.test.mjs` - Unit tests for validateToolArgs (18 tests)
- `tests/repochat.ratelimit.test.mjs` - Unit tests for checkRateLimit (3 tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal em dashes in source file comments and regex**
- **Found during:** Task 2 acceptance criteria check (`grep -c '—'` returned 3)
- **Issue:** Two places had literal U+2014: the JSDoc comment and the regex pattern `/—/g`. The plan requires the source file to have zero literal em dashes so the regex correctly uses a Unicode escape.
- **Fix:** Replaced with `—` Unicode escape in the regex and rewrote the comment to avoid the character. Also a TS type cast (`as number`) in the .mjs test file was rejected by Node's ESM loader (no TypeScript in .mjs); removed the cast.
- **Files modified:** `app/lib/repoChatPrompt.ts`, `tests/repochat.tools.test.mjs`
- **Commit:** `7c25185`

**2. [Rule 2 - Missing functionality] Lazy Octokit import in toolExecutor**
- **Found during:** Task 3 - the toolExecutor runs in a streaming context and importing Octokit at module top-level would cause ERR_MODULE_NOT_FOUND in the node --test context (same pattern as dynamic imports in runAlertSweep per STATE.md)
- **Fix:** Used `await import("octokit")` inside the get_repo_file branch to avoid the issue.
- **Files modified:** `app/api/repo-chat/route.ts`
- **Commit:** `5dc50b1`

## TDD Gate Compliance

- RED gate: `test(04-02)` commit `9b05479` - test files imported from non-existent module, confirmed `ERR_MODULE_NOT_FOUND`
- GREEN gate: `feat(04-02)` commit `7c25185` - 28 tests pass, `tsc --noEmit` clean

## Known Stubs

None. Both files are fully wired: buildSystemPrompt fills real RepoContext slots, the tool executor calls real GitHub/Gemini APIs, the rate limiter uses a real in-memory map.

## Threat Flags

No new threat surface beyond the STRIDE register in the plan's `<threat_model>`. All T-04-04 through T-04-10 mitigations are implemented and verified.

## Self-Check: PASSED

- app/lib/repoChatPrompt.ts: EXISTS
- app/api/repo-chat/route.ts: EXISTS
- tests/repochat.style.test.mjs: EXISTS
- tests/repochat.tools.test.mjs: EXISTS
- tests/repochat.ratelimit.test.mjs: EXISTS
- Commit 9b05479 (RED): EXISTS
- Commit 7c25185 (GREEN): EXISTS
- Commit 5dc50b1 (route): EXISTS
- No file deletions in any task commit
