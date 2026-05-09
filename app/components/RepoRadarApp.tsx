"use client";

import { useEffect, useMemo, useState } from "react";
import { CopilotPopup } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { rankRepos } from "@/app/lib/scoring";
import type { AxisWeights, Repo, ScoredRepo } from "@/app/lib/types";
import { RepoCard } from "@/app/components/RepoCard";
import { RadarPlot } from "@/app/components/RadarPlot";
import { DeployForm } from "@/app/components/DeployForm";

const STARTER_QUERIES = [
  { topic: "agent", label: "AI agent frameworks" },
  { topic: "rag", label: "RAG / retrieval" },
  { topic: "rust", label: "Rust infra" },
  { topic: "iot", label: "IoT / hardware" },
];

export function RepoRadarApp() {
  const [weights, setWeights] = useState<AxisWeights>({
    speedToBuild: 0.5,
    communityEngagement: 0.5,
    jobPotential: 0.5,
  });
  const [repos, setRepos] = useState<ScoredRepo[]>([]);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [activeDeploy, setActiveDeploy] = useState<{ repo: ScoredRepo } | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // Auto-populate the radar on mount so the page is never empty in screenshots
  // and the demo lands hot. Pure /api/repos + local scoring — no LLM call.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/repos?topic=ai&limit=8`);
        if (!res.ok) return;
        const data = (await res.json()) as Repo[];
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        setRepos(rankRepos(data, weights));
        setLastQuery("trending: AI");
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runStarter = async (topic: string, label: string) => {
    setBootstrapping(true);
    try {
      const res = await fetch(`/api/repos?topic=${encodeURIComponent(topic)}&limit=8`);
      if (res.ok) {
        const data = (await res.json()) as Repo[];
        setRepos(rankRepos(data, weights));
        setLastQuery(`trending: ${label}`);
      }
    } finally {
      setBootstrapping(false);
    }
  };

  // Re-rank locally whenever sliders move — instant feedback, no LLM call.
  const ranked = useMemo(() => {
    if (repos.length === 0) return [] as ScoredRepo[];
    return rankRepos(repos as Repo[], weights);
  }, [repos, weights]);

  // Share slider state + repo set with the agent so it can reason over them.
  useCopilotReadable({
    description:
      "The user's current radar tuning weights (speedToBuild, communityEngagement, jobPotential), each in 0..1.",
    value: weights,
  });
  useCopilotReadable({
    description:
      "The repos currently visible on the radar, with their scored axes. Use the fullName when calling deployRepo.",
    value: ranked.map((r) => ({
      fullName: r.fullName,
      stars: r.stars,
      language: r.language,
      topics: r.topics,
      scores: r.scores,
    })),
  });

  // Action: rankRepos — agent calls this to surface trending repos.
  useCopilotAction({
    name: "rankRepos",
    description:
      "Find trending GitHub repos that match a topic or theme and surface them on the radar. Always call this when the user asks for repos, examples, or projects.",
    parameters: [
      { name: "topic", type: "string", description: "GitHub topic or keyword (e.g. 'langchain', 'rust', 'rag')", required: false },
      { name: "limit", type: "number", description: "How many repos to surface (1-12)", required: false },
      { name: "summary", type: "string", description: "A one-sentence framing for the user about what you found", required: false },
    ],
    handler: async ({ topic, limit, summary }: { topic?: string; limit?: number; summary?: string }) => {
      setLastQuery(summary ?? topic ?? "");
      const params = new URLSearchParams();
      if (topic) params.set("topic", topic);
      params.set("limit", String(Math.min(12, Math.max(3, limit ?? 6))));
      params.set("enrich", "1");

      const res = await fetch(`/api/repos?${params}`);
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, error: `repo fetch failed: ${t}` };
      }
      const baseRepos = (await res.json()) as Repo[];
      const scored = rankRepos(baseRepos, weights);
      setRepos(scored);
      return {
        ok: true,
        count: scored.length,
        repos: scored.slice(0, 8).map((r) => ({
          fullName: r.fullName,
          stars: r.stars,
          language: r.language,
          description: r.description,
          scores: r.scores,
        })),
      };
    },
    render: ({ status, args, result }) => {
      if (status === "executing") {
        return (
          <div className="rounded-md border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs font-mono text-zinc-400">
            <span className="text-emerald-400">›</span> scanning GitHub for{" "}
            <span className="text-zinc-200">{args?.topic ?? "trending"}</span>…
          </div>
        );
      }
      if (status === "complete") {
        const r = result as { ok: boolean; count?: number; error?: string } | undefined;
        if (!r?.ok) {
          return (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {r?.error ?? "rank failed"}
            </div>
          );
        }
        return (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            ✓ surfaced {r.count} repos on the radar
          </div>
        );
      }
      return null as unknown as React.ReactElement;
    },
  });

  // Action: deployRepo — agent calls with a repoFullName + optional hint, we
  // render the form, the user fills/confirms, and we POST to /api/deploy.
  useCopilotAction({
    name: "deployRepo",
    description:
      "Generate and deploy a bespoke interactive surface for a specific repo. The user will be shown a form to confirm and optionally hint at what kind of surface they want.",
    parameters: [
      { name: "repoFullName", type: "string", description: "The owner/repo to deploy a generative surface for", required: true },
      { name: "hint", type: "string", description: "Optional pre-filled user hint about what kind of surface to make", required: false },
    ],
    renderAndWaitForResponse: ({ args, respond }) => (
      <DeployForm
        repo={args.repoFullName ?? ""}
        onResolved={(result) => respond?.(JSON.stringify(result))}
        onCancel={() => respond?.(JSON.stringify({ deployed: false }))}
      />
    ),
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_2px] shadow-emerald-400/60" />
          <h1 className="font-mono text-lg tracking-tight">RepoRadar</h1>
          <span className="hidden text-xs text-zinc-500 sm:inline">
            agent-rendered repo radar · deploy custom surfaces on demand
          </span>
        </div>
        <span className="text-xs text-zinc-500 font-mono">v0.1 · gen-ui hackathon</span>
      </header>

      <main className="grid flex-1 grid-cols-12 gap-6 p-6">
        <aside className="col-span-12 flex flex-col gap-5 rounded-xl border border-white/10 bg-zinc-900/50 p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold text-zinc-300">Tune your radar</h2>
          <SliderControl
            label="Speed to build"
            value={weights.speedToBuild}
            onChange={(v) => setWeights((w) => ({ ...w, speedToBuild: v }))}
          />
          <SliderControl
            label="Community engagement"
            value={weights.communityEngagement}
            onChange={(v) => setWeights((w) => ({ ...w, communityEngagement: v }))}
          />
          <SliderControl
            label="Job potential"
            value={weights.jobPotential}
            onChange={(v) => setWeights((w) => ({ ...w, jobPotential: v }))}
          />

          <div className="flex flex-col gap-2 pt-2">
            <h3 className="text-xs uppercase tracking-wider text-zinc-500">
              Quick scans
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {STARTER_QUERIES.map((q) => (
                <button
                  key={q.topic}
                  disabled={bootstrapping}
                  onClick={() => runStarter(q.topic, q.label)}
                  className="rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] font-mono text-zinc-300 transition hover:border-emerald-500/40 hover:text-emerald-300 disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 rounded-md border border-white/10 bg-black/40 p-3 text-xs leading-5 text-zinc-400">
            Open the chat dock and ask for repos in any flavor. The agent calls{" "}
            <span className="font-mono text-emerald-400">rankRepos</span>; cards
            land on the radar, ranked by your sliders. Click{" "}
            <span className="font-mono text-emerald-400">Deploy</span> on any
            card to materialize a bespoke generative-UI surface.
          </div>
        </aside>

        <section className="col-span-12 flex flex-col gap-4 lg:col-span-9">
          <RadarPlot repos={ranked} selected={selected} onSelect={setSelected} />

          {ranked.length === 0 ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/30 p-6 text-center">
              <span className="text-sm text-zinc-300">
                Ask the agent:{" "}
                <span className="font-mono text-emerald-400">
                  &quot;show me LangChain repos for a weekend project&quot;
                </span>
              </span>
              <span className="mt-2 text-xs text-zinc-500">
                Repo cards will materialize here, agent-summarized and ranked by
                your sliders.
              </span>
            </div>
          ) : (
            <div>
              {lastQuery && (
                <div className="mb-3 text-xs font-mono text-zinc-500">
                  <span className="text-emerald-400">›</span> {lastQuery}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ranked.map((r) => (
                  <RepoCard
                    key={r.fullName}
                    repo={r}
                    onDeploy={(repo) => setActiveDeploy({ repo })}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {activeDeploy && (
        <DeployModal
          repo={activeDeploy.repo.fullName}
          onClose={() => setActiveDeploy(null)}
        />
      )}

      <CopilotPopup
        instructions={
          "You are RepoRadar, an agent that surfaces trending GitHub repos as interactive UI cards and deploys bespoke generative-UI variants of them on demand. When the user asks about repos, projects, or examples, ALWAYS call rankRepos — never list repos in plain text. When the user asks to deploy, run, build, or explore a repo, call deployRepo with that repo's fullName. After tool calls, give a short conversational summary in 1-2 sentences."
        }
        labels={{
          title: "RepoRadar",
          initial:
            "Ask me to find you a repo. Try: 'Show me langchain repos for a weekend project' — I'll plot them and you can deploy any one as a custom interactive surface.",
        }}
        defaultOpen={true}
        clickOutsideToClose={false}
      />
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono text-zinc-500">{(value * 100).toFixed(0)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-emerald-400"
      />
    </label>
  );
}

function DeployModal({
  repo,
  onClose,
}: {
  repo: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          aria-label="Close"
        >
          ×
        </button>
        <DeployForm
          repo={repo}
          onResolved={(result) => {
            if (result.deployed && result.url) {
              window.open(result.url, "_blank", "noopener,noreferrer");
            }
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
