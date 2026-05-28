---
phase: 04-repo-intelligence
plan: 05
subsystem: ui
tags: [react, tsx, anchor, chat, icon, svg]

# Dependency graph
requires:
  - phase: 04-repo-intelligence
    provides: chat workspace route (/chat/[owner]/[repo]) that the new anchor links to
provides:
  - "Ask this repo" anchor in RepoCard footer, opening /chat/{fullName} in a new tab
affects: [04-06-qa, 04-repo-intelligence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Href-only <a> for card footer actions that open new tabs (no callback prop needed)"
    - "ChatIcon inline SVG alongside GitHubMark for icon parity"
    - "flex-wrap gap-2 footer row for 3-item card actions"

key-files:
  created: []
  modified:
    - app/components/RepoCard.tsx

key-decisions:
  - "href-only anchor, no onAsk prop or RepoRadarApp.tsx change needed"
  - "Footer restructured from justify-between to flex-wrap gap-2 to cleanly hold three actions"
  - "Pre-existing JSX comment em dashes cleaned up (Rule 1 - bug: plan acceptance criterion required zero em dashes)"

patterns-established:
  - "ChatIcon: speech-bubble with question mark, inline SVG 16x16, aria-hidden, size prop, placed beside GitHubMark"

requirements-completed: [INTL-01]

# Metrics
duration: 5min
completed: 2026-05-28
---

# Phase 4 Plan 5: "Ask this repo" entry affordance on RepoCard

**Speech-bubble anchor in RepoCard footer linking `/chat/{owner}/{repo}` in a new tab, styled with blue secondary tokens, stopPropagation, and verbatim UI-SPEC aria-label.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-28T08:53:57Z
- **Completed:** 2026-05-28T08:58:24Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `ChatIcon` inline SVG (speech bubble with question mark, recognizable icon, not decorative)
- Inserted `<a href="/chat/${repo.fullName}" target="_blank" rel="noopener noreferrer">` between GitHub and Deploy in the footer row
- aria-label verbatim from UI-SPEC: `Ask {fullName}, opens the chat workspace in a new tab`
- Footer restructured to `flex flex-wrap items-center gap-2` for clean three-item row
- Mitigated T-04-17 (reverse tabnabbing) via `rel="noopener noreferrer"`, T-04-18 (event bleed) via `e.stopPropagation()`

## Task Commits

1. **Task 1: Add the "Ask this repo" anchor to the RepoCard footer** - `1a58e85` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified

- `app/components/RepoCard.tsx` - Added `ChatIcon` SVG helper and "Ask this repo" `<a>` anchor in the footer row; cleaned pre-existing em dashes from JSX comments

## Decisions Made

- href-only anchor with no `onAsk` callback prop: the plan explicitly called for this approach and it avoids prop-drilling through `RepoRadarApp.tsx`
- Footer layout changed from `justify-between` to `flex-wrap gap-2`: supports three items cleanly on narrow cards per UI-SPEC
- Cleaned pre-existing JSX comment em dashes: the plan's acceptance criterion `grep -c '—'` must return 0, requiring cleanup of legacy `{/* HERO — ... */}` style comments

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed pre-existing em dashes from JSX comments**
- **Found during:** Task 1 acceptance criteria check
- **Issue:** Five JSX block comments used `—` (em dash) in the comment text, causing `grep -c '—'` to return 5 instead of 0
- **Fix:** Replaced `—` with `:` in all five comment headers (HERO, TAGS ROW, DESCRIPTION, SCORE BAR, FOOTER)
- **Files modified:** app/components/RepoCard.tsx
- **Verification:** `grep -c '—' app/components/RepoCard.tsx` returns 0
- **Committed in:** 1a58e85 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - pre-existing bug in comments)
**Impact on plan:** Required for acceptance criterion compliance. No scope creep; the em dashes were in comments only, not user-facing text.

## Issues Encountered

- `npm run lint` (full project) OOM-crashed with `JavaScript heap out of memory` at ~4GB. This is a pre-existing ESLint performance issue in the project (not introduced by this change). `npx eslint app/components/RepoCard.tsx` (single-file) ran clean. `npx tsc --noEmit` passed. Deferred to out-of-scope tracking.

## Known Stubs

None. The anchor links to `/chat/${repo.fullName}` which is the actual chat route being built in plans 04-01 through 04-06. The entry affordance is fully wired.

## Threat Flags

None beyond the two items already in the plan's threat model (both mitigated inline).

## Next Phase Readiness

- Entry affordance complete; the "Ask this repo" button is live on every repo card
- Plan 04-06 QA will browser-verify the three-action footer and the new-tab navigation behavior
- No blockers; no RepoRadarApp.tsx changes needed

---
*Phase: 04-repo-intelligence*
*Completed: 2026-05-28*
