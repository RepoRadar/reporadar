"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { PriorityBar, type SortKey } from "@/app/components/PriorityBar";
import { DeployForm } from "@/app/components/DeployForm";

const QUICK_SCANS = [
  { topic: "hermes", label: "Hermes", glyph: "◈" },
  { topic: "openclaw", label: "OpenClaw", glyph: "◇" },
  { topic: "ag-ui", label: "AG-UI", glyph: "◆" },
  { topic: "a2ui", label: "A2UI", glyph: "✸" },
  { topic: "claude-code", label: "Claude Code", glyph: "✦" },
  { topic: "cloudflare", label: "Cloudflare", glyph: "⬢" },
  { topic: "generative-ui", label: "Generative UI", glyph: "▦" },
  { topic: "mcp", label: "MCP", glyph: "◫" },
  { topic: "langchain", label: "LangChain", glyph: "⌬" },
  { topic: "gemini", label: "Gemini", glyph: "✧" },
];

const TAG_HELP: Record<string, string> = {
  hermes: "Hermes — open-weights instruction-tuned models from Nous Research. Tool-use, function-calling, and JSON-mode out of the box.",
  openclaw: "OpenClaw — open-source agentic tooling from this hackathon's stack. Click to surface anything tagged or mentioning it.",
  "ag-ui": "AG-UI — CopilotKit's open transport protocol for fullstack agentic UI in React. Bidirectional state sync between agent + frontend.",
  a2ui: "A2UI — Google DeepMind's open protocol for agents to send fully interactive UI components instead of plain text. Apache 2.0.",
  "claude-code": "Claude Code — Anthropic's CLI agent for engineering workflows. Click to surface skills, plugins, and projects building on it.",
  cloudflare: "Cloudflare — Workers, D1, R2, KV, Durable Objects, AI Gateway. Edge-deployed everything; the entire RepoRadar stack runs on it.",
  "generative-ui": "Generative UI — agents that emit interactive UI at runtime instead of plain text. The whole point of this hackathon.",
  mcp: "Model Context Protocol — the open standard for connecting AI assistants to tools, data, and live UI widgets. Manufact / mcp-use territory.",
  langchain: "LangChain — the most-used framework for building production-grade LLM applications. Chains, agents, RAG, tool-use, memory.",
  gemini: "Gemini — Google's multimodal model family. Powers RepoRadar's Gemini 2.5 Flash for both the chat agent and the A2UI deploy generator.",
};

const TOP3: Dimension[] = ["momentum", "velocity", "maturity"];
const REST: Dimension[] = DIMENSION_ORDER.filter((d) => !TOP3.includes(d));

