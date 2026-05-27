/**
 * app/lib/db.ts — ALL SQL for Phase 3 threshold alerts lives here.
 *
 * Every value is passed through .bind() — zero string interpolation (SQLi guard, T-03-01).
 * Mirror the workers/deploy parameterized pattern: prepare().bind().run()/.first()/.all().
 *
 * D1Database type is from @cloudflare/workers-types (devDependency, types-only import).
 * In route handlers, get the DB via:
 *   import { getCloudflareContext } from "@opennextjs/cloudflare";
 *   const db = getCloudflareContext().env.DB;
 * In the scheduled handler (worker.ts), DB arrives via env parameter directly.
 */

import type { D1Database } from "@cloudflare/workers-types";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type SubscriptionRow = {
  id: string;
  email: string;
  kind: "topic" | "query";
  term: string;
  metric: "stars_pct" | "stars_abs" | "velocity";
  threshold: number;
  window_days: number;
  digest: string | null;
  created_at: string;
  verified_at: string | null;
  last_notified_at: string | null;
  verify_token: string;
  unsub_token: string;
};

export type SnapshotRow = {
  term: string;
  full_name: string;
  stars: number;
  captured_at: string;
};

// -----------------------------------------------------------------------
// Subscriptions
// -----------------------------------------------------------------------

/**
 * Insert a new (unverified) subscription row.
 * verified_at and last_notified_at default to NULL.
 */
export async function createSubscription(
  db: D1Database,
  sub: Omit<SubscriptionRow, "verified_at" | "last_notified_at"> & {
    digest?: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO subscriptions
         (id, email, kind, term, metric, threshold, window_days, digest,
          created_at, verify_token, unsub_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      sub.id,
      sub.email,
      sub.kind,
      sub.term,
      sub.metric,
      sub.threshold,
      sub.window_days,
      sub.digest ?? null,
      sub.created_at,
      sub.verify_token,
      sub.unsub_token
    )
    .run();
}

/**
 * Look up a subscription by its verify token.
 * Returns null if not found (T-03-03: do not leak which token exists).
 */
export async function getSubscriptionByVerifyToken(
  db: D1Database,
  token: string
): Promise<SubscriptionRow | null> {
  const row = await db
    .prepare(`SELECT * FROM subscriptions WHERE verify_token = ?`)
    .bind(token)
    .first<SubscriptionRow>();
  return row ?? null;
}

/**
 * Mark a subscription as verified by setting verified_at to now.
 * Returns true if a row was updated (boolean — T-03-03: callers respond generically).
 */
export async function verifySubscription(
  db: D1Database,
  token: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE subscriptions SET verified_at = ? WHERE verify_token = ? AND verified_at IS NULL`
    )
    .bind(new Date().toISOString(), token)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Delete a subscription by its unsub token.
 * Returns true if a row was deleted (boolean — T-03-03).
 */
export async function unsubscribeByToken(
  db: D1Database,
  token: string
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM subscriptions WHERE unsub_token = ?`)
    .bind(token)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * List all subscriptions for a given email address (verified or not).
 */
export async function listSubscriptionsByEmail(
  db: D1Database,
  email: string
): Promise<SubscriptionRow[]> {
  const result = await db
    .prepare(`SELECT * FROM subscriptions WHERE email = ? ORDER BY created_at DESC`)
    .bind(email)
    .all<SubscriptionRow>();
  return result.results ?? [];
}

/**
 * Return distinct (term, kind) pairs that have at least one verified subscriber.
 * Used by the sweep to dedupe terms — only one upstream fetch per distinct term.
 */
export async function listDistinctTerms(
  db: D1Database
): Promise<{ term: string; kind: "topic" | "query" }[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT term, kind FROM subscriptions WHERE verified_at IS NOT NULL`
    )
    .all<{ term: string; kind: "topic" | "query" }>();
  return result.results ?? [];
}

/**
 * Return all verified subscriptions for a specific term.
 * Only rows with verified_at IS NOT NULL are returned (double opt-in guard).
 */
export async function listVerifiedSubsForTerm(
  db: D1Database,
  term: string
): Promise<SubscriptionRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM subscriptions WHERE term = ? AND verified_at IS NOT NULL`
    )
    .bind(term)
    .all<SubscriptionRow>();
  return result.results ?? [];
}

/**
 * Update last_notified_at for a subscription (crossing-dedupe, Pitfall 1).
 */
export async function setLastNotified(
  db: D1Database,
  id: string,
  isoTime: string
): Promise<void> {
  await db
    .prepare(`UPDATE subscriptions SET last_notified_at = ? WHERE id = ?`)
    .bind(isoTime, id)
    .run();
}

// -----------------------------------------------------------------------
// Snapshots
// -----------------------------------------------------------------------

/**
 * Return a Map<full_name, stars> for the MOST RECENT captured_at for this term.
 * Returns an empty Map if no snapshots exist yet.
 *
 * Query: find MAX(captured_at), then fetch all rows at that timestamp.
 */
export async function getLatestSnapshot(
  db: D1Database,
  term: string
): Promise<Map<string, number>> {
  const result = await db
    .prepare(
      `SELECT full_name, stars FROM repo_snapshots
       WHERE term = ?
         AND captured_at = (
           SELECT MAX(captured_at) FROM repo_snapshots WHERE term = ?
         )`
    )
    .bind(term, term)
    .all<{ full_name: string; stars: number }>();

  const map = new Map<string, number>();
  for (const row of result.results ?? []) {
    map.set(row.full_name, row.stars);
  }
  return map;
}

/**
 * Write a batch of snapshot rows for a term at the given capturedAt timestamp.
 * Uses db.batch() to avoid N sequential .run() calls (RESEARCH Pitfall 4).
 *
 * Authoritative 4-arg signature:
 *   writeSnapshots(db, term, repos: {fullName; stars}[], capturedAt: string)
 *
 * Plan 03-04 depends on this exact signature — do NOT change the arity.
 */
export async function writeSnapshots(
  db: D1Database,
  term: string,
  repos: { fullName: string; stars: number }[],
  capturedAt: string
): Promise<void> {
  if (repos.length === 0) return;

  const stmt = db.prepare(
    `INSERT INTO repo_snapshots (term, full_name, stars, captured_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(term, full_name, captured_at) DO UPDATE SET stars = excluded.stars`
  );

  const statements = repos.map((r) =>
    stmt.bind(term, r.fullName, r.stars, capturedAt)
  );

  await db.batch(statements);
}
