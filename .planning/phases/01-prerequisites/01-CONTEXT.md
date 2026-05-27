# Phase 1: Prerequisites - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning
**Source:** discuss-phase --auto (recommended defaults selected; rationale logged in 01-DISCUSSION-LOG.md)

<domain>
## Phase Boundary

Lay the two infrastructure prerequisites that gate the alerts workstream (WS2) without
changing user-facing behavior:

1. A **rate-safe GitHub trending fetch** — distinct terms cached + coalesced so scheduled
   polling (many tags) does not exhaust the rate budget — running on an **app-owned,
   fine-scoped** `GITHUB_TOKEN` (minting the prod token is a human handoff).
2. A real **`sendEmail()` library** (Resend) that downstream features (WS1 contact form,
   WS2 alert emails) call. The Resend API key already exists for reporadar; the lib reads it
   at runtime and degrades gracefully when absent.

**In scope:** the caching/dedupe wrapper for `fetchTrending`, the `sendEmail()` lib, wiring
the existing repos route + deploy-route email onto these shared helpers (no behavior change),
and `.dev.vars.example` documentation of required secrets.
**Out of scope:** the alerts cron, D1 schema, subscription UI (all WS2 / Phase 3); SMS/Twilio.
</domain>

<decisions>
## Implementation Decisions

### Email delivery (`sendEmail()` lib)
- **D-01:** Provider is **Resend**, called over plain `fetch` to `https://api.resend.com/emails`
  with `Authorization: Bearer ${RESEND_API_KEY}` — the exact pattern already in
  `app/api/deploy/route.ts`. No new SDK dependency.
- **D-02:** New module **`app/lib/email.ts`** exports
  `async function sendEmail(opts: { to: string | string[]; subject: string; html: string; text?: string; from?: string; replyTo?: string }): Promise<{ ok: boolean; id?: string; skipped?: boolean; status?: number; error?: string }>`.
- **D-03:** `from` defaults to `process.env.RESEND_FROM || "RepoRadar <onboarding@resend.dev>"`
  (matches deploy route). The sandbox `onboarding@resend.dev` sender only delivers to the
  account's own verified address — a verified domain is a later, non-blocking improvement.
- **D-04:** **Graceful no-op when `RESEND_API_KEY` is unset** — return `{ ok: false, skipped: true }`
  (never throw), mirroring the no-key behavior of `app/lib/translate.ts` and the deploy route.
  Network/HTTP failures return `{ ok: false, status, error }` and are logged, never thrown.
- **D-05:** Export a small **`escapeHtml`** helper from `app/lib/email.ts` (extracted from the
  copy in `app/api/deploy/route.ts`) so callers building HTML bodies share one implementation.
- **D-06:** Refactor the inline Resend `fetch` in `app/api/deploy/route.ts` to call `sendEmail()`,
  preserving its existing bespoke HTML and the `"sent" | "queued"` return contract — **no
  behavior change to deploy notifications** (regression-checked).

### Rate-safe trending fetch (caching + dedupe)
- **D-07:** Add a cached, request-coalescing wrapper — **`fetchTrendingCached(params)`** — in a new
  `app/lib/trendingCache.ts` (or co-located in `app/lib/github.ts`). It wraps the existing
  `fetchTrending` and does NOT change its signature or the 5-tier/AbortSignal fail-fast logic.
- **D-08:** Cache key is the normalized tuple `topic|query|since|page|perPage` (lowercased topic),
  stored in a module-level `Map<string, { at: number; data: Repo[] }>` with a TTL
  (`TRENDING_TTL_MS`, default `5 * 60 * 1000` — same as the repos route today).
- **D-09:** **In-flight coalescing:** keep a `Map<string, Promise<Repo[]>>` of pending fetches so
  N concurrent identical terms (e.g. the cron polling a popular tag) share ONE upstream GitHub
  call. This is the "batch distinct terms" requirement — dedupe by identical key, coalesce
  concurrent, serve cache within TTL.
- **D-10:** **Only cache non-empty results.** An empty array (rate-limited / aborted tier) is not
  cached, so a transient failure doesn't stick for the full TTL and the next call retries.
- **D-11:** Refactor `app/api/repos/route.ts` to use `fetchTrendingCached`, replacing its local
  `cache`/`TTL_MS` — verify the dashboard's browse/search and `s-maxage`/SWR headers are
  unchanged (no regression). The bounded translation race stays exactly as-is.

