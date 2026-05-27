# Context

Running notes keyed by topic, appended verbatim with source attribution. No documents were
classified as DOC; the notes below are background context carried in the SPEC's framing section
(BUILD-BRIEF.md § 0) to aid downstream planning — not requirements or constraints.

---

## Topic: Product identity
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ 0)
RepoRadar is a dashboard that surfaces trending GitHub repos as agent-rendered, scored cards.
Users tune 10 weighted dimensions (sliders + a draggable radar hex), filter by sort priority,
search by tag or freeform text, and deploy a bespoke generative-UI surface for any repo.
Tagline: "Find the most meaningful repo to build upon as efficiently as possible."

## Topic: Already shipped (do not rebuild)
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ 0 What already shipped)
Shareable search URLs (`?topic`/`?q`/`?sort`/`?window`, `app/lib/shareUrl.ts`); SSR data
caching; single-select tags + center "Loading…" state; stale-result guard + bounded
GitHub/translation fetches; tuning re-rank pulse. Notifications v1 scaffold
(`app/api/notifications/subscribe` + `tests/notifications.spec.ts`) stores in-memory and sends a
dummy email. Feedback intake exists (`app/api/feedback`, `FeedbackWidget`).

## Topic: Key files / patterns to reuse
- source: /Users/cro/dev/reporadar/BUILD-BRIEF.md (§ 0 Key files)
- `app/lib/github.ts` — `fetchTrending` (5-tier search, bounded by one `AbortSignal.timeout`,
  uses `GITHUB_TOKEN` when present; fail-fast). Prod currently uses Christo's personal `gh` token.
- `app/api/repos/route.ts` — in-memory cache + `s-maxage`/SWR headers + bounded translation.
- `app/components/RepoRadarApp.tsx` — central state, `runQuery` (request-sequenced + 15s timeout +
  error/retry state), loading/empty/error render branches, `tuneWeights`/`tunePriorities`.
- `app/lib/translate.ts` — batched Gemini translation, module-cached, script-detect skip.

## Topic: Cross-references (from classification)
- source: /Users/cro/dev/reporadar/.planning/intel/classifications/BUILD-BRIEF.json
The brief references existing repo files/dirs (not other ingested docs): AGENTS.md,
node_modules/next/dist/docs/, wrangler.jsonc, app/lib/shareUrl.ts,
app/api/notifications/subscribe, tests/notifications.spec.ts, app/api/feedback,
app/lib/github.ts, app/api/repos/route.ts, app/components/RepoRadarApp.tsx, app/lib/translate.ts,
playwright.local.config.ts, workers/deploy. All targets are source artifacts, not ingest-set
documents, so no document cross-ref cycle is possible.
