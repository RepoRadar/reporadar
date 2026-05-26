"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Image from "next/image";
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
import { type SortKey } from "@/app/components/PriorityBar";
import { HeaderControls, type TimeWindow as HeaderTimeWindow } from "@/app/components/HeaderControls";
import { buildShareUrl } from "@/app/lib/shareUrl";
import { DeployForm } from "@/app/components/DeployForm";
import { NotificationSignup } from "@/app/components/NotificationSignup";
import type { NotificationDigestItem } from "@/app/lib/notifications";

// Time-window chip values map to the GitHub `pushed:>YYYY-MM-DD` filter.
// Header chip rendering moved to <HeaderControls>; this type is still used
// by sinceIsoFor() and the activeCategory state machine.
type TimeWindow = "30" | "90" | "365" | "all";

// Rotating example prompts shown in the empty/loading state. One picked at
// random on each page load so the dashboard doesn't feel canned.
const EXAMPLE_PROMPTS: string[] = [
  "Give me some OpenClaw skills for design",
  "Hermes skill packs for finance",
  "agent orchestrators",
  "paperclip-style agents",
  "Cloudflare Workers repos",
  "MCP servers for Claude Desktop",
  "production-grade RAG in TypeScript",
  "voice agents with 11Labs",
  "open-source code review tools",
  "Next.js starters with auth",
  "vector databases for embeddings",
  "AI evals frameworks",
  "self-hosted LLM gateways",
  "agentic browser automation",
  "Python data engineering pipelines",
  "Rust CLI tools that shipped this month",
  "Stable Diffusion fine-tuning kits",
  "Cloudflare D1 examples",
  "WebRTC voice apps",
  "real-time collab editors",
  "TypeScript AI SDKs",
  "podcast generation tools",
  "embedding visualization libraries",
  "GitHub Actions for AI",
  "WebSocket-based agent infra",
  "no-code AI workflow builders",
  "trading bots with backtesting",
  "developer copilots for Vim",
  "MCP clients I can self-host",
  "agent memory backends",
];
type DeployMode = "modal" | "panel";
type DeployStatus = "form" | "running" | "done" | "error";

const ABSOLUTE_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatTime(iso?: string): string {
  if (!iso) return "(unknown)";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "(unknown)";
  return `${ABSOLUTE_TIME_FORMAT.format(d)} UTC`;
}

