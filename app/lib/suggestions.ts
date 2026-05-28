/**
 * app/lib/suggestions.ts — ALL SQL for the public suggestions voting board.
 *
 * Every value is passed through .bind() — zero string interpolation (SQLi guard).
 * Mirror the db.ts parameterized pattern: prepare().bind().run()/.first()/.all().
 *
 * D1Database type is from @cloudflare/workers-types (devDependency, types-only import).
 * In route handlers, get the DB via:
 *   import { getCloudflareContext } from "@opennextjs/cloudflare";
 *   const db = getCloudflareContext().env.DB;
 */

import type { D1Database } from "@cloudflare/workers-types";

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export type SuggestionRow = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  status: "awaiting" | "accepted" | "declined" | "delivered";
  eta: string | null;
  github_issue_url: string | null;
  votes_up: number;
  votes_down: number;
  hidden: number;
};

export type SuggestionVoteRow = {
  id: string;
  suggestion_id: string;
  ip_hash: string;
  direction: "up" | "down";
  created_at: string;
};

export type VoteResult =
  | { ok: true; votes_up: number; votes_down: number; rateLimited?: false }
  | { ok: false; rateLimited: true; votes_up: number; votes_down: number };

// -----------------------------------------------------------------------
// IP Hashing (privacy: never store raw IPs)
// -----------------------------------------------------------------------

/**
 * Hash a raw IP address with a salt using Web Crypto SHA-256.
 * Returns a hex string. Never stores or logs the raw IP.
 */
export async function hashIp(rawIp: string): Promise<string> {
  const salt = process.env.SUGGESTIONS_SALT ?? "reporadar-suggestions-v1";
  const data = new TextEncoder().encode(`${salt}:${rawIp}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// -----------------------------------------------------------------------
// Suggestions CRUD
// -----------------------------------------------------------------------

/**
 * Insert a new suggestion row.
 * status defaults to 'awaiting', hidden to 0.
 */
export async function createSuggestion(
  db: D1Database,
  suggestion: {
    id: string;
    name: string;
    description: string;
    created_at: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO suggestions (id, name, description, created_at, status, hidden)
       VALUES (?, ?, ?, ?, 'awaiting', 0)`
    )
    .bind(
      suggestion.id,
      suggestion.name,
      suggestion.description,
      suggestion.created_at
    )
    .run();
}

/**
 * Return all visible (hidden=0) suggestions, each with live vote counts, status, eta,
 * and github_issue_url. Sorted by net score (votes_up - votes_down) DESC, then
 * created_at DESC for ties.
 */
export async function listSuggestions(db: D1Database): Promise<SuggestionRow[]> {
  const result = await db
    .prepare(
      `SELECT id, name, description, created_at, status, eta, github_issue_url,
              votes_up, votes_down, hidden
       FROM suggestions
       WHERE hidden = 0
       ORDER BY (votes_up - votes_down) DESC, created_at DESC`
    )
    .all<SuggestionRow>();
  return result.results ?? [];
}

/**
 * Return a single suggestion by id (visible or hidden).
 */
export async function getSuggestion(
  db: D1Database,
  id: string
): Promise<SuggestionRow | null> {
  const row = await db
    .prepare(`SELECT * FROM suggestions WHERE id = ?`)
    .bind(id)
    .first<SuggestionRow>();
  return row ?? null;
}

/**
 * Update github_issue_url on an existing suggestion.
 * Called after GitHub issue creation succeeds (best-effort, never fatal).
 */
export async function updateGithubIssueUrl(
  db: D1Database,
  id: string,
  url: string
): Promise<void> {
  await db
    .prepare(`UPDATE suggestions SET github_issue_url = ? WHERE id = ?`)
    .bind(url, id)
    .run();
}

// -----------------------------------------------------------------------
// Voting
// -----------------------------------------------------------------------

/**
 * Record or toggle an upvote for a suggestion by an IP hash.
 *
 * Rate-limit: a single ip_hash may cast at most 3 new votes per rolling 1-hour
 * window across ALL suggestions. Removals (toggle off) do not consume a slot.
 * If exceeded, returns { ok: false, rateLimited: true }.
 *
 * Toggle behavior: one row per (suggestion_id, ip_hash) — UNIQUE constraint.
 *   - No prior vote: INSERT and increment votes_up.
 *   - Prior vote exists with the same direction: DELETE and decrement votes_up (toggle off).
 *   - Prior vote exists with a different direction: UPDATE direction, swap counters
 *     (kept for backward compatibility with any residual votes_down rows in the DB).
 *
 * All mutations are issued in a db.batch() to keep counts consistent.
 *
 * Returns the updated counts from the suggestions row.
 */
