/**
 * app/lib/alerts.ts — pure crossing-detection module for the alert engine.
 *
 * PURE: no I/O, no fetch, no DB access. Takes data in, returns crossings.
 * Fully unit-testable with fixtures (node --test tests/alerts.detectCrossings.test.mjs).
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
 */

import type { SubscriptionRow } from "./db";

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
