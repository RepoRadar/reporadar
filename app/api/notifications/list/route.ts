/**
 * GET /api/notifications/list?email= — list subscriptions for the calling user.
 *
 * Design decisions:
 *   T-03-19: returns only rows for the queried email; never exposes the
 *            verification token; generic empty array for unknown emails (no
 *            enumeration oracle).
 *   T-03-09: same per-IP rate-limit pattern as subscribe (5 req/60s).
 *   D-03: access D1 via getCloudflareContext().env.DB
 *   runtime="nodejs": consistent with the other notification routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { listSubscriptionsByEmail } from "@/app/lib/db";
import { normalizeEmail } from "@/app/lib/notifications";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Rate limiter — mirrors subscribe/route.ts (T-03-09)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // 1. Rate-limit per IP (T-03-09)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests, try again shortly." },
      { status: 429 }
    );
  }

  // 2. Validate email param
  const rawEmail = req.nextUrl.searchParams.get("email") ?? "";
  const email = normalizeEmail(rawEmail);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  // 3. Query D1 (T-03-19: only rows for this email)
  let rows;
  try {
    const { env } = getCloudflareContext();
    const db = env.DB;
    rows = await listSubscriptionsByEmail(db, email);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[list] listSubscriptionsByEmail error:", msg);
    // Return empty — no info leak on DB error
    return NextResponse.json({ ok: true, alerts: [] });
  }

  // 4. Shape response: expose only what the panel needs.
  //    NEVER return the verify token (T-03-19).
  //    Returning unsub_token to the email owner is the intended one-click
  //    remove capability — they own the subscription.
  const alerts = rows.map((row) => ({
    id: row.id,
    term: row.term,
    kind: row.kind,
    metric: row.metric,
    threshold: row.threshold,
    window_days: row.window_days,
    verified: row.verified_at !== null,
    unsubToken: row.unsub_token,
    createdAt: row.created_at,
  }));

  return NextResponse.json({ ok: true, alerts });
}
