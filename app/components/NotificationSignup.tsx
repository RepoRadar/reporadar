"use client";

import { useEffect, useMemo, useState } from "react";
import { track } from "@/app/lib/analytics";
import type { NotificationDigestItem } from "@/app/lib/notifications";

const STORAGE_KEY = "reporadar-notification-profile-v1";
const SOURCES = ["RepoRadar", "GitHub", "Product Hunt demo"] as const;

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "queued"; email: string; preview: string }
  | { kind: "error"; message: string };

type StoredProfile = {
  email: string;
  sources: string[];
  updatedAt: string;
};

export function NotificationSignup({
  digest,
}: {
  digest: NotificationDigestItem[];
}) {
  const [email, setEmail] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([
    "RepoRadar",
    "GitHub",
    "Product Hunt demo",
  ]);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as Partial<StoredProfile>;
        if (typeof stored.email === "string") setEmail(stored.email);
        if (Array.isArray(stored.sources) && stored.sources.length > 0) {
          setSelectedSources(stored.sources.filter((source): source is string => typeof source === "string"));
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const previewItems = useMemo(() => digest.slice(0, 3), [digest]);
  const isSubmitting = state.kind === "submitting";

  const toggleSource = (source: string) => {
    setSelectedSources((current) => {
      if (current.includes(source)) {
        const next = current.filter((item) => item !== source);
        return next.length > 0 ? next : current;
      }
      return [...current, source];
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setState({ kind: "submitting" });
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          sources: selectedSources,
          digest: previewItems,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setState({ kind: "error", message: body.error ?? "Could not queue demo email." });
        return;
      }

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          email: body.email,
          sources: selectedSources,
          updatedAt: new Date().toISOString(),
        } satisfies StoredProfile),
      );
      // source count only — no email/PII in the payload (T-02-14).
      track("alert_signup", { sources: selectedSources.length });
      setEmail(body.email);
      setState({
        kind: "queued",
        email: body.email,
        preview: body.dummyEmail?.preview ?? "Demo email queued.",
      });
    } catch {
      setState({ kind: "error", message: "Network error while queuing the demo email." });
    }
  };

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
            borderColor: "rgba(234,179,8,0.35)",
            background: "rgba(234,179,8,0.08)",
            color: "var(--accent)",
          }}
        >
          demo email
        </span>
      </div>

      <p className="mt-2 text-xs leading-5" style={{ color: "var(--fg-muted)" }}>
        Save an email and queue a sample digest from today&apos;s RepoRadar scan plus demo Product Hunt-style signals.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Notification sources">
        {SOURCES.map((source) => {
          const selected = selectedSources.includes(source);
          return (
            <button
              key={source}
              type="button"
              onClick={() => toggleSource(source)}
              className="rounded-md border px-2 py-1 text-[10px] font-mono transition"
              style={{
                borderColor: selected ? "var(--secondary)" : "var(--border)",
                background: selected ? "rgba(59,130,246,0.12)" : "var(--surface-3)",
                color: selected ? "var(--secondary)" : "var(--fg-muted)",
              }}
              aria-pressed={selected}
            >
              {source}
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono">
          <span style={{ color: "var(--fg-dim)" }}>email preview</span>
          <span style={{ color: "var(--primary)" }}>today</span>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {previewItems.length > 0 ? (
            previewItems.map((item) => (
              <div key={`${item.source}-${item.title}`} className="grid grid-cols-[1fr_auto] gap-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-mono" style={{ color: "var(--fg)" }}>{item.title}</div>
                  <div className="truncate text-[11px]" style={{ color: "var(--fg-dim)" }}>{item.subtitle}</div>
                </div>
                <span className="font-mono text-[11px]" style={{ color: "var(--primary)" }}>
                  {item.score}/100
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs leading-5" style={{ color: "var(--fg-dim)" }}>
              Trend items will appear as soon as the radar has repos to summarize.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        <label className="text-xs" style={{ color: "var(--fg-muted)" }}>
          Notification email
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (state.kind !== "idle" && state.kind !== "submitting") setState({ kind: "idle" });
            }}
            onInput={(event) => {
              setEmail(event.currentTarget.value);
              if (state.kind !== "idle" && state.kind !== "submitting") setState({ kind: "idle" });
            }}
            placeholder="builder@example.com"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none transition"
            style={{
              borderColor: "var(--border-strong)",
              background: "#f8fafc",
              color: "#06080d",
            }}
            aria-describedby="notification-status"
          />
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-9 items-center justify-center rounded-md px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "linear-gradient(90deg, var(--primary), var(--secondary))",
            color: "#06080d",
            boxShadow: !isSubmitting ? "0 0 16px var(--primary-glow)" : "none",
          }}
        >
          {state.kind === "submitting" ? "Queuing…" : "Send demo email"}
        </button>
      </form>

      <div id="notification-status" className="mt-2 min-h-9" aria-live="polite">
        {state.kind === "queued" && (
          <p className="text-xs leading-5" style={{ color: "var(--primary)" }}>
            <strong>Demo email queued</strong> for {state.email}. {state.preview}
          </p>
        )}
        {state.kind === "error" && (
          <p className="text-xs leading-5" style={{ color: "var(--danger)" }}>
            {state.message}
          </p>
        )}
        {state.kind === "idle" && (
          <p className="text-[11px] leading-5" style={{ color: "var(--fg-dim)" }}>
            Stored locally for now. Real delivery and unsubscribe flows are tracked for the next pass.
          </p>
        )}
      </div>
    </section>
  );
}
