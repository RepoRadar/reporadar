/**
 * GET /api/notifications/verify?token= — double opt-in confirmation.
 *
 * Design decisions:
 *   D-07: one-click verification from an email link
 *   T-03-06: token looked up strictly by exact match; only the matched row is acted on
 *   T-03-08: same HTTP status (200) whether token matched or not — no oracle
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { verifySubscription } from "@/app/lib/db";

export const runtime = "nodejs";

const CONFIRMED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Subscription confirmed | RepoRadar</title>
</head>
<body style="font-family:system-ui,sans-serif;background:#06080d;color:#fafafa;margin:0;padding:2rem;text-align:center;">
  <h1 style="color:#22c55e;margin-bottom:1rem;">
    <span style="color:#fafafa;">Repo</span><span style="color:#22c55e;">Radar</span>
  </h1>
  <h2 style="color:#22c55e;">Subscription confirmed!</h2>
  <p style="color:#b3bbc8;max-width:480px;margin:0 auto 1.5rem;">
    Your alert subscription is now active. We'll notify you when your tracked
    repositories cross your threshold.
  </p>
  <a href="/" style="display:inline-block;padding:0.75rem 1.5rem;background:#22c55e;color:#000;font-weight:600;text-decoration:none;border-radius:6px;">
    Back to RepoRadar
  </a>
</body>
</html>`;

// T-03-08: generic page for expired/invalid tokens — same status code, no information leak
const EXPIRED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Link expired | RepoRadar</title>
</head>
<body style="font-family:system-ui,sans-serif;background:#06080d;color:#fafafa;margin:0;padding:2rem;text-align:center;">
  <h1 style="color:#22c55e;margin-bottom:1rem;">
    <span style="color:#fafafa;">Repo</span><span style="color:#22c55e;">Radar</span>
  </h1>
  <h2 style="color:#b3bbc8;">Link expired or already used</h2>
  <p style="color:#6b7384;max-width:480px;margin:0 auto 1.5rem;">
    This verification link is no longer valid. If you still want to subscribe,
    please submit a new subscription request.
  </p>
  <a href="/" style="display:inline-block;padding:0.75rem 1.5rem;background:#22c55e;color:#000;font-weight:600;text-decoration:none;border-radius:6px;">
    Back to RepoRadar
  </a>
</body>
</html>`;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  // Reject obviously empty tokens without a DB round-trip
  if (!token.trim()) {
    return new NextResponse(EXPIRED_HTML, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const { env } = getCloudflareContext();
  const db = env.DB;

  let matched = false;
  try {
    matched = await verifySubscription(db, token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[verify] verifySubscription error:", msg);
    // On DB error, show generic expired page — don't 500
  }

  // T-03-08: same 200 status regardless of whether the token matched
  const html = matched ? CONFIRMED_HTML : EXPIRED_HTML;
  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
