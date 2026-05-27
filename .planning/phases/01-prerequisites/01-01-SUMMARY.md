---
phase: 01-prerequisites
plan: "01"
subsystem: email
tags: [email, resend, lib, refactor]
dependency_graph:
  requires: []
  provides: [app/lib/email.ts, sendEmail, escapeHtml]
  affects: [app/api/deploy/route.ts]
tech_stack:
  added: []
  patterns: [graceful-no-op-on-missing-key, fetch-without-sdk, defense-in-depth-subject-strip]
key_files:
  created:
    - app/lib/email.ts
  modified:
    - app/api/deploy/route.ts
decisions:
  - "D-01: Resend via plain fetch (no SDK) — matches existing deploy route pattern"
  - "D-02: sendEmail() signature with to/subject/html/text?/from?/replyTo?"
  - "D-03: from defaults to RESEND_FROM || 'RepoRadar <onboarding@resend.dev>'"
  - "D-04: no-key no-op returns {ok:false,skipped:true}; exceptions return {ok:false,error}"
  - "D-05: escapeHtml extracted to email.ts, imported by deploy route"
  - "D-06: deploy route refactored to call sendEmail(), zero behavior change"
metrics:
  duration: "~5 min"
  completed: "2026-05-27"
  tasks_completed: 2
  files_changed: 2
requirements: [PRE-03]
---

# Phase 1 Plan 01: sendEmail() Resend lib + deploy-route refactor Summary

**One-liner:** Resend email lib via plain fetch with graceful no-key no-op, subject CR/LF strip, and deploy route refactored to use it with zero behavior change.

## What Was Built

### app/lib/email.ts (created)

Exports two functions used by current and future callers:

- `sendEmail(opts)` — Posts to `https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}`. Returns `{ok:true,id?}` on success; `{ok:false,skipped:true}` when key is absent (no throw, no fetch); `{ok:false,status,error}` on non-2xx; `{ok:false,error}` on network exception. Never throws. Strips CR/LF from subject before send (defense-in-depth per T-01-02). Key never logged (T-01-01).
- `escapeHtml(s)` — Escapes `&<>"'` to HTML entities (extracted verbatim from deploy route per D-05).

### app/api/deploy/route.ts (refactored)

- Added `import { sendEmail, escapeHtml } from "@/app/lib/email"` at top.
- Replaced the 20-line inline fetch/ok/catch block in `notifyContact` with 4 lines calling `sendEmail()`.
- Removed local `function escapeHtml()` (now imported).
- Preserved: RESEND_API_KEY guard log ("email notify queued for ... (RESEND_API_KEY not set)"), the full bespoke HTML body, the `"sent" | "queued"` return contract, and `runtime = "nodejs"` export.

## Verification

- `npm run build` exits 0 (confirmed).
- `npx eslint app/lib/email.ts app/api/deploy/route.ts` — no output (no errors).
- `grep "export async function sendEmail" app/lib/email.ts` — matches.
- `grep "await sendEmail" app/api/deploy/route.ts` — matches.
- `grep "function escapeHtml" app/api/deploy/route.ts` — does NOT match (local copy removed).
- No-key path: `RESEND_API_KEY` unset → `return { ok: false, skipped: true }` on line 29 — confirmed by code inspection.
- `npm run lint` (full repo) OOM'd — pre-existing environment constraint (Node.js heap limit on the full eslint scan); the two changed files pass eslint in isolation.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create app/lib/email.ts | 60b8a23 | app/lib/email.ts (created, 92 lines) |
| 2 | Refactor deploy route | 982e50b | app/api/deploy/route.ts (+8/-28) |

## Deviations from Plan

### Auto-noted: No unit test runner

The plan noted that if no unit test runner exists, set the test file aside and rely on build + smoke. Only Playwright e2e is configured (`test:smoke`). No `email.test.ts` was created. Verification is via:
1. Build (`npm run build`) — type-checks the full module graph.
2. eslint on changed files — no errors.
3. Code inspection of no-key early-return and error paths.

This is the documented fallback in the plan; not a deviation from the plan's intent.

### Auto-noted: npm run lint OOM

`npm run lint` exhausts the Node.js heap on the full project scan (pre-existing environment issue unrelated to these changes). Replaced with targeted `npx eslint app/lib/email.ts app/api/deploy/route.ts` which exits clean. This is not a new error introduced by this plan.

## Threat Surface

All T-01-01 through T-01-05 mitigations applied as specified in the plan's threat model. No new security surface introduced beyond what was already in `app/api/deploy/route.ts`.

## Known Stubs

None. `sendEmail()` is fully wired; it will deliver real email the moment `RESEND_API_KEY` is set in the environment.

## Self-Check: PASSED

- `app/lib/email.ts` exists and contains all required exports.
- `app/api/deploy/route.ts` imports from `@/app/lib/email` and does not contain local `escapeHtml`.
- Commits 60b8a23 and 982e50b confirmed in git log.
