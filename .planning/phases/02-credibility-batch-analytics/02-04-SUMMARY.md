---
phase: 02-credibility-batch-analytics
plan: "04"
subsystem: ui
tags: [footer, next/link, react, css-tokens, custom-events, github-mark]

requires:
  - phase: 02-credibility-batch-analytics
    provides: "02-01 /changelog /blog /contact routes; 02-03 FeedbackWidget with reporadar:open-feedback CustomEvent hook"

provides:
  - "app/components/Footer.tsx — on-brand product footer with all nav links, donation, GitHub, hackathon"
  - "app/lib/links.ts — DONATION_URL / GITHUB_URL / HACKATHON_URL constants"
  - "<Footer /> mounted after grid in RepoRadarApp, frozen UI untouched"

affects: [02-05-env-doc, future-analytics-wiring]

tech-stack:
  added: []
  patterns:
    - "Custom-event dispatch from footer button (not a link) to open FeedbackWidget in feature mode — same OPEN_EVENT constant used in FeedbackWidget"
    - "Inline CSS-var hover handlers (onMouseEnter/Leave) keep the footer off Tailwind utility classes for token-driven theming"
    - "DONATION_URL constant with env-var override pattern: process.env.NEXT_PUBLIC_DONATION_URL || placeholder"

key-files:
  created:
    - app/lib/links.ts
    - app/components/Footer.tsx
  modified:
    - app/components/RepoRadarApp.tsx

key-decisions:
  - "Footer uses 'use client' to enable the dispatchEvent onClick — required because window is not available server-side"
  - "Suggest a feature is a <button> not an <a> tag — no URL, pure event dispatch (D-09)"
  - "Buy us a coffee hover color uses --accent (yellow) to distinguish the donation call-to-action from nav links (--primary green)"
  - "Hackathon link rendered with --secondary (blue) in footer to match header styling convention for that link"
  - "GitHub mark SVG inlined — real brand icon, allowed per AGENTS.md; no fake icon for unrelated tech"
  - "Copyright year uses new Date().getFullYear() — evaluated client-side, fine for a 'use client' component"

patterns-established:
  - "links.ts: centralised URL constants with env-var override for human-handoff config values"
  - "Footer mounts strictly after </main> before <CopilotPopup> — structural position prevents any overlap with frozen UI"

requirements-completed: [CRED-05]

duration: 2min
completed: 2026-05-27
---

# Phase 2 Plan 04: Footer Summary

**On-brand product footer with Changelog/Blog/Contact nav, Suggest-a-feature event dispatch, Buy-us-a-coffee outbound link, GitHub mark, and frozen hackathon link — mounted after the grid via a 2-line additive change to RepoRadarApp.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-27T09:22:01Z
- **Completed:** 2026-05-27T09:24:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `app/lib/links.ts` exposes `DONATION_URL` (env-override placeholder), `GITHUB_URL`, and `HACKATHON_URL` — single source of truth for footer link targets
- `app/components/Footer.tsx` delivers a quiet, dark-themed product footer using globals.css tokens (`--bg`, `--border`, `--fg-dim`, `--fg-muted`, `--primary`, `--accent`, `--secondary`) with all required links
- `RepoRadarApp.tsx` diff is exactly 2 lines: one import, one `<Footer />` mount — frozen header/cards/sliders/radar untouched
- `npm run build` exits clean; targeted eslint shows only the 2 pre-existing baseline set-state-in-effect warnings

## Task Commits

1. **Task 1: links module + Footer component** - `066b2f0` (feat)
2. **Task 2: Mount Footer after grid in RepoRadarApp** - `f8f421e` (feat)

## Files Created/Modified

- `app/lib/links.ts` — DONATION_URL / GITHUB_URL / HACKATHON_URL constants with env-var override and human-handoff documentation
- `app/components/Footer.tsx` — "use client" footer with all required links; GitHub SVG mark; Custom-event dispatch for Suggest a feature; all external anchors `rel="noopener noreferrer"`
- `app/components/RepoRadarApp.tsx` — import + `<Footer />` mount only (2-line diff)

## Decisions Made

- Footer is `"use client"` because the "Suggest a feature" onClick dispatches `window.dispatchEvent` — not available in server context
- "Suggest a feature" implemented as `<button>` (not `<a>`): no URL, pure side-effect via CustomEvent (D-09 pattern)
- Donation CTA hover uses `--accent` (yellow) to visually distinguish it from standard nav links (`--primary` green)
- Copyright bar uses `new Date().getFullYear()` evaluated client-side — acceptable for a client component

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `DONATION_URL` defaults to `"https://ko-fi.com/reporadar"` — a placeholder. The real Ko-fi handle is a **human handoff**: owner sets `NEXT_PUBLIC_DONATION_URL` in deployment env (Cloudflare Workers secret / `.dev.vars`). Documented in plan 02-05 env-doc task.
- `GITHUB_URL` points to `https://github.com/RepoRadar/reporadar` — owner should verify the correct org/repo path before launch.

## Threat Flags

None — all identified threats from threat model are mitigated in implementation:
- T-02-11 (reverse tabnabbing): All external `target="_blank"` anchors set `rel="noopener noreferrer"`
- T-02-12 (donation URL spoofing): DONATION_URL is a hardcoded default; real value is owner-supplied via env
- T-02-13 (footer overlap): Footer mounts strictly after `</main>`, no absolute/fixed positioning over dashboard; diff verified as 2-line additive only

## User Setup Required

None for this plan — the DONATION_URL placeholder is noted above and will be documented in plan 02-05 (consolidated env doc).

## Next Phase Readiness

- Footer is live and functional; Changelog/Blog/Contact are all linked
- "Suggest a feature" wired to FeedbackWidget feature mode via `reporadar:open-feedback` event
- 02-05 (env doc consolidation) can now include `NEXT_PUBLIC_DONATION_URL` as a documented variable
- Phase 2 plan 04 of 5 complete

---
*Phase: 02-credibility-batch-analytics*
*Completed: 2026-05-27*