function formatRelativeTime(iso?: string, now?: number | null): string {
  if (!iso) return "(unknown)";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "(unknown)";
  if (now == null) return "just now";
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400)}d ago`;
  if (sec < 86400 * 365) return `${Math.floor(sec / (86400 * 30))}mo ago`;
  return `${Math.floor(sec / (86400 * 365))}y ago`;
}

function RelativeTime({ iso, pendingLabel = "(unknown)" }: { iso?: string; pendingLabel?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!iso) {
      const timeout = setTimeout(() => setNow(null), 0);
      return () => clearTimeout(timeout);
    }
    const update = () => setNow(Date.now());
    const timeout = setTimeout(update, 0);
    const interval = setInterval(update, 30_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [iso]);

  if (!iso) return <>{pendingLabel}</>;
  return <>{formatRelativeTime(iso, now)}</>;
}

function sinceIsoFor(w: TimeWindow): string | undefined {
  if (w === "all") return undefined;
  const days = parseInt(w, 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function RepoRadarApp({
  initialRepos = [],
  initialQuery,
  initialPriorities,
  initialTimeWindow,
}: {
  initialRepos?: Repo[];
  // Hydration from a shared URL (?topic / ?q / ?sort / ?window), parsed
  // server-side in app/page.tsx. Absent → the default Hermes trending view.
  initialQuery?: { topic?: string; query?: string; label: string };
  initialPriorities?: SortKey[];
  initialTimeWindow?: TimeWindow;
} = {}) {
  // Resolve the initial sort once so the prop-hydrated state and the initial
  // ranking agree (a shared ?sort= link should rank + snap by that sort).
  const startPriorities: SortKey[] = initialPriorities ?? ["stars"];
  const [weights, setWeights] = useState<DimensionWeights>(DEFAULT_WEIGHTS);
  // Default sort priority is "Most Stars" — toggleable. Christo's spec.
  const [priorities, setPriorities] = useState<SortKey[]>(startPriorities);
  // Server-prefetched data hydrates the initial card grid so the first paint
  // includes cards instead of a loading dot animation. For a shared link this
  // is the shared topic/query's repos; otherwise the default Hermes pull. If
  // the SSR fetch failed we fall back to the client-side bootstrap.
  const [repos, setRepos] = useState<ScoredRepo[]>(() =>
    initialRepos.length > 0
      ? rankRepos(initialRepos, DEFAULT_WEIGHTS, startPriorities)
      : [],
  );
  // activeCategory holds comma-joined topics; "" means freeform-query mode.
  const [activeCategory, setActiveCategory] = useState<string>(
    initialQuery ? (initialQuery.topic ?? "") : "hermes",
  );
  const [lastQuery, setLastQuery] = useState<string>(
    initialRepos.length > 0 ? (initialQuery?.label ?? "trending: hermes") : "",
  );
  const [activeDeploy, setActiveDeploy] = useState<{ repo: ScoredRepo } | null>(null);
  const [deployMode, setDeployMode] = useState<DeployMode>("modal");
  const [deployStatus, setDeployStatus] = useState<DeployStatus>("form");
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(initialRepos.length === 0);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(initialTimeWindow ?? "365");
  // Random example prompt for the empty/loading state. Picked once per
  // mount so the page feels different every visit. Picked in an effect
  // (not in useState init) so the server-rendered HTML matches the first
  // client paint — otherwise React throws a hydration mismatch.
  const [examplePrompt, setExamplePrompt] = useState<string>(EXAMPLE_PROMPTS[0]);
  useEffect(() => {
    setExamplePrompt(EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]);
  }, []);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  // Stash the last successful query so infinite-scroll knows what to fetch next.
  // Hydrated from a shared link when present so the slow-path bootstrap + load-more
  // fetch the shared view, not the default.
  const queryRef = useRef<{ topic?: string; query?: string }>(
    initialQuery
      ? { topic: initialQuery.topic, query: initialQuery.query }
      : { topic: "hermes", query: "hermes" },
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const deployPanelRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const bootstrappingRef = useRef(true);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);
  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  useEffect(() => {
    bootstrappingRef.current = bootstrapping;
  }, [bootstrapping]);

  const minimizeDeploy = () => {
    setDeployMode("panel");
    window.setTimeout(() => {
      deployPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };

  const openDeploy = (repo: ScoredRepo) => {
    if (activeDeploy && deployStatus === "running") {
      minimizeDeploy();
      return;
    }
    setActiveDeploy({ repo });
    setDeployMode("modal");
    setDeployStatus("form");
  };

  // Wrapper for every "user tuned the radar" code path (hex drag, slider
  // drag, card-snap). Updates weights AND demotes the lone default "stars"
  // sort priority — otherwise priority-sort wins over the weighted overall
  // score and the list never visibly reorders when the user drags. If the
  // user has explicitly picked other priorities we leave them alone.
  const tuneWeights = (next: DimensionWeights) => {
    setWeights(next);
    setPriorities((p) => (p.length === 1 && p[0] === "stars" ? [] : p));
  };

  // Click a card → snap the radar/sliders to that repo's dimensional profile
  // so the user can SEE what kind of repo it is. We deliberately call
  // setWeights directly here (not tuneWeights) so we don't clear the
  // "Most Stars" priority — that priority-clearing side effect would let
  // weighted-sum take over the rank, which bubbles the clicked card to
  // position #1 every time and the list re-shuffles under the user's
  // cursor. Clicking is now purely visual: highlight + radar update, no
  // reorder.
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

  const notificationDigest = useMemo<NotificationDigestItem[]>(
    () =>
      ranked.slice(0, 3).map((repo) => ({
        title: repo.fullName,
        subtitle: `${formatCompact(repo.stars)} stars${repo.language ? ` · ${repo.language}` : ""}`,
        score: Math.round(repo.scores.overall * 100),
        source: "RepoRadar",
      })),
    [ranked],
  );

  // Build params for /api/repos including current time window + page.
  // We do NOT pass enrich=1 by default — that would chain 2 extra anon
  // GitHub fetches per repo, which times out without a GITHUB_TOKEN secret.
  // The scoring heuristic (app/lib/scoring.ts) falls back to description
  // length and pushedAt freshness when readmeLength/recentCommits are 0.
  const buildParams = (
    overrides: { topic?: string; query?: string; window?: TimeWindow; page?: number; limit?: number } = {},
  ) => {
    const p = new URLSearchParams();
    const topic = overrides.topic ?? queryRef.current.topic;
    const query = overrides.query ?? queryRef.current.query;
    if (topic) p.set("topic", topic);
    if (query) p.set("q", query);
    // `window` override lets a caller fetch at a specific window in the same
    // tick a setTimeWindow() is scheduled (state hasn't committed yet) — used
    // by the logo "home" reset so its single fetch uses the default window.
    const since = sinceIsoFor(overrides.window ?? timeWindow);
    if (since) p.set("since", since);
    p.set("page", String(overrides.page ?? 1));
    p.set("limit", String(overrides.limit ?? 100));
    return p;
  };

  useEffect(() => {
    // Fast path: SSR already pre-fetched the view (default Hermes, or the
    // shared topic/query) and hydrated `repos`. Skip the client-side fetch
    // entirely; just auto-snap to the top repo so the radar populates + the
    // #1 card highlights green.
    if (initialRepos.length > 0) {
      const fresh = rankRepos(initialRepos, DEFAULT_WEIGHTS, startPriorities);
      if (fresh.length > 0) {
        selectRepoProfile(fresh[0]);
      }
      setLastRefresh(Date.now());
      setPage(1);
      pageRef.current = 1;
      setHasMore(initialRepos.length >= 100);
      return;
    }

    // Slow path: SSR failed (e.g. GitHub rate-limited) — fall back to a
    // client-side bootstrap so the page still works.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/repos?${buildParams({ page: 1, limit: 100 })}`);
        if (!res.ok) return;
        const data = (await res.json()) as Repo[];
        if (cancelled || !Array.isArray(data) || data.length === 0) {
          setHasMore(false);
          return;
        }
        const fresh = rankRepos(data, weights, priorities);
        setRepos(fresh);
        setLastRefresh(Date.now());
        setLastQuery(initialQuery?.label ?? "trending: hermes");
        setPage(1);
        pageRef.current = 1;
        setHasMore(data.length >= 100);
        // Auto-snap to the top repo on initial page load too (not just on
        // tag clicks via runQuery) — radar/sliders populate and the #1
        // card highlights green, matching the post-query behavior.
        if (fresh.length > 0) {
          selectRepoProfile(fresh[0]);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runQuery = async ({ topic, query, label, window }: { topic?: string; query?: string; label: string; window?: TimeWindow }) => {
    setBootstrapping(true);
    setLoadMoreError(null);
    setSelectedRepo(null);
    if (topic) setActiveCategory(topic);
    else setActiveCategory("");
    // Optimistic pill update — the status chip + tag-button sub-label should
    // reflect the user's *intent* immediately, not 1-3s later when the GitHub
    // fetch resolves. Without this the user clicks "Claude Code" and sees the
    // chip still say "trending: hermes" while old hermes cards linger, and it
    // looks broken. The grid still shows previous cards during the fetch, but
    // they're dimmed via the bootstrapping flag (see card-grid wrapper below).
    setLastQuery(label);
    queryRef.current = { topic, query };
    try {
      const res = await fetch(`/api/repos?${buildParams({ topic, query, window, page: 1, limit: 100 })}`);
      if (res.ok) {
        const data = (await res.json()) as Repo[];
        const fresh = rankRepos(data, weights, priorities);
        setRepos(fresh);
        setLastRefresh(Date.now());
        setPage(1);
        pageRef.current = 1;
        setHasMore(data.length >= 100);
        // Auto-snap to the top repo so the user sees the radar/sliders
        // populate with its profile and the #1 card highlight in green.
        // From there they can click any other card to compare profiles.
        if (fresh.length > 0) {
          selectRepoProfile(fresh[0]);
        }
      }
    } finally {
      setBootstrapping(false);
    }
  };

  // Infinite-scroll: fetch the next page and append. De-dupes by fullName so
  // overlap between pages doesn't cause repeats.
  const loadMore = async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || bootstrappingRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextPage = pageRef.current + 1;
      const res = await fetch(`/api/repos?${buildParams({ page: nextPage, limit: 100 })}`);
      if (res.ok) {
        const data = (await res.json()) as Repo[];
        if (data.length === 0) {
          setHasMore(false);
          hasMoreRef.current = false;
        } else {
          let addedCount = 0;
          setRepos((prev) => {
            const seen = new Set(prev.map((r) => r.fullName));
            const additions = data.filter((r) => !seen.has(r.fullName));
            addedCount = additions.length;
            return rankRepos([...prev, ...additions], weights, priorities);
          });
          setPage(nextPage);
          pageRef.current = nextPage;
          setHasMore(data.length >= 100);
          hasMoreRef.current = data.length >= 100;
          if (addedCount === 0 && data.length < 100) {
            setHasMore(false);
            hasMoreRef.current = false;
          }
        }
      } else {
        setLoadMoreError("Could not load more repos");
      }
    } catch {
      setLoadMoreError("Could not load more repos");
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  };

  // Mirror the current search into the address bar so the view is copy-pasteable
  // and shareable: topics (?topic), a freeform ask (?q), the sort filters (?sort),
  // and the time window (?window). The default Hermes view collapses to "/".
  //
  // Uses the native History API — Next 16 integrates pushState/replaceState with
  // the App Router, so this updates the URL WITHOUT a navigation or server
  // re-render. The client already holds the data (runQuery fetched it), so there's
  // no double-fetch. replaceState (not pushState) keeps rapid tag toggling from
  // bloating the back stack. Idempotent: on a shared-link load this reconstructs
  // the same URL the state was hydrated from, so it never loops or clobbers.
  //
  // Keyed on lastQuery (not queryRef, which is a ref): runQuery sets lastQuery and
  // queryRef together, so the effect fires and reads the fresh freeform query.
  useEffect(() => {
    const freeform = !activeCategory;
    const url = buildShareUrl({
      topic: freeform ? undefined : activeCategory,
      query: freeform ? queryRef.current.query : undefined,
      priorities,
      timeWindow,
    });
    window.history.replaceState(null, "", url);
  }, [activeCategory, lastQuery, priorities, timeWindow]);

  // Re-run on time-window change (after initial mount).
  const isFirstWindow = useRef(true);
  // Set when another handler (logo "home" reset) changes the window AND issues
  // its own fetch — suppresses this effect's duplicate fetch (and the race
  // between the two) for that one change.
  const skipNextWindowEffect = useRef(false);
  useEffect(() => {
    if (isFirstWindow.current) {
      isFirstWindow.current = false;
      return;
    }
    if (skipNextWindowEffect.current) {
      skipNextWindowEffect.current = false;
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
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "500px 0px 700px", threshold: 0.01 },
    );
    obs.observe(node);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow, lastQuery]);

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

  const buildTimeIso = process.env.NEXT_PUBLIC_BUILD_TIME;
  const lastRefreshIso = lastRefresh == null ? undefined : new Date(lastRefresh).toISOString();

  return (
    <div className="flex flex-1 flex-col">
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={() => {
            // Logo click = "take me home". Reset to the full default view —
            // Hermes, Most Stars, AND the default 1-year window — so the URL
            // collapses to a clean "/" and the user gets a true clean starting
            // point during the demo without a full page reload. We fetch once
            // with an explicit window override and suppress the time-window
            // effect's duplicate fetch (see skipNextWindowEffect).
            setPriorities(["stars"]);
            if (timeWindow !== "365") skipNextWindowEffect.current = true;
            setTimeWindow("365");
            runQuery({ topic: "hermes", label: "trending: hermes", window: "365" });
          }}
          className="flex items-center gap-3 rounded-md transition hover:opacity-80"
          title="Reset to the default Hermes trending view"
          aria-label="RepoRadar home"
        >
          <Image
            src="/reporadar-mark.svg"
            alt=""
            aria-hidden="true"
            width={36}
            height={36}
            className="h-9 w-9 shrink-0"
          />
          <h1 className="text-2xl font-black leading-none tracking-normal">
            <span style={{ color: "var(--fg)" }}>Repo</span>
            <span style={{ color: "var(--primary)" }}>Radar</span>
          </h1>
          <span
            className="hidden text-base italic leading-none sm:inline"
            style={{ color: "var(--fg-muted)" }}
          >
            Find the most meaningful repo to build upon as efficiently as possible.
          </span>
        </button>
        <div
          className="flex flex-wrap items-center justify-start gap-x-3 gap-y-1 text-[11px] font-mono"
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
          <span title={`Code last updated: ${formatTime(buildTimeIso)}`}>
            code{" "}
            <span style={{ color: "var(--fg-muted)" }}>
              <RelativeTime iso={buildTimeIso} />
            </span>
          </span>
          <span>·</span>
          <span title={`Data last refreshed: ${formatTime(lastRefreshIso)}`}>
            data{" "}
            <span style={{ color: "var(--fg-muted)" }}>
              <RelativeTime iso={lastRefreshIso} pendingLabel="pending" />
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

      {/* Streamlined header — TAGS / TALK / TYPE / FILTER buttons + time-window pills. */}
      <HeaderControls
        activeTopics={activeCategory ? activeCategory.split(",").map((s) => s.trim()).filter(Boolean) : []}
        priorities={priorities}
        timeWindow={timeWindow as HeaderTimeWindow}
        bootstrapping={bootstrapping}
        priorityCount={priorities.length}
        onRunQuery={runQuery}
        onSetPriorities={setPriorities}
        onSetTimeWindow={(w) => setTimeWindow(w as TimeWindow)}
      />

      <main className="grid flex-1 grid-cols-12 gap-5 p-5">
        <aside
          className="col-span-12 flex flex-col gap-5 rounded-2xl border p-4 lg:col-span-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div className="flex flex-col gap-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
              Drag to tune
            </h2>
            <InteractiveRadar weights={weights} onChange={tuneWeights} />
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

            {DIMENSION_ORDER.map((dim) => (
              <DimSlider
                key={dim}
                dim={dim}
                value={weights[dim]}
                onChange={(v) => tuneWeights({ ...weights, [dim]: v })}
              />
            ))}
          </div>

          {activeDeploy && (
            <DeployDock
              refEl={deployPanelRef}
              mode={deployMode}
              repo={activeDeploy.repo.fullName}
              description={activeDeploy.repo.description}
              status={deployStatus}
              onStatusChange={setDeployStatus}
              onMinimize={minimizeDeploy}
              onExpand={() => setDeployMode("modal")}
              onClose={() => setActiveDeploy(null)}
            />
          )}

          <NotificationSignup digest={notificationDigest} />

        </aside>

        <section className="col-span-12 flex flex-col gap-4 lg:col-span-9">
          {ranked.length === 0 ? (
            <div
              className="flex min-h-[28rem] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-6 text-center rr-fade-up"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }}
            >
              {bootstrapping && (
                <div className="flex items-center gap-2" aria-label="Loading">
                  <span
                    className="inline-block h-2 w-2 rounded-full animate-bounce"
                    style={{ background: "var(--primary)", animationDelay: "0ms" }}
                  />
                  <span
                    className="inline-block h-2 w-2 rounded-full animate-bounce"
                    style={{ background: "var(--primary)", animationDelay: "150ms" }}
                  />
                  <span
                    className="inline-block h-2 w-2 rounded-full animate-bounce"
                    style={{ background: "var(--primary)", animationDelay: "300ms" }}
                  />
                </div>
              )}
              <span className="text-sm" style={{ color: "var(--fg)" }}>
                Try:{" "}
                <span className="font-mono" style={{ color: "var(--primary)" }}>
                  &quot;{examplePrompt}&quot;
                </span>
              </span>
              <span className="text-xs" style={{ color: "var(--fg-dim)" }}>
                {bootstrapping
                  ? "Pulling the latest from GitHub…"
                  : "Repo cards will materialize here, agent-summarized and ranked by your sliders + sort priorities."}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-xs font-mono flex items-center gap-2 flex-wrap" style={{ color: "var(--fg-dim)" }}>
                {lastQuery && (() => {
                  // Pill chip showing the active filter, with a ✕ to clear
                  // back to the default trending pull.
                  const m = lastQuery.match(/^([^:]+:)\s*(.+)$/);
                  const prefix = m ? m[1] : "";
                  const value = m ? m[2] : lastQuery;
                  return (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                      style={{
                        borderColor: "var(--primary)",
                        background: "rgba(34,197,94,0.10)",
                        boxShadow: "0 0 12px var(--primary-glow)",
                      }}
                      title={`Active filter: ${lastQuery}. Click ✕ to clear and return to the default trending list.`}
                    >
                      {prefix && (
                        <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--fg-dim)" }}>
                          {prefix.replace(":", "")}
                        </span>
                      )}
                      <span style={{ color: "var(--primary)", fontWeight: 600 }}>{value}</span>
                      <button
                        onClick={() => runQuery({ topic: "hermes", label: "trending: hermes" })}
                        aria-label="Clear active filter"
                        className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none transition"
                        style={{
                          background: "rgba(34,197,94,0.20)",
                          color: "var(--primary)",
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  );
                })()}
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
                      onDeploy={openDeploy}
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
                className="flex items-center justify-center py-7 text-xs font-mono"
              >
                {loadingMore ? (
                  <div
                    className="rr-load-more rr-fade-up inline-flex items-center gap-3 rounded-md border px-4 py-3"
                    role="status"
                    aria-live="polite"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--fg-muted)",
                    }}
                  >
                    <span className="rr-spinner" aria-hidden />
                    <span className="flex flex-col gap-0.5">
                      <span style={{ color: "var(--fg)" }}>Loading more repos</span>
                      <span className="rr-slide-text" style={{ color: "var(--fg-dim)" }}>
                        Pulling the next page from GitHub…
                      </span>
                    </span>
                  </div>
                ) : loadMoreError ? (
                  <button
                    onClick={loadMore}
                    className="inline-flex items-center gap-2 rounded-md border px-4 py-2 transition"
                    style={{
                      borderColor: "var(--danger)",
                      background: "rgba(239,68,68,0.08)",
                      color: "var(--danger)",
                    }}
                  >
                    retry loading more
                  </button>
                ) : hasMore ? (
                  <div
                    className="inline-flex items-center gap-2 rounded-md border px-4 py-2"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface)",
                      color: "var(--fg-dim)",
                    }}
                  >
                    <span className="rr-scroll-cue" aria-hidden>↓</span>
                    <span>scroll for more repos</span>
                  </div>
                ) : (
                  <div
                    className="rounded-md border px-4 py-2"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--surface)",
                      color: "var(--fg-dim)",
                    }}
                  >
                    end of results
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <CopilotPopup
        instructions={
          "You are RepoRadar, an agent that surfaces trending GitHub repos as interactive UI cards and deploys bespoke generative-UI variants of them on demand. When the user asks about repos, projects, or examples, ALWAYS call rankRepos with a query (and a topic slug if one fits). When the user asks to deploy, run, build, or explore a repo, call deployRepo with that repo's fullName. After tool calls, give a short conversational summary in 1-2 sentences."
        }
        labels={{
          title: "RepoRadar",
          initial:
            "Hey — ask me to find you a repo, like 'show me trending security repos' or 'find me a Rust project for a weekend'. I'll plot them and you can deploy any one as its own interactive surface on a reporadar.io subdomain.",
        }}
        defaultOpen={false}
        clickOutsideToClose={false}
      />
    </div>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
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
        style={{
          background: `linear-gradient(90deg, var(--primary) 0%, var(--secondary) ${Math.max(1, pct * 0.35)}%, var(--accent) ${Math.max(2, pct * 0.7)}%, var(--danger) ${pct}%, var(--surface-3) ${pct}%, var(--surface-3) 100%)`,
        }}
      />
    </label>
  );
}

