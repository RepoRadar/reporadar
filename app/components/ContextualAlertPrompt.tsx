"use client";

import { useEffect, useState } from "react";
import { track } from "@/app/lib/analytics";

const DISMISS_KEY = "reporadar-contextual-alert-dismissed-v1";
const EMAIL_KEY = "reporadar-notification-profile-v1";

// Inferred defaults for the one-click watch. The user can refine metric +
// threshold later in the full panel; we pick a sensible "is this taking off?"
// signal: 20% star growth over a 7-day window.
const DEFAULT_METRIC = "stars_pct" as const;
const DEFAULT_THRESHOLD = 20;
const DEFAULT_WINDOW_DAYS = 7;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Submit =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "confirmed" }
  | { kind: "error"; message: string };

/**
 * Contextual "Watch this?" prompt shown near the results after the user hits an
 * aha moment (tuned a slider/priority OR ran a search). One email field plus a
 * "Notify me" button, pre-filled with what they just searched.
 *
 * Constraints (from the brief):
 *   - Fires at most once per session, dismissible.
 *   - Dismissal persists in localStorage so it never nags again.
 *   - Reuses the existing /api/notifications/subscribe flow (email-only first;
 *     metric + threshold inferred, refine later in the panel).
 *   - Framing = "watch a topic for momentum", NOT "beats my dimensions".
 */
export function ContextualAlertPrompt({
  visible,
  watchTerm,
  watchKind,
  onDismiss,
  onRefine,
}: {
  // Parent decides WHEN the aha happened; this component owns the once-per-
  // session + persisted-dismissal gating so it never shows after a dismissal.
  visible: boolean;
  watchTerm: string;
  watchKind: "topic" | "query";
  onDismiss: () => void;
  // Hand off to the full panel (expand + prefill) so the user can refine.
  onRefine: (prefill: { term: string; kind: "topic" | "query" }) => void;
}) {
  const [dismissed, setDismissed] = useState(true); // assume dismissed until we read storage
  const [email, setEmail] = useState("");
  const [submit, setSubmit] = useState<Submit>({ kind: "idle" });

  // Read persisted dismissal + any saved email on mount.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const isDismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
        setDismissed(isDismissed);
        const raw = window.localStorage.getItem(EMAIL_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { email?: unknown };
          if (typeof parsed.email === "string") setEmail(parsed.email);
        }
      } catch {
        setDismissed(false);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const persistDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    persistDismiss();
    track("contextual_alert_dismiss", {});
    onDismiss();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submit.kind === "submitting") return;
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      setSubmit({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    const term = watchTerm.trim();
    if (!term) {
      setSubmit({ kind: "error", message: "Run a search first so we know what to watch." });
      return;
    }

    setSubmit({ kind: "submitting" });
    try {
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: normalized,
          kind: watchKind,
          term,
          metric: DEFAULT_METRIC,
          threshold: DEFAULT_THRESHOLD,
          window_days: DEFAULT_WINDOW_DAYS,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setSubmit({ kind: "error", message: body.error ?? "Could not set the alert." });
        return;
      }

      // Reuse the panel's email-persistence key so the full panel pre-fills.
      try {
        window.localStorage.setItem(
          EMAIL_KEY,
          JSON.stringify({ email: normalized, updatedAt: new Date().toISOString() }),
        );
      } catch {
        /* ignore */
      }

      // Same analytics contract as the panel signup (no PII in payload).
      track("alert_signup", { sources: 1, source: "contextual" });

      // A successful submit ends the prompt's life for this session AND future
      // visits (persist dismissal so it never nags after a conversion).
      persistDismiss();
      setSubmit({ kind: "confirmed" });
    } catch {
      setSubmit({ kind: "error", message: "Network error. Try again." });
    }
  };

  if (dismissed || !visible) return null;

  return (
    <div
      className="rr-fade-up flex flex-col gap-3 rounded-xl border p-4"
      style={{
        borderColor: "rgba(34,197,94,0.40)",
        background:
          "linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(59,130,246,0.08) 100%)",
        boxShadow: "0 0 18px var(--primary-glow)",
      }}
      role="region"
      aria-label="Watch this topic for momentum"
    >
      {submit.kind === "confirmed" ? (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm leading-5" style={{ color: "var(--primary)" }}>
            <strong>Check your email</strong> to confirm. You&apos;ll get a heads-up when{" "}
            <span className="font-mono" style={{ color: "var(--fg)" }}>
              {watchTerm}
            </span>{" "}
            starts taking off.
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded px-1.5 text-lg leading-none transition hover:opacity-70"
            style={{ color: "var(--fg-dim)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>
                Watch this?
              </p>
              <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--fg-muted)" }}>
                We&apos;ll email you when a repo like{" "}
                <span className="font-mono" style={{ color: "var(--primary)" }}>
                  {watchTerm}
                </span>{" "}
                takes off.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 rounded px-1.5 text-lg leading-none transition hover:opacity-70"
              style={{ color: "var(--fg-dim)" }}
              aria-label="Dismiss watch prompt"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="contextual-alert-email">
              Your email
            </label>
            <input
              id="contextual-alert-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (submit.kind === "error") setSubmit({ kind: "idle" });
              }}
              placeholder="builder@example.com"
              className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm outline-none transition"
              style={{ borderColor: "var(--border-strong)", background: "#f8fafc", color: "#06080d" }}
              aria-describedby="contextual-alert-status"
            />
            <button
              type="submit"
              disabled={submit.kind === "submitting" || !email.trim()}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "linear-gradient(90deg, var(--primary), var(--secondary))",
                color: "#06080d",
                boxShadow: submit.kind === "submitting" ? "none" : "0 0 16px var(--primary-glow)",
              }}
            >
              {submit.kind === "submitting" ? "Setting…" : "Notify me"}
            </button>
          </form>

          <div id="contextual-alert-status" className="flex items-center justify-between gap-2" aria-live="polite">
            {submit.kind === "error" ? (
              <p className="text-[11px] leading-4" style={{ color: "var(--danger)" }}>
                {submit.message}
              </p>
            ) : (
              <p className="text-[11px] leading-4" style={{ color: "var(--fg-dim)" }}>
                One email per crossing. Unsubscribe anytime.
              </p>
            )}
            <button
              type="button"
              onClick={() => onRefine({ term: watchTerm, kind: watchKind })}
              className="shrink-0 text-[11px] underline-offset-2 transition hover:underline"
              style={{ color: "var(--secondary)" }}
            >
              refine
            </button>
          </div>
        </>
      )}
    </div>
  );
}
