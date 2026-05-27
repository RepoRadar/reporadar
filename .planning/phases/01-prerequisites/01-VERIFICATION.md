---
phase: 01-prerequisites
verified: 2026-05-27T00:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Deploy-route email delivery end-to-end"
    expected: "POST /api/deploy with a real email address in 'contact' and RESEND_API_KEY set returns notified='sent' and the contact receives the HTML email"
    why_human: "Live Resend delivery requires a running server with the real API key; cannot be verified by static code inspection or dry build"
  - test: "Existing browse/search regression — rendered card results"
    expected: "Typing 'Cloudflare Workers' in the search field returns cards that are genuinely Cloudflare/Workers repos (not stale or mismatched cards from before the cache-wrapper refactor)"
    why_human: "AGENTS.md verification contract: 'verify results, not just mechanics' — asserting the URL or chip changed is not enough; a human must confirm the rendered cards match the query"
---

# Phase 1: Prerequisites Verification Report

**Phase Goal:** The infrastructure that gates the alerts workstream is in place — a dedicated, rate-safe GitHub token and a real email-delivery path.
**Verified:** 2026-05-27
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | fetchTrending runs on an app-owned token with distinct tags cached/batched so scheduled polling stays within the rate budget; prod-token human handoff documented | VERIFIED | `app/lib/trendingCache.ts` exports `fetchTrendingCached` with TTL Map cache (5 min), in-flight coalescing Map, empty-result exclusion (line 58), 500-entry eviction guard. `app/api/repos/route.ts` imports and calls it (lines 3, 24). Old local `cache`/`TTL_MS` fully removed. `.dev.vars.example` documents `GITHUB_TOKEN=` with explicit human-handoff note ("owner mints it and sets prod via `wrangler secret put GITHUB_TOKEN`"). `app/lib/github.ts` reads `process.env.GITHUB_TOKEN` at lines 13 and 115. |
| 2 | sendEmail() lib exists, delivers real email via Resend, graceful no-op when RESEND_API_KEY unset | VERIFIED | `app/lib/email.ts` exports `sendEmail()` (92 lines, no SDK, plain fetch to `https://api.resend.com/emails`). No-key early-return at line 30-33 returns `{ ok: false, skipped: true }`. `escapeHtml` also exported. `app/api/deploy/route.ts` imports both at line 6 and calls `sendEmail()` at line 208. Local `escapeHtml` function removed from deploy route (grep confirms absence). |
| 3 | Existing repo browsing/search keeps working unchanged — no regression from cache wrapper or deploy-route refactor | VERIFIED (code-level) — human spot-check required for rendered results | `app/api/repos/route.ts`: `s-maxage=300, stale-while-revalidate=3600` header preserved (line 64). 4-second translation race preserved (lines 55-58). `enrich` block preserved (lines 32-43). `export const runtime = "nodejs"` preserved (line 6). `fetchTrendingCached` wraps `fetchTrending` unchanged: no alteration to 5-tier search logic or AbortSignal. Cache key normalization (lowercased topic) verified in `trendingCache.ts` lines 27-32. Deploy route: `sendEmail`/`escapeHtml` imported; bespoke HTML body and `"sent"|"queued"` contract unchanged. |

