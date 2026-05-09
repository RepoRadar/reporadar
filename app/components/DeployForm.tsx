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
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/80 p-4">
        <div className="text-xs uppercase tracking-wider text-emerald-400">Deploy a generative surface</div>
        <div className="font-mono text-sm">{repo}</div>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Anything to optimize for? (optional)
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="e.g. 'control panel for IoT', 'dashboard with charts'"
            className="rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500/60"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={() => {
              onCancel();
              onResolved({ deployed: false });
            }}
            className="rounded-md px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-medium text-black hover:bg-emerald-400"
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
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-zinc-900/80 p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-emerald-400">Building…</div>
          <div className="font-mono text-xs text-zinc-500">{seconds}s</div>
        </div>
        <BuildLog lines={stage.log} />
      </div>
    );
  }

  if (stage.kind === "done") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
        <div className="text-xs uppercase tracking-wider text-emerald-400">Deployed</div>
        <div className="font-mono text-sm text-zinc-100">{repo}</div>
        <div className="flex flex-col gap-1 rounded-md border border-white/10 bg-black/40 p-3">
          <span className="text-xs text-zinc-500">form factor</span>
          <span className="font-mono text-sm text-zinc-200">{stage.formFactor}</span>
        </div>
        <a
          href={stage.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-2 text-xs font-medium text-black hover:bg-emerald-400"
        >
          Open {stage.url} ↗
        </a>
        <BuildLog lines={stage.log} compact />
        <button
          onClick={() => onResolved({ deployed: true, url: stage.url, slug: stage.slug, hint })}
          className="rounded-md border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
        >
          Acknowledge
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
      <div className="text-xs uppercase tracking-wider text-red-400">Deploy failed</div>
      <div className="text-sm text-zinc-200">{stage.message}</div>
      <BuildLog lines={stage.log} compact />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => onResolved({ deployed: false })}
          className="rounded-md px-3 py-2 text-xs text-zinc-400 hover:bg-white/5"
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
      className={`overflow-auto rounded-md border border-white/10 bg-black/60 p-3 font-mono text-[11px] text-zinc-400 ${
        compact ? "max-h-24" : "max-h-40"
      }`}
    >
      {lines.map((l, i) => (
        <div key={i}>
          <span className="text-zinc-600">›</span> {l}
        </div>
      ))}
    </pre>
  );
}