### GitHub token (human handoff)
- **D-12:** Code already reads `process.env.GITHUB_TOKEN` (in `app/lib/github.ts` and
  `app/api/feedback/route.ts`). The **app-owned, fine-scoped prod token is owner-only** — the
  executor does NOT mint or rotate it. Document the requirement and stop at a green PR; the
  human swaps the prod `GITHUB_TOKEN` secret (`wrangler secret put GITHUB_TOKEN`).
- **D-13:** Add **`.dev.vars.example`** listing the env contract (`GITHUB_TOKEN=`,
  `RESEND_API_KEY=`, optional `RESEND_FROM=`, existing `GOOGLE_API_KEY=`, `ELEVENLABS_API_KEY=`,
  `NEXTJS_ENV=`) so contributors know what to set locally. `.gitignore` already allows
  `!.dev.vars.example`.

### Claude's Discretion
- Exact file placement (`app/lib/trendingCache.ts` vs. additions to `app/lib/github.ts`),
  internal helper names, and whether to expose `TRENDING_TTL_MS` via env. Keep it minimal.
- Whether `sendEmail` accepts a `tags`/`headers` passthrough — only if trivially clean.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase brief & prerequisites
- `BUILD-BRIEF.md` — Prerequisites §A (dedicated token + tag caching/batching) and §B (email provider + `sendEmail()`).
- `.planning/intel/requirements.md` — `PRE-github-token`, `PRE-email-provider` acceptance criteria.

### Existing patterns to reuse (do not reinvent)
- `app/api/deploy/route.ts` §170–230 — the Resend `fetch` call, `RESEND_FROM` default, `escapeHtml`, and the no-key/queue graceful-degrade pattern that `sendEmail()` generalizes.
- `app/api/repos/route.ts` — the `Map`+`TTL_MS` in-memory cache and `s-maxage`/stale-while-revalidate headers `fetchTrendingCached` must preserve.
- `app/lib/github.ts` — `fetchTrending` (5-tier search, single `AbortSignal.timeout` budget, `GITHUB_TOKEN` when present, fail-fast). The wrapper must NOT alter this.
- `app/lib/translate.ts` §35–60 — the "no-op when API key missing" convention (`GOOGLE_API_KEY`) to mirror for `RESEND_API_KEY`.

### Secrets / config
- `.gitignore` §39–60 — `.env*` / `.dev.vars*` rules (`.dev.vars.example` is the committed template).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Resend send path** (`app/api/deploy/route.ts`): copy/generalize the `fetch` body, headers, `from` default, and `escapeHtml` into `app/lib/email.ts`.
- **In-memory cache** (`app/api/repos/route.ts`): the `Map<string,{at,data}>`+TTL shape is the model for `trendingCache.ts`.

### Established Patterns
- **Graceful degradation without keys** (`translate.ts`, deploy route): features no-op/queue rather than throw when their API key is absent — `sendEmail()` follows this.
- **Fail-fast upstream calls** (`github.ts`): single `AbortSignal.timeout` across all work, no throttling/retry sleeps (a Worker-time-limit guard) — the cache wrapper must not reintroduce blocking waits.

### Integration Points
- `app/api/repos/route.ts` (swap local cache → `fetchTrendingCached`).
- `app/api/deploy/route.ts` (inline Resend → `sendEmail()`).
- Future consumers (Phase 2 contact form, Phase 3 alerts cron) import `sendEmail` and `fetchTrendingCached`.
</code_context>

<specifics>
## Specific Ideas

- The Resend key for reporadar already exists; it goes in `.dev.vars` (local) and `wrangler secret put RESEND_API_KEY` (prod). The lib must work the moment the secret is present — no code change needed to "turn it on."
</specifics>

<deferred>
## Deferred Ideas

- Verified Resend sending domain + branded `RESEND_FROM` — improves deliverability to arbitrary recipients; not required for tonight's build (sandbox sender works for owner-address testing).
- Twilio/SMS notify path (stubbed/queued today in deploy route) — out of scope; remains queued.
- Persisting snapshots / cron polling — that's Phase 3 (WS2), which consumes `fetchTrendingCached`.

</deferred>

---

*Phase: 01-prerequisites*
*Context gathered: 2026-05-27 via discuss-phase --auto*
