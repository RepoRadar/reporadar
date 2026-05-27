"use client";

import { useCallback, useEffect, useState } from "react";
import { track } from "@/app/lib/analytics";

const STORAGE_KEY = "reporadar-notification-profile-v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AlertRow = {
  id: string;
  term: string;
  kind: "topic" | "query";
  metric: "stars_pct" | "stars_abs" | "velocity";
  threshold: number;
  window_days: number;
  verified: boolean;
  unsubToken: string;
  createdAt: string;
};

type CreateState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "confirmed"; email: string }
  | { kind: "error"; message: string };

type StoredProfile = {
  email: string;
  updatedAt: string;
};

// Gradient accent per metric — reuses green/blue/yellow/red language (AGENTS.md slider/score contract)
const METRIC_COLORS: Record<AlertRow["metric"], string> = {
  stars_pct: "var(--primary)",    // green  — growth %
  stars_abs: "var(--secondary)",  // blue   — absolute star count
  velocity:  "var(--accent)",     // yellow — stars/day rate
};

const METRIC_LABELS: Record<AlertRow["metric"], string> = {
  stars_pct: "% growth",
  stars_abs: "stars gained",
  velocity:  "stars/day",
};

const KIND_LABELS: Record<AlertRow["kind"], string> = {
  topic: "topic",
  query: "search query",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationSignup() {
  // --- Persisted email -------------------------------------------------------
  const [email, setEmail] = useState("");

  // --- Create form state -----------------------------------------------------
  const [term, setTerm] = useState("");
  const [kind, setKind] = useState<"topic" | "query">("topic");
  const [metric, setMetric] = useState<"stars_pct" | "stars_abs" | "velocity">("stars_pct");
  const [threshold, setThreshold] = useState<number>(20);
  const [windowDays, setWindowDays] = useState<number>(7);
  const [createState, setCreateState] = useState<CreateState>({ kind: "idle" });

  // --- List state ------------------------------------------------------------
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [removeStatus, setRemoveStatus] = useState<Record<string, "removing" | "error">>({});

  // --- Restore email from localStorage --------------------------------------
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as Partial<StoredProfile>;
        if (typeof stored.email === "string") setEmail(stored.email);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // --- Fetch alert list ------------------------------------------------------
  const fetchAlerts = useCallback(async (forEmail: string) => {
    const trimmed = forEmail.trim().toLowerCase();
    if (!trimmed) {
      setAlerts([]);
      return;
    }
    setListLoading(true);
    try {
      const res = await fetch(
        `/api/notifications/list?email=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) { setAlerts([]); return; }
      const body = await res.json();
      setAlerts(Array.isArray(body.alerts) ? (body.alerts as AlertRow[]) : []);
    } catch {
      setAlerts([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  // Re-fetch whenever the email field stabilises (debounced via effect).
  // Empty email: schedule a debounced clear rather than calling setAlerts
  // synchronously, to avoid the set-state-in-effect lint rule.
  useEffect(() => {
    const trimmed = email.trim();
    const t = window.setTimeout(() => {
      if (!trimmed) {
        setAlerts([]);
      } else {
        void fetchAlerts(email);
      }
    }, 600);
    return () => window.clearTimeout(t);
  }, [email, fetchAlerts]);

  // --- Create alert ----------------------------------------------------------
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createState.kind === "submitting") return;

    setCreateState({ kind: "submitting" });
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          kind,
          term: term.trim(),
          metric,
          threshold,
          window_days: windowDays,
        }),
      });
      const body = await res.json();

      if (!res.ok || !body.ok) {
        setCreateState({ kind: "error", message: body.error ?? "Could not create alert." });
        return;
      }

      // Persist email for next visit
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          email: normalizedEmail,
          updatedAt: new Date().toISOString(),
        } satisfies StoredProfile)
      );

      // Phase 2 analytics contract — keep as-is (T-02-14: no PII in payload)
      track("alert_signup", { sources: 1 });

      setCreateState({ kind: "confirmed", email: normalizedEmail });
      setTerm("");

      // Refresh the list so the new (pending) alert appears
      void fetchAlerts(normalizedEmail);
    } catch {
      setCreateState({ kind: "error", message: "Network error while creating alert." });
    }
  };

  // --- Remove alert ----------------------------------------------------------
  const removeAlert = async (id: string, unsubToken: string) => {
    setRemoveStatus((prev) => ({ ...prev, [id]: "removing" }));
    try {
      // Unsubscribe returns an HTML page (one-click link design).
      // We just fire the request and optimistically remove from list on any 200.
      const res = await fetch(
        `/api/notifications/unsubscribe?token=${encodeURIComponent(unsubToken)}`
      );
      if (res.ok) {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        setRemoveStatus((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        setRemoveStatus((prev) => ({ ...prev, [id]: "error" }));
      }
    } catch {
      setRemoveStatus((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  const isSubmitting = createState.kind === "submitting";

  // --- Metric color for threshold display ------------------------------------
  const thresholdColor = METRIC_COLORS[metric];

  return (
    <section
      className="rr-notification-card rr-fade-up rounded-xl border p-4"
      style={{
        borderColor: "var(--border)",
        background:
          "linear-gradient(180deg, rgba(24,29,40,0.96) 0%, rgba(16,20,27,0.98) 100%)",
      }}
      aria-labelledby="trend-alerts-heading"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--fg-dim)" }}
          >
            Notifications
          </p>
          <h2 id="trend-alerts-heading" className="mt-1 text-base font-bold tracking-normal">
            Trend alerts
          </h2>
        </div>
        <span
          className="shrink-0 rounded-md border px-2 py-1 text-[10px] font-mono"
          style={{
            borderColor: "rgba(34,197,94,0.35)",
            background: "rgba(34,197,94,0.08)",
            color: "var(--primary)",
          }}
        >
          double opt-in
        </span>
      </div>

      <p className="mt-2 text-xs leading-5" style={{ color: "var(--fg-muted)" }}>
        Get emailed when a repo or search term crosses a star-growth threshold. One email per crossing.
      </p>

      {/* CREATE FORM */}
      <form
        onSubmit={submit}
        className="mt-4 flex flex-col gap-3"
        aria-label="Create alert"
      >
        {/* Email */}
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
          Your email
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (createState.kind !== "idle" && createState.kind !== "submitting") {
                setCreateState({ kind: "idle" });
              }
            }}
            placeholder="builder@example.com"
            className="mt-0.5 w-full rounded-md border px-3 py-2 text-sm outline-none transition"
            style={{
              borderColor: "var(--border-strong)",
              background: "#f8fafc",
              color: "#06080d",
            }}
            aria-describedby="alert-status"
          />
        </label>

        {/* Term */}
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
          Term to watch
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder='e.g. "rust" or "cloudflare workers"'
            maxLength={200}
            className="mt-0.5 w-full rounded-md border px-3 py-2 text-sm outline-none transition"
            style={{
              borderColor: "var(--border-strong)",
              background: "#f8fafc",
              color: "#06080d",
            }}
          />
        </label>

        {/* Kind toggle */}
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Kind
          </legend>
          <div className="mt-1 flex gap-2" role="group" aria-label="Alert kind">
            {(["topic", "query"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className="rounded-md border px-3 py-1 text-[11px] font-mono transition"
                style={{
                  borderColor: kind === k ? "var(--secondary)" : "var(--border)",
                  background: kind === k ? "rgba(59,130,246,0.12)" : "var(--surface-3)",
                  color: kind === k ? "var(--secondary)" : "var(--fg-muted)",
                }}
                aria-pressed={kind === k}
              >
                {k}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Metric + threshold row */}
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
            Metric
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as AlertRow["metric"])}
              className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-xs outline-none"
              style={{
                borderColor: "var(--border-strong)",
                background: "#f8fafc",
                color: "#06080d",
              }}
            >
              <option value="stars_pct">% growth</option>
              <option value="stars_abs">stars gained</option>
              <option value="velocity">stars/day</option>
            </select>
          </label>

          <label className="flex w-24 flex-col gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
            Threshold
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Math.max(1, Number(e.target.value)))}
              min={1}
              step={metric === "stars_pct" ? 5 : 1}
              className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-xs outline-none transition"
              style={{
                borderColor: thresholdColor,
                background: "#f8fafc",
                color: "#06080d",
                boxShadow: `0 0 0 1px ${thresholdColor}33`,
              }}
            />
          </label>
        </div>

        {/* Window */}
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
          Window (days)
          <input
            type="number"
            value={windowDays}
            onChange={(e) => setWindowDays(Math.max(1, Math.min(90, Number(e.target.value))))}
            min={1}
            max={90}
            className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-xs outline-none transition"
            style={{
              borderColor: "var(--border-strong)",
              background: "#f8fafc",
              color: "#06080d",
            }}
          />
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !email.trim() || !term.trim()}
          className="inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "linear-gradient(90deg, var(--primary), var(--secondary))",
            color: "#06080d",
            boxShadow: !isSubmitting ? "0 0 16px var(--primary-glow)" : "none",
          }}
        >
          {isSubmitting ? "Creating…" : "Create alert"}
        </button>
      </form>

      {/* Status region */}
      <div id="alert-status" className="mt-2 min-h-9" aria-live="polite">
        {createState.kind === "confirmed" && (
          <p className="text-xs leading-5" style={{ color: "var(--primary)" }}>
            <strong>Check your email</strong> to confirm this alert for{" "}
            {createState.email}. It will activate once you click the link.
          </p>
        )}
        {createState.kind === "error" && (
          <p className="text-xs leading-5" style={{ color: "var(--danger)" }}>
            {createState.message}
          </p>
        )}
        {createState.kind === "idle" && (
          <p className="text-[11px] leading-5" style={{ color: "var(--fg-dim)" }}>
            You&apos;ll get one email per threshold crossing. Unsubscribe anytime.
          </p>
        )}
      </div>

      {/* ACTIVE ALERTS LIST */}
      {(alerts.length > 0 || listLoading) && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--fg-dim)" }}
            >
              Your alerts
            </p>
            {listLoading && (
              <span className="text-[10px]" style={{ color: "var(--fg-dim)" }}>
                loading…
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2" role="list" aria-label="Active alerts">
            {alerts.map((alert) => {
              const color = METRIC_COLORS[alert.metric];
              const removing = removeStatus[alert.id] === "removing";
              const removeErr = removeStatus[alert.id] === "error";

              return (
                <div
                  key={alert.id}
                  role="listitem"
                  className="flex items-start justify-between gap-2 rounded-lg border p-3"
                  style={{
                    borderColor: "var(--border)",
                    background: "rgba(0,0,0,0.18)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    {/* Term + kind */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className="max-w-[120px] truncate text-xs font-semibold"
                        style={{ color: "var(--fg)" }}
                        title={alert.term}
                      >
                        {alert.term}
                      </span>
                      <span
                        className="rounded border px-1 py-0.5 text-[9px] font-mono"
                        style={{
                          borderColor: "rgba(59,130,246,0.3)",
                          background: "rgba(59,130,246,0.08)",
                          color: "var(--secondary)",
                        }}
                      >
                        {KIND_LABELS[alert.kind]}
                      </span>
                    </div>

                    {/* Metric + threshold + window */}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                      <span style={{ color: color }}>
                        {alert.metric === "stars_pct"
                          ? `${alert.threshold}% growth`
                          : `${alert.threshold} ${METRIC_LABELS[alert.metric]}`}
                      </span>
                      <span style={{ color: "var(--fg-dim)" }}>
                        / {alert.window_days}d
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {/* Status badge */}
                    <span
                      className="rounded border px-1.5 py-0.5 text-[9px] font-mono"
                      style={
                        alert.verified
                          ? {
                              borderColor: "rgba(34,197,94,0.35)",
                              background: "rgba(34,197,94,0.08)",
                              color: "var(--primary)",
                            }
                          : {
                              borderColor: "rgba(234,179,8,0.35)",
                              background: "rgba(234,179,8,0.08)",
                              color: "var(--accent)",
                            }
                      }
                    >
                      {alert.verified ? "active" : "pending"}
                    </span>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => void removeAlert(alert.id, alert.unsubToken)}
                      disabled={removing}
                      className="text-[10px] transition disabled:opacity-50"
                      style={{ color: removeErr ? "var(--danger)" : "var(--fg-dim)" }}
                      aria-label={`Remove alert for ${alert.term}`}
                    >
                      {removing ? "removing…" : removeErr ? "retry remove" : "remove"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
