// worker.ts — custom Worker entrypoint for RepoRadar.
//
// Source: opennext.js.org/cloudflare/howtos/custom-worker
//
// Why this file exists:
//   OpenNext generates .open-next/worker.js with ONLY a `fetch` handler. It has
//   no hook for adding a Cloudflare Cron Trigger (`scheduled` export). The
//   official pattern is to wrap the generated handler in this tiny custom file,
//   re-export `fetch` and the DO classes, and add your own `scheduled` export.
//   Wrangler's `main` is then pointed at this file instead of the generated one.
//
// Build order:
//   `opennextjs-cloudflare build` must run BEFORE wrangler bundles this file so
//   that .open-next/worker.js exists. The deploy workflow is:
//     1. opennextjs-cloudflare build   (generates .open-next/worker.js)
//     2. wrangler deploy               (bundles worker.ts → references the generated file)
//   See SUMMARY's A1 finding for the exact owner-gated deploy command.

import type {
  ScheduledController,
  ExecutionContext,
  ExportedHandler,
} from "@cloudflare/workers-types";
// @ts-ignore — `.open-next/worker.js` is generated at build time; types absent until after first build
import { default as handler } from "./.open-next/worker.js";
import { runAlertSweep } from "./app/lib/alerts";

export default {
  fetch: handler.fetch,

  /**
   * Cloudflare Cron Trigger handler.
   *
   * Fires on the cadence declared in wrangler.jsonc `triggers.crons`.
   * `ctx.waitUntil` keeps the invocation alive for the async sweep and
   * records any failure in the Cron Trigger "Past Events" dashboard.
   *
   * Signature: (controller, env, ctx) where:
   *   controller.cron          — the cron expression that fired
   *   controller.scheduledTime — Unix timestamp of the scheduled invocation
   *   env                      — Worker bindings (DB, secrets, etc.)
   *   ctx                      — ExecutionContext for waitUntil / passThroughOnException
   *
   * RESEARCH Anti-Pattern avoided: runAlertSweep receives `env` directly
   * instead of relying on getCloudflareContext() — keeps it testable outside
   * the Worker runtime.
   */
  async scheduled(
    controller: ScheduledController,
    env: CloudflareEnv,
    ctx: ExecutionContext
  ) {
    ctx.waitUntil(runAlertSweep(env));
  },
} satisfies ExportedHandler<CloudflareEnv>;

// REQUIRED re-exports — this app uses the R2 incremental cache (opennext.js.org/cloudflare/caching).
// The generated worker.js references DOQueueHandler and DOShardedTagCache Durable Objects.
// When wrangler bundles THIS file as the entry instead of the generated file, these classes
// must be re-exported so wrangler can register the DO bindings.
// Dropping them breaks the R2 incremental cache at deploy (RESEARCH Anti-Pattern).
// @ts-ignore — types for DO classes absent until after first build
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
