# Phase 3: Threshold Alerts - Discussion Log

> Audit trail only. Decisions live in CONTEXT.md.

**Date:** 2026-05-27 · **Mode:** --auto · **Phase:** 03-threshold-alerts

## D1 database
| Option | Selected |
|--------|----------|
| Reuse existing `reporadar` D1 (already provisioned, used by workers/deploy) + add tables via migrations | ✓ |
| Provision a new D1 | ✗ rejected — avoids an unnecessary account-level handoff |

## Crossing-detection design
| Option | Selected |
|--------|----------|
| Pure `detectCrossings()` module (no I/O) + thin orchestrator `runAlertSweep()` | ✓ |
| Inline logic in the route/cron handler | ✗ rejected — not unit-testable; idempotency is the headline criterion |

## Cron trigger on OpenNext (RESEARCH REQUIRED)
| Option | Selected |
|--------|----------|
| In-app `scheduled()` handler via OpenNext (if supported) | preferred — researcher to confirm |
| Fallback: cron → authed internal `POST /api/notifications/sweep` (CRON_SECRET) | fallback if no clean in-app pattern |

The sweep LOGIC is identical and testable regardless of trigger mechanism — the unknown is only the wiring.

## Delivery
- Double opt-in (verify_token) + one-click unsubscribe (unsub_token); instant send for v1 (digest pref stored, batching deferred).

## Human handoffs (deploy/account-gated): remote migrations apply, cron deploy, live sweep with prod GITHUB_TOKEN, CRON_SECRET (if fallback). Local D1 + seeded fixtures verify everything else.
## Claude's Discretion: token format, indexes, panel layout, snapshot pruning, crossing-dedupe rule.
## Deferred: digest batching, SMS/push, per-repo alerts, prefs center, snapshot retention.
