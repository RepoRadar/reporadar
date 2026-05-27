---
phase: 02-credibility-batch-analytics
plan: "02"
subsystem: contact
tags: [contact-form, email, rate-limiting, static-page, api-route]
dependency_graph:
  requires: [02-01, app/lib/email.ts]
  provides: [/contact page, POST /api/contact]
  affects: []
tech_stack:
  added: []
  patterns: [in-memory-rate-limiter, force-static-page, client-form-with-status-machine, escapeHtml-on-untrusted-input]
key_files:
  created:
    - app/api/contact/route.ts
    - app/(site)/contact/page.tsx
    - app/(site)/_components/ContactForm.tsx
  modified: []
key_decisions:
  - "CONTACT_TO unset → 200 {queued:true} + console.warn, never 500 — graceful owner-handoff degradation (D-06)"
  - "escapeHtml applied to name/email/message before HTML body interpolation — T-02-04 HTML injection prevention"
  - "In-memory fixed-window rate-limiter: 5 req/60 s per IP via Map — per-isolate acceptable for v1 (D-06)"
  - "ContactForm status machine: idle|sending|sent|queued|error with aria-live polite status box matching FeedbackWidget pattern (D-07)"
metrics:
  duration_seconds: 175
  completed_date: "2026-05-27"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 2 Plan 02: Contact Form + API Summary

**One-liner:** Validated, rate-limited `/contact` page with inline status UX and HTML-escaped email delivery via `sendEmail()`, gracefully degrading when `CONTACT_TO` is unset.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | POST /api/contact — validated, rate-limited, emails via sendEmail() | 81244d4 | app/api/contact/route.ts |
| 2 | /contact static page + ContactForm client component | a0c89f2 | app/(site)/contact/page.tsx, app/(site)/_components/ContactForm.tsx |

## What Was Built

### Task 1: POST /api/contact (81244d4)

`app/api/contact/route.ts` — `export const runtime = "nodejs"` API route:

- **Validation:** `normalizeText()` helper (mirrored from feedback route) validates name (1–120), email (regex shape + max 200), message (1–4000); each returns a clear 400 on failure.
- **Rate limiting:** In-memory fixed-window per-IP limiter (`Map<string, {count, windowStart}>`); 5 req/60 s; IP from `x-forwarded-for` header; 429 + clear message on exceed (T-02-05).
- **Delivery:** Calls `sendEmail()` with `to: CONTACT_TO`, `replyTo: submitter_email`, HTML + plain text bodies. `escapeHtml()` applied to name/email/message before any HTML interpolation (T-02-04).
- **Graceful degradation:** `CONTACT_TO` unset → `console.warn` + `{ok:true, queued:true}` (200), never 500. Provider exception → same graceful 200/queued (D-06 / T-02-06). `RESEND_API_KEY` absent → `sendEmail()` returns `skipped:true` → treated as queued.

### Task 2: /contact page + ContactForm (a0c89f2)

`app/(site)/contact/page.tsx` — `export const dynamic = "force-static"` Server Component:
- Exports `metadata` with title/description.
- Renders heading, blurb, card-wrapped `<ContactForm />`, and a GitHub issues fallback link.
- No fetch/fs at page level — purely static shell.

`app/(site)/_components/ContactForm.tsx` — `"use client"` form component:
- Status machine: `idle | sending | sent | queued | error`.
- Client-side validates before fetch (non-empty name, email shape, non-empty message).
- On 429: surfaces rate-limit message inline. On queued/sent: clears message field and shows confirmation.
- `role="status" aria-live="polite"` status box matching FeedbackWidget pattern (D-07).
- All fields disabled during `sending` and after success to prevent double-submit.

## Verification Results

**Build:** `npm run build` exits 0. `/contact` marked `○ (Static)`, `/api/contact` marked `ƒ (Dynamic)`.

**ESLint:** `npx eslint` on all three new files — no errors.

**API behavior (live dev server):**
- Valid submit (CONTACT_TO unset) → `{"ok":true,"queued":true}` (200) — no 500
- Missing name → `{"ok":false,"error":"Name is required."}` (400)
- Bad email shape → `{"ok":false,"error":"Enter a valid email address."}` (400)
- Empty message → `{"ok":false,"error":"Message is required."}` (400)
- 6th rapid request from same IP → `{"ok":false,"error":"Too many messages, try again shortly."}` (429)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `CONTACT_TO` is unset in development — submissions queue gracefully. This is intentional: it's an owner-supplied handoff documented in 02-05's `.dev.vars.example` edit. When set, the full `sendEmail()` path executes.

## Threat Flags

All threats in the plan's `<threat_model>` were addressed:

| ID | Status | Mitigation |
|----|--------|------------|
| T-02-04 | Mitigated | `escapeHtml()` on name/email/message before HTML body interpolation |
| T-02-05 | Mitigated | Fixed-window rate limiter 5/60 s + length caps (name 120, message 4000) |
| T-02-06 | Mitigated | No PII in logs; no key exposure; 200/queued on failure, never 500 |
| T-02-07 | Accepted | reply-to is user-claimed email; ownership unverified — accepted for v1 |

No new unplanned threat surface introduced.

## Self-Check: PASSED

- [x] `app/api/contact/route.ts` — exists
- [x] `app/(site)/contact/page.tsx` — exists
- [x] `app/(site)/_components/ContactForm.tsx` — exists
- [x] Commit `81244d4` — exists in git log
- [x] Commit `a0c89f2` — exists in git log
