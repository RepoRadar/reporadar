"use client";

import type { ScoredRepo } from "@/app/lib/types";

const TAGS_SHOWN = 5;

export function RepoCard({
  repo,
  onDeploy,
  onSelect,
  onTagClick,
  selected = false,
  isDeploying = false,
  rank,
}: {
  repo: ScoredRepo;
  onDeploy: (repo: ScoredRepo) => void;
  onSelect?: (repo: ScoredRepo) => void;
  onTagClick?: (topic: string) => void;
  selected?: boolean;
  isDeploying?: boolean;
  rank?: number;
}) {
  const { overall } = repo.scores;
  const overallPct = Math.round(overall * 100);
  const tags = (repo.topics ?? []).slice(0, TAGS_SHOWN);

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

      {/* HERO ROW — medal/rank on the left, BIG star count on the right.
          Christo's rule: stars are the reward, make them huge. */}
      <div className="relative flex items-start justify-between gap-3">
        <RankMedal rank={rank} />
        <div className="flex flex-col items-end gap-0.5">
          <StarBadge stars={repo.stars} rank={rank} />
          <RepoTimeline createdAt={repo.createdAt} pushedAt={repo.pushedAt} />
        </div>
      </div>

      {/* TAGS ROW — top 5 GitHub topics. Click any one to repopulate the
          whole page by that tag. Primary scan affordance per Christo's
          rule: tags first, names last. */}
      <div className="relative flex flex-wrap items-center gap-1.5">
        {tags.length > 0 ? (
          tags.map((t) => (
            <button
              key={t}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(t);
              }}
              title={`Filter the whole page by GitHub topic: ${t}`}
              className="rounded-md border px-2 py-0.5 text-[10px] font-mono transition"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-3)",
                color: "var(--fg-muted)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
                (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
              }}
            >
              #{t}
            </button>
          ))
        ) : (
          <span className="text-[10px] font-mono" style={{ color: "var(--fg-dim)" }}>
            (no tags on this repo)
          </span>
        )}
      </div>

      {/* DESCRIPTION — what does this repo actually do */}
      {repo.description && (
        <p
          className="line-clamp-3 text-sm leading-relaxed"
          style={{ color: "var(--fg)" }}
        >
          {repo.description}
        </p>
      )}

      {repo.agentSummary && (
        <p className="text-xs leading-5" style={{ color: "var(--fg-muted)" }}>
          <span className="mr-1" style={{ color: "var(--primary)" }}>›</span>
          {repo.agentSummary}
        </p>
      )}

      {/* SCORE BAR — match against current sliders */}
      <div className="flex flex-col gap-1.5">
        <div
          className="flex items-center justify-between text-[10px] font-mono"
          title="Overall match score (0-100): weighted by your sliders. Higher = better fit. Re-ranks live as you tune."
        >
          <span style={{ color: "var(--fg-dim)" }}>match score</span>
          <span style={{ color: "var(--primary)", fontWeight: 600 }}>
            {overallPct}/100
          </span>
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
                "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent), var(--danger))",
              boxShadow: "0 0 8px var(--primary-glow)",
            }}
          />
        </div>
      </div>

      {/* FOOTER — small repo identity + Deploy button */}
      <div className="mt-auto flex items-end justify-between gap-3 pt-1">
        <a
          href={repo.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="truncate font-mono text-[11px] underline underline-offset-2 transition"
          style={{ color: "var(--secondary)", maxWidth: "60%", textDecorationColor: "var(--secondary)" }}
          title={`Open ${repo.fullName} on GitHub in a new tab ↗`}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)";
            (e.currentTarget as HTMLAnchorElement).style.textDecorationColor = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--secondary)";
            (e.currentTarget as HTMLAnchorElement).style.textDecorationColor = "var(--secondary)";
          }}
        >
          ↗ {repo.fullName}
          {repo.language ? ` · ${repo.language}` : ""}
        </a>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeploy(repo);
          }}
          disabled={isDeploying}
          className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium tracking-wide transition disabled:opacity-50"
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
    </div>
  );
}

