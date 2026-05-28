"use client";

import type { ScoredRepo } from "@/app/lib/types";

const TAGS_SHOWN = 5;
const RADAR_GRADIENT =
  "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent), var(--danger))";

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
  const repoName = repo.fullName.split("/")[1] ?? repo.fullName;

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
      aria-label={onSelect ? `Load ${repo.fullName} into the radar and sliders` : undefined}
      className="group relative flex h-full flex-col gap-3 overflow-visible rounded-xl border p-4 transition cursor-pointer outline-none focus-visible:ring-2"
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

      {/* HERO: rank, repo name, and stars stay in one guarded row. */}
      <div className="relative flex flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <RankMedal rank={rank} />
          <span
            className="min-w-0 flex-1 truncate text-xl font-bold leading-tight tracking-normal transition"
            style={{ color: "var(--fg)" }}
          >
            {repoName}
          </span>
          <StarBadge stars={repo.stars} rank={rank} />
        </div>
        <div className="grid min-w-0 gap-0.5 pl-11 text-[11px] font-mono">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate" style={{ color: "var(--fg-muted)" }}>
              {repo.fullName}
            </span>
            {repo.language && (
              <>
                <span className="shrink-0" style={{ color: "var(--fg-dim)" }}>·</span>
                <span className="shrink-0" style={{ color: "var(--secondary)" }}>{repo.language}</span>
              </>
            )}
          </div>
          <div>
            <RepoTimeline createdAt={repo.createdAt} pushedAt={repo.pushedAt} />
          </div>
        </div>
      </div>

      {/* TAGS ROW: top 5 GitHub topics. Click any one to repopulate the
          whole page by that tag. */}
      <div className="relative flex min-h-[4.25rem] content-start items-start gap-1.5 flex-wrap">
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

      {/* DESCRIPTION: what does this repo actually do */}
      {(repo.descriptionEn || repo.description) && (
        <div className="group/desc relative flex min-h-[5rem] flex-col gap-1.5">
          {repo.descriptionEn && repo.descriptionLang && (
            <span
              className="inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-mono"
              style={{
                borderColor: "var(--border)",
                background: "rgba(234,179,8,0.08)",
                color: "var(--accent)",
              }}
              title={`Original: ${repo.description ?? ""}`}
            >
              [Translated from {repo.descriptionLang}]
            </span>
          )}
          <div className="relative">
            <p
              className="line-clamp-3 text-sm leading-relaxed"
              style={{ color: "var(--fg)" }}
            >
              {repo.descriptionEn || repo.description}
            </p>
            {(repo.descriptionEn || repo.description || "").length > 120 && (
              <div
                className="pointer-events-none absolute -left-3 -right-3 top-0 z-30 max-h-64 overflow-auto rounded-md border p-3 text-sm leading-relaxed opacity-0 shadow-2xl transition delay-700 duration-150 group-hover/desc:pointer-events-auto group-hover/desc:opacity-100"
                style={{
                  borderColor: "var(--border-strong)",
                  background: "var(--surface)",
                  color: "var(--fg)",
                  boxShadow: "0 18px 40px rgba(0,0,0,0.42)",
                }}
              >
                {repo.descriptionEn || repo.description}
              </div>
            )}
          </div>
        </div>
      )}
      {!(repo.descriptionEn || repo.description) && <div className="min-h-[5rem]" />}

      {repo.agentSummary && (
        <p className="text-xs leading-5" style={{ color: "var(--fg-muted)" }}>
          <span className="mr-1" style={{ color: "var(--primary)" }}>›</span>
          {repo.agentSummary}
        </p>
      )}

      {/* SCORE BAR: match against current sliders */}
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
              background: RADAR_GRADIENT,
              boxShadow: "0 0 8px var(--primary-glow)",
            }}
          />
        </div>
      </div>

      {/* FOOTER: three-item action row */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <a
          href={repo.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open ${repo.fullName} on GitHub`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 font-mono text-[11px] transition"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-3)",
            color: "var(--secondary)",
          }}
          title={`Open ${repo.fullName} on GitHub in a new tab`}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--secondary)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--secondary)";
          }}
        >
          <GitHubMark size={13} />
          GitHub repo
        </a>
        <a
          href={`/chat/${repo.fullName}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Ask ${repo.fullName}, opens the chat workspace in a new tab`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 font-mono text-[11px] transition"
          style={{
            borderColor: "var(--secondary)",
            background: "rgba(59,130,246,0.08)",
            color: "var(--secondary)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(59,130,246,0.20)";
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 0 16px var(--secondary-glow)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(59,130,246,0.08)";
            (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
          }}
        >
          <ChatIcon size={13} />
          Ask this repo
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

function GitHubMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.69 5.47 7.77.4.08.55-.18.55-.4l-.01-1.4c-2.23.5-2.7-1.1-2.7-1.1-.36-.95-.89-1.2-.89-1.2-.73-.51.06-.5.06-.5.8.06 1.23.85 1.23.85.72 1.26 1.88.9 2.34.68.07-.53.28-.9.51-1.1-1.78-.2-3.64-.91-3.64-4.05 0-.9.31-1.63.82-2.2-.08-.21-.36-1.04.08-2.17 0 0 .67-.22 2.2.84A7.45 7.45 0 0 1 8 3.95c.68 0 1.36.09 2 .27 1.52-1.06 2.19-.84 2.19-.84.44 1.13.16 1.96.08 2.17.51.57.82 1.3.82 2.2 0 3.15-1.87 3.84-3.65 4.05.29.26.54.76.54 1.53l-.01 2.24c0 .22.15.48.55.4A8.13 8.13 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z" />
    </svg>
  );
}

function ChatIcon({ size = 13 }: { size?: number }) {
  // Speech-bubble with a question mark: recognizable chat/ask icon, not decorative.
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M2 1.5A1.5 1.5 0 0 1 3.5 0h9A1.5 1.5 0 0 1 14 1.5v8A1.5 1.5 0 0 1 12.5 11H8.707l-2.853 2.854A.5.5 0 0 1 5 13.5V11H3.5A1.5 1.5 0 0 1 2 9.5v-8Z" />
      <path
        fill="var(--surface-3)"
        d="M7.168 3.5c-.494 0-.916.115-1.264.345-.348.23-.614.556-.797.98a.4.4 0 0 0 .198.52.39.39 0 0 0 .515-.2c.13-.308.3-.534.51-.677.212-.144.48-.216.805-.216.328 0 .594.077.797.23.203.154.305.37.305.647 0 .19-.047.355-.14.496a1.59 1.59 0 0 1-.352.373 5.6 5.6 0 0 0-.41.363 1.5 1.5 0 0 0-.312.493 2.1 2.1 0 0 0-.098.665v.23c0 .22.178.398.398.398a.398.398 0 0 0 .398-.398v-.22c0-.226.03-.411.09-.554.06-.143.146-.27.259-.383.112-.112.242-.228.39-.347.148-.12.285-.254.41-.402.124-.148.224-.315.3-.5a1.7 1.7 0 0 0 .111-.627c0-.498-.17-.895-.513-1.19C7.984 3.648 7.622 3.5 7.168 3.5Zm.527 5.34a.525.525 0 1 0-1.05 0 .525.525 0 0 0 1.05 0Z"
      />
    </svg>
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
      title={`${medal.label} place, ranked ${rank} given your current sliders + sort priorities`}
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
  // Keep stars prominent, but compact enough to share the title row.
  const isPodium = rank != null && rank <= 3;
  const pretty = formatStars(stars);
  return (
    <div
      className="flex shrink-0 items-baseline gap-1"
      title={`${stars.toLocaleString()} stars on GitHub`}
    >
      <span
        className="text-2xl font-bold leading-none"
        style={{ color: "var(--accent)" }}
        aria-hidden
      >
        ★
      </span>
      <span
        className="text-2xl font-bold tracking-tight tabular-nums leading-none"
        style={{
          color: isPodium ? "var(--accent)" : "var(--fg)",
          textShadow: isPodium ? "0 0 14px rgba(234, 179, 8, 0.38)" : "none",
        }}
      >
        {pretty}
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
