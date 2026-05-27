# Phase 1: Prerequisites - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 01-prerequisites
**Mode:** --auto (recommended defaults auto-selected)
**Areas discussed:** Email lib shape, GitHub rate-safety strategy, Secrets/config, Regression safety

---

## Email lib shape

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Resend over `fetch` + extract a shared `sendEmail()` | Generalize the proven deploy-route pattern; no new dependency | ✓ |
| Add `resend` npm SDK | Cleaner API but new dep + bundle weight on Workers | |
| Defer email entirely (stub) | Rejected — key exists, real email unblocks WS1/WS2 | |

**Auto-selected:** Reuse `fetch` + shared lib (recommended). Matches existing convention, zero new deps, works on Workers.

## GitHub rate-safety strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Cache + in-flight coalescing wrapper around `fetchTrending` | Dedupe identical terms, coalesce concurrent, TTL cache; signature unchanged | ✓ |
| Move caching into `fetchTrending` itself | Riskier — touches the fail-fast AbortSignal core | |
| No caching, rely on token headroom | Rejected — cron polls many tags; PRE-01 requires batching | |

**Auto-selected:** Wrapper (recommended). Preserves the fragile fail-fast core untouched; reusable by the repos route and the Phase 3 cron.

## Secrets / config

| Option | Description | Selected |
|--------|-------------|----------|
| Read `RESEND_API_KEY`/`GITHUB_TOKEN` from env + add `.dev.vars.example` | Runtime env, documented contract, human mints prod secrets | ✓ |
| Hardcode / commit keys | Rejected — never | |

**Auto-selected:** env + `.dev.vars.example` (recommended). Prod `GITHUB_TOKEN` + `RESEND_API_KEY` are owner-only secrets (human handoff).

## Regression safety

| Option | Description | Selected |
|--------|-------------|----------|
| Refactor deploy route + repos route onto shared helpers, verify no behavior change | DRY, single source of truth, regression-checked | ✓ |
| Leave deploy/repos inline, only add new helpers | Less DRY, duplicate logic drifts | |

**Auto-selected:** Refactor with regression check (recommended). Build + lint + browse/search must stay green; deploy email keeps its `"sent"|"queued"` contract.

## Claude's Discretion
- File placement of the cache wrapper, internal helper names, optional env-configurable TTL.

## Deferred Ideas
- Verified Resend domain + branded `RESEND_FROM`.
- Twilio/SMS path (stays queued).
- Cron polling / D1 snapshots (Phase 3).
