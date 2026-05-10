"use client";

import type { ScoredRepo } from "@/app/lib/types";

export function RepoCard({
  repo,
  onDeploy,
  onSelect,
  selected = false,
  isDeploying = false,
  rank,
}: {
  repo: ScoredRepo;
  onDeploy: (repo: ScoredRepo) => void;
  onSelect?: (repo: ScoredRepo) => void;
  selected?: boolean;
  isDeploying?: boolean;
  rank?: number;
}) {
  const { complexity, uiPotential, overall } = repo.scores;
  const overallPct = Math.round(overall * 100);

  return (
    <div
      onClick={() => onSelect?.(repo)}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(repo);
        }
      }}
      title={onSelect ? "Click to load this repo's profile into the radar + sliders" : undefined}
      className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border p-4 transition cursor-pointer outline-none focus-visible:ring-2"
      style={{
        borderColor: selected ? "var(--primary)" : "var(--border)",
        background:
          "linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)",
        boxShadow: selected ? "0 0 24px var(--primary-glow)" : "none",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 transition"
        style={{
          opacity: selected ? 1 : 0,
          background:
            "radial-gradient(600px 200px at top right, rgba(34,197,94,0.12), transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px 200px at top right, rgba(34,197,94,0.08), transparent 60%)",
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {rank != null && (
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-mono"
                style={{
                  background: "var(--surface-3)",
                  color: rank <= 3 ? "var(--accent)" : "var(--fg-dim)",
                  border: `1px solid ${rank <= 3 ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {String(rank).padStart(2, "0")}
              </span>
            )}
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-sm font-medium transition hover:underline"
              style={{ color: "var(--fg)" }}
            >
              {repo.fullName}
            </a>
          </div>
          {repo.description && (
            <p
              className="mt-1.5 line-clamp-2 text-xs leading-relaxed"
              style={{ color: "var(--fg-muted)" }}
            >
              {repo.description}
            </p>
          )}
        </div>
        <div
          className="flex flex-col items-end gap-0.5 text-right text-[10px] font-mono"
          style={{ color: "var(--fg-dim)" }}
        >
          <span style={{ color: "var(--accent)" }}>★ {format(repo.stars)}</span>
          {repo.language && <span>{repo.language}</span>}
        </div>
      </div>

      {repo.agentSummary && (
        <p
          className="text-xs leading-5"
          style={{ color: "var(--fg)" }}
        >
          <span className="mr-1" style={{ color: "var(--primary)" }}>›</span>
          {repo.agentSummary}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <Pill
            label="depth"
            value={complexity}
            max={10}
            color="var(--secondary)"
            help="Depth (0-10): how substantive the codebase is. Higher = more to dig into."
          />
          <Pill
            label="ui"
            value={uiPotential}
            max={10}
            color="var(--accent)"
            help="UI potential (0-10): how rich a generative-UI surface this repo can support. Higher = better."
          />
          <Pill
            label="score"
            value={overallPct}
            max={100}
            color="var(--primary)"
            emphasized
            help="Overall match score (0-100): weighted by your sliders. Higher = better fit. Re-ranks live as you tune."
          />
        </div>
        <div
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ background: "var(--surface-3)" }}
        >
          <div
            className="h-full"
            style={{
              width: `${overallPct}%`,
              background:
                "linear-gradient(90deg, var(--primary), var(--accent), var(--secondary))",
              boxShadow: "0 0 8px var(--primary-glow)",
            }}
          />
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeploy(repo);
        }}
        disabled={isDeploying}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium tracking-wide transition disabled:opacity-50"
        style={{
          borderColor: "var(--primary)",
          background: "rgba(34,197,94,0.08)",
          color: "var(--primary)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.20)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px var(--primary-glow)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
        }}
      >
        {isDeploying ? "deploying…" : "Deploy →"}
      </button>
    </div>
  );
}

function Pill({
  label,
  value,
  max,
  color,
  emphasized,
  help,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  emphasized?: boolean;
  help?: string;
}) {
  return (
    <span
      className="flex cursor-help items-center gap-1"
      title={help ?? `${label}: ${value} of ${max} (higher = better)`}
    >
      <span style={{ color: "var(--fg-dim)" }}>{label}</span>
      <span
        style={{
          color: emphasized ? color : "var(--fg)",
          fontWeight: emphasized ? 600 : 500,
        }}
      >
        {value}/{max}
      </span>
    </span>
  );
}

function format(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
