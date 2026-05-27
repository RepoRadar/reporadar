# Phase 3: Threshold Alerts - Research

**Researched:** 2026-05-27
**Domain:** Cloudflare Cron Triggers + `scheduled()` on an OpenNext-wrapped Next.js 16 app; D1 (reuse existing DB) + migrations; idempotent email alert sweep
**Confidence:** HIGH (cron mechanism, D1 access, migrations all verified against installed code + official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Bind the **existing** D1 database `reporadar` (`database_id ba6ce5a3-54e5-449a-9371-178eda6de8a3`, already used by `workers/deploy`) into the MAIN app's `wrangler.jsonc` as `{ "binding": "DB", "database_name": "reporadar", "database_id": "ba6ce5a3-..." }`. **No new DB provisioning** — the database exists; we only add tables.
- **D-02:** Schema (migrations in a new `migrations/` dir, applied via `wrangler d1 migrations apply reporadar` — `--local` for tests; `--remote` is a deploy-gated human step):
  - `subscriptions(id TEXT PK, email TEXT, kind TEXT['topic'|'query'], term TEXT, metric TEXT['stars_pct'|'stars_abs'|'velocity'], threshold REAL, window_days INTEGER, created_at TEXT, verified_at TEXT NULL, last_notified_at TEXT NULL, verify_token TEXT, unsub_token TEXT)`
  - `repo_snapshots(term TEXT, full_name TEXT, stars INTEGER, captured_at TEXT, PRIMARY KEY(term, full_name, captured_at))` — baselines for growth deltas. Index on `(term, captured_at)`.
- **D-03:** Access D1 via `getCloudflareContext().env.DB` (OpenNext) in a thin `app/lib/db.ts` data-access module — **all SQL lives here**, parameterized (no string interpolation → no SQLi). Routes/handlers call typed functions (`createSubscription`, `verifySubscription`, `unsubscribe`, `listSubscriptions`, `getLatestSnapshot`, `writeSnapshots`, …).
- **D-04:** A pure module `app/lib/alerts.ts` exporting `detectCrossings(subscription, latestRepos, priorSnapshot)` returning the repos that crossed, computed by metric: `stars_abs`, `stars_pct` (% growth over window_days vs prior snapshot ≥ threshold), `velocity` (stars/day ≥ threshold). NO I/O. Fully unit-testable with fixtures.
- **D-05:** The scheduled job orchestrator (`runAlertSweep(env)`): load DISTINCT subscribed terms (dedupe!), for each call `fetchTrendingCached` ONCE per distinct term (coalesced), diff vs latest snapshot via `detectCrossings`, for matched+verified subs whose `last_notified_at` doesn't already cover this crossing → `sendEmail()` + set `last_notified_at`, then write fresh snapshots. Idempotent. Never blocks on a slow upstream (Phase 1's AbortSignal budget).
- **D-06:** Add a `triggers.crons` entry to `wrangler.jsonc`. The scheduled handler must invoke `runAlertSweep`. (HOW = THIS RESEARCH; see RECOMMENDATION below.) Fallback: a thin authed internal route (`POST /api/notifications/sweep` guarded by a `CRON_SECRET`). Either way the SWEEP LOGIC (D-05) is identical and testable independent of the trigger.
- **D-07:** Double opt-in: store unverified + `verify_token`, email a verify link (`/api/notifications/verify?token=…`); alerts only fire for `verified_at IS NOT NULL`. One-click unsubscribe via `unsub_token` (`/api/notifications/unsubscribe?token=…`), in every alert email footer.
- **D-08:** Build on v1 surfaces: extend `app/api/notifications/subscribe/route.ts` (replace in-memory array with `db.ts`), reuse `app/lib/notifications.ts` helpers + email composition (replace `buildDummyTrendEmail` with a real alert email via `sendEmail()` + `escapeHtml`).
- **D-09:** Digest vs instant: keep simple for v1 — instant (send on detection). A `digest` preference field is stored but the cron sends instant; digest batching deferred.
- **D-10:** Extend the existing `NotificationSignup` into an "Alerts" panel (create with term + kind + metric + threshold + window; list active alerts; remove/unsubscribe). Reuse dashboard styling + panel patterns. On-brand; do NOT touch frozen contracts. Use the green/blue/yellow/red gradient language for threshold UI where relevant.
- **D-11:** Applying migrations to the REMOTE D1 (`--remote`), deploying the Cron Trigger, and the live end-to-end sweep with the prod app-owned `GITHUB_TOKEN` are owner/deploy-gated. The executor builds + verifies everything LOCALLY (local D1 + seeded fixtures + a manual sweep invocation) and stops at a green PR. `CRON_SECRET` (if internal-route fallback) is an owner-supplied secret.

### Claude's Discretion
- Token format (UUID/crypto random), exact table indexes, panel layout details, whether snapshots are pruned, the precise crossing-dedupe rule keyed off `last_notified_at` + crossing identity.

