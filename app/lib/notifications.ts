/**
 * app/lib/notifications.ts — email composers, input validators, and shared types.
 *
 * Design decisions:
 *   - escapeHtml imported from email.ts (D-05) — EVERY interpolated value escaped (T-03-07)
 *   - buildVerifyEmail / buildAlertEmail replace the v1 dummy email (D-08)
 *   - normalizeMetric / normalizeKind: allow-list validators (RESEARCH Security V5, T-03-11)
 *   - normalizeThreshold / normalizeWindowDays: numeric range guards (T-03-11)
 *   - normalizeEmail / normalizeSources / normalizeDigest kept — still imported by other routes
 */

import { escapeHtml } from "./email.ts";
import type { Crossing } from "./alerts.ts";

// ---------------------------------------------------------------------------
// Email scheme (from / reply-to). Automated alert + verify mail sends FROM the
// dedicated alerts@ address (its own sending reputation) with replies routed to
// the monitored hello@ inbox. Everything else (contact form, admin/deploy mail)
// uses the global RESEND_FROM default, which is hello@.
// ---------------------------------------------------------------------------
export const ALERTS_FROM = "RepoRadar Alerts <alerts@reporadar.io>";
export const REPLY_TO_EMAIL = "hello@reporadar.io";

// ---------------------------------------------------------------------------
// Legacy types (kept for backward compatibility — other files may import these)
// ---------------------------------------------------------------------------

export type NotificationDigestItem = {
  title: string;
  subtitle: string;
  score: number;
  source: string;
};

export type NotificationSubscription = {
  email: string;
  sources: string[];
  digest: NotificationDigestItem[];
};

// ---------------------------------------------------------------------------
// Input validators (allow-lists)
// ---------------------------------------------------------------------------

/** Allow-list for subscription metric. Returns null for anything off-list. */
export function normalizeMetric(
  value: unknown
): "stars_pct" | "stars_abs" | "velocity" | null {
  if (value === "stars_pct") return "stars_pct";
  if (value === "stars_abs") return "stars_abs";
  if (value === "velocity") return "velocity";
  return null;
}

/** Allow-list for subscription kind. Returns null for anything off-list. */
export function normalizeKind(value: unknown): "topic" | "query" | null {
  if (value === "topic") return "topic";
  if (value === "query") return "query";
  return null;
}

/**
 * Validates a threshold value.
 * Must be a finite number greater than zero.
 */
export function normalizeThreshold(value: unknown): number | null {
  if (typeof value !== "number" || !isFinite(value)) return null;
  if (value <= 0) return null;
  return value;
}

/**
 * Validates a window_days value.
 * Must be an integer in the range [1, 90].
 */
export function normalizeWindowDays(value: unknown): number | null {
  if (typeof value !== "number" || !isFinite(value)) return null;
  const n = Math.round(value);
  if (n < 1 || n > 90) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Legacy normalizers (kept — imported by subscribe/route.ts v1 and others)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

export function normalizeSources(value: unknown): string[] {
  if (!Array.isArray(value)) return ["RepoRadar"];
  const sources = value
    .filter((source): source is string => typeof source === "string")
    .map((source) => source.trim())
    .filter(Boolean);
  return Array.from(new Set(sources)).slice(0, 4);
}

export function normalizeDigest(value: unknown): NotificationDigestItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";
      if (!title) return null;
      const subtitle =
        typeof record.subtitle === "string" ? record.subtitle.trim() : "";
      const source =
        typeof record.source === "string" && record.source.trim()
          ? record.source.trim()
          : "RepoRadar";
      const rawScore =
        typeof record.score === "number" ? record.score : 0;
      const score = Math.max(0, Math.min(100, Math.round(rawScore)));
      return { title, subtitle, source, score };
    })
    .filter((item): item is NotificationDigestItem => Boolean(item))
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// Email composers
// ---------------------------------------------------------------------------

const BRAND_COLOR = "#22c55e";
const BG_COLOR = "#06080d";
const TEXT_COLOR = "#fafafa";
const MUTED_COLOR = "#b3bbc8";
const DIMMED_COLOR = "#6b7384";

