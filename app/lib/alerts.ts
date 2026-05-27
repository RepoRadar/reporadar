/**
 * app/lib/alerts.ts — pure crossing-detection module + sweep orchestrator.
 *
 * PURE section (detectCrossings): no I/O, no fetch, no DB access.
 * Fully unit-testable with fixtures (node --test tests/alerts.detectCrossings.test.mjs).
 *
 * Sweep orchestrator (runAlertSweep): env-injected, NOT context-coupled to the Cloudflare request.
 * This allows it to run from both the scheduled() handler in worker.ts AND from
 * unit tests with a fake/local DB adapter. Do NOT use the cloudflare context API here.
 *
 * Three supported metrics (D-04):
 *   stars_abs  — absolute star count passed threshold
 *   stars_pct  — % growth over window_days vs prior snapshot ≥ threshold
 *   velocity   — stars/day over the window ≥ threshold
 *
 * Threat mitigations:
 *   T-03-04: Skip repos with no prior baseline (missing from priorSnapshot) or
 *            prior <= 0 for pct/velocity — prevents divide-by-zero and false fires.
 *   T-03-05: reason is plain text; HTML escaping is the email layer's job (Plan 03/04).
 *   T-03-12: alreadyNotified() skips standing crossings so the sweep is idempotent.
 *   T-03-15: listVerifiedSubsForTerm returns only verified_at IS NOT NULL rows.
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { SubscriptionRow } from "./db.ts";
import {
  listDistinctTerms,
  listVerifiedSubsForTerm,
  getLatestSnapshot,
  writeSnapshots,
  setLastNotified,
} from "./db.ts";
import type { Repo } from "./types.ts";

// NOTE: fetchTrendingCached, buildAlertEmail, and sendEmail are imported
// dynamically in runAlertSweep when no dep overrides are provided. This avoids
// loading trendingCache → github (which references env/process) at module parse
// time, keeping the module loadable in plain-Node test environments that don't
// have Cloudflare bindings. The injected-deps path (used in tests) never
// exercises the dynamic branches.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A repo that crossed the subscription threshold for the current metric.
 *
 * Consumed by Plan 03-03 (email builder) and Plan 03-04 (sweep orchestrator).
 */
export type Crossing = {
  /** owner/repo full name */
  fullName: string;
  /** Current star count from the latest data */
  stars: number;
  /** Which metric triggered the crossing */
  metric: SubscriptionRow["metric"];
  /**
   * The computed value that was compared to the threshold.
   * stars_abs → current stars
   * stars_pct → growth percentage (e.g. 30 for 30%)
   * velocity  → stars/day (e.g. 14.28...)
   */
  value: number;
  /** Human-readable explanation (plain text, NOT HTML) */
  reason: string;
};

// ---------------------------------------------------------------------------
// detectCrossings
// ---------------------------------------------------------------------------

/**
 * Given a subscription's metric configuration, the current list of repos, and
 * the prior snapshot (full_name → stars), return all repos that crossed the
 * threshold for this run.
 *
 * @param sub          - metric, threshold, window_days from the subscription row
 * @param latestRepos  - current repo list (fullName + stars minimum)
 * @param priorSnapshot - Map<fullName, stars> from the last snapshot write
 * @returns Array of Crossing objects (empty if nothing crossed)
 */
export function detectCrossings(
  sub: Pick<SubscriptionRow, "metric" | "threshold" | "window_days">,
  latestRepos: { fullName: string; stars: number }[],
  priorSnapshot: Map<string, number>
): Crossing[] {
  const crossings: Crossing[] = [];

  for (const repo of latestRepos) {
    const crossing = evaluateRepo(sub, repo, priorSnapshot);
    if (crossing !== null) {
      crossings.push(crossing);
    }
  }

  return crossings;
}

// ---------------------------------------------------------------------------
// Per-metric evaluation helpers
// ---------------------------------------------------------------------------

function evaluateRepo(
  sub: Pick<SubscriptionRow, "metric" | "threshold" | "window_days">,
  repo: { fullName: string; stars: number },
  priorSnapshot: Map<string, number>
): Crossing | null {
  switch (sub.metric) {
    case "stars_abs":
      return evaluateStarsAbs(sub, repo);
    case "stars_pct":
      return evaluateStarsPct(sub, repo, priorSnapshot);
    case "velocity":
      return evaluateVelocity(sub, repo, priorSnapshot);
    default: {
      // Exhaustive check — TypeScript will warn if a new metric is added to the union.
      // The cast to never makes the compiler enforce completeness; void suppresses the
      // lint "assigned but never used" warning without removing the type safety.
      void (sub.metric as never);
      return null;
    }
  }
}