### Deferred Ideas (OUT OF SCOPE)
- Digest batching (store the pref now, send instant for v1); SMS/push; per-repo alerts; a preferences center; snapshot pruning/retention policy. (All later.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALRT-01 | D1 schema for `subscriptions` + `repo_snapshots` | Migrations workflow + binding (Standard Stack, Migrations section). Reuse existing `reporadar` DB via a second binding — verified safe (no conflict; D1 tables are namespaced per-DB, both Workers just `CREATE TABLE IF NOT EXISTS`). |
| ALRT-02 | Cron Trigger diffs distinct terms over `window_days`, idempotent + rate-safe | **Custom worker entrypoint** adds `scheduled()` (RECOMMENDATION). `fetchTrendingCached` coalesces per distinct term. Idempotency via `last_notified_at` + crossing identity. |
| ALRT-03 | On crossing → ONE email; `last_notified_at` dedupes; fresh snapshots written | Pure `detectCrossings` + `runAlertSweep` orchestration; dedupe pattern (Pitfalls). |
| ALRT-04 | Double opt-in + one-click unsub + digest-vs-instant via `sendEmail()` | `crypto.randomUUID()` for tokens (verified available in Workers). Existing `sendEmail()` + `escapeHtml`. Verify/unsub routes. |
| ALRT-05 | Alerts UI panel create/manage/list/unsub | Extend `NotificationSignup`; reuse panel + gradient contracts (AGENTS.md). |
</phase_requirements>

## Summary

The single gating unknown — "how do you run a `scheduled()` cron handler on an OpenNext-wrapped Next 16 app?" — has a clean, officially-supported answer for the installed version (`@opennextjs/cloudflare@1.19.8`): a **custom worker entrypoint**. The OpenNext-generated `.open-next/worker.js` exports a `default` object with only a `fetch` handler (verified by reading the generated file). OpenNext does not inject a `scheduled` handler and exposes no hook for one — but it officially documents wrapping the generated handler in a tiny custom worker that re-exports `fetch` and adds your own `async scheduled()`. You point wrangler's `main` at that custom file and add `triggers.crons`.

D1 access from OpenNext is via `getCloudflareContext().env.DB` (verified in the installed type definitions). It works in `nodejs` route handlers. The important subtlety: **in a `scheduled()` context the cleanest path is to pass `env` directly to `runAlertSweep(env)`** rather than relying on `getCloudflareContext()`, because the custom worker's `scheduled(controller, env, ctx)` already receives `env`. Reusing the existing `reporadar` database by adding a second `DB` binding to the main app's `wrangler.jsonc` is sound — D1 has no exclusive-owner concept, both Workers simply issue SQL, and `CREATE TABLE IF NOT EXISTS` migrations don't conflict with `workers/deploy`'s `deploys` table.

Everything except the live remote deploy is locally verifiable: `wrangler d1 migrations apply reporadar --local` against miniflare's `.wrangler/state` SQLite, `wrangler dev --test-scheduled` + `curl /__scheduled` to fire the cron locally, and direct unit tests of the pure `detectCrossings` and the `runAlertSweep(fakeEnv)` orchestrator with a local D1. The remote `--remote` migration, the cron deploy, and the live sweep with the prod `GITHUB_TOKEN` are the only deploy-gated steps (D-11).

**Primary recommendation:** Add a custom worker entrypoint (`worker.ts` at repo root) that does `fetch: handler.fetch` + `async scheduled(controller, env, ctx) { ctx.waitUntil(runAlertSweep(env)) }`, re-export the OpenNext DO classes, point `wrangler.jsonc` `main` at it, add the `DB` binding and `triggers.crons`. Keep `runAlertSweep(env)` env-injected (not `getCloudflareContext`-dependent) so it is trivially unit-testable. Use `crypto.randomUUID()` for verify/unsub tokens.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cron scheduling | Cloudflare Workers runtime (custom worker `scheduled`) | — | Cron Triggers invoke the Worker's `scheduled()` export; no app-tier scheduler exists in Workers. |
| Sweep orchestration (`runAlertSweep`) | API / Backend (lib) | Workers runtime (invoked by `scheduled`) | Pure-ish orchestrator; takes `env`, does I/O via D1 + fetch. Tier-agnostic by design so the same code runs from cron OR an internal route. |
| Crossing detection (`detectCrossings`) | API / Backend (pure lib) | — | No I/O. Pure function. Unit-testable. |
| Subscription persistence (`db.ts`) | Database / Storage (D1) | API (route handlers) | All SQL centralized; routes/scheduled call typed fns. |
| Subscribe / verify / unsubscribe routes | API / Backend (Next route handlers, `runtime="nodejs"`) | — | HTTP endpoints; D1 via `getCloudflareContext().env.DB`. |
| Email delivery | API / Backend (`sendEmail` → Resend) | — | Existing Phase 1 lib; fetch to Resend. |
| Alerts panel | Frontend (React client component) | API | Extends `NotificationSignup`; calls the API routes. |
| Trending fetch (`fetchTrendingCached`) | API / Backend (lib, module cache) | GitHub API (external) | Phase 1 coalesced/cached fetch reused by the sweep. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opennextjs/cloudflare` | `1.19.8` (installed) `[VERIFIED: node_modules/@opennextjs/cloudflare/package.json]` | Wraps Next 16 build for Workers; provides `getCloudflareContext`, `defineCloudflareConfig` | Already the repo's deploy adapter |
| `next` | `16.2.6` (installed) `[VERIFIED: package.json]` | App framework; route handlers with `export const runtime = "nodejs"` | Existing |
| `wrangler` | `^4.90.0` (installed) `[VERIFIED: package.json]` | D1 migrations, `dev --test-scheduled`, deploy | Existing; cron + D1 CLI |
| Cloudflare D1 (`reporadar`) | existing DB `ba6ce5a3-…` `[VERIFIED: workers/deploy/wrangler.toml]` | Subscriptions + snapshots persistence | Reuse per D-01 |
| `crypto.randomUUID()` | Workers runtime built-in `[CITED: developers.cloudflare.com — Web Crypto is globally available in Workers]` | verify_token / unsub_token / subscription id | No dep; standard, collision-safe |

### Supporting (already in repo — reuse, do not re-add)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `sendEmail()` (`app/lib/email.ts`) | Resend delivery, key-absent no-op, CRLF-stripped subject | verify email, alert email, (unsub is a link, no email) |
| `escapeHtml()` (`app/lib/email.ts`) | HTML escaping for interpolated repo/term strings | every alert/verify HTML body |
| `fetchTrendingCached()` (`app/lib/trendingCache.ts`) | 5-min TTL + in-flight coalescing wrapper over `fetchTrending` | sweep: one upstream call per distinct term |
| `normalizeEmail` / `normalizeSources` / `normalizeDigest` (`app/lib/notifications.ts`) | input normalization | subscribe route |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom worker entrypoint (`scheduled` in-process) | Separate scheduled Worker → authed `POST /api/notifications/sweep` (CRON_SECRET) | Fallback only. Adds a network hop + a shared secret + a public-ish route to guard. Custom worker is simpler, runs sweep in the same Worker with direct `env.DB`. Keep as documented fallback (D-06) but recommend the custom worker. |
| `crypto.randomUUID()` | `nanoid` / `crypto.getRandomValues` | No need for a dep; UUID v4 is unguessable enough for opt-in tokens. |

**Installation:** No new npm packages required. All capabilities use existing deps + Workers runtime built-ins.

**Version verification:** `@opennextjs/cloudflare` confirmed at `1.19.8` by reading `node_modules/@opennextjs/cloudflare/package.json`. The custom-worker API (`import { default as handler } from "./.open-next/worker.js"; export default { fetch: handler.fetch, async scheduled(){} }`) is the documented pattern for the 1.x line. `[VERIFIED: installed pkg]` `[CITED: opennext.js.org/cloudflare/howtos/custom-worker]`

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────┐
   Cloudflare Cron  ──────▶  Custom Worker (worker.ts)           │
   Trigger (crons)         │  ┌─────────────┐  ┌──────────────┐  │
                           │  │ fetch:      │  │ scheduled(    │  │
   HTTPS request    ──────▶│  │  handler.   │  │  ctrl,env,ctx)│  │
                           │  │  fetch      │  │  → waitUntil( │  │
                           │  │ (OpenNext)  │  │   runAlert    │  │
                           │  └──────┬──────┘  │   Sweep(env)) │  │
                           │         │         └──────┬────────┘  │
                           └─────────┼────────────────┼──────────-┘
                                     │                │
                  ┌──────────────────▼──┐             │
                  │ Next route handlers │             │
                  │ /api/notifications/ │             ▼
                  │  subscribe          │     runAlertSweep(env)
                  │  verify             │     1. db.listDistinctTerms()  ── dedupe
                  │  unsubscribe        │     2. for each term:
                  │  (sweep* fallback)  │          fetchTrendingCached(term) ──▶ GitHub API
                  └─────────┬───────────┘     3. db.getLatestSnapshot(term)
                            │                 4. detectCrossings(sub, repos, prior)  ── PURE
                            │                 5. for verified + uncovered crossing:
                            ▼                       sendEmail() ──▶ Resend
                  getCloudflareContext()            db.setLastNotified()
                       .env.DB                 6. db.writeSnapshots(term, repos)
                            │                            │
                            ▼                            ▼
                  ┌─────────────────────────────────────────┐
                  │  D1: reporadar (EXISTING db, shared)      │
                  │  subscriptions │ repo_snapshots │ deploys │
                  │  (new)          (new)             (existing,│
                  │                                   workers/deploy)│
                  └─────────────────────────────────────────┘

  *sweep route = fallback path only (D-06); same runAlertSweep(env).
```

A reader traces: cron fires → `scheduled()` → `runAlertSweep(env)` → dedupe terms → coalesced GitHub fetch → pure crossing detection vs prior snapshot → send-once email + mark `last_notified_at` → write fresh snapshots. The sweep logic is identical whether triggered by cron or the fallback route.

### Recommended Project Structure
```
worker.ts                              # NEW — custom entrypoint: fetch + scheduled
migrations/
├── 0001_alerts_init.sql               # NEW — subscriptions + repo_snapshots + indexes
app/lib/
├── db.ts                              # NEW — ALL SQL, parameterized, typed fns
├── alerts.ts                          # NEW — pure detectCrossings + runAlertSweep
├── email.ts                           # reuse sendEmail/escapeHtml
├── trendingCache.ts                   # reuse fetchTrendingCached
├── notifications.ts                   # reuse normalizers; replace buildDummyTrendEmail
app/api/notifications/
├── subscribe/route.ts                 # EDIT — D1 instead of in-memory; create unverified + token + send verify email
├── verify/route.ts                    # NEW — GET ?token=… → set verified_at
├── unsubscribe/route.ts               # NEW — GET ?token=… → delete/disable sub
├── sweep/route.ts                     # NEW (fallback only) — POST guarded by CRON_SECRET → runAlertSweep
app/components/
├── NotificationSignup.tsx             # EDIT — extend into Alerts panel
tests/                                 # alerts.detectCrossings unit; runAlertSweep idempotency (local D1)
```

### Pattern 1: Custom Worker Entrypoint with `scheduled()`  [RECOMMENDED — resolves D-06]
**What:** Wrap the OpenNext-generated fetch handler; add a `scheduled` handler that calls `runAlertSweep(env)`.
**When to use:** This is THE supported way to add a cron handler to an OpenNext app on the 1.x line.
**Example:**
```typescript
// worker.ts (repo root)  — Source: opennext.js.org/cloudflare/howtos/custom-worker
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { runAlertSweep } from "./app/lib/alerts";

export default {
  fetch: handler.fetch,

  async scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    // waitUntil keeps the invocation alive for the async sweep; first failure
    // is recorded in the Cron Trigger "Past Events" table.
    ctx.waitUntil(runAlertSweep(env));
  },
} satisfies ExportedHandler<CloudflareEnv>;

// REQUIRED re-export — this app uses the R2 incremental cache; the DO Queue /
// DO Tag Cache classes are referenced by the generated worker. Re-export to keep
// them registered when wrangler bundles THIS file as the entry.
// @ts-ignore generated at build time
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
```
`scheduled` signature is `(controller, env, ctx)` where `controller.cron` / `controller.scheduledTime` identify the trigger. `[CITED: developers.cloudflare.com/workers/runtime-apis/handlers/scheduled]`

> **Build-order caveat (verify during planning/exec):** the generated `.open-next/worker.js` must exist *before* wrangler bundles `worker.ts`. `opennextjs-cloudflare build` produces it; `opennextjs-cloudflare deploy`/`preview` run the build then invoke wrangler. It is **not 100% confirmed** that `opennextjs-cloudflare deploy` honors a custom `main` pointing away from `.open-next/worker.js` vs. requiring a plain `wrangler deploy` after build. Plan a task to verify locally with `opennextjs-cloudflare build` then `wrangler dev`/`wrangler deploy`. The DO re-export above is what the example uses to keep caching DOs registered. `[ASSUMED]` for the deploy-command interplay; `[CITED]` for the worker shape. **This only affects the deploy step (D-11, owner-gated), not local verification.**

### Pattern 2: `runAlertSweep(env)` — env-injected, not context-coupled
**What:** Accept `env` as an argument so the same function runs from `scheduled(controller, env, ctx)` AND from a route handler / unit test.
**When to use:** Always. Do NOT call `getCloudflareContext()` inside `runAlertSweep` — that couples it to a request context and makes it hard to test.
**Example:**
```typescript
// app/lib/alerts.ts
export async function runAlertSweep(env: { DB: D1Database }): Promise<{ sent: number; scanned: number }> {
  const terms = await listDistinctTerms(env.DB);            // dedupe at SQL level
  let sent = 0;
  for (const term of terms) {
    const repos = await fetchTrendingCached({ topic: term.kind === "topic" ? term.term : undefined,
                                              query: term.kind === "query" ? term.term : undefined });
    const prior = await getLatestSnapshot(env.DB, term.term);
    for (const sub of await listVerifiedSubsForTerm(env.DB, term.term)) {
      const crossings = detectCrossings(sub, repos, prior);  // PURE
      for (const c of crossings) {
        if (alreadyNotified(sub, c)) continue;               // last_notified_at + crossing identity
        await sendAlertEmail(sub, c);
        await setLastNotified(env.DB, sub.id, c, new Date().toISOString());
        sent++;
      }
    }
    await writeSnapshots(env.DB, term.term, repos);          // fresh baselines AFTER detection
  }
  return { sent, scanned: terms.length };
}
```
In **route handlers** (subscribe/verify/unsubscribe), get the DB the OpenNext way:
```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";
const { env } = getCloudflareContext();        // sync form OK inside a request
const db = env.DB;                              // typed as D1Database
```
`getCloudflareContext()` is exported by `@opennextjs/cloudflare` and returns `{ env, cf, ctx }`; `env.DB` is the bound D1. `[VERIFIED: node_modules/@opennextjs/cloudflare/dist/api/cloudflare-context.d.ts]`

### Pattern 3: Parameterized D1 (no interpolation)
```typescript
// app/lib/db.ts  — Source: workers/deploy/src/index.ts (existing in-repo D1 pattern)
await env.DB.prepare(
  `INSERT INTO subscriptions (id, email, kind, term, metric, threshold, window_days, created_at, verify_token, unsub_token)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).bind(id, email, kind, term, metric, threshold, windowDays, now, verifyToken, unsubToken).run();
