/**
 * POST /api/suggestions/vote — cast or switch a vote on a suggestion
 *
 * Security:
 *   - IP address is hashed (SHA-256 + SUGGESTIONS_SALT) before storage
 *   - 3 votes per IP per rolling 1-hour window (D1-level check in recordVote)
 *   - One vote per (suggestion_id, ip_hash) — direction switch allowed
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextRequest, NextResponse } from "next/server";
import { recordVote, hashIp } from "@/app/lib/suggestions";

export const runtime = "nodejs";

type VoteBody = {
  suggestion_id?: unknown;
  direction?: unknown;
};

export async function POST(req: NextRequest) {
  // 1. Parse body
  let body: VoteBody;
  try {
    body = (await req.json()) as VoteBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send a JSON body with suggestion_id and direction." },
      { status: 400 }
    );
  }

  // 2. Validate
  const suggestion_id =
    typeof body.suggestion_id === "string" ? body.suggestion_id.trim() : null;
  if (!suggestion_id) {
    return NextResponse.json(
      { ok: false, error: "suggestion_id is required." },
      { status: 400 }
    );
  }

  const direction = body.direction;
  if (direction !== "up" && direction !== "down") {
    return NextResponse.json(
      { ok: false, error: "direction must be 'up' or 'down'." },
      { status: 400 }
    );
  }

  // 3. Hash IP (privacy guard — never store raw IP)
  const rawIp =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const ip_hash = await hashIp(rawIp);

  // 4. Record vote (rate-limit + dedup handled in data layer)
  const db = getCloudflareContext().env.DB;
  const now = new Date().toISOString();
  const voteId = crypto.randomUUID();

  const result = await recordVote(db, {
    id: voteId,
    suggestion_id,
    ip_hash,
    direction,
    now,
  });

  if (!result.ok && result.rateLimited) {
    return NextResponse.json(
      {
        ok: false,
        rateLimited: true,
        votes_up: result.votes_up,
        votes_down: result.votes_down,
        error: "You've used your 3 votes this hour. Try again later.",
      },
      { status: 429 }
    );
  }

  return NextResponse.json({
    ok: true,
    votes_up: result.votes_up,
    votes_down: result.votes_down,
  });
}