function DeployDock({
  refEl,
  mode,
  repo,
  description,
  status,
  onStatusChange,
  onMinimize,
  onExpand,
  onClose,
}: {
  refEl: RefObject<HTMLDivElement | null>;
  mode: DeployMode;
  repo: string;
  description?: string | null;
  status: DeployStatus;
  onStatusChange: (status: DeployStatus) => void;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  const modal = mode === "modal";
  const closeOrMinimize = () => {
    if (status === "running") {
      onMinimize();
      return;
    }
    onClose();
  };

  return (
    <div
      ref={refEl}
      data-testid="deploy-dock"
      className={
        modal
          ? "fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          : "rr-deploy-dock-panel rr-fade-up"
      }
      style={modal ? { background: "rgba(8,7,13,0.75)" } : undefined}
    >
      <div className={modal ? "relative w-full max-w-md rr-fade-up" : "relative"}>
        <div className="absolute -top-3 -right-3 z-10 flex items-center gap-1">
          {modal && status === "running" && (
            <button
              onClick={onMinimize}
              className="flex h-8 cursor-pointer items-center justify-center rounded-full border px-3 text-[10px] font-mono transition hover:scale-105"
              style={{ borderColor: "var(--primary)", background: "var(--surface-2)", color: "var(--primary)" }}
              aria-label="Minimize deployment"
              data-testid="minimize-deploy"
            >
              minimize
            </button>
          )}
          {!modal && (
            <button
              onClick={onExpand}
              className="flex h-8 cursor-pointer items-center justify-center rounded-full border px-3 text-[10px] font-mono transition hover:scale-105"
              style={{ borderColor: "var(--border-strong)", background: "var(--surface-2)", color: "var(--fg-muted)" }}
              aria-label="Expand deployment"
            >
              expand
            </button>
          )}
          <button
            onClick={closeOrMinimize}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border text-sm transition hover:scale-110"
            style={{ borderColor: "var(--border-strong)", background: "var(--surface-2)", color: "var(--fg)" }}
            aria-label={status === "running" ? "Minimize deployment" : "Close"}
          >
            ×
          </button>
        </div>
        {!modal && status === "running" && (
          <div
            className="mb-2 rounded-md border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em]"
            style={{
              borderColor: "var(--primary)",
              background: "rgba(34,197,94,0.08)",
              color: "var(--primary)",
            }}
          >
            Deploying in background
          </div>
        )}
        <DeployForm
          key={repo}
          repo={repo}
          description={description}
          onResolved={(result) => {
            if (result.deployed && result.url) {
              window.open(result.url, "_blank", "noopener,noreferrer");
            }
            onClose();
          }}
          onCancel={onClose}
          onStatusChange={onStatusChange}
        />
      </div>
    </div>
  );
}