```
Use `.bind()` for every value (matches `workers/deploy`'s style; satisfies D-03 / AGENTS.md "parameterized everything").

### Anti-Patterns to Avoid
- **Calling `getCloudflareContext()` inside `runAlertSweep`** — couples sweep to a request context, breaks unit tests and the `scheduled` path. Pass `env` instead.
- **Writing fresh snapshots BEFORE detecting crossings** — you'd diff against today's data and never detect a crossing. Detect first, then overwrite the baseline.
- **String-interpolating `term`/`email` into SQL** — SQLi + breaks on quotes. Always `.bind()`.
- **Relying on `getCloudflareContext({async:true})` in routes when sync works** — sync `getCloudflareContext()` is fine inside a Next route handler; the async form exists for static/non-request contexts. Don't over-reach.
- **Forgetting the DO re-export in the custom worker** — this app uses the R2 incremental cache and references DO classes from the generated worker; dropping the re-export can break caching at deploy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Run code on a schedule | A self-pinging loop / setInterval | Cloudflare Cron Trigger → `scheduled()` | Workers have no long-lived process; cron is the platform primitive. |
| Add `scheduled` to OpenNext | Forking/patching `.open-next/worker.js` | The documented custom worker entrypoint | Official, survives rebuilds (regenerated file is imported, not edited). |
| Schema versioning | Ad-hoc `CREATE TABLE` on boot | `wrangler d1 migrations` (`migrations/` + `d1_migrations` tracking) | Tracked, idempotent, `--local`/`--remote` parity. |
| Unguessable tokens | Hand-rolled random strings | `crypto.randomUUID()` | Built-in, CSPRNG-backed, no deps. |
| Rate-safe multi-term fetch | New fetch logic in the sweep | `fetchTrendingCached` (Phase 1) | Already TTL-cached + in-flight coalesced; one upstream call per distinct term. |
| Email send | New Resend client | `sendEmail()` (Phase 1) | Key-absent no-op, CRLF-stripped subject, never throws. |

**Key insight:** Almost everything new in this phase is *orchestration* of existing primitives. The only genuinely new infra is the custom worker entrypoint + the two D1 tables; the rest is pure logic (`detectCrossings`) and glue (`db.ts`, routes, panel).

## Runtime State Inventory

> Rename/migration-style concerns for binding a shared DB into a second Worker.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `reporadar` D1 contains `deploys` table (from `workers/deploy`). New `subscriptions` + `repo_snapshots` tables are additive. `[VERIFIED: workers/deploy/migrations/0001_init.sql]` | Add migration creating the two new tables; do NOT touch `deploys`. |
| Live service config | The `reporadar` D1 database is already provisioned (`database_id ba6ce5a3-…`). Cron Trigger config will live in `wrangler.jsonc` (in git). | Add `DB` binding + `triggers.crons` to main `wrangler.jsonc`. |
| OS-registered state | None — cron lives in Cloudflare, declared via wrangler config. | None. |
| Secrets/env vars | `RESEND_API_KEY`, `RESEND_FROM` already used by `sendEmail`. If the FALLBACK route is chosen, a new `CRON_SECRET` is needed (owner-supplied). `GITHUB_TOKEN` already app-owned (PRE-01). | If custom-worker path: no new secret. If fallback route: owner sets `CRON_SECRET` (D-11). |
| Build artifacts | `.open-next/worker.js` is regenerated each build; `worker.ts` imports it (not edited), so no stale-artifact risk. Local `.wrangler/state` holds the local D1. `[VERIFIED: .wrangler/state exists]` | None beyond running `opennextjs-cloudflare build` before bundling the custom entry. |

**Shared-DB safety:** D1 has no exclusive-owner lock; two Workers binding the same `database_id` is supported. Both `workers/deploy` and the main app issue independent SQL; table names don't collide (`deploys` vs `subscriptions`/`repo_snapshots`). Migrations run from the main app's `migrations/` dir won't disturb the `deploys` table. `[CITED: developers.cloudflare.com/d1 — bindings are references, not ownership]` `[VERIFIED: distinct table names by reading both schemas]`

## Common Pitfalls

### Pitfall 1: Double-send (the headline acceptance criterion, ALRT-03)
**What goes wrong:** Re-running the sweep on the same data sends a second email.
**Why it happens:** `last_notified_at` is treated as a single timestamp without binding it to the *crossing identity* (which repo crossed which threshold). A new run sees the same crossing and re-fires.
**How to avoid:** Define a stable **crossing identity** (e.g. `subscription.id + full_name + metric + threshold`, or simpler: only re-notify if the repo's value has crossed *again* after a reset). Simplest robust rule for v1: once a sub has `last_notified_at` set for the current crossing, skip until the metric drops back below threshold (or for a cooldown window). Store enough to answer "did I already tell this subscriber about THIS crossing?" Test explicitly: run `runAlertSweep` twice on the same fixture → assert exactly one `sendEmail` call.
**Warning signs:** Idempotency test sends 2 emails on the second invocation.

### Pitfall 2: Snapshot ordering (silent no-detection)
**What goes wrong:** No crossings ever detected.
**Why it happens:** Writing fresh snapshots before `detectCrossings`, so "prior" == "current".
**How to avoid:** Detect against the PRIOR snapshot first, then write the new snapshot (Pattern 2 order). `stars_pct`/`velocity` need a genuinely older baseline within `window_days`.
**Warning signs:** `detectCrossings` always returns `[]` for pct/velocity in tests.

### Pitfall 3: GitHub rate budget across many distinct terms
**What goes wrong:** A sweep with many subscriptions exhausts the GitHub rate budget.
**Why it happens:** One fetch per subscription instead of per distinct term.
**How to avoid:** `listDistinctTerms` dedupes at SQL level; `fetchTrendingCached` coalesces concurrent identical keys and TTL-caches non-empty results (5 min). The sweep loops over DISTINCT terms only (D-05). `fetchTrending` already fails fast via `AbortSignal.timeout(FETCH_BUDGET_MS)`. `[VERIFIED: app/lib/trendingCache.ts, app/lib/github.ts]`
**Warning signs:** 403s in Worker logs traced to the shared token (the exact PRE-02 symptom Phase 1 fixed).

### Pitfall 4: Worker CPU/time limits in `scheduled`
**What goes wrong:** Sweep times out / hits CPU limits with many terms.
**Why it happens:** Scheduled invocations are still Worker invocations; a long serial loop with many upstream fetches can exceed limits.
**How to avoid:** Use `ctx.waitUntil(runAlertSweep(env))` so async work is tracked. Keep per-term work bounded (the AbortSignal budget caps each fetch). For v1 the term count is small; if it grows, batch D1 writes and consider chunking. D1 has per-query limits — use `.batch()` for multi-row snapshot writes rather than N sequential `.run()` calls. `[CITED: developers.cloudflare.com/d1 — batch for multiple statements]` `[ASSUMED]` exact CPU limit number not pinned here (docs didn't surface a specific figure); flag as a scale concern, not a v1 blocker.
**Warning signs:** Cron "Past Events" shows failures/timeouts after subscription growth.

### Pitfall 5: Verify/unsub token guessability + HTML injection
**What goes wrong:** Tokens guessable, or repo/term strings break the email HTML.
**How to avoid:** `crypto.randomUUID()` for tokens; `escapeHtml()` every interpolated `term`, `full_name`, `email`, description in alert/verify bodies (reuse Phase 1 helper). `[VERIFIED: escapeHtml in app/lib/email.ts]`

## Code Examples

### Migration file (ALRT-01)
```sql
-- migrations/0001_alerts_init.sql  (applied: wrangler d1 migrations apply reporadar --local|--remote)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  kind TEXT NOT NULL,          -- 'topic' | 'query'
  term TEXT NOT NULL,
  metric TEXT NOT NULL,        -- 'stars_pct' | 'stars_abs' | 'velocity'
  threshold REAL NOT NULL,
  window_days INTEGER NOT NULL,
  digest TEXT,                 -- pref stored; v1 sends instant (D-09)
  created_at TEXT NOT NULL,
  verified_at TEXT,            -- NULL until double opt-in confirmed
  last_notified_at TEXT,       -- dedupe (see Pitfall 1)
  verify_token TEXT NOT NULL,
  unsub_token TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subs_term ON subscriptions(term);