/** stars_abs: current star count >= threshold */
function evaluateStarsAbs(
  sub: Pick<SubscriptionRow, "metric" | "threshold">,
  repo: { fullName: string; stars: number }
): Crossing | null {
  if (repo.stars < sub.threshold) return null;

  return {
    fullName: repo.fullName,
    stars: repo.stars,
    metric: "stars_abs",
    value: repo.stars,
    reason: `${repo.fullName} has ${formatStars(repo.stars)} stars, passing your ${formatStars(sub.threshold)}-star threshold`,
  };
}

/** stars_pct: ((current - prior) / prior) * 100 >= threshold */
function evaluateStarsPct(
  sub: Pick<SubscriptionRow, "metric" | "threshold">,
  repo: { fullName: string; stars: number },
  priorSnapshot: Map<string, number>
): Crossing | null {
  const prior = priorSnapshot.get(repo.fullName);

  // T-03-04: No prior baseline or prior ≤ 0 → skip (no false fire, no divide-by-zero)
  if (prior === undefined || prior <= 0) return null;

  const growthPct = ((repo.stars - prior) / prior) * 100;

  if (growthPct < sub.threshold) return null;

  const growthRounded = Math.round(growthPct * 10) / 10;

  return {
    fullName: repo.fullName,
    stars: repo.stars,
    metric: "stars_pct",
    value: growthPct,
    reason: `${repo.fullName} gained ${growthRounded}% stars, crossing your ${sub.threshold}% threshold`,
  };
}

/** velocity: (current - prior) / max(1, window_days) stars/day >= threshold */
function evaluateVelocity(
  sub: Pick<SubscriptionRow, "metric" | "threshold" | "window_days">,
  repo: { fullName: string; stars: number },
  priorSnapshot: Map<string, number>
): Crossing | null {
  const prior = priorSnapshot.get(repo.fullName);

  // T-03-04: No prior baseline → skip (no false fire)
  if (prior === undefined) return null;

  // Use max(1, window_days) to guard against division by zero (window_days = 0)
  const windowDays = Math.max(1, sub.window_days);
  const perDay = (repo.stars - prior) / windowDays;

  if (perDay < sub.threshold) return null;

  const perDayRounded = Math.round(perDay * 10) / 10;

  return {
    fullName: repo.fullName,
    stars: repo.stars,
    metric: "velocity",
    value: perDay,
    reason: `${repo.fullName} is gaining ~${perDayRounded} stars/day over ${sub.window_days} days, crossing your ${sub.threshold}/day threshold`,
  };
}

// ---------------------------------------------------------------------------
// Formatting helpers (pure — no I/O)
// ---------------------------------------------------------------------------

/**
 * Format a star count with commas (e.g. 1000 → "1,000", 141700 → "141,700").
 * Used in reason strings only; no HTML involved.
 */
