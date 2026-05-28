/**
 * GET /api/notifications/verify?token= — double opt-in confirmation.
 *
 * Design decisions:
 *   D-07: one-click verification from an email link
 *   T-03-06: token looked up strictly by exact match; only the matched row is acted on
 *   T-03-08: same HTTP status (200) whether token matched or not — no oracle
 *
 * On a match we render the alert the subscriber just confirmed (term, metric,
 * threshold, window) with a link to the matching repos, so confirming lands on
 * something concrete instead of a generic "confirmed" page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSubscriptionByVerifyToken, verifySubscription } from "@/app/lib/db";
import { buildVerifyConfirmedPage } from "@/app/lib/notifications";

export const runtime = "nodejs";

function htmlResponse(html: string): NextResponse {
  // T-03-08: always 200, whether the token matched or not (no enumeration oracle).
  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

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
  if (!token.trim()) return htmlResponse(EXPIRED_HTML);

  const { env } = getCloudflareContext();
  const db = env.DB;

  try {
    // T-03-06: exact-match lookup; only this row is ever acted on.
    const sub = await getSubscriptionByVerifyToken(db, token);
    if (!sub) return htmlResponse(EXPIRED_HTML);

    // Set verified_at on first confirm. A second click is a no-op update but
    // the token is still valid, so we keep showing the confirmed page.
    await verifySubscription(db, token);

    return htmlResponse(
      buildVerifyConfirmedPage({
        email: sub.email,
        origin: req.nextUrl.origin,
        kind: sub.kind,
        term: sub.term,
        metric: sub.metric,
        threshold: sub.threshold,
        window_days: sub.window_days,
      })
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[verify] error:", msg);
    // On DB error, show the generic expired page — never 500.
    return htmlResponse(EXPIRED_HTML);
  }
}