CREATE INDEX IF NOT EXISTS idx_subs_verify_token ON subscriptions(verify_token);
CREATE INDEX IF NOT EXISTS idx_subs_unsub_token ON subscriptions(unsub_token);

CREATE TABLE IF NOT EXISTS repo_snapshots (
  term TEXT NOT NULL,
  full_name TEXT NOT NULL,
  stars INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (term, full_name, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_term_time ON repo_snapshots(term, captured_at);
```

### wrangler.jsonc additions (D-01, D-06)
```jsonc
// add to wrangler.jsonc
"main": "worker.ts",                 // CHANGED from ".open-next/worker.js" — custom entry (verify deploy interplay, D-11)
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "reporadar",
    "database_id": "ba6ce5a3-54e5-449a-9371-178eda6de8a3",
    "migrations_dir": "migrations"
  }
],
"triggers": {
  "crons": ["0 */6 * * *"]           // example: every 6h — exact cadence at planner/owner discretion
}
```
`triggers.crons` is an array of cron expressions; each fires the same `scheduled()`. `[CITED: developers.cloudflare.com/workers/configuration/cron-triggers]`

### Local cron test (no deploy — D-11 boundary)
```bash
# 1. apply migrations to the LOCAL miniflare D1
wrangler d1 migrations apply reporadar --local

