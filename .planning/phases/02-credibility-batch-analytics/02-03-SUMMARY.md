---
phase: 02-credibility-batch-analytics
plan: 03
subsystem: feedback
tags: [feedback, feature-request, github-issues, gemini, ui-toggle]
dependency_graph:
  requires: []
  provides: [FeedbackWidget-feature-mode, api-feedback-type-aware]
  affects: [app/components/FeedbackWidget.tsx, app/api/feedback/route.ts]
tech_stack:
  added: []
  patterns: [segmented-toggle, custom-event-bus, strict-enum-normalization]
key_files:
  modified:
    - app/components/FeedbackWidget.tsx
    - app/api/feedback/route.ts
decisions:
  - "type normalization uses strict equality (=== 'feature') — any invalid/missing value defaults to 'feedback', so no 400 on bad type"
  - "External open hook uses CustomEvent 'reporadar:open-feedback' with optional detail.type — documented for 02-04 footer link"
  - "Segmented toggle resets form state on mode switch to prevent stale content"
  - "normalizeLabels seeded with feature-request for both LLM and fallback paths — label injection impossible via type field"
metrics:
  duration_seconds: 166
  completed_date: "2026-05-27"
  tasks_completed: 2
  files_modified: 2
---

# Phase 02 Plan 03: Extend FeedbackWidget + /api/feedback with feature-request type Summary

**One-liner:** Single FeedbackWidget gains a Review/Suggest-a-feature segmented toggle that posts `type:"feature"` to `/api/feedback`, which routes to a feature-framed Gemini instruction and adds the `feature-request` GitHub label — backward compatible, no duplicate widget or route.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | type-aware /api/feedback (feedback\|feature) | d06e071 | app/api/feedback/route.ts |
| 2 | FeedbackWidget Review/Suggest toggle + external open hook | 6dbd086 | app/components/FeedbackWidget.tsx |

## What Was Built

### Task 1 — /api/feedback type extension

`FeedbackBody` gains `type?: unknown`. The POST handler normalizes it immediately:

```typescript
const type: "feedback" | "feature" = body.type === "feature" ? "feature" : "feedback";
```

Type flows into:
- `verifyFeedback` — selects Gemini `systemInstruction` (feature-framed vs review-framed) and `titlePrefix` ("Feature:" vs "Feedback:") and `baseLabels` array in the JSON prompt
- `buildFallbackIssue` — picks title prefix and label set (`feature-request` included when feature)
- `normalizeLabels` — seeds `["user-feedback","triage","feature-request"]` for feature, `["user-feedback","triage"]` for feedback

Both LLM and fallback (no GOOGLE_API_KEY) paths produce `feature-request`-labeled issues in feature mode.

### Task 2 — FeedbackWidget toggle + external open hook

- `mode` state (`"feedback" | "feature"`) drives a segmented two-button toggle inside the open panel
- A `COPY` constant maps mode to title, helper text, label, placeholder, and submit button text — zero branching in JSX
- `type: mode` is included in the POST body; this is the only body change from the widget
- `handleModeChange` resets form state on toggle to avoid stale text in the opposite mode
- A `useEffect` listens for `window` event `"reporadar:open-feedback"` (constant `OPEN_EVENT`); on receipt, sets `open(true)` and `mode` from `detail.type`
- Trigger button, outside-click/Escape, header placement, and status UX are untouched

## Verification

```
npm run build       → exit 0 (all routes compiled)
npx eslint ...      → no new errors (empty output)
grep "type: mode"   → line 121 in FeedbackWidget.tsx (POST body)
grep "feature-request" route.ts → lines 96, 206, 315 (LLM prompt, fallback, normalizeLabels)
type normalization  → body.type === "feature" ? "feature" : "feedback" (strict guard at line 49)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — widget sends real `type` field, API uses it to route labels and Gemini framing.

## Threat Surface Scan

No new endpoints or trust boundaries introduced. The `type` field is normalized at route entry (strict enum) per T-02-08 in the plan's threat model. No new threat flags.

## Self-Check: PASSED

- [x] `app/api/feedback/route.ts` exists and contains `feature-request` and `type` normalization
- [x] `app/components/FeedbackWidget.tsx` exists and contains `reporadar:open-feedback`, `feature`, `type: mode`
- [x] Commits d06e071 and 6dbd086 exist on feat/phase-2-credibility
- [x] `npm run build` exits 0
- [x] `npx eslint` on both changed files produces no output (no errors)
