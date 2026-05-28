# Suggestions Board — Implementation Summary

**Branch:** `feat/suggestions-board`
**Completed:** 2026-05-28
**Duration:** ~2 hours

## One-liner

Public suggestions voting board with D1 persistence, IP-hashed 3/hr rate-limiting, Gemini spam screen, GitHub issue auto-filing, and admin token-gated moderation.

## What was built

A full-stack public suggestions board for RepoRadar:

| Layer | File | Description |
|-------|------|-------------|
| Migration | `migrations/0002_suggestions.sql` | D1 schema: `suggestions` + `suggestion_votes` tables with UNIQUE constraint and indexes |
| Data layer | `app/lib/suggestions.ts` | All parameterized SQL: createSuggestion, listSuggestions, getSuggestion, recordVote, setSuggestionStatus, hideSuggestion, updateGithubIssueUrl, hashIp |
| API — submit/list | `app/api/suggestions/route.ts` | POST (validate → rate-limit → Gemini screen → D1 → GitHub issue); GET (sorted by score) |
| API — vote | `app/api/suggestions/vote/route.ts` | POST: IP hash → recordVote (3/hr cap + dedup) → 429 on limit |
| API — admin | `app/api/suggestions/admin/route.ts` | PATCH: token-gated (ADMIN_TOKEN header); set status/eta/hidden |
| Page | `app/(site)/suggestions/page.tsx` | Static shell, Workers-safe, Metadata |
| Component | `app/(site)/_components/SuggestionsBoard.tsx` | Client: submit form + voting list with optimistic updates, status badges, inline error handling |
| Entry — menu | `app/components/InteractMenu.tsx` | Suggestions item changed from `action: openSuggestions` to `href: "/suggestions"` |
| Entry — footer | `app/components/Footer.tsx` | "Suggest a feature" button replaced with `Link href="/suggestions"` |
| Tests | `tests/suggestions.test.mjs` | 13 tests (schema, createSuggestion, ordering, dedup, direction-switch, rate-limit) |

## Commits

| Hash | Message |
|------|---------|
| `d8440e8` | feat(suggestions-board): add D1 migration for suggestions + votes tables |
| `763c2dc` | feat(suggestions-board): add suggestions data layer (suggestions.ts) |
| `b516f7f` | feat(suggestions-board): add /api/suggestions, /vote, and /admin route handlers |
| `18dc521` | feat(suggestions-board): add /suggestions public page with submit form + voting list |
| `f2be0b7` | feat(suggestions-board): wire InteractMenu and Footer to /suggestions page |
| `9a91e40` | test(suggestions-board): add suggestions integration tests (all 13 pass) |

## Verification Evidence

### Build output (npm run build)

```
Route (app)
├ ○ /suggestions          ← Static (Workers-safe, force-static)
├ ƒ /api/suggestions      ← Dynamic function
├ ƒ /api/suggestions/admin ← Dynamic function
├ ƒ /api/suggestions/vote  ← Dynamic function
```

Build exits 0. All 4 routes typed correctly.

### GET /api/suggestions — live data sorted by score

```
curl http://localhost:3000/api/suggestions
# Returns:
{
  "ok": true,
  "suggestions": [
    { "name": "...score5", "votes_up": 6, "votes_down": 1, ... },  // net +5
    { "name": "...score3", "votes_up": 5, "votes_down": 2, ... },  // net +3
    { "name": "Real-time GitHub trending alerts", "votes_up": 1, "votes_down": 0, ... },
    ...
  ]
}
```

### POST /api/suggestions — submit

```
curl -X POST http://localhost:3000/api/suggestions \
  -H "content-type: application/json" \
  -d '{"name":"Real-time GitHub trending alerts","description":"Would love to get notified..."}'
# Response:
{ "ok": true, "suggestion": { "id": "0976b62a-...", "status": "awaiting", ... } }
```

Suggestion appears in GET immediately (auto-publish working).

### POST /api/suggestions/vote — vote + count update

```
curl -X POST http://localhost:3000/api/suggestions/vote \
  -H "content-type: application/json" \
  -d '{"suggestion_id":"0976b62a-...","direction":"up"}'
# Response: { "ok": true, "votes_up": 1, "votes_down": 0 }
```

### Validation rejection

```
curl -X POST http://localhost:3000/api/suggestions -d '{"name":"","description":""}'
# Response: { "ok": false, "error": "Name is required (max 120 characters)." }
```