// Time-window chip values map to the GitHub `pushed:>YYYY-MM-DD` filter.
type TimeWindow = "30" | "90" | "365" | "all";
const TIME_WINDOWS: { key: TimeWindow; label: string; help: string }[] = [
  { key: "30", label: "1mo", help: "Pushed in the last 30 days — freshest, smallest pool." },
  { key: "90", label: "3mo", help: "Pushed in the last 90 days." },
  { key: "365", label: "1y", help: "Pushed in the last year. Default — broad enough for most queries." },
  { key: "all", label: "All", help: "No time filter — surfaces classic + long-tail repos too." },
];
function formatTime(iso?: string): string {
  if (!iso) return "(unknown)";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "(unknown)";
  return d.toLocaleString();
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return "(unknown)";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "(unknown)";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400)}d ago`;
  if (sec < 86400 * 365) return `${Math.floor(sec / (86400 * 30))}mo ago`;
  return `${Math.floor(sec / (86400 * 365))}y ago`;
}

function sinceIsoFor(w: TimeWindow): string | undefined {
  if (w === "all") return undefined;
  const days = parseInt(w, 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function RepoRadarApp() {
  const [weights, setWeights] = useState<DimensionWeights>(DEFAULT_WEIGHTS);
  // Default sort priority is "Most Stars" — toggleable. Christo's spec.
  const [priorities, setPriorities] = useState<SortKey[]>(["stars"]);
  const [repos, setRepos] = useState<ScoredRepo[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("hermes");
  const [lastQuery, setLastQuery] = useState<string>("");
  const [activeDeploy, setActiveDeploy] = useState<{ repo: ScoredRepo } | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("365");
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Stash the last successful query so infinite-scroll knows what to fetch next.
  const queryRef = useRef<{ topic?: string; query?: string }>({ topic: "hermes", query: "hermes" });
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Click a card → snap weights to that repo's dimensional profile so the
  // hex polygon morphs and every slider animates to match. Side effect:
  // the ranking re-orders to put similar repos near the top.
  const selectRepoProfile = (r: ScoredRepo) => {
    setSelectedRepo(r.fullName);
    setWeights({
      momentum: r.dimensions.momentum / 100,
      velocity: r.dimensions.velocity / 100,
      maturity: r.dimensions.maturity / 100,
      community: r.dimensions.community / 100,
      recency: r.dimensions.recency / 100,
      easeOfPrototyping: r.dimensions.easeOfPrototyping / 100,
      productionReadiness: r.dimensions.productionReadiness / 100,
      security: r.dimensions.security / 100,
      documentation: r.dimensions.documentation / 100,
      ecosystemPull: r.dimensions.ecosystemPull / 100,
    });
  };

  const ranked = useMemo(() => {
    if (repos.length === 0) return [] as ScoredRepo[];
    return rankRepos(repos as Repo[], weights, priorities);
  }, [repos, weights, priorities]);

  // Build params for /api/repos including current time window + page.
  const buildParams = (
    overrides: { topic?: string; query?: string; page?: number; limit?: number } = {},
  ) => {
    const p = new URLSearchParams();
    const topic = overrides.topic ?? queryRef.current.topic;
    const query = overrides.query ?? queryRef.current.query;
    if (topic) p.set("topic", topic);
    if (query) p.set("q", query);
    const since = sinceIsoFor(timeWindow);
    if (since) p.set("since", since);
    p.set("page", String(overrides.page ?? 1));
    p.set("limit", String(overrides.limit ?? 12));
    return p;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/repos?${buildParams({ page: 1, limit: 12 })}`);
        if (!res.ok) return;
        const data = (await res.json()) as Repo[];
        if (cancelled || !Array.isArray(data) || data.length === 0) {
          setHasMore(false);
          return;
        }
        setRepos(rankRepos(data, weights, priorities));
        setLastRefresh(Date.now());
        setLastQuery("trending: hermes");
        setPage(1);
        setHasMore(data.length >= 12);
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
    setSelectedRepo(null);
    if (topic) setActiveCategory(topic);
    else setActiveCategory("");
    queryRef.current = { topic, query };
    try {
      const res = await fetch(`/api/repos?${buildParams({ topic, query, page: 1, limit: 12 })}`);
      if (res.ok) {
        const data = (await res.json()) as Repo[];
        setRepos(rankRepos(data, weights, priorities));
        setLastRefresh(Date.now());
        setLastQuery(label);
        setPage(1);
        setHasMore(data.length >= 12);
      }
    } finally {
      setBootstrapping(false);
    }
  };

  // Infinite-scroll: fetch the next page and append. De-dupes by fullName so
  // overlap between pages doesn't cause repeats.
  const loadMore = async () => {
    if (loadingMore || !hasMore || bootstrapping) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/repos?${buildParams({ page: nextPage, limit: 12 })}`);
      if (res.ok) {
        const data = (await res.json()) as Repo[];
        if (data.length === 0) {
          setHasMore(false);
        } else {
          setRepos((prev) => {
            const seen = new Set(prev.map((r) => r.fullName));
            const additions = data.filter((r) => !seen.has(r.fullName));
            return rankRepos([...prev, ...additions], weights, priorities);
          });
          setPage(nextPage);
          setHasMore(data.length >= 12);
        }
      } else {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // Re-run on time-window change (after initial mount).
  const isFirstWindow = useRef(true);
  useEffect(() => {
    if (isFirstWindow.current) {
      isFirstWindow.current = false;
      return;
    }
    const { topic, query } = queryRef.current;
    runQuery({ topic, query, label: lastQuery || "trending" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow]);

  // IntersectionObserver — when the sentinel scrolls into view, load more.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "300px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, hasMore, loadingMore, bootstrapping, timeWindow]);

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
            style={{ borderColor: "var(--secondary)", background: "rgba(59,130,246,0.1)", color: "var(--secondary)" }}
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
          <h1 className="font-mono text-xl tracking-tight rr-grad-text leading-none">
            RepoRadar
          </h1>
          <span
            className="hidden text-base italic leading-none sm:inline"
            style={{ color: "var(--fg-muted)" }}
          >
            Find the most meaningful repo to build upon as efficiently as possible.
          </span>
        </div>
        <div
          className="flex items-center gap-3 text-[11px] font-mono whitespace-nowrap"
          style={{ color: "var(--fg-dim)" }}
        >
          <span style={{ color: "var(--accent)" }}>{process.env.NEXT_PUBLIC_APP_VERSION || "v0.4"}</span>
          <span>·</span>
          <span>
            built at the{" "}
            <a
              href="https://sf.aitinkerers.org/hackathons/h_FZX7ihFWcHA/handbook"
              target="_blank"
              rel="noopener noreferrer"
              title="Open the AI Tinkerers Generative UI Hackathon handbook in a new tab ↗"
              className="underline underline-offset-2 transition"
              style={{ color: "var(--secondary)", textDecorationColor: "var(--secondary)" }}
            >
              AI Tinkerers Generative UI Hackathon
            </a>{" "}
            · 5/10/26
          </span>
          <span>·</span>
          <span title={`Code last updated: ${formatTime(process.env.NEXT_PUBLIC_BUILD_TIME)}`}>
            code{" "}
            <span style={{ color: "var(--fg-muted)" }}>
              {formatRelativeTime(process.env.NEXT_PUBLIC_BUILD_TIME)}
            </span>
          </span>
          <span>·</span>
          <span title={`Data last refreshed: ${formatTime(new Date(lastRefresh).toISOString())}`}>
            data{" "}
            <span style={{ color: "var(--fg-muted)" }}>
              {formatRelativeTime(new Date(lastRefresh).toISOString())}
            </span>
            <button
              onClick={() => {
                const { topic, query } = queryRef.current;
                runQuery({ topic, query, label: lastQuery || "trending" });
              }}
              title="Refresh the data — re-runs your current search and reloads the cards"
              aria-label="Refresh data"
              className="ml-1.5 rounded px-1 transition"
              style={{ color: "var(--secondary)", border: "1px solid transparent" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--secondary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
              }}
            >
              ↻
            </button>
          </span>
        </div>
      </header>

      {/* Row 1 — TAGS + inline search input */}
      <div
        className="flex items-center gap-3 border-b px-6 py-3 flex-wrap"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] whitespace-nowrap cursor-help"
          style={{ color: "var(--fg-dim)" }}
          title="Pick one of these popular GitHub topic tags or type your own in the white box. Hover any chip to see what that topic is about."
        >
          Tags
          <span
            className="inline-flex h-3 w-3 items-center justify-center rounded-full border text-[7px]"
            style={{
              borderColor: "var(--border-strong)",
              color: "var(--fg-dim)",
            }}
            aria-hidden
          >
            ?
          </span>
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_SCANS.map((q) => {
            const active = activeCategory === q.topic;
            return (
              <button
                key={q.topic}
                disabled={bootstrapping}
                onClick={() => runQuery({ topic: q.topic, label: `trending: ${q.label.toLowerCase()}` })}
                title={TAG_HELP[q.topic] ?? `Search GitHub topic: ${q.topic}`}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-mono transition disabled:opacity-50"
                style={{
                  borderColor: active ? "var(--primary)" : "var(--border)",
                  background: active ? "rgba(34,197,94,0.10)" : "var(--surface-2)",
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
        <div className="flex items-center gap-1" title="Time window for the GitHub search. Tighter = fresher repos but smaller pool.">
          {TIME_WINDOWS.map((w) => {
            const active = timeWindow === w.key;
            return (
              <button
                key={w.key}
                onClick={() => setTimeWindow(w.key)}
                title={w.help}
                className="rounded-md border px-2 py-1 text-[10px] font-mono transition"
                style={{
                  borderColor: active ? "var(--secondary)" : "var(--border)",
                  background: active ? "rgba(59,130,246,0.10)" : "var(--surface-2)",
                  color: active ? "var(--secondary)" : "var(--fg-muted)",
                  boxShadow: active ? "0 0 8px var(--secondary-glow)" : "none",
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>
        <form onSubmit={submitSearch} className="relative flex-1 min-w-[280px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search for something else"
            disabled={bootstrapping}
            className="w-full rounded-md border px-3.5 py-2 pr-14 text-sm outline-none transition"
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
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] font-mono disabled:opacity-40"
            style={{ color: "var(--primary)" }}
          >
            ↵ Enter
          </button>
        </form>
      </div>

      {/* Row 2 — FILTERS / SORT BY (10 dimensions, click order = priority) */}
      <PriorityBar priorities={priorities} onChange={setPriorities} />

      <main className="grid flex-1 grid-cols-12 gap-5 p-5">
        <aside
          className="col-span-12 flex flex-col gap-5 rounded-2xl border p-4 lg:col-span-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
              Drag to tune
            </h2>
            <InteractiveRadar weights={weights} onChange={setWeights} />
          </div>

          <div
            className="flex flex-col gap-3 rounded-xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
                Slide to tune
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
                    {(() => {
                      // Format "tag: claude-code-memory" with the value in
                      // accent yellow so the user always knows what's
                      // currently filtering the radar.
                      const m = lastQuery.match(/^([^:]+:)\s*(.+)$/);
                      if (m) {
                        return (
                          <>
                            <span style={{ color: "var(--fg-dim)" }}>{m[1]}</span>{" "}
                            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                              {m[2]}
                            </span>
                          </>
                        );
                      }
                      return <span style={{ color: "var(--accent)", fontWeight: 600 }}>{lastQuery}</span>;
                    })()}
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
                          <span style={{ color: "var(--secondary)" }}>
                            {p === "stars" ? "Most Stars" : DIMENSION_META[p].label}
                          </span>
                        </span>
                      ))}
                    </span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ranked.map((r, i) => (
                  <div key={r.fullName} className="rr-card" style={{ animationDelay: `${Math.min(i, 11) * 0.04}s` }}>
                    <RepoCard
                      repo={r}
                      onDeploy={(repo) => setActiveDeploy({ repo })}
                      onSelect={selectRepoProfile}
                      onTagClick={(topic) => runQuery({ topic, label: `tag: ${topic}` })}
                      selected={selectedRepo === r.fullName}
                      rank={i + 1}
                    />
                  </div>
                ))}
              </div>
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-6 text-xs font-mono"
                style={{ color: "var(--fg-dim)" }}
              >
                {loadingMore ? (
                  <span className="rr-blink">loading more…</span>
                ) : hasMore ? (
                  <span>scroll for more</span>
                ) : (
                  <span>· end of results ·</span>
                )}
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
