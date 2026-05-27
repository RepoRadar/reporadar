# Phase 3: Threshold Alerts - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning (research-first — see canonical_refs for the cron unknown)
**Source:** discuss-phase --auto (recommended defaults; rationale in 03-DISCUSSION-LOG.md). Surfaces scouted directly.

<domain>
## Phase Boundary

The retention hook: a user subscribes to a tag or search term with a growth threshold and gets
**exactly one** email when a repo crosses it. Replace notifications v1 (in-memory + dummy email)
with real persistence, real delivery, double opt-in, unsubscribe, an Alerts UI, and an idempotent
scheduled job — built on Phase 1's `sendEmail()` + `fetchTrendingCached()`.

**In scope:** D1 schema + migrations (`subscriptions`, `repo_snapshots`); D1-backed subscription
store replacing the in-memory route; double opt-in (verify token) + one-click unsubscribe
(unsub_token); the scheduled job's crossing-detection logic (dedupe distinct terms, diff snapshots
over window_days, detect crossings, send once via last_notified_at, write fresh snapshots); the
Cloudflare Cron Trigger wiring; an Alerts UI panel (create/list/manage/remove); tests at the API
AND scheduled-handler level with seeded fixtures.
**Out of scope:** SMS/push, per-repo (vs per-term) alerts, a full preferences center.
</domain>

<decisions>
## Implementation Decisions

### Data layer (D1) — REUSE the existing database, don't provision a new one
- **D-01:** Bind the **existing** D1 database `reporadar` (`database_id ba6ce5a3-54e5-449a-9371-178eda6de8a3`, already used by `workers/deploy`) into the MAIN app's `wrangler.jsonc` as `{ "binding": "DB", "database_name": "reporadar", "database_id": "ba6ce5a3-..." }`. **No new DB provisioning** — the database exists; we only add tables.
- **D-02:** Schema (migrations in a new `migrations/` dir, applied via `wrangler d1 migrations apply reporadar` — `--local` for tests; `--remote` is a deploy-gated human step):
  - `subscriptions(id TEXT PK, email TEXT, kind TEXT['topic'|'query'], term TEXT, metric TEXT['stars_pct'|'stars_abs'|'velocity'], threshold REAL, window_days INTEGER, created_at TEXT, verified_at TEXT NULL, last_notified_at TEXT NULL, verify_token TEXT, unsub_token TEXT)`
  - `repo_snapshots(term TEXT, full_name TEXT, stars INTEGER, captured_at TEXT, PRIMARY KEY(term, full_name, captured_at))` — baselines for growth deltas. Index on `(term, captured_at)`.
- **D-03:** Access D1 via `getCloudflareContext().env.DB` (OpenNext) in a thin `app/lib/db.ts` data-access module — **all SQL lives here**, parameterized (no string interpolation → no SQLi). Routes/handlers call typed functions (`createSubscription`, `verifySubscription`, `unsubscribe`, `listSubscriptions`, `getLatestSnapshot`, `writeSnapshots`, …).

### Crossing-detection logic — PURE + UNIT-TESTABLE (the verifiable core)
- **D-04:** A pure module `app/lib/alerts.ts` exporting `detectCrossings(subscription, latestRepos, priorSnapshot)` returning the repos that crossed, computed by metric: `stars_abs` (stars passed threshold), `stars_pct` (% growth over window_days vs prior snapshot ≥ threshold), `velocity` (stars/day ≥ threshold). NO I/O — takes data in, returns crossings. Fully unit-testable with fixtures.
- **D-05:** The scheduled job orchestrator (`runAlertSweep(env)`): load DISTINCT subscribed terms (dedupe!), for each call `fetchTrendingCached` (Phase 1) ONCE per distinct term (coalesced), diff vs latest snapshot via `detectCrossings`, for matched+verified subs whose `last_notified_at` doesn't already cover this crossing → `sendEmail()` the repo card + why it fired, set `last_notified_at`, then write fresh snapshots. Idempotent (re-running same data sends nothing new). Never blocks on a slow upstream (Phase 1's AbortSignal budget).

### Cron wiring (RESEARCH REQUIRED — the one real unknown)
- **D-06:** Add a `triggers.crons` entry to `wrangler.jsonc`. The scheduled handler must invoke `runAlertSweep`. **HOW to expose a `scheduled()` handler on an OpenNext-wrapped Next app is the open research question** (custom worker entry / OpenNext `scheduled` support / a separate scheduled Worker that hits an authed internal route). The researcher MUST determine the supported pattern for `@opennextjs/cloudflare` + Next 16. If no clean in-app pattern exists, fall back to: a thin authed internal route (`POST /api/notifications/sweep` guarded by a `CRON_SECRET`) invoked by the cron — and document it. Either way, the SWEEP LOGIC (D-05) is identical and testable independent of the trigger.