### Tests: 13/13 pass

```
node --test --test-concurrency=1 'tests/suggestions.test.mjs'

ℹ tests 13
ℹ pass 13
ℹ fail 0
```

### Targeted ESLint on all changed files

```
npx eslint app/lib/suggestions.ts app/api/suggestions/route.ts \
  app/api/suggestions/vote/route.ts app/api/suggestions/admin/route.ts \
  "app/(site)/_components/SuggestionsBoard.tsx" "app/(site)/suggestions/page.tsx" \
  app/components/InteractMenu.tsx app/components/Footer.tsx
# Output: (no output — clean)
# SQL file: one expected "File ignored" warning (not a JS file)
```

## Deviations from Spec

### None from spec intent — one lint pattern deviation

The spec called for a `useEffect` data fetch. The project has a custom lint rule `react-hooks/set-state-in-effect` that prohibits calling setState synchronously inside effect bodies. Resolution: mirrored the pattern used in `NotificationSignup.tsx` — `window.setTimeout(..., 0)` inside the effect defers state updates outside the synchronous effect body, satisfying the lint rule while preserving the correct async fetch-on-mount behavior.

### OPEN_EVENT constant removal

`InteractMenu.tsx` had an unused `OPEN_EVENT` constant after removing the `openSuggestions` action. Removed as part of the wiring task (Rule 1 cleanup). FeedbackWidget still works — only the Suggestions menu item entry point changed.

## Human Handoffs (do NOT block deployment)

These steps require owner credentials and must be done manually:

### 1. Apply migration to production D1

```bash
npx wrangler d1 migrations apply reporadar --remote
```

This applies `0002_suggestions.sql` to the production D1 database. The migration is idempotent (`CREATE TABLE IF NOT EXISTS`). Do NOT do this until the branch is merged — migrations on remote are destructive to undo.

### 2. Set ADMIN_TOKEN secret

```bash
npx wrangler secret put ADMIN_TOKEN
# When prompted, enter a strong random token (keep it secret)
```

Without this secret, `PATCH /api/suggestions/admin` returns 503 "Admin not configured" — that is intentional and safe. The token gates hide/accept/decline operations.

### 3. Set SUGGESTIONS_SALT secret (optional but recommended)

```bash
npx wrangler secret put SUGGESTIONS_SALT
# When prompted, enter a random string (e.g. from openssl rand -hex 32)
```

Without this, IP hashing falls back to a constant salt (`reporadar-suggestions-v1`). Setting a deployment-specific secret improves privacy isolation. **This must be set before going live** for meaningful privacy protection.

### 4. GitHub issue filing

GitHub issues are filed via the existing `GITHUB_TOKEN` + `FEEDBACK_ISSUE_REPO` env vars already used by `/api/feedback`. If those are already set, suggestion submissions will auto-create issues labeled `suggestion, user-feedback, triage`. No additional config needed.

### 5. Gemini screening

Uses the existing `GOOGLE_API_KEY` env var. If unset, suggestions are accepted without screening (graceful degradation). No additional config needed.

## Known Stubs

None. All data flows are wired to real D1 endpoints. The `github_issue_url` field will be `null` in dev/test environments where `GITHUB_TOKEN` is not configured — this is intentional graceful degradation, not a stub.

## Self-Check

- [x] `migrations/0002_suggestions.sql` exists and was applied locally
- [x] `app/lib/suggestions.ts` exists with all required functions
- [x] `app/api/suggestions/route.ts` exists (POST + GET)
- [x] `app/api/suggestions/vote/route.ts` exists (POST)
- [x] `app/api/suggestions/admin/route.ts` exists (PATCH)
- [x] `app/(site)/suggestions/page.tsx` exists (static shell)
- [x] `app/(site)/_components/SuggestionsBoard.tsx` exists (client board)
- [x] `tests/suggestions.test.mjs` exists with 13 passing tests
- [x] `app/components/InteractMenu.tsx` — Suggestions item → `/suggestions`
- [x] `app/components/Footer.tsx` — "Suggest a feature" → `/suggestions`
- [x] `npm run build` exits 0; `/suggestions` is static; API routes are functions
- [x] Targeted eslint on all changed files — 0 errors
- [x] Frozen dashboard/header/cards/sliders/radar untouched
