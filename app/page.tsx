import { RepoRadarApp } from "@/app/components/RepoRadarApp";
import { fetchTrendingCached } from "@/app/lib/trendingCache";
import type { Repo } from "@/app/lib/types";
import { parseShareParams, labelFor, type TimeWindow } from "@/app/lib/shareUrl";

// No caching of the rendered PAGE/HTML. We're iterating on this every few
// minutes — every visit must hit the latest deployed bundle. (Without this,
// OpenNext + Cloudflare were caching the page HTML for s-maxage=31536000 — a
// year.) NOTE: the prefetched repo *data* IS cached in-memory below
// (prefetchCache) so first paint isn't gated on a GitHub round-trip per
// request; that's independent of this page-render directive.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Server-prefetch the default Hermes trending pull so the home page's first
// paint already has cards. Without this, the client bootstrap useEffect adds
// a 1-3s blank window every visit (GitHub Search API round-trip). With this,
// the HTML arrives card-complete and the only post-hydration work is the
// auto-snap to the top repo.
//
// We call fetchTrendingCached directly (not via /api/repos round-trip) so the
// Cloudflare Worker stays within itself. It adds the shared KV cache so cold
// isolates serve from KV instead of GitHub. If GitHub rate-limits us at SSR
// time, we degrade gracefully: pass an empty initialRepos array and the
// client-side bootstrap fires the old way.
// Time window → GitHub `pushed:>YYYY-MM-DD` cutoff. "all" = no cutoff.
function sinceFor(window: TimeWindow): string | undefined {
  if (window === "all") return undefined;
  const days = parseInt(window, 10) || 365;
  return new Date(Date.now() - days * 86400 * 1000).toISOString().slice(0, 10);
}

// Hard cap on the SSR prefetch. Even with fail-fast GitHub (see github.ts), a
// cold/slow upstream must never let this server-render exceed the Cloudflare
// Worker time limit — that turns into an uncatchable 500. If the cap trips we
// degrade exactly like a failed fetch: empty initialRepos → client bootstrap.
const SSR_PREFETCH_BUDGET_MS = 4000;
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("ssr prefetch budget exceeded")), ms),
    ),
  ]);
}

// In-memory SSR data cache (mirrors the pattern in app/api/repos/route.ts). The
// page stays `force-dynamic` so every visit renders the latest bundle, but the
// *prefetched repo data* is cached per (topic|query|window) so first paint
// isn't gated on a live GitHub round-trip on every request. The default Hermes
// view dominates traffic, so this makes the vast majority of loads instant.
//
// Two tiers, stale-while-revalidate style:
//   age < FRESH_MS  → serve cached, no refresh
//   age < STALE_MS  → serve cached immediately + refresh in the background
//   otherwise/miss  → fetch synchronously (bounded), then cache
// Per-isolate (like the API cache); a warm isolate serves cached after its
// first miss. We only cache non-empty results so a transient failure can't
// poison the cache, and fall back to expired-but-present data if a fetch fails.
const PREFETCH_FRESH_MS = 60_000; // 1 min
const PREFETCH_STALE_MS = 10 * 60_000; // 10 min
const prefetchCache = new Map<string, { at: number; data: Repo[] }>();

type PrefetchKey = { topic?: string; query?: string; timeWindow: TimeWindow };

function prefetchOnce(k: PrefetchKey): Promise<Repo[]> {
  return withTimeout(
    // fetchTrendingCached adds the shared KV layer (cold isolates serve from KV
    // instead of GitHub). The in-memory prefetchCache below stays as a fast L0.
    fetchTrendingCached({
      topic: k.topic,
      query: k.query,
      since: sinceFor(k.timeWindow),
      page: 1,
      perPage: 100,
    }),
    SSR_PREFETCH_BUDGET_MS,
  );
}

async function getPrefetch(k: PrefetchKey): Promise<Repo[]> {
  const key = `${k.topic ?? ""}|${k.query ?? ""}|${k.timeWindow}`;
  const hit = prefetchCache.get(key);
  const now = Date.now();

  if (hit) {
    const age = now - hit.at;
    if (age < PREFETCH_FRESH_MS) return hit.data;
    if (age < PREFETCH_STALE_MS) {
      // Best-effort background refresh; if the isolate is torn down after the
      // response it simply refreshes on a later request. Never blocks paint.
      void prefetchOnce(k)
        .then((fresh) => {
          if (fresh.length > 0) prefetchCache.set(key, { at: Date.now(), data: fresh });
        })
        .catch(() => {});
      return hit.data;
    }
  }

  try {
    const data = await prefetchOnce(k);
    if (data.length > 0) prefetchCache.set(key, { at: now, data });
    return data;
  } catch (e) {
    // Timed out or upstream error — serve expired cache if we have it, else
    // empty (client bootstrap fills in after hydration). Never blocks paint.
    console.error("[home] SSR prefetch skipped:", e instanceof Error ? e.message : e);
    return hit?.data ?? [];
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // A shared link (?topic / ?q / ?sort / ?window) hydrates the whole view; an
  // empty URL resolves to the default Hermes trending pull. Reading searchParams
  // here lets us SSR-prefetch the *shared* topic/query so the link arrives
  // card-complete, exactly like the default view does.
  const state = parseShareParams(await searchParams);
  const label = labelFor(state);

  // Skip translateRepoDescriptions in the SSR path — that's a Gemini round
  // trip per cold isolate (~5-10s) and the cards have a graceful fallback
  // (RepoCard renders descriptionEn || description). The client will pick
  // up translations on any later /api/repos fetch (infinite scroll, search,
  // tag click) which keeps the module-level translation cache populated.
  const initialRepos = await getPrefetch({
    topic: state.topic,
    query: state.query,
    timeWindow: state.timeWindow,
  });
  return (
    <RepoRadarApp
      initialRepos={initialRepos}
      initialQuery={{ topic: state.topic, query: state.query, label }}
      initialPriorities={state.priorities}
      initialTimeWindow={state.timeWindow}
    />
  );
}
