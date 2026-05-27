/**
 * sendEmail — reusable Resend delivery lib.
 *
 * Design decisions (from 01-CONTEXT.md):
 *   D-01: plain fetch to https://api.resend.com/emails, no SDK
 *   D-02: exact signature below
 *   D-03: from defaults to RESEND_FROM || "RepoRadar <onboarding@resend.dev>"
 *   D-04: graceful no-op when key absent; HTTP/network failures logged+returned, never thrown
 *   D-05: escapeHtml exported (extracted from app/api/deploy/route.ts)
 *   T-01-01: RESEND_API_KEY never logged or returned
 *   T-01-02: subject newlines stripped before send (defense-in-depth)
 *   T-01-05: failures console.warn'd so Worker logs are traceable
 */

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; skipped: true }
  | { ok: false; status: number; error: string }
  | { ok: false; error: string };

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}): Promise<{ ok: boolean; id?: string; skipped?: boolean; status?: number; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // D-04: no-key no-op — never throw, never fetch
    return { ok: false, skipped: true };
  }

  // T-01-02: strip CR/LF from subject (defense-in-depth for future user-derived subjects)
  const subject = opts.subject.replace(/[\r\n]+/g, " ").trim();

  const from =
    opts.from || process.env.RESEND_FROM || "RepoRadar <onboarding@resend.dev>";

  // Build the minimal body — only include optional fields when present
  const body: Record<string, unknown> = {
    from,
    to: opts.to,
    subject,
    html: opts.html,
  };
  if (opts.text !== undefined) {
    body.text = opts.text;
  }
  if (opts.replyTo !== undefined) {
    body.reply_to = opts.replyTo; // Resend field name
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`, // T-01-01: key used only here, never logged
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const parsed = await res.json().catch(() => ({})) as { id?: string };
      return { ok: true, id: parsed?.id };
    }

    // Non-2xx: log status + truncated body (never the key — T-01-01)
    const t = await res.text().catch(() => "");
    console.warn(`[sendEmail] Resend ${res.status}: ${t.slice(0, 200)}`);
    return { ok: false, status: res.status, error: t.slice(0, 200) };
  } catch (err) {
    // Network failure: log + return, never throw (D-04 / T-01-05)
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[sendEmail] exception: ${msg}`);
    return { ok: false, error: msg };
  }
}

/**
 * escapeHtml — extracted verbatim from app/api/deploy/route.ts §233-235 (D-05).
 * Callers building HTML bodies MUST escape untrusted interpolations (T-01-03).
 */
export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c),
  );
}
