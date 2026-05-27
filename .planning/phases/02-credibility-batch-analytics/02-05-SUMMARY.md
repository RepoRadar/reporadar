---
phase: 02-credibility-batch-analytics
plan: "05"
subsystem: analytics
tags: [analytics, cloudflare, tracking, privacy]
dependency_graph:
  requires: [02-04]
  provides: [analytics-helper, cf-beacon, event-tracking]
  affects: [app/lib/analytics.ts, app/layout.tsx, app/components/RepoRadarApp.tsx, app/components/DeployForm.tsx, app/components/NotificationSignup.tsx, .dev.vars.example]
tech_stack:
  added: [next/script, cloudflare-web-analytics-beacon]
  patterns: [provider-agnostic-analytics, env-gated-beacon, label-prefix-discrimination]
key_files:
  created: [app/lib/analytics.ts]
  modified: [app/layout.tsx, app/components/RepoRadarApp.tsx, app/components/DeployForm.tsx, app/components/NotificationSignup.tsx, .dev.vars.example]
decisions:
  - "Option B centralization in runQuery — label-prefix discrimination covers all tag-pick entry points (card + header TAGS panel) without touching call sites"
  - "Track events backend is a deferred product decision — analytics.ts documents CF Zaraz / Plausible / Umami options"
  - "beacon injected via next/script with strategy=afterInteractive in layout.tsx (Server Component safe)"
  - "alert_signup payload carries source count only — no email/PII (T-02-14)"
metrics:
  duration: "7 min"
  completed: "2026-05-27T09:29:43Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 02 Plan 05: Analytics Beacon + track() Helper Summary

Provider-agnostic `track()` helper with CF Web Analytics beacon (env-gated, no PII), wired at all 4 core events via label-prefix discrimination in `runQuery`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | track() helper + CF Web Analytics beacon (gated) | db0470f | app/lib/analytics.ts, app/layout.tsx, .dev.vars.example |
| 2 | Wire track() at the 4 core events | e1b8e2a | app/components/RepoRadarApp.tsx, app/components/DeployForm.tsx, app/components/NotificationSignup.tsx |

## What Was Built

**`app/lib/analytics.ts`** — provider-agnostic `track(event, props?)` helper. In development it logs `[track] <event> <props>` to console; in production it no-ops until a backend (CF Zaraz / Plausible / Umami) is wired inside the single function. `typeof window !== "undefined"` guard makes it safe to import from any module. No PII flows through any call site.

**`app/layout.tsx`** — CF Web Analytics beacon injected via `next/script` (`strategy="afterInteractive"`), rendered ONLY when `NEXT_PUBLIC_CF_BEACON_TOKEN` is set. When unset: no script tag rendered, no token in HTML. Token is JSON-stringified into `data-cf-beacon`.

**4 wired events:**
- `search_run` — fires in `runQuery` when label starts with `"ask: "` or `"voice: "` (freeform TYPE/TALK queries)
- `tag_picked` — fires in `runQuery` when label starts with `"tag: "` — this covers BOTH card `onTagClick` AND the header TAGS panel via centralized discrimination (Option B)
- `deploy_clicked` — fires in `DeployForm.submit()` before the `/api/deploy` fetch; payload: `{ repo }`
- `alert_signup` — fires in `NotificationSignup.submit()` on successful subscribe; payload: `{ sources: number }` — count only, no email

**`.dev.vars.example`** — consolidated all Phase 2 handoffs: `CONTACT_TO`, `NEXT_PUBLIC_DONATION_URL`, `NEXT_PUBLIC_CF_BEACON_TOKEN`, plus the deferred analytics backend decision note.

## Deviations from Plan

### Auto-applied Corrections

**1. [Critical Constraint Applied] Centralized tag discrimination in runQuery (Option B)**
- **Found during:** Task 2 planning
- **Issue:** The original plan mentioned wiring `tag_picked` at `~line 766` (which is the REFRESH button) and `~line 998` (card onTagClick). The critical constraint in the execution prompt correctly identified that the header TAGS panel path (HeaderControls → TagsPanel → onPick → onRunQuery) also calls `runQuery({ topic, label: \`tag: ${topic}\` })` — so both paths already use the same `"tag: "` label prefix.
- **Fix:** Applied Option B — added discrimination logic at the top of `runQuery` using label prefix. `"tag: "` → `tag_picked`; `"ask: "` or `"voice: "` → `search_run`. No double-fire possible. No call sites needed modification beyond adding the import.
- **Files modified:** app/components/RepoRadarApp.tsx
- **Commit:** e1b8e2a

## Verification Notes

Build: `npm run build` exits 0 — all routes compile clean.

ESLint: 2 pre-existing `react-hooks/set-state-in-effect` warnings in RepoRadarApp.tsx (baseline, not introduced by this plan). No new errors.

Tag discrimination is exhaustive and mutually exclusive:
- `tag: ` prefix → only `tag_picked`
- `ask: ` / `voice: ` prefix → only `search_run`
- `trending: ` prefix (refresh, bootstrap, hermes) → no event (system actions)

Footer import/mount preserved from 02-04 (confirmed at lines 23 and 1083).

## Known Stubs

**analytics.ts production backend** — `track()` no-ops in production until a backend is wired. This is intentional per the plan (deferred product decision). The console.debug output covers all development verification. See `.dev.vars.example` NOTE block and analytics.ts comments for wiring instructions.

## Threat Flags

No new threat surface introduced beyond what is covered in the plan's threat model (T-02-14 through T-02-17).

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | app/layout.tsx | NEXT_PUBLIC_CF_BEACON_TOKEN embedded client-side — accepted per T-02-15 (public read-only CF token by design) |

## Self-Check: PASSED
