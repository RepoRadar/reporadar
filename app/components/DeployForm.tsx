"use client";

import { useEffect, useRef, useState } from "react";

type DeployStage =
  | { kind: "form" }
  | { kind: "running"; log: string[]; progress: number; milestoneIdx: number; seconds: number }
  | { kind: "done"; url: string; slug: string; formFactor: string; log: string[]; notified?: "sent" | "queued" }
  | { kind: "error"; message: string; log: string[] };

const MILESTONES = [
  "Fetching repo metadata from GitHub (description, topics, README)",
  "Asking Gemini 2.5 Flash to pick a form factor + emit A2UI surface JSON",
  "Validating components + writing surface to Cloudflare R2",
  "Recording the deploy in Cloudflare D1 (slug → repo mapping)",
  "Going live at your reporadar.io subdomain via the serve worker",
] as const;

export function DeployForm({
  repo,
  description,
  onResolved,
  onCancel,
  onStatusChange,
}: {
  repo: string;
  description?: string | null;
  onResolved: (result: { deployed: boolean; url?: string; slug?: string; hint?: string }) => void;
  onCancel: () => void;
  onStatusChange?: (status: DeployStage["kind"]) => void;
}) {
  const [hint, setHint] = useState("");
  const [contact, setContact] = useState("");
  const [stage, setStage] = useState<DeployStage>({ kind: "form" });
  const tickStartedAt = useRef<number | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  useEffect(() => {
    onStatusChange?.(stage.kind);
  }, [onStatusChange, stage.kind]);

  const submit = async () => {
    const log: string[] = [`launching deploy for ${repo}`];
    tickStartedAt.current = Date.now();
    setStage({ kind: "running", log, progress: 4, milestoneIdx: 0, seconds: 0 });

    // Animate progress + milestones based on elapsed time. Caps at 92% until
    // the real fetch resolves, then jumps to 100% in the done state.
    progressTimer.current = setInterval(() => {
      const elapsed = (Date.now() - (tickStartedAt.current ?? Date.now())) / 1000;
      const seconds = Math.floor(elapsed);
      const fakePct = Math.min(92, 4 + Math.round((1 - Math.exp(-elapsed / 6)) * 92));
      const idx = Math.min(MILESTONES.length - 1, Math.floor(elapsed / 2.4));
      setStage((s) => (s.kind === "running" ? { ...s, progress: fakePct, milestoneIdx: idx, seconds } : s));
    }, 250);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repo,
          hint: hint.trim() || undefined,
          contact: contact.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (progressTimer.current) clearInterval(progressTimer.current);
      if (!res.ok || !j.ok) {
        setStage({ kind: "error", message: j.error ?? "deploy failed", log: j.buildLog ?? log });
        return;
      }
      const merged = [...log, ...(j.buildLog ?? [])];
      setStage({
        kind: "done",
        url: j.url,
        slug: j.slug,
        formFactor: j.surface?.formFactor ?? "?",
        log: merged,
        notified: j.notified,
      });
    } catch (err) {
      if (progressTimer.current) clearInterval(progressTimer.current);
      const msg = err instanceof Error ? err.message : String(err);
      setStage({ kind: "error", message: msg, log: [...log, `error: ${msg}`] });
    }
  };

  if (stage.kind === "form") {
    return (
      <div
        className="flex flex-col gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--primary)" }}>
            Deploy a generative surface
          </div>
          <span className="text-[10px] font-mono" style={{ color: "var(--secondary)" }}>
            ·.reporadar.io
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="font-mono text-sm" style={{ color: "var(--fg)" }}>{repo}</div>
          {description && (
            <p className="text-xs leading-5" style={{ color: "var(--fg-muted)" }}>
              {description}
            </p>
          )}
        </div>

        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
          What kind of surface? <span style={{ color: "var(--fg-dim)" }}>(optional)</span>
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="e.g. 'control panel for IoT', 'dashboard with charts', 'wizard'"
            className="rounded-md border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: "var(--border-strong)",
              background: "rgba(0,0,0,0.40)",
              color: "var(--fg)",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = "var(--primary)";
              (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--primary-glow)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-strong)";
              (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
            }}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
          Notify me when ready <span style={{ color: "var(--fg-dim)" }}>(email or phone — optional)</span>
          <input
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="you@example.com or +14155551234"
            className="rounded-md border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: "var(--border-strong)",
              background: "rgba(0,0,0,0.40)",
              color: "var(--fg)",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = "var(--primary)";
              (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--primary-glow)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-strong)";
              (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
            }}
          />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => {
              onCancel();
              onResolved({ deployed: false });
            }}
            className="cursor-pointer rounded-md px-3 py-2 text-xs transition"
            style={{ color: "var(--fg-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="cursor-pointer rounded-md px-3 py-2 text-xs font-medium transition"
            style={{
              background: "var(--primary)",
              color: "#08070d",
              boxShadow: "0 0 16px var(--primary-glow)",
            }}
          >
            Deploy →
          </button>
        </div>
      </div>
    );
  }

  if (stage.kind === "running") {
    return (
      <div
        className="flex flex-col gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--primary)", background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.18em] rr-blink" style={{ color: "var(--primary)" }}>
            ● Building…
          </div>
          <div className="font-mono text-xs" style={{ color: "var(--fg-muted)" }}>{stage.seconds}s · {stage.progress}%</div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${stage.progress}%`,
              background: "linear-gradient(90deg, var(--primary), var(--accent), var(--secondary))",
              boxShadow: "0 0 12px var(--primary-glow)",
            }}
          />
        </div>

        <ul className="flex flex-col gap-1">
          {MILESTONES.map((m, i) => {
            const done = i < stage.milestoneIdx;
            const active = i === stage.milestoneIdx;
            return (
              <li key={m} className="flex items-center gap-2 text-[11px]">
                <span
                  className={active ? "rr-blink" : ""}
                  style={{
                    color: done ? "var(--secondary)" : active ? "var(--primary)" : "var(--fg-dim)",
                    fontFamily: "ui-monospace, monospace",
                    width: 12,
                  }}
                >
                  {done ? "✓" : active ? "●" : "○"}
                </span>
                <span
                  style={{
                    color: done ? "var(--fg)" : active ? "var(--fg)" : "var(--fg-dim)",
                  }}
                >
                  {m}
                </span>
              </li>
            );
          })}
        </ul>

        {contact && (
          <div className="text-[10px] font-mono" style={{ color: "var(--fg-dim)" }}>
            We&apos;ll ping <span style={{ color: "var(--secondary)" }}>{contact}</span> when it&apos;s ready.
          </div>
        )}

        <BuildLog lines={stage.log} compact />
      </div>
    );
  }

  if (stage.kind === "done") {
    return (
      <div
        className="flex flex-col gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--secondary)", background: "rgba(59,130,246,0.06)" }}
      >
        <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--secondary)" }}>
          ✓ Deployed
        </div>
        <div className="flex flex-col gap-1">
          <div className="font-mono text-sm" style={{ color: "var(--fg)" }}>{repo}</div>
          {description && (
            <p className="text-xs leading-5" style={{ color: "var(--fg-muted)" }}>
              {description}
            </p>
          )}
        </div>
        <div
          className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
          style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.40)" }}
        >
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--fg-dim)" }}>
            form factor
          </span>
          <span className="font-mono text-xs" style={{ color: "var(--accent)" }}>
            {stage.formFactor}
          </span>
        </div>
        <a
          href={stage.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center justify-center rounded-md px-3 py-2 text-xs font-medium tracking-wide transition hover:scale-[1.01]"
          style={{
            background: "var(--secondary)",
            color: "#08070d",
            boxShadow: "0 0 16px var(--secondary-glow)",
          }}
        >
          Open ↗ {stage.url.replace(/^https?:\/\//, "")}
        </a>
        <div
          className="rounded-md border p-3 text-[11px] leading-relaxed"
          style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.30)", color: "var(--fg-muted)" }}
        >
          <div className="mb-1.5 font-mono uppercase tracking-[0.18em]" style={{ color: "var(--accent)", fontSize: "9px" }}>
            How to test
          </div>
          <ol className="ml-4 list-decimal space-y-0.5">
            <li>Open the URL above — it&apos;s a real interactive app, not a screenshot.</li>
            <li>Fill in any text fields and click <span style={{ color: "var(--primary)" }}>Save</span>. The record persists in this deploy&apos;s own Cloudflare D1 table.</li>
            <li>Click <span style={{ color: "var(--secondary)" }}>Refresh</span> (or reload the page) — your records reappear.</li>
            <li>Click <span style={{ color: "var(--fg)" }}>×</span> next to any saved record to delete it.</li>
            <li>Share the URL — anyone visiting sees the same persisted data.</li>
          </ol>
        </div>
        {contact && (
          <div className="text-[10px] font-mono" style={{ color: "var(--fg-dim)" }}>
            {stage.notified === "sent" ? (
              <>
                ✓ Email sent to <span style={{ color: "var(--secondary)" }}>{contact}</span>
              </>
            ) : (
              <>
                Notification queued for <span style={{ color: "var(--secondary)" }}>{contact}</span>
                {" "}<span style={{ color: "var(--fg-dim)" }}>· will fire once RESEND_API_KEY lands</span>
              </>
            )}
          </div>
        )}
        <BuildLog lines={stage.log} compact />
        <button
          onClick={() => onResolved({ deployed: true, url: stage.url, slug: stage.slug, hint })}
          className="cursor-pointer rounded-md border px-3 py-2 text-xs transition hover:scale-[1.01]"
          style={{ borderColor: "var(--border-strong)", color: "var(--fg-muted)" }}
        >
          Acknowledge
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{ borderColor: "var(--danger)", background: "rgba(248,113,113,0.06)" }}
    >
      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--danger)" }}>
        Deploy failed
      </div>
      <div className="text-sm" style={{ color: "var(--fg)" }}>{stage.message}</div>
      <BuildLog lines={stage.log} compact />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onResolved({ deployed: false })}
          className="cursor-pointer rounded-md px-3 py-2 text-xs"
          style={{ color: "var(--fg-muted)" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function BuildLog({ lines, compact = false }: { lines: string[]; compact?: boolean }) {
  return (
    <pre
      className="overflow-auto rounded-md border p-3 font-mono text-[11px] leading-5"
      style={{
        borderColor: "var(--border)",
        background: "rgba(0,0,0,0.50)",
        color: "var(--fg-muted)",
        maxHeight: compact ? "6rem" : "10rem",
      }}
    >
      {lines.map((l, i) => (
        <div key={i}>
          <span style={{ color: "var(--fg-dim)" }}>›</span> {l}
        </div>
      ))}
    </pre>
  );
}