**Score:** 3/3 truths verified at code level; human spot-check pending for live delivery and rendered search results.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/lib/email.ts` | sendEmail() + escapeHtml() exports, no-key no-op | VERIFIED | 92 lines, both functions exported, no-key guard at line 30, fetch at line 56, network errors caught and returned never thrown |
| `app/lib/trendingCache.ts` | fetchTrendingCached with TTL cache + in-flight coalescing | VERIFIED | 74 lines, TTL Map, inflight Map, empty-result guard at line 58, 500-entry eviction at line 60 |
| `app/api/repos/route.ts` | Uses fetchTrendingCached; no local cache; SWR headers preserved | VERIFIED | Imports `fetchTrendingCached` (line 3), calls it (line 24), no local `cache` or `TTL_MS` variables, Cache-Control header intact (line 64) |
| `app/api/deploy/route.ts` | Calls sendEmail(); no local escapeHtml(); same send/queued contract | VERIFIED | Imports `sendEmail, escapeHtml` from `@/app/lib/email` (line 6), calls `sendEmail()` (line 208), no local `escapeHtml` function (confirmed by grep returning empty), "queued" fallback preserved (line 214) |
| `.dev.vars.example` | Env contract template with GITHUB_TOKEN human-handoff note | VERIFIED | Lists all 6 variables (GITHUB_TOKEN, RESEND_API_KEY, RESEND_FROM, GOOGLE_API_KEY, ELEVENLABS_API_KEY, NEXTJS_ENV) with inline comments; GITHUB_TOKEN comment explicitly names the human handoff step and `wrangler secret put GITHUB_TOKEN` command |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/api/repos/route.ts` | `app/lib/trendingCache.ts` | `import { fetchTrendingCached }` | WIRED | Import at line 3, call at line 24 with params passed through |
| `app/api/deploy/route.ts` | `app/lib/email.ts` | `import { sendEmail, escapeHtml }` | WIRED | Import at line 6, sendEmail called at line 208, escapeHtml used at lines 196, 199, 200 |
| `app/lib/trendingCache.ts` | `app/lib/github.ts` | `import { fetchTrending }` | WIRED | Import at line 1, call at line 57 inside the cold/expired branch |
| `.dev.vars.example` | `app/lib/github.ts` | GITHUB_TOKEN env var | DOCUMENTED | .dev.vars.example line 4; github.ts reads `process.env.GITHUB_TOKEN` at lines 13 and 115 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `fetchTrendingCached` | `data` (Repo[]) | `fetchTrending(p)` — 5-tier GitHub Search API | Yes — live HTTP call to GitHub API (not mocked) | FLOWING |
| `sendEmail` | Response `id` | Resend API POST | Yes — real HTTP call when `RESEND_API_KEY` set; no-op (skipped:true) when absent | FLOWING (key-gated) |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `sendEmail` no-key path returns `{ok:false,skipped:true}` | Code inspection, line 29-33 of email.ts | `if (!apiKey) return { ok: false, skipped: true }` confirmed | PASS |
| In-flight coalescing: inflight Map populated and cleaned up | Code inspection, lines 52-71 of trendingCache.ts | `inflight.set(key, promise)` before await; `.finally(() => inflight.delete(key))` guarantees cleanup | PASS |
| Empty-result non-caching: rate-limited `[]` not cached | Code inspection, line 58 of trendingCache.ts | `if (data.length > 0)` guard before `cache.set` | PASS |
| SWR headers preserved | `grep "Cache-Control" app/api/repos/route.ts` | `"public, s-maxage=300, stale-while-revalidate=3600"` present at line 64 | PASS |
| Old local cache removed from repos route | `grep "const cache\|TTL_MS" app/api/repos/route.ts` | No output — variables absent | PASS |
| All 4 commits claimed by SUMMARY exist | `git log --oneline --no-walk 60b8a23 982e50b 997068e a2d68cf` | All 4 commit hashes confirmed with matching descriptions | PASS |
| Live email delivery to real recipient | Requires running server + real RESEND_API_KEY | Not runnable statically | SKIP — human required |
| Browse/search rendered cards match query | Requires browser against dev server | Not runnable statically | SKIP — human required |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PRE-01 | 01-02-PLAN | App-owned fine-scoped GITHUB_TOKEN, not personal | SATISFIED — human handoff documented | `.dev.vars.example` explicitly states human mints token + `wrangler secret put GITHUB_TOKEN`. Code already reads `process.env.GITHUB_TOKEN`. The executor correctly stopped at PR boundary. |
| PRE-02 | 01-02-PLAN | fetchTrending caches/batches distinct tags; rate-limit failures no longer occur from shared token | SATISFIED | `fetchTrendingCached` TTL cache + in-flight coalescing + empty-result exclusion fully implemented and wired into repos route |
| PRE-03 | 01-01-PLAN | sendEmail() lib behind email provider; real key human-supplied; lib+routes build with key stubbed | SATISFIED | `app/lib/email.ts` exists with correct signature; graceful no-op confirmed; deploy route refactored to use it; `npm run build` exits 0 per SUMMARY |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None detected | — | — | — | — |

Scanned `app/lib/email.ts`, `app/lib/trendingCache.ts`, `app/api/repos/route.ts`, `app/api/deploy/route.ts` for TODO/FIXME/placeholder comments, empty return bodies, and hardcoded stubs. None found. The `stub_surface` fallback in `deploy/route.ts` is pre-existing behavior gated on `GOOGLE_API_KEY` absence — not introduced by this phase.

---

### Human Verification Required

#### 1. Deploy-route email delivery end-to-end

**Test:** With `RESEND_API_KEY` set in `.dev.vars`, POST to `/api/deploy` with a real email address in the `contact` field and a valid repo name. Observe the response `notified` field and check the inbox.
**Expected:** Response includes `notified: "sent"`; the contact email address receives the HTML notification with correct repo name, form factor, and live URL.
**Why human:** Live Resend delivery requires a running server with the real API key present. Static code inspection confirms the wiring is correct (`sendEmail()` is called with the right arguments) but cannot confirm actual delivery or Resend API acceptance.

#### 2. Existing browse/search regression — rendered card results

**Test:** On the running dev server, open the dashboard. Type `Cloudflare Workers` in the search field and press enter (or wait for results). Observe the rendered repo cards.
**Expected:** The top cards returned are genuinely Cloudflare/Workers repos (e.g. cloudflare.com repos, repos with `workers` or `cloudflare` in their names/topics) — not stale cards from a previous query or unrelated repos.
**Why human:** Per `AGENTS.md` verification contract: "verify results, not just mechanics — type real queries... confirm the returned cards actually MATCH the input." A working cache layer could serve mismatched cached results under a new query if key normalization has a subtle bug; only a live browser check confirms the results are correct.

---

### Gaps Summary

No blockers. All three success criteria are met at the code level:

1. **Rate-safe caching (SC-1):** `fetchTrendingCached` is substantive, wired, and data-flowing. The prod GITHUB_TOKEN is correctly treated as a human handoff — documented in `.dev.vars.example`, not a code gap.
2. **sendEmail() lib (SC-2):** `app/lib/email.ts` is complete and wired into the deploy route. The no-op on missing key is confirmed. The prod RESEND_API_KEY being available is noted in the CONTEXT as already existing; the lib activates the moment it is present in the environment.
3. **No regression (SC-3):** All preserved behaviors confirmed by code inspection (SWR headers, 4s translation race, enrich block, runtime export, "sent"|"queued" contract). Human spot-check on rendered results is standard due diligence per project verification rules, not an indicator of a code gap.

Two items require human verification before the phase can be marked fully passed: live email delivery and confirmed search results in the browser.

---

_Verified: 2026-05-27_
_Verifier: Claude (gsd-verifier)_