export async function recordVote(
  db: D1Database,
  params: {
    id: string;
    suggestion_id: string;
    ip_hash: string;
    direction: "up" | "down";
    now: string; // ISO timestamp
  }
): Promise<VoteResult> {
  // 1. Check for existing vote on this suggestion from this ip_hash
  const existing = await db
    .prepare(
      `SELECT id, direction FROM suggestion_votes
       WHERE suggestion_id = ? AND ip_hash = ?`
    )
    .bind(params.suggestion_id, params.ip_hash)
    .first<{ id: string; direction: string }>();

  if (existing) {
    if (existing.direction === params.direction) {
      // Toggle off: remove the vote and decrement the counter.
      // Removals do not consume a rate-limit slot.
      const decCol = existing.direction === "up" ? "votes_up" : "votes_down";
      await db.batch([
        db
          .prepare(`DELETE FROM suggestion_votes WHERE id = ?`)
          .bind(existing.id),
        db
          .prepare(
            `UPDATE suggestions SET ${decCol} = MAX(0, ${decCol} - 1) WHERE id = ?`
          )
          .bind(params.suggestion_id),
      ]);

      const updated = await getSuggestion(db, params.suggestion_id);
      return {
        ok: true,
        votes_up: updated?.votes_up ?? 0,
        votes_down: updated?.votes_down ?? 0,
      };
    }

    // Direction switch: update the vote row and swap counters.
    // Rate-limit applies here (changing direction is treated as a new vote).
    const oneHourAgo = new Date(
      new Date(params.now).getTime() - 60 * 60 * 1000
    ).toISOString();
    const countResult = await db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM suggestion_votes
         WHERE ip_hash = ? AND created_at > ?`
      )
      .bind(params.ip_hash, oneHourAgo)
      .first<{ cnt: number }>();

    if ((countResult?.cnt ?? 0) >= 3) {
      const row = await getSuggestion(db, params.suggestion_id);
      return {
        ok: false,
        rateLimited: true,
        votes_up: row?.votes_up ?? 0,
        votes_down: row?.votes_down ?? 0,
      };
    }

    const decCol = existing.direction === "up" ? "votes_up" : "votes_down";
    const incCol = params.direction === "up" ? "votes_up" : "votes_down";

    await db.batch([
      db
        .prepare(
          `UPDATE suggestion_votes SET direction = ?, created_at = ? WHERE id = ?`
        )
        .bind(params.direction, params.now, existing.id),
      db
        .prepare(
          `UPDATE suggestions SET ${decCol} = MAX(0, ${decCol} - 1), ${incCol} = ${incCol} + 1 WHERE id = ?`
        )
        .bind(params.suggestion_id),
    ]);
  } else {
    // New vote — check rate limit, then insert and increment counter.
    const oneHourAgo = new Date(
      new Date(params.now).getTime() - 60 * 60 * 1000
    ).toISOString();
    const countResult = await db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM suggestion_votes
         WHERE ip_hash = ? AND created_at > ?`
      )
      .bind(params.ip_hash, oneHourAgo)
      .first<{ cnt: number }>();

    if ((countResult?.cnt ?? 0) >= 3) {
      const row = await getSuggestion(db, params.suggestion_id);
      return {
        ok: false,
        rateLimited: true,
        votes_up: row?.votes_up ?? 0,
        votes_down: row?.votes_down ?? 0,
      };
    }

    const incCol = params.direction === "up" ? "votes_up" : "votes_down";

    await db.batch([
      db
        .prepare(
          `INSERT INTO suggestion_votes (id, suggestion_id, ip_hash, direction, created_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          params.id,
          params.suggestion_id,
          params.ip_hash,
          params.direction,
          params.now
        ),
      db
        .prepare(
          `UPDATE suggestions SET ${incCol} = ${incCol} + 1 WHERE id = ?`
        )
        .bind(params.suggestion_id),
    ]);
  }

  // Return fresh counts
  const updated = await getSuggestion(db, params.suggestion_id);
  return {
    ok: true,
    votes_up: updated?.votes_up ?? 0,
    votes_down: updated?.votes_down ?? 0,
  };
}

// -----------------------------------------------------------------------
// Admin operations
// -----------------------------------------------------------------------

/**
 * Update status and optional ETA / github_issue_url for a suggestion.
 * Used by the admin route to mark accepted/declined and set an ETA.
 */
export async function setSuggestionStatus(
  db: D1Database,
  params: {
    id: string;
    status: "awaiting" | "accepted" | "declined" | "delivered";
    eta?: string | null;
    github_issue_url?: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE suggestions
       SET status = ?,
           eta = ?,
           github_issue_url = COALESCE(?, github_issue_url)
       WHERE id = ?`
    )
    .bind(
      params.status,
      params.eta ?? null,
      params.github_issue_url ?? null,
      params.id
    )
    .run();
}

/**
 * Show or hide a suggestion (admin moderation).
 * hidden = 1 removes it from public listSuggestions; hidden = 0 restores.
 */
export async function hideSuggestion(
  db: D1Database,
  id: string,
  hidden: 0 | 1
): Promise<void> {
  await db
    .prepare(`UPDATE suggestions SET hidden = ? WHERE id = ?`)
    .bind(hidden, id)
    .run();
}
