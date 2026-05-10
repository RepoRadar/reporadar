"use client";

import { useEffect, useMemo, useState } from "react";
import { CopilotPopup } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { DEFAULT_WEIGHTS, rankRepos } from "@/app/lib/scoring";
import {
  DIMENSION_META,
  DIMENSION_ORDER,
  type Dimension,
  type DimensionWeights,
  type Repo,
  type ScoredRepo,
} from "@/app/lib/types";
import { RepoCard } from "@/app/components/RepoCard";
import { InteractiveRadar } from "@/app/components/InteractiveRadar";
import { PriorityBar } from "@/app/components/PriorityBar";
import { DeployForm } from "@/app/components/DeployForm";

const QUICK_SCANS = [
  { topic: "agent", label: "Agents", glyph: "◈" },
  { topic: "rag", label: "RAG", glyph: "◇" },
  { topic: "llm", label: "LLM Apps", glyph: "◆" },
  { topic: "rust", label: "Rust", glyph: "▲" },
  { topic: "iot", label: "IoT", glyph: "⚡" },
  { topic: "security", label: "Security", glyph: "✦" },
];

const TOP3: Dimension[] = ["momentum", "velocity", "maturity"];
const REST: Dimension[] = DIMENSION_ORDER.filter((d) => !TOP3.includes(d));