### Delivery & flow
- **D-07:** Double opt-in: on subscribe, store unverified + `verify_token`, email a verify link (`/api/notifications/verify?token=…`); alerts only fire for `verified_at IS NOT NULL`. One-click unsubscribe via `unsub_token` (`/api/notifications/unsubscribe?token=…`), present in every alert email footer.
- **D-08:** Build on the v1 surfaces: extend `app/api/notifications/subscribe/route.ts` (replace in-memory array with `db.ts`), reuse `app/lib/notifications.ts` helpers + the email composition (replace `buildDummyTrendEmail` with a real alert email via `sendEmail()` + `escapeHtml`).
- **D-09:** Digest vs instant: keep simple for v1 — instant (send on detection). A `digest` preference field is stored but the cron sends instant; digest batching is deferred.

### Alerts UI
- **D-10:** Extend the existing `NotificationSignup` into an "Alerts" panel (create with term + kind + metric + threshold + window; list active alerts; remove/unsubscribe). Reuse dashboard styling + the panel patterns (like TagsPanel/HeaderControls). On-brand; do NOT touch frozen contracts. Use the same green/blue/yellow/red gradient language for threshold UI where relevant (AGENTS.md slider/score color contract).

### Human handoffs (deploy/account-gated — flag, don't block)
- **D-11:** Applying migrations to the REMOTE D1 (`wrangler d1 migrations apply reporadar --remote`), deploying the Cron Trigger, and the live end-to-end sweep with the prod app-owned `GITHUB_TOKEN` are owner/deploy-gated. The executor builds + verifies everything LOCALLY (local D1 + seeded fixtures + a manual sweep invocation) and stops at a green PR. Also: `CRON_SECRET` (if the internal-route fallback is used) is an owner-supplied secret.

### Claude's Discretion
- Token format (UUID/crypto random), exact table indexes, panel layout details, whether snapshots are pruned, the precise crossing-dedupe rule keyed off `last_notified_at` + crossing identity.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase brief
- `BUILD-BRIEF.md` — WS2 (data shapes, scheduled-job behavior, delivery, UI, acceptance, out-of-scope).
- `.planning/intel/requirements.md` — `REQ-threshold-alerts` (ALRT-01..05) acceptance criteria.

### Surfaces to build on
- `app/api/notifications/subscribe/route.ts` — v1 in-memory scaffold to replace with D1.
- `app/lib/notifications.ts` — `normalizeEmail/normalizeSources/normalizeDigest`, `buildDummyTrendEmail` (replace dummy with real), types `NotificationSubscription`.
- `app/components/NotificationSignup.tsx` — extend into the Alerts panel (already fires `track("alert_signup")` from Phase 2).
- `app/lib/email.ts` — `sendEmail()` + `escapeHtml` (Phase 1) — verify + alert + unsubscribe-footer emails.
- `app/lib/trendingCache.ts` / `app/lib/github.ts` — `fetchTrendingCached` (Phase 1) — the rate-safe, term-coalesced fetch the sweep uses.

### D1 reference
- `workers/deploy/wrangler.toml` — the existing `[[d1_databases]] binding="DB" database_name="reporadar" database_id="ba6ce5a3-..."` to reuse the shape of.
- `workers/deploy/src/index.ts` — an existing example of D1 access (`env.DB`) in this repo.

### Platform docs (MANDATORY before writing cron/D1/Worker code)
- `node_modules/next/dist/docs/` — relevant Next 16 docs for route handlers.
- `@opennextjs/cloudflare` docs + Cloudflare docs for **Cron Triggers + the `scheduled()` handler** and **D1 from OpenNext (`getCloudflareContext().env.DB`)** + **`wrangler d1 migrations`** — the researcher fetches these (the cron-on-OpenNext mechanism is the gating unknown).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 1 `sendEmail()`, `escapeHtml`, `fetchTrendingCached`; v1 notifications scaffold + helpers; existing D1 `reporadar` database.

### Established Patterns
- Routes `runtime="nodejs"`; graceful degradation without keys; in-memory rate-limit pattern (contact route) reusable for subscribe abuse-guard; parameterized everything (no interpolation).

### Integration Points
- `wrangler.jsonc` (add D1 binding + `triggers.crons`), `app/api/notifications/*` (subscribe/verify/unsubscribe/sweep), `app/lib/{db,alerts}.ts` (new), `NotificationSignup` → Alerts panel, new `migrations/`.
</code_context>

<specifics>
## Specific Ideas
- The alert email shows the repo card + a plain "why it fired" line (e.g. "hermes repo `owner/x` gained 23% stars this week, crossing your 20% threshold").
- Idempotency is the headline acceptance criterion: the cron must NEVER double-send. Test it explicitly (run the sweep twice on the same fixture → one email).
</specifics>

<deferred>
## Deferred Ideas
- Digest batching (store the pref now, send instant for v1); SMS/push; per-repo alerts; a preferences center; snapshot pruning/retention policy. (All later.)
</deferred>

---

*Phase: 03-threshold-alerts*
*Context gathered: 2026-05-27 via discuss-phase --auto*
