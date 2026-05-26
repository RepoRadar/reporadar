import { RepoRadarApp } from "@/app/components/RepoRadarApp";
import { fetchTrending } from "@/app/lib/github";
import type { Repo } from "@/app/lib/types";
import { parseShareParams, labelFor, type TimeWindow } from "@/app/lib/shareUrl";

// No caching at the page level. We're iterating on this every few minutes —
// every visit must hit the latest deployed bundle. (Without this, OpenNext +
// Cloudflare were caching the page HTML for s-maxage=31536000 — a year.)
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Server-prefetch the default Hermes trending pull so the home page's first
// paint already has cards. Without this, the client bootstrap useEffect adds
// a 1-3s blank window every visit (GitHub Search API round-trip). With this,
// the HTML arrives card-complete and the only post-hydration work is the
// auto-snap to the top repo.
//
// We import fetchTrending directly (not via /api/repos round-trip) so the
// Cloudflare Worker stays within itself. If GitHub rate-limits us at SSR
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
  let initialRepos: Repo[] = [];
  try {
    initialRepos = await withTimeout(
      fetchTrending({
        topic: state.topic,
        query: state.query,
        since: sinceFor(state.timeWindow),
        page: 1,
        perPage: 100,
      }),
      SSR_PREFETCH_BUDGET_MS,
    );
  } catch (e) {
    // Timed out or upstream error — render without prefetched cards; the
    // client bootstrap fetches them after hydration. Never blocks first paint.
    console.error("[home] SSR prefetch skipped:", e instanceof Error ? e.message : e);
  }
  return (
    <RepoRadarApp
      initialRepos={initialRepos}
      initialQuery={{ topic: state.topic, query: state.query, label }}
      initialPriorities={state.priorities}
      initialTimeWindow={state.timeWindow}
    />
  );
}