function RankMedal({ rank }: { rank?: number }) {
  if (rank == null) return null;
  // 1st = gold, 2nd = silver, 3rd = bronze. Beyond 3 = a plain numeric chip.
  const medal = MEDALS[rank];
  if (!medal) {
    return (
      <span
        className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-mono"
        style={{
          background: "var(--surface-3)",
          color: "var(--fg-dim)",
          border: "1px solid var(--border)",
        }}
        title={`Rank ${rank} given your current sliders + sort priorities`}
      >
        {String(rank).padStart(2, "0")}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-1 text-sm font-bold tracking-tight"
      style={{
        background: medal.bg,
        color: medal.fg,
        boxShadow: `${medal.glow}, inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)`,
        border: `1px solid ${medal.border}`,
      }}
      title={`${medal.label} place — ranked ${rank} given your current sliders + sort priorities`}
      aria-label={`${medal.label} place medal`}
    >
      {rank}
    </span>
  );
}

const MEDALS: Record<number, { label: string; bg: string; fg: string; border: string; glow: string }> = {
  1: {
    label: "1st",
    bg: "linear-gradient(135deg, #fde68a 0%, #f59e0b 50%, #d97706 100%)",
    fg: "#3a2a05",
    border: "#f59e0b",
    glow: "0 0 14px rgba(245, 158, 11, 0.55)",
  },
  2: {
    label: "2nd",
    bg: "linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 50%, #64748b 100%)",
    fg: "#1f2937",
    border: "#94a3b8",
    glow: "0 0 12px rgba(148, 163, 184, 0.45)",
  },
  3: {
    label: "3rd",
    bg: "linear-gradient(135deg, #fcd34d 0%, #b45309 60%, #78350f 100%)",
    fg: "#fff7e6",
    border: "#b45309",
    glow: "0 0 12px rgba(180, 83, 9, 0.5)",
  },
};

function StarBadge({ stars, rank }: { stars: number; rank?: number }) {
  // Top 3 get the huge font + medal-tinted glow; everyone else still gets a
  // big number, just slightly smaller.
  const isPodium = rank != null && rank <= 3;
  const pretty = formatStars(stars);
  return (
    <div
      className="flex items-baseline gap-1.5"
      title={`${stars.toLocaleString()} stars on GitHub`}
    >
      <span
        className="text-3xl font-bold tracking-tight tabular-nums leading-none"
        style={{
          color: isPodium ? "var(--accent)" : "var(--fg)",
          textShadow: isPodium ? "0 0 20px rgba(234, 179, 8, 0.45)" : "none",
        }}
      >
        {pretty}
      </span>
      <span
        className="text-base"
        style={{ color: "var(--accent)" }}
        aria-hidden
      >
        ★
      </span>
    </div>
  );
}

function formatStars(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function RepoTimeline({ createdAt, pushedAt }: { createdAt?: string; pushedAt?: string }) {
  // Two timestamps that together tell a velocity story at a glance:
  //   "launched"  → repo's createdAt (when it was first pushed up)
  //   "last star" → pushedAt is the closest signal GitHub exposes on
  //                 the search endpoint; fork/star timestamps aren't
  //                 included. Labelled "last update" so we don't lie.
  const launched = formatDate(createdAt);
  const lastUpdate = formatRelative(pushedAt);
  if (!launched && !lastUpdate) return null;
  return (
    <div
      className="flex items-baseline gap-2 text-[10px] font-mono"
      style={{ color: "var(--fg-dim)" }}
    >
      {launched && (
        <span title={`Launched ${createdAt ?? ""}`}>
          launched <span style={{ color: "var(--fg-muted)" }}>{launched}</span>
        </span>
      )}
      {launched && lastUpdate && <span style={{ color: "var(--fg-dim)" }}>·</span>}
      {lastUpdate && (
        <span title={`Most recent push ${pushedAt ?? ""}`}>
          last update <span style={{ color: "var(--fg-muted)" }}>{lastUpdate}</span>
        </span>
      )}
    </div>
  );
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // e.g. "May 2024"
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatRelative(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