# 2. (separately seed fixtures via wrangler d1 execute reporadar --local --command "INSERT ...")

# 3. run dev with the scheduled test route exposed
opennextjs-cloudflare build          # generates .open-next/worker.js first
wrangler dev --test-scheduled        # exposes /__scheduled

# 4. fire the cron locally
curl "http://localhost:8787/__scheduled?cron=0+*/6+*+*+*"
```
`[CITED: developers.cloudflare.com/workers/runtime-apis/handlers/scheduled — --test-scheduled + /__scheduled]`

> **Preferred local verification (fastest, no build):** unit-test `detectCrossings` with pure fixtures, and unit-test `runAlertSweep(fakeEnv)` where `fakeEnv.DB` is a local D1 (via `wrangler d1` or a stub). Assert: (a) crossings detected correctly per metric, (b) running the sweep twice on identical data sends exactly one email (idempotency). This is the core acceptance evidence and needs NO deploy and NO real keys (`sendEmail` no-ops without `RESEND_API_KEY`; assert it's called, not that mail arrives).

### Verify/unsub token + route (ALRT-04)
```typescript
const verifyToken = crypto.randomUUID();   // built-in CSPRNG, available in Workers
const unsubToken  = crypto.randomUUID();
// verify: GET /api/notifications/verify?token=… → UPDATE subscriptions SET verified_at=? WHERE verify_token=?
// unsub:  GET /api/notifications/unsubscribe?token=… → DELETE / disable WHERE unsub_token=?
```
`crypto.randomUUID()` is a Workers runtime global (Web Crypto). `[CITED: developers.cloudflare.com/workers/runtime-apis/web-crypto]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Patch the generated `worker.js` to add `scheduled` | Custom worker entrypoint that imports the generated handler | OpenNext Cloudflare 1.x | Survives rebuilds; officially documented. |
| In-memory subscription array (v1 scaffold) | D1-backed `db.ts` | This phase | Persistence + idempotency become possible. |
| `buildDummyTrendEmail` | Real alert email via `sendEmail()` + `escapeHtml` | This phase (D-08) | Real delivery. |

