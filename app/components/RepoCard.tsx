"use client";

import type { ScoredRepo } from "@/app/lib/types";

export function RepoCard({
  repo,
  onDeploy,
  isDeploying = false,
}: {
  repo: ScoredRepo;
  onDeploy: (repo: ScoredRepo) => void;
  isDeploying?: boolean;
}) {
  const { complexity, uiPotential, overall } = repo.scores;
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-white/10 bg-zinc-900/60 p-4 transition hover:border-emerald-500/40 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-sm font-medium text-zinc-100 hover:text-emerald-400"
          >
            {repo.fullName}
          </a>
          {repo.description && (
            <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{repo.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end text-right text-[10px] font-mono text-zinc-500">
          <span>★ {format(repo.stars)}</span>
          {repo.language && <span>{repo.language}</span>}
        </div>
      </div>

      {repo.agentSummary && (
        <p className="text-xs leading-5 text-zinc-300">
          <span className="mr-1 text-emerald-400">›</span>
          {repo.agentSummary}
        </p>
      )}

      <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
        <Pill label="complexity" value={complexity} max={10} />
        <Pill label="ui" value={uiPotential} max={10} />
        <Pill label="score" value={Math.round(overall * 100)} max={100} accent />
      </div>

      <button
        onClick={() => onDeploy(repo)}
        disabled={isDeploying}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
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
  accent,
}: {
  label: string;
  value: number;
  max: number;
  accent?: boolean;
}) {
  const color = accent ? "text-emerald-400" : "text-zinc-300";
  return (
    <span className="flex items-center gap-1">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-medium ${color}`}>
        {value}/{max}
      </span>
    </span>
  );
}

function format(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
