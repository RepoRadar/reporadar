"use client";

import { useState } from "react";

type DeployStage =
  | { kind: "form" }
  | { kind: "running"; log: string[] }
  | { kind: "done"; url: string; slug: string; formFactor: string; log: string[] }
  | { kind: "error"; message: string; log: string[] };

export function DeployForm({
  repo,
  onResolved,
  onCancel,
}: {
  repo: string;
  onResolved: (result: { deployed: boolean; url?: string; slug?: string; hint?: string }) => void;
  onCancel: () => void;
}) {
  const [hint, setHint] = useState("");
  const [stage, setStage] = useState<DeployStage>({ kind: "form" });
  const [tickStartedAt, setTickStartedAt] = useState<number | null>(null);

  const submit = async () => {
    const log: string[] = [`launching deploy for ${repo}`];
    setStage({ kind: "running", log });
    setTickStartedAt(Date.now());

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo, hint: hint.trim() || undefined }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setStage({ kind: "error", message: j.error ?? "deploy failed", log: j.buildLog ?? log });
        return;
      }
      const merged = [...log, ...(j.buildLog ?? [])];
      setStage({ kind: "done", url: j.url, slug: j.slug, formFactor: j.surface?.formFactor ?? "?", log: merged });
    } catch (err) {
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
        <div className="font-mono text-sm" style={{ color: "var(--fg)" }}>{repo}</div>
        <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--fg-muted)" }}>
          What kind of surface? (optional)
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
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => {
              onCancel();
              onResolved({ deployed: false });
            }}
            className="rounded-md px-3 py-2 text-xs transition"
            style={{ color: "var(--fg-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-md px-3 py-2 text-xs font-medium transition"
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
    const seconds = tickStartedAt ? Math.floor((Date.now() - tickStartedAt) / 1000) : 0;
    return (
      <div
        className="flex flex-col gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--primary)", background: "var(--surface)" }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.18em] rr-blink" style={{ color: "var(--primary)" }}>
            ● Building…
          </div>
          <div className="font-mono text-xs" style={{ color: "var(--fg-muted)" }}>{seconds}s</div>
        </div>
        <BuildLog lines={stage.log} />
      </div>
    );
  }

  if (stage.kind === "done") {
    return (
      <div
        className="flex flex-col gap-3 rounded-xl border p-4"
        style={{ borderColor: "var(--secondary)", background: "rgba(34,211,238,0.06)" }}
      >
        <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--secondary)" }}>
          ✓ Deployed
        </div>
        <div className="font-mono text-sm" style={{ color: "var(--fg)" }}>{repo}</div>
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
          className="inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-medium tracking-wide"
          style={{
            background: "var(--secondary)",
            color: "#08070d",
            boxShadow: "0 0 16px var(--secondary-glow)",
          }}
        >
          Open ↗ {stage.url.replace(/^https?:\/\//, "")}
        </a>
        <BuildLog lines={stage.log} compact />
        <button
          onClick={() => onResolved({ deployed: true, url: stage.url, slug: stage.slug, hint })}
          className="rounded-md border px-3 py-2 text-xs transition"
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
          className="rounded-md px-3 py-2 text-xs"
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