**Deprecated/outdated:**
- The current `subscribe/route.ts` module-level `queuedNotifications` array — replace with D1 (it doesn't survive cold starts and isn't shared across isolates). `[VERIFIED: app/api/notifications/subscribe/route.ts]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `opennextjs-cloudflare deploy` correctly bundles a custom `main: worker.ts` (vs. needing a plain `wrangler deploy` after `opennextjs-cloudflare build`) | Pattern 1 caveat | Deploy step (owner-gated, D-11) needs the right command. Does NOT affect local build/test. Plan a verify task. |
| A2 | Exact Worker CPU/duration limit for `scheduled` not pinned (docs didn't surface a number) | Pitfall 4 | Only matters at scale; v1 term count is small. Flag, don't block. |
| A3 | A single `last_notified_at` + crossing-identity rule is sufficient for "exactly once" for v1 | Pitfall 1 | If the dedupe rule is too coarse, legitimate re-crossings are missed; too fine, double-sends. Planner to pin the exact rule (Claude's discretion per D-11/decisions). |

## Open Questions

1. **Exact cron cadence** — `["0 */6 * * *"]` is a placeholder. Recommendation: planner picks a cadence balancing freshness vs. GitHub budget; owner can tune in `wrangler.jsonc` at deploy. Not a blocker.
2. **Deploy command for custom entry (A1)** — Recommendation: plan an explicit local task that runs `opennextjs-cloudflare build && wrangler deploy --dry-run` (or `opennextjs-cloudflare deploy`) and confirms the bundle includes `scheduled`. Resolve before the owner-gated remote deploy.
3. **Crossing-identity dedupe rule (A3)** — Recommendation: pick the simplest rule that passes the twice-run idempotency test; document it in the plan.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@opennextjs/cloudflare` | custom worker, `getCloudflareContext` | ✓ | 1.19.8 | — |
| `wrangler` | D1 migrations, `--test-scheduled`, deploy | ✓ | ^4.90.0 | — |
| Cloudflare D1 `reporadar` (remote) | prod persistence | ✓ (provisioned) | — | local miniflare D1 for tests |
| Local D1 (miniflare `.wrangler/state`) | local migration + sweep tests | ✓ | — | — |
| `RESEND_API_KEY` | live email send | ✗ (owner-supplied) | — | `sendEmail` no-ops; assert call, not delivery |
| Prod `GITHUB_TOKEN` | live sweep fetch | ✗ (owner-supplied, PRE-01) | — | local fixtures for tests |
| `crypto.randomUUID` | tokens | ✓ (Workers global) | — | — |

