/**
 * POST /api/contact — validated, rate-limited contact form handler.
 *
 * Design decisions (from 02-CONTEXT.md):
 *   D-05: runtime = "nodejs" (per-request API — NOT static)
 *   D-06: in-memory per-IP rate-limit; per-isolate is acceptable for v1
 *   D-06: CONTACT_TO is owner-supplied — missing config degrades to 200/queued (never 500)
 *   D-07: reply-to set to submitter email
 *   T-02-04: escapeHtml() applied to every untrusted field in HTML body
 *   T-02-05: field length caps + fixed-window rate-limiter bound payload and request rate
 *   T-02-06: no raw PII in logs; no stack traces via 500s
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmail, escapeHtml } from "@/app/lib/email";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Rate limiter — simple in-memory fixed-window per-IP
// Per-isolate is acceptable for v1 (D-06); no cross-request state needed for
// basic abuse prevention. Workers may have multiple isolates so this may
// undercount across instances, but that is a known and accepted tradeoff.
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
    // New window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true; // allowed
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // exceeded
  }

  entry.count += 1;
  return true; // allowed
}

// ---------------------------------------------------------------------------
// Validation helpers (mirrored from app/api/feedback/route.ts)
// ---------------------------------------------------------------------------

const MAX_NAME_CHARS = 120;
const MAX_EMAIL_CHARS = 200;
const MAX_MESSAGE_CHARS = 4000;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : undefined;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

type ContactBody = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
};

export async function POST(req: NextRequest) {
  // 1. Parse JSON body
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send a JSON body with name, email, and message." },
      { status: 400 },
    );
  }

  // 2. Validate fields
  const name = normalizeText(body.name, MAX_NAME_CHARS);
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Name is required." },
      { status: 400 },
    );
  }

  const email = normalizeText(body.email, MAX_EMAIL_CHARS);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Email is required." },
      { status: 400 },
    );
  }
  if (!EMAIL_SHAPE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const message = normalizeText(body.message, MAX_MESSAGE_CHARS);
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Message is required." },
      { status: 400 },
    );
  }

  // 3. Rate-limit per IP (T-02-05)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many messages, try again shortly." },
      { status: 429 },
    );
  }

  // 4. Deliver via sendEmail()
  const contactTo = process.env.CONTACT_TO;

  if (!contactTo) {
    // D-06: CONTACT_TO is an owner-supplied handoff — log + queue gracefully, never 500
    console.warn(
      "[contact] CONTACT_TO unset — message logged, not delivered",
      `name=${name} email=<redacted> length=${message.length}`,
    );
    return NextResponse.json({ ok: true, queued: true });
  }

  // T-02-04: escape every untrusted field before HTML interpolation
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Contact from ${safeName}</title></head>
<body style="font-family:sans-serif;background:#06080d;color:#fafafa;padding:2rem;">
  <h2 style="color:#22c55e;margin-bottom:1rem;">New contact message: RepoRadar</h2>
  <table style="border-collapse:collapse;width:100%;max-width:600px;">
    <tr>
      <td style="padding:0.5rem 1rem 0.5rem 0;color:#b3bbc8;white-space:nowrap;vertical-align:top;">
        <strong>From</strong>
      </td>
      <td style="padding:0.5rem 0;color:#fafafa;">${safeName}</td>
    </tr>
    <tr>
      <td style="padding:0.5rem 1rem 0.5rem 0;color:#b3bbc8;white-space:nowrap;vertical-align:top;">
        <strong>Reply-to</strong>
      </td>
      <td style="padding:0.5rem 0;color:#fafafa;">${safeEmail}</td>
    </tr>
    <tr>
      <td style="padding:0.5rem 1rem 0.5rem 0;color:#b3bbc8;white-space:nowrap;vertical-align:top;">
        <strong>Message</strong>
      </td>
      <td style="padding:0.5rem 0;color:#fafafa;white-space:pre-wrap;">${safeMessage}</td>
    </tr>
  </table>
  <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:1.5rem 0;">
  <p style="color:#6b7384;font-size:0.875rem;">
    Sent via RepoRadar /contact. Reply directly to respond to this visitor.
  </p>
</body>
</html>`;

  const text = `New contact message: RepoRadar\n\nFrom: ${name}\nReply-to: ${email}\n\nMessage:\n${message}\n\n---\nSent via RepoRadar /contact`;

  try {
    const result = await sendEmail({
      to: contactTo,
      subject: `Contact from ${name}`,
      html,
      text,
      replyTo: email,
    });

    // Treat skipped (no RESEND_API_KEY) as queued — not an error (D-06)
    if (result.skipped) {
      return NextResponse.json({ ok: true, queued: true });
    }

    return NextResponse.json({ ok: true, sent: result.ok });
  } catch (err) {
    // Provider failure: degrade gracefully — never 500 (D-06 / T-02-06)
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[contact] sendEmail exception:", msg);
    return NextResponse.json({ ok: true, queued: true });
  }
}