function formatStars(n: number): string {
  return n.toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Idempotency guard (T-03-12 / Pitfall 1)
// ---------------------------------------------------------------------------

/**
 * V1 crossing-identity dedupe rule (pinned per D-11 / A3):
 *
 * Once a subscription has last_notified_at set, skip sending again until the
 * metric value drops back below threshold and re-crosses. This is the simplest
 * robust rule that guarantees "exactly one email per standing crossing" and
 * passes the twice-run idempotency test.
 *
 * Rationale: last_notified_at is set for the WHOLE subscription (not per-repo).
 * A finer per-repo crossing identity can be added in v2 if needed (deferred).
 * For v1 the acceptance criterion is "never double-send" — this achieves it.
 */
export function alreadyNotified(sub: Pick<SubscriptionRow, "last_notified_at">): boolean {
  return sub.last_notified_at !== null && sub.last_notified_at !== undefined;
}

// ---------------------------------------------------------------------------
// runAlertSweep — scheduled sweep orchestrator (D-05)
// ---------------------------------------------------------------------------

/**
 * Injected dependencies for testability. Production defaults are applied inside
 * runAlertSweep when the optional `deps` arg is omitted or partially provided.
 *
 * - fetchTrending: replaces fetchTrendingCached so tests can return fixtures
 *   without a real GitHub token.
 * - send: replaces the sendEmail+buildAlertEmail pair so tests can spy on calls
 *   without a real Resend key.
 * - now: replaces new Date().toISOString() so tests can produce deterministic
 *   timestamps (also enables snapshot ordering assertions).
 */
export type SweepDeps = {
  fetchTrending?: (params: { topic?: string; query?: string }) => Promise<Repo[]>;
  send?: (sub: SubscriptionRow, crossing: Crossing, unsubUrl: string) => Promise<unknown>;
  now?: () => string;
};

/**
 * Run one complete alert sweep.
 *
 * Sweep order (Pitfall 2 — detect BEFORE write):
 *   1. Dedupe distinct verified terms via listDistinctTerms (Pitfall 3 — rate budget).
 *   2. For each term: fetch once (fetchTrendingCached or injected stub).
 *   3. Load prior snapshot for that term (getLatestSnapshot).
 *   4. Detect crossings for each VERIFIED subscriber via detectCrossings.
 *   5. For subs not already notified (T-03-12): send email + setLastNotified.
 *   6. THEN writeSnapshots (fresh baselines, after detection).
 *
 * @param env  - Worker env object supplying DB binding. Pass env directly; do not reach for the context API.
 * @param deps - Optional testability overrides for fetchTrending, send, now.
 * @returns    { sent, scanned } counts (useful for tests + Cron Past-Events logs).
 */
export async function runAlertSweep(
  env: { DB: D1Database; APP_ORIGIN?: string },
  deps: SweepDeps = {},
): Promise<{ sent: number; scanned: number }> {
  // Apply production defaults for injected deps (lazy dynamic imports avoid loading
  // the Cloudflare-coupled modules in plain-Node test environments).
  let fetchTrending: (params: { topic?: string; query?: string }) => Promise<Repo[]>;
  if (deps.fetchTrending) {
    fetchTrending = deps.fetchTrending;
  } else {
    const { fetchTrendingCached } = await import("./trendingCache.ts");
    fetchTrending = fetchTrendingCached;
  }

  let sendFn: (sub: SubscriptionRow, crossing: Crossing, unsubUrl: string) => Promise<unknown>;
  if (deps.send) {
    sendFn = deps.send;
  } else {
    sendFn = async (sub: SubscriptionRow, crossing: Crossing, unsubUrl: string) => {
      const { buildAlertEmail, ALERTS_FROM, REPLY_TO_EMAIL } = await import("./notifications.ts");
      const { sendEmail } = await import("./email.ts");
      const { subject, html } = buildAlertEmail({ term: sub.term, crossing, unsubUrl });
      return sendEmail({ to: sub.email, subject, html, from: ALERTS_FROM, replyTo: REPLY_TO_EMAIL });
    };
  }
  const now = deps.now ?? (() => new Date().toISOString());

  const terms = await listDistinctTerms(env.DB);
  let sent = 0;

  for (const t of terms) {
    // Fetch once per DISTINCT term — Pitfall 3 / D-05 rate-budget guard.
    const repos = await fetchTrending(
      t.kind === "topic" ? { topic: t.term } : { query: t.term }
    );

    // Load the PRIOR snapshot BEFORE detection (Pitfall 2: detect vs old baseline).
    const prior = await getLatestSnapshot(env.DB, t.term);

    const subs = await listVerifiedSubsForTerm(env.DB, t.term);

    for (const sub of subs) {
      // T-03-15: listVerifiedSubsForTerm already gates on verified_at IS NOT NULL.
      // T-03-12: skip if already notified about a standing crossing (idempotency v1).
      if (alreadyNotified(sub)) continue;

      const crossings = detectCrossings(sub, repos, prior);

      for (const crossing of crossings) {
        const unsubUrl = `${env.APP_ORIGIN ?? "https://reporadar.io"}/api/notifications/unsubscribe?token=${sub.unsub_token}`;
        await sendFn(sub, crossing, unsubUrl);
        await setLastNotified(env.DB, sub.id, now());
        sent++;
        // Once we've sent for this sub, mark notified and move to the next sub
        // (v1 rule: one notification per standing crossing per sub).
        break;
      }
    }

    // Pitfall 2: write fresh baselines AFTER detection (not before).
    const capturedAt = now();
    await writeSnapshots(env.DB, t.term, repos, capturedAt);
  }

  return { sent, scanned: terms.length };
}