**Missing dependencies with no fallback:** None for LOCAL verification.
**Missing dependencies with fallback:** `RESEND_API_KEY` / prod `GITHUB_TOKEN` — deploy-gated (D-11); local tests use no-op email + fixtures.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (`@playwright/test ^1.59.1`) is present for SMOKE only (`npm run test:smoke`). **No unit-test runner installed.** `[VERIFIED: package.json]` |
| Config file | none for unit tests — see Wave 0 |
| Quick run command | (after Wave 0) e.g. `node --test` or `vitest run` for `detectCrossings` |
| Full suite command | `npm run lint && npm run build`; `npm run test:smoke` for browser |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ALRT-01 | Migrations create both tables | integration (local D1) | `wrangler d1 migrations apply reporadar --local && wrangler d1 execute reporadar --local --command ".tables"` | ❌ Wave 0 |
| ALRT-02 | Distinct-term dedupe + rate-safe sweep | unit | `runAlertSweep(fakeEnv)` asserts one fetch per distinct term | ❌ Wave 0 |
| ALRT-02/03 | Crossing detection per metric | unit (pure) | `detectCrossings` fixtures: stars_abs / stars_pct / velocity | ❌ Wave 0 |
| ALRT-03 | Exactly-once (idempotency) | unit (local D1) | run `runAlertSweep` twice → assert 1 `sendEmail` call | ❌ Wave 0 |
| ALRT-04 | Verify flips `verified_at`; unsub removes; tokens unguessable | unit/integration | route handler tests against local D1 | ❌ Wave 0 |
| ALRT-05 | Alerts panel renders + posts; results match input | browser QA | extend `npm run test:smoke` (AGENTS.md: verify RESULTS not mechanics) | partial (smoke exists) |