export function RepoRadarApp() {
  const [weights, setWeights] = useState<DimensionWeights>(DEFAULT_WEIGHTS);
  const [priorities, setPriorities] = useState<Dimension[]>([]);
  const [repos, setRepos] = useState<ScoredRepo[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("agent");
  const [lastQuery, setLastQuery] = useState<string>("");
  const [activeDeploy, setActiveDeploy] = useState<{ repo: ScoredRepo } | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const ranked = useMemo(() => {
    if (repos.length === 0) return [] as ScoredRepo[];
    return rankRepos(repos as Repo[], weights, priorities);
  }, [repos, weights, priorities]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/repos?topic=agent&limit=10`);
        if (!res.ok) return;
        const data = (await res.json()) as Repo[];
        if (cancelled || !Array.isArray(data) || data.length === 0) return;
        setRepos(rankRepos(data, weights, priorities));
        setLastQuery("trending: agents");
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runQuery = async ({ topic, query, label }: { topic?: string; query?: string; label: string }) => {
    setBootstrapping(true);
    if (topic) setActiveCategory(topic);
    else setActiveCategory("");
    try {
      const params = new URLSearchParams();
      if (topic) params.set("topic", topic);
      if (query) params.set("q", query);
      params.set("limit", "10");
      const res = await fetch(`/api/repos?${params}`);
      if (res.ok) {
        const data = (await res.json()) as Repo[];
        setRepos(rankRepos(data, weights, priorities));
        setLastQuery(label);
      }
    } finally {
      setBootstrapping(false);
    }
  };

  useCopilotReadable({
    description:
      "The user's per-dimension slider weights (10 PRD dims, each 0..1) plus their click-ordered sort priorities (subset of dims).",
    value: { weights, priorities },
  });
  useCopilotReadable({
    description:
      "The repos currently visible on the radar with their scored axes. Use the fullName when calling deployRepo.",
    value: ranked.slice(0, 12).map((r) => ({
      fullName: r.fullName,
      stars: r.stars,
      language: r.language,
      topics: r.topics,
      dimensions: r.dimensions,
      scores: r.scores,
    })),
  });

  useCopilotAction({
    name: "rankRepos",
    description:
      "Find trending GitHub repos and surface them on the radar. Call this any time the user asks for repos, examples, or projects — even loose phrases like 'a podcast platform' or 'something for travel'. ALWAYS provide a 'query' (freeform keywords) and OPTIONALLY a 'topic' (single GitHub topic slug). The backend tries the topic first then falls back to keyword search, so it's better to over-call this with both than to refuse.",
    parameters: [
      { name: "query", type: "string", description: "Freeform search keywords. Spaces OK. e.g. 'podcast', 'image generation', 'low effort weekend project'.", required: false },
      { name: "topic", type: "string", description: "OPTIONAL single GitHub topic slug. Lowercase, hyphenated, no spaces. e.g. 'rust', 'iot', 'agent'.", required: false },
      { name: "limit", type: "number", description: "How many repos to surface (1-12)", required: false },
      { name: "summary", type: "string", description: "A one-sentence framing for the user about what you found", required: false },
    ],
    handler: async ({ topic, query, limit, summary }: { topic?: string; query?: string; limit?: number; summary?: string }) => {
      const normalizedTopic = topic
        ?.toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/^[^a-z0-9-]+|[^a-z0-9-]+$/g, "");
      const trimmedQuery = (query ?? "").trim();
      setLastQuery(summary ?? trimmedQuery ?? normalizedTopic ?? "");
      if (normalizedTopic) setActiveCategory(normalizedTopic);
      else if (trimmedQuery) setActiveCategory("");

      const params = new URLSearchParams();
      if (normalizedTopic) params.set("topic", normalizedTopic);
      if (trimmedQuery) params.set("q", trimmedQuery);
      params.set("limit", String(Math.min(12, Math.max(3, limit ?? 8))));

      const res = await fetch(`/api/repos?${params}`);
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, error: `repo fetch failed: ${t}` };
      }
      const baseRepos = (await res.json()) as Repo[];
      const scored = rankRepos(baseRepos, weights, priorities);
      if (scored.length > 0) setRepos(scored);
      return {
        ok: true,
        count: scored.length,
        repos: scored.slice(0, 8).map((r) => ({
          fullName: r.fullName,
          stars: r.stars,
          language: r.language,
          description: r.description,
          dimensions: r.dimensions,
        })),
      };
    },
    render: ({ status, args, result }) => {
      if (status === "executing") {
        return (
          <div
            className="rounded-md border px-3 py-2 text-xs font-mono"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)" }}
          >
            <span style={{ color: "var(--primary)" }}>›</span> scanning GitHub for{" "}
            <span style={{ color: "var(--fg)" }}>{args?.topic ?? args?.query ?? "trending"}</span>…
          </div>
        );
      }
      if (status === "complete") {
        const r = result as { ok: boolean; count?: number; error?: string } | undefined;
        if (!r?.ok) {
          return (
            <div
              className="rounded-md border px-3 py-2 text-xs"
              style={{ borderColor: "var(--danger)", background: "rgba(248,113,113,0.1)", color: "var(--danger)" }}
            >
              {r?.error ?? "rank failed"}
            </div>
          );
        }
        return (
          <div
            className="rounded-md border px-3 py-2 text-xs font-mono"
            style={{ borderColor: "var(--secondary)", background: "rgba(34,211,238,0.1)", color: "var(--secondary)" }}
          >
            ✓ surfaced {r.count} repos on the radar
          </div>
        );
      }
      return null as unknown as React.ReactElement;
    },
  });

  useCopilotAction({
    name: "deployRepo",
    description:
      "Generate and deploy a bespoke interactive surface for a specific repo. The user will be shown a form to confirm and optionally hint at what kind of surface they want.",
    parameters: [
      { name: "repoFullName", type: "string", description: "The owner/repo to deploy a generative surface for", required: true },
      { name: "hint", type: "string", description: "Optional pre-filled user hint about what kind of surface to make", required: false },
    ],
    renderAndWaitForResponse: ({ args, respond }) => {
      const fullName = args.repoFullName ?? "";
      const known = ranked.find((r) => r.fullName === fullName);
      return (
        <DeployForm
          repo={fullName}
          description={known?.description ?? null}
          onResolved={(result) => respond?.(JSON.stringify(result))}
          onCancel={() => respond?.(JSON.stringify({ deployed: false }))}
        />
      );
    },
  });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    runQuery({ query: q, label: `search: ${q}` });
  };

  return (
    <div className="flex flex-1 flex-col">
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-3 w-3 rounded-full rr-pulse"
            style={{ background: "var(--primary)" }}
          />
          <h1 className="font-mono text-lg tracking-tight rr-grad-text">RepoRadar</h1>
          <span
            className="hidden text-xs sm:inline"
            style={{ color: "var(--fg-dim)" }}
          >
            agent-rendered repos · generative-UI deploys at <span style={{ color: "var(--secondary)" }}>·.reporadar.io</span>
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono" style={{ color: "var(--fg-dim)" }}>
          <span className="rr-blink" style={{ color: "var(--accent)" }}>● LIVE</span>
          <span>v0.2 · gen-ui hackathon</span>
        </div>
      </header>

      <PriorityBar priorities={priorities} onChange={setPriorities} />

      <div
        className="flex items-center gap-3 border-b px-6 py-3 flex-wrap"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_SCANS.map((q) => {
            const active = activeCategory === q.topic;
            return (
              <button
                key={q.topic}
                disabled={bootstrapping}
                onClick={() => runQuery({ topic: q.topic, label: `trending: ${q.label.toLowerCase()}` })}
                title={`Search GitHub topic: ${q.topic}`}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-mono transition disabled:opacity-50"
                style={{
                  borderColor: active ? "var(--primary)" : "var(--border)",
                  background: active ? "rgba(244,63,138,0.10)" : "var(--surface-2)",
                  color: active ? "var(--primary)" : "var(--fg-muted)",
                  boxShadow: active ? "0 0 12px var(--primary-glow)" : "none",
                }}
              >
                <span style={{ color: active ? "var(--primary)" : "var(--accent)" }}>{q.glyph}</span>
                {q.label}
              </button>
            );
          })}
        </div>
        <form onSubmit={submitSearch} className="relative ml-auto flex-1 min-w-[280px] max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="✦ or type your own idea — 'something for podcasts', 'rust cli that's fun this weekend'…"
            disabled={bootstrapping}
            className="w-full rounded-md border px-3 py-1.5 pr-9 text-xs outline-none transition"
            style={{
              background: "#fafafa",
              color: "#0a0a0a",
              borderColor: "var(--border-strong)",
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--primary-glow)";
              (e.currentTarget as HTMLInputElement).style.borderColor = "var(--primary)";
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
              (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-strong)";
            }}
          />
          <button
            type="submit"
            disabled={bootstrapping || !searchInput.trim()}
            aria-label="Search"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-2 py-0.5 text-[11px] font-mono disabled:opacity-40"
            style={{ color: "var(--primary)" }}
          >
            ↵
          </button>
        </form>
      </div>

      <main className="grid flex-1 grid-cols-12 gap-5 p-5">
        <aside
          className="col-span-12 flex flex-col gap-5 rounded-2xl border p-4 lg:col-span-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div
            className="flex flex-col gap-3 rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
                Tune your radar
              </h2>
              <button
                onClick={() => setWeights(DEFAULT_WEIGHTS)}
                className="text-[10px] underline-offset-2 hover:underline"
                style={{ color: "var(--fg-dim)" }}
                title="Reset all weights to default"
              >
                reset
              </button>
            </div>

            {TOP3.map((dim) => (
              <DimSlider
                key={dim}
                dim={dim}
                value={weights[dim]}
                onChange={(v) => setWeights({ ...weights, [dim]: v })}
              />
            ))}

            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center gap-1 rounded-md border py-1 text-[10px] font-mono transition"
              style={{
                borderColor: "var(--border)",
                background: "transparent",
                color: "var(--fg-muted)",
              }}
            >
              <span>{expanded ? "fewer dimensions" : `+${REST.length} more dimensions`}</span>
              <span style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                ▼
              </span>
            </button>

            {expanded && (
              <div className="flex flex-col gap-3 pt-1 rr-fade-up">
                {REST.map((dim) => (
                  <DimSlider
                    key={dim}
                    dim={dim}
                    value={weights[dim]}
                    onChange={(v) => setWeights({ ...weights, [dim]: v })}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
              Drag to tune
            </h2>
            <InteractiveRadar weights={weights} onChange={setWeights} />
          </div>

          <div
            className="rounded-md border p-3 text-[11px] leading-5"
            style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.30)", color: "var(--fg-muted)" }}
          >
            Sliders, hex, and chat all share the same state. Click{" "}
            <span style={{ color: "var(--primary)" }} className="font-mono">Deploy</span>{" "}
            on any card to materialize a bespoke generative-UI surface at{" "}
            <span style={{ color: "var(--secondary)" }} className="font-mono">·.reporadar.io</span>.
          </div>
        </aside>

        <section className="col-span-12 flex flex-col gap-4 lg:col-span-9">
          {ranked.length === 0 ? (
            <div
              className="flex min-h-[28rem] flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center rr-fade-up"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
            >
              <span className="text-sm" style={{ color: "var(--fg)" }}>
                Ask the agent or use the search box:{" "}
                <span className="font-mono" style={{ color: "var(--primary)" }}>
                  &quot;something for podcasts&quot;
                </span>
              </span>
              <span className="mt-2 text-xs" style={{ color: "var(--fg-dim)" }}>
                Repo cards will materialize here, agent-summarized and ranked by your sliders + sort priorities.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-xs font-mono flex items-center gap-2 flex-wrap" style={{ color: "var(--fg-dim)" }}>
                {lastQuery && (
                  <>
                    <span style={{ color: "var(--primary)" }}>›</span>
                    {lastQuery}
                    <span style={{ color: "var(--fg-dim)" }}>·</span>
                  </>
                )}
                <span>{ranked.length} repos</span>
                {priorities.length > 0 && (
                  <>
                    <span style={{ color: "var(--fg-dim)" }}>·</span>
                    <span>
                      sorted by{" "}
                      {priorities.map((p, i) => (
                        <span key={p}>
                          {i > 0 && <span style={{ color: "var(--fg-dim)" }}>, then </span>}
                          <span style={{ color: "var(--secondary)" }}>{DIMENSION_META[p].label}</span>
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ranked.map((r, i) => (
                  <div key={r.fullName} className="rr-card" style={{ animationDelay: `${i * 0.04}s` }}>
                    <RepoCard repo={r} onDeploy={(repo) => setActiveDeploy({ repo })} rank={i + 1} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {activeDeploy && (
        <DeployModal
          repo={activeDeploy.repo.fullName}
          description={activeDeploy.repo.description}
          onClose={() => setActiveDeploy(null)}
        />
      )}

      <CopilotPopup
        instructions={
          "You are RepoRadar, an agent that surfaces trending GitHub repos as interactive UI cards and deploys bespoke generative-UI variants of them on demand. When the user asks about repos, projects, or examples, ALWAYS call rankRepos with a query (and a topic slug if one fits). When the user asks to deploy, run, build, or explore a repo, call deployRepo with that repo's fullName. After tool calls, give a short conversational summary in 1-2 sentences."
        }
        labels={{
          title: "RepoRadar",
          initial:
            "Hey — ask me to find you a repo, like 'show me trending security repos' or 'find me a Rust project for a weekend'. I'll plot them and you can deploy any one as its own interactive surface at <slug>.reporadar.io.",
        }}
        defaultOpen={false}
        clickOutsideToClose={false}
      />
    </div>
  );
}

function DimSlider({
  dim,
  value,
  onChange,
}: {
  dim: Dimension;
  value: number;
  onChange: (v: number) => void;
}) {
  const meta = DIMENSION_META[dim];
  const pct = Math.round(value * 100);
  return (
    <label className="flex flex-col gap-2" title={meta.help}>
      <div className="flex items-center justify-between text-xs">
        <span className="cursor-help" style={{ color: "var(--fg-muted)" }}>
          {meta.label}
        </span>
        <span className="font-mono" style={{ color: "var(--primary)" }}>
          {pct.toString().padStart(2, "0")}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
      />
    </label>
  );
}

function DeployModal({
  repo,
  description,
  onClose,
}: {
  repo: string;
  description?: string | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{ background: "rgba(8,7,13,0.75)" }}
    >
      <div className="relative w-full max-w-md rr-fade-up">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border text-sm transition hover:scale-110"
          style={{ borderColor: "var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)" }}
          aria-label="Close"
        >
          ×
        </button>
        <DeployForm
          repo={repo}
          description={description}
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