/** Base HTML shell used by both composers. */
function buildEmailShell(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family:system-ui,sans-serif;background:${BG_COLOR};color:${TEXT_COLOR};margin:0;padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:${BG_COLOR};padding:2rem 1rem;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom:1.5rem;border-bottom:1px solid rgba(255,255,255,0.08);">
              <span style="font-size:1.25rem;font-weight:700;color:${TEXT_COLOR};">Repo</span><span style="font-size:1.25rem;font-weight:700;color:${BRAND_COLOR};">Radar</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:1.5rem 0;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:1rem;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="color:${DIMMED_COLOR};font-size:0.8rem;margin:0;">
                RepoRadar · AI-powered repository discovery
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build a double-opt-in verification email.
 *
 * T-03-07: escapeHtml applied to `email` (user-controlled input).
 * The verifyUrl is a server-minted value (UUID token) — included as-is in href + text.
 */
export function buildVerifyEmail(opts: {
  email: string;
  verifyUrl: string;
}): { subject: string; html: string } {
  const safeEmail = escapeHtml(opts.email);

  const bodyContent = `
<h2 style="color:${BRAND_COLOR};margin:0 0 1rem;">Confirm your RepoRadar alert</h2>
<p style="color:${TEXT_COLOR};margin:0 0 0.75rem;">
  We received a request to send threshold alerts to
  <strong style="color:${TEXT_COLOR};">${safeEmail}</strong>.
</p>
<p style="color:${TEXT_COLOR};margin:0 0 1.5rem;">
  Click the button below to confirm and activate your subscription.
  If you did not request this, you can safely ignore this email.
</p>
<table role="presentation" cellpadding="0" cellspacing="0">
  <tr>
    <td style="border-radius:6px;background:${BRAND_COLOR};">
      <a href="${opts.verifyUrl}"
         style="display:inline-block;padding:0.75rem 1.5rem;color:#000;font-weight:600;text-decoration:none;border-radius:6px;">
        Confirm subscription
      </a>
    </td>
  </tr>
</table>
<p style="color:${MUTED_COLOR};font-size:0.875rem;margin:1.5rem 0 0;">
  Or copy this link into your browser:<br>
  <a href="${opts.verifyUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${opts.verifyUrl}</a>
</p>`;

  return {
    subject: "Confirm your RepoRadar alert subscription",
    html: buildEmailShell("Confirm your RepoRadar alert", bodyContent),
  };
}

/**
 * Build a threshold-crossing alert email.
 *
 * T-03-07: escapeHtml applied to `term`, `crossing.fullName`, `crossing.reason`
 * (all may originate from user-controlled subscription data stored in D1).
 * The unsubUrl is a server-minted value (UUID token) — safe to embed in href.
 */
export function buildAlertEmail(opts: {
  term: string;
  crossing: Pick<Crossing, "fullName" | "stars" | "metric" | "value" | "reason">;
  unsubUrl: string;
}): { subject: string; html: string } {
  const { term, crossing, unsubUrl } = opts;

  const safeTerm = escapeHtml(term);
  const safeFullName = escapeHtml(crossing.fullName);
  const safeReason = escapeHtml(crossing.reason);

  const bodyContent = `
<h2 style="color:${BRAND_COLOR};margin:0 0 1rem;">Alert: ${safeTerm}</h2>
<p style="color:${TEXT_COLOR};margin:0 0 0.5rem;">
  A repository you are watching has crossed your alert threshold.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin:1rem 0;">
  <tr>
    <td style="padding:1rem 1.25rem;">
      <p style="color:${TEXT_COLOR};font-size:1rem;font-weight:600;margin:0 0 0.25rem;">
        <a href="https://reporadar.io/?q=${encodeURIComponent(safeFullName)}"
           style="color:${BRAND_COLOR};text-decoration:none;"
           target="_blank" rel="noopener noreferrer">
          ${safeFullName}
        </a>
      </p>
      <p style="color:${MUTED_COLOR};font-size:0.875rem;margin:0;">
        ${safeReason}
      </p>
    </td>
  </tr>
</table>
<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:1.5rem 0;">
<p style="color:${DIMMED_COLOR};font-size:0.8rem;margin:0;">
  You are receiving this because you subscribed to alerts for
  <strong style="color:${MUTED_COLOR};">${safeTerm}</strong> on RepoRadar.
  <br>
  <a href="${unsubUrl}" style="color:${DIMMED_COLOR};">Unsubscribe from this alert</a>
</p>`;

  return {
    subject: `RepoRadar alert: ${term} crossed your threshold`,
    html: buildEmailShell(`RepoRadar alert — ${term}`, bodyContent),
  };
}
