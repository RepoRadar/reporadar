# Handoff — Shareable Search URLs + prod incident (2026-05-26)

## TL;DR / current state
- **Prod (reporadar.io) is HEALTHY and safe to leave.** Home returns 200, fast. Verified with 10 manual requests.
- The shareable-URL feature + the feedback feature are now **merged to `main` and deployed**.
- Current prod Worker version: **`91fb7211-29db-40de-a99e-140d5607e339`** (the fix version).
- **One recommended follow-up remains:** add a `GITHUB_TOKEN` secret to prod so cards load reliably under load (see "Next step" below). Not required to prevent crashes — only for the cards-in-first-paint experience.

## What shipped (the feature)
Shareable search URLs. The dashboard mirrors its search into the address bar and reproduces it on load:
- `?topic=a,b` (one or more topics), `?q=...` (freeform ask), `?sort=stars,velocity` (up to 3 filters), `?window=all`. Default Hermes view = clean `/`.
- Files: `app/lib/shareUrl.ts` (parse/build), `app/page.tsx` (SSR reads searchParams), `app/components/RepoRadarApp.tsx` (History-API URL sync + hydration).
- Tests: `tests/share-url.spec.ts` (11 cases) + `playwright.local.config.ts` (local dev-server runner). Run: `npx playwright test -c playwright.local.config.ts` (needs a dev server; use `GITHUB_TOKEN=$(gh auth token) PORT=3000 npm run dev`).

## The incident (what went wrong + how it was fixed)
1. Merged PR #19 (shareable URLs) → `main`, which already had PR #18 ("feedback issue intake", from an `orchestrator/rep-orchestrator` branch). Deployed `main`.
2. **Prod home route started returning HTTP 500.** `/api/repos` stayed 200.
3. Rolled prod back to the last-good version (`bd3f2406`, May 14) → prod healthy.
4. **Root cause:** the home page SSR-prefetches from GitHub. Prod has **no `GITHUB_TOKEN`**, so calls are anonymous and share Cloudflare's egress IPs across all visitors → GitHub rate-limits them → octokit's throttling plugin **slept ~48s** waiting for the reset → blew the Cloudflare Worker time limit → **uncatchable 500**. (Worked locally because dev used a token; local `opennextjs-cloudflare preview`/miniflare is an UNRELIABLE testbed here — it shows 48s stalls and ignores AbortSignal even WITH a token, so don't trust it for this.)
5. **Fix (commit `fa49487`):** `fetchTrending` now calls the GitHub Search API with a plain `fetch` (no octokit throttle/retry plugins — they sleep and ignored disable attempts), bounded by one `AbortSignal.timeout` across all fallback tiers. A rate-limited call now returns a fast 403 → empty → client bootstrap, instead of hanging. `page.tsx` also wraps the SSR prefetch in a hard time budget.
6. Redeployed the fix → prod home verified 200 across 10 requests, no hangs. **Confirmed fixed even WITHOUT a token** (degrades gracefully).

## Known remaining behavior (the "do I need a token?" answer)
- **Crash: fixed, no token needed.** Home never hangs/500s now.
- **Cards under load: needs a token.** Without `GITHUB_TOKEN` in prod, under concurrent traffic anonymous GitHub gets exhausted → SSR/`/api/repos` return empty → the homepage shows the loading/empty state instead of cards (it does NOT crash). The parallel smoke suite reproduces this (data-dependent tests fail: "home chrome", tag chips, `/api/repos non-empty`).
- **Fix for reliable cards:** add a `GITHUB_TOKEN` secret to prod (authenticated = 5000/hr, won't be rate-limited under demo load).

## NEXT STEP (do this for a reliable demo)
Add the token (applies immediately to the running Worker, no redeploy needed):
```
# uses your gh login token (reads public repos only is enough; rotate anytime)
printf '%s' "$(gh auth token)" | npx wrangler secret put GITHUB_TOKEN
```
Then confirm cards load:
```
curl -s "https://reporadar.io/api/repos?topic=cloudflare&limit=3" | head -c 200   # expect a non-empty JSON array
npm run test:smoke    # most failures should clear with the token in place
```
(A dedicated fine-scoped PAT with `public_repo`/read-only is cleaner long-term than the gh token, but the gh token works.)

## Rollback (if anything looks wrong on prod)
```
npx wrangler rollback bd3f2406-e7f4-4d47-a5fd-ae7f08def82b --message "rollback"   # last known-good (May 14, pre-features)
# or roll back to just-before-current if needed: see `npx wrangler deployments list`
```

## Git state
- Branch `feat/shareable-search-urls` merged to `main` via PR #19 (merge commit on `origin/main`).
- Local `main` has commits NOT yet pushed to origin:
  - `c72c391` test(share): raise per-test timeout (playwright.local.config.ts)
  - `fa49487` fix(home): stop the SSR GitHub fetch from hanging the Worker (prod 500)  ← **this is the deployed fix; PUSH IT**
- **TODO: `git push origin main`** so origin matches what's deployed. (Local `main` is ahead of `origin/main` by these commits. Deployed prod = local `main` @ `fa49487`.)
- The review fixes from `/ultrareview` (window=all all-time, copilot URL, landing-param preservation, logo/✕ reset) are in earlier commits `ec846a2` + `dc384eb`.

## Verification commands recap
- Local feature tests: `GITHUB_TOKEN=$(gh auth token) PORT=3000 npm run dev` then `npx playwright test -c playwright.local.config.ts` → 11/11.
- Build: `NODE_OPTIONS="--max-old-space-size=8192" npm run build`.
- Lint: only 2 pre-existing `set-state-in-effect` errors on `main` (not from this work).
