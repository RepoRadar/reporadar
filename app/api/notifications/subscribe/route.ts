/**
 * POST /api/notifications/subscribe — D1-backed double opt-in subscription.
 *
 * Design decisions:
 *   D-08: replaces in-memory v1 — D1 persistence survives cold starts + isolate restarts
 *   T-03-08: generic response regardless of email existence (enumeration prevention)
 *   T-03-09: in-memory fixed-window per-IP rate-limit (5/60s) — mirrors contact route (D-06)
 *   T-03-11: allow-list normalizers reject invalid metric/kind/threshold/window_days → 400
 *   T-03-06: crypto.randomUUID() for id/verify_token/unsub_token (122-bit CSPRNG)
 *   D-07: verify link emailed via sendEmail + buildVerifyEmail; email no-ops without key
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createSubscription } from "@/app/lib/db";
import { sendEmail } from "@/app/lib/email";
import {
  normalizeEmail,
  normalizeKind,
  normalizeMetric,
  normalizeThreshold,
  normalizeWindowDays,
  buildVerifyEmail,
} from "@/app/lib/notifications";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Rate limiter — in-memory fixed-window per-IP (mirrors contact/route.ts)
// Per-isolate is acceptable for v1 (T-03-09); known tradeoff documented.
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 seconds
const RATE_LIMIT_MAX = 5; // max requests per window per IP

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
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Parse JSON body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send a JSON body." },
      { status: 400 }
    );
  }

  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  // 2. Validate fields via allow-list normalizers (T-03-11)
  const email = normalizeEmail(record.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const kind = normalizeKind(record.kind);
  if (!kind) {
    return NextResponse.json(
      { ok: false, error: "kind must be 'topic' or 'query'." },
      { status: 400 }
    );
  }

  const term =
    typeof record.term === "string" ? record.term.trim().slice(0, 200) : null;
  if (!term) {
    return NextResponse.json(
      { ok: false, error: "term is required." },
      { status: 400 }
    );
  }

  const metric = normalizeMetric(record.metric);
  if (!metric) {
    return NextResponse.json(
      { ok: false, error: "metric must be 'stars_pct', 'stars_abs', or 'velocity'." },
      { status: 400 }
    );
  }

  const threshold = normalizeThreshold(record.threshold);
  if (threshold === null) {
    return NextResponse.json(
      { ok: false, error: "threshold must be a positive number." },
      { status: 400 }
    );
  }

  const window_days = normalizeWindowDays(record.window_days);
  if (window_days === null) {
    return NextResponse.json(
      { ok: false, error: "window_days must be an integer between 1 and 90." },
      { status: 400 }
    );
  }

  // 3. Rate-limit per IP (T-03-09)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests, try again shortly." },
      { status: 429 }
    );
  }

  // 4. Mint tokens (T-03-06: CSPRNG)
  const id = crypto.randomUUID();
  const verify_token = crypto.randomUUID();
  const unsub_token = crypto.randomUUID();
  const created_at = new Date().toISOString();

  // 5. Persist unverified subscription to D1
  const { env } = getCloudflareContext();
  const db = env.DB;

  try {
    await createSubscription(db, {
      id,
      email,
      kind,
      term,
      metric,
      threshold,
      window_days,
      created_at,
      verify_token,
      unsub_token,
      digest: null,
    });
  } catch (err) {
    // Log but do NOT expose DB errors — generic response to avoid enumeration
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[subscribe] createSubscription error:", msg);
    // Return generic success (T-03-08: enumeration prevention — same response
    // whether or not the email already had a sub or a DB error occurred).
    return NextResponse.json({ ok: true, status: "pending_verification" });
  }

  // 6. Send verify email (no-ops without RESEND_API_KEY — D-04)
  const origin = req.nextUrl.origin;
  const verifyUrl = `${origin}/api/notifications/verify?token=${verify_token}`;
  const { subject, html } = buildVerifyEmail({ email, verifyUrl });

  await sendEmail({ to: email, subject, html }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[subscribe] sendEmail exception:", msg);
  });

  // 7. Generic response — T-03-08: same body whether email already existed or not
  return NextResponse.json({ ok: true, status: "pending_verification" });
}