### Sampling Rate
- **Per task commit:** unit tests for the touched lib (`detectCrossings` / `runAlertSweep`) + `npm run lint`.
- **Per wave merge:** `npm run lint && npm run build` + full unit suite.
- **Phase gate:** lint + build green, idempotency test green, smoke green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Choose + install a unit runner. Recommendation: `vitest` (works with the existing TS/ESM setup) OR Node's built-in `node --test` (zero new deps — preferable given AGENTS.md "small, verifiable" ethos). Pin in the plan.
- [ ] `tests/alerts.detectCrossings.test.ts` — pure-function fixtures per metric.
- [ ] `tests/alerts.sweep.test.ts` — `runAlertSweep(fakeEnv)` against a local D1 (seed fixtures via `wrangler d1 execute --local`), idempotency assertion.
- [ ] Seed-fixture helper (insert verified subs + prior snapshots into local D1).
- [ ] Extend `tests/` smoke for the Alerts panel (type a term → confirm it lists; AGENTS.md verify-results rule).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | No user accounts; verify/unsub tokens act as bearer capability — use `crypto.randomUUID()`, look up by token, constant-ish-time not required for opt-in but don't leak which token failed. |
| V3 Session Management | no | Stateless token links. |
| V4 Access Control | yes | Fallback `/api/notifications/sweep` MUST be guarded by `CRON_SECRET` (header compare). Verify/unsub act only on the row matching the token. |
| V5 Input Validation | yes | `normalizeEmail`, validate `kind`/`metric` against allow-lists, `threshold`/`window_days` numeric bounds. |
| V6 Cryptography | yes | `crypto.randomUUID()` (Web Crypto) — never hand-roll tokens. |

### Known Threat Patterns for Workers + D1 + email
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection | Tampering | Parameterized `.bind()` only — ALL SQL in `db.ts` (D-03). `[VERIFIED: existing workers/deploy pattern]` |
| Email header/HTML injection | Tampering | `sendEmail` strips CRLF from subject; `escapeHtml` every interpolated value. `[VERIFIED: app/lib/email.ts]` |
| Unauthorized sweep trigger (fallback route) | Elevation of Privilege | `CRON_SECRET` header check; reject if absent/mismatch. |
| Token guessing (verify/unsub) | Spoofing | `crypto.randomUUID()` (122 bits entropy). |
| Subscribe abuse / spam | DoS | Reuse the in-memory rate-limit pattern from the contact route (AGENTS.md notes it's reusable). |
| Email enumeration | Info Disclosure | Generic "check your email" response on subscribe regardless of whether the email already exists. |

## Sources

### Primary (HIGH confidence)
- `node_modules/@opennextjs/cloudflare/package.json` — version 1.19.8 confirmed
- `node_modules/@opennextjs/cloudflare/dist/api/cloudflare-context.d.ts` — `getCloudflareContext` signature, `env.DB`, async/sync forms
- `.open-next/worker.js` (generated) — confirmed default export has ONLY `fetch` + DO re-exports; no `scheduled`
- `workers/deploy/wrangler.toml` + `workers/deploy/src/index.ts` + `migrations/0001_init.sql` — existing D1 binding shape, `.bind()` pattern, `deploys` table
- `app/lib/{email,trendingCache,notifications}.ts`, `app/api/notifications/subscribe/route.ts` — reusable surfaces
- [opennext.js.org/cloudflare/howtos/custom-worker](https://opennext.js.org/cloudflare/howtos/custom-worker) — exact custom worker + scheduled code
- [developers.cloudflare.com/workers/runtime-apis/handlers/scheduled](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/) — `scheduled(controller,env,ctx)`, `--test-scheduled`, `/__scheduled`
- [developers.cloudflare.com/workers/configuration/cron-triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) — `triggers.crons`
- [developers.cloudflare.com/d1/reference/migrations](https://developers.cloudflare.com/d1/reference/migrations/) — migrations workflow, `--local`/`--remote`, `d1_migrations` table

### Secondary (MEDIUM confidence)
- [opennext.js.org/cloudflare/howtos/multi-worker](https://opennext.js.org/cloudflare/howtos/multi-worker) — fallback (separate worker) context
- [developers.cloudflare.com/workers/wrangler/configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) — config schema

### Tertiary (LOW confidence — flagged in Assumptions)
- Deploy-command interplay for a custom `main` with `opennextjs-cloudflare deploy` (A1) — not explicitly documented; plan a local verify.

## Metadata

**Confidence breakdown:**
- Cron mechanism (custom worker): HIGH — verified generated worker shape + official doc with exact code.
- D1 access + reuse-shared-DB: HIGH — verified type defs + existing in-repo usage; D1 has no ownership lock.
- Migrations + local testability: HIGH — official docs + local `.wrangler/state` present.
- Idempotency/dedupe rule: MEDIUM — pattern clear, exact rule is Claude's discretion (A3).
- Deploy command for custom entry: LOW — flagged A1, deploy-gated only.

**Research date:** 2026-05-27
**Valid until:** 2026-06-26 (30 days; OpenNext 1.x is stable but moves — re-check `custom-worker` doc if upgrading the adapter)
