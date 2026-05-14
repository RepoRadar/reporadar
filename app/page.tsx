import { RepoRadarApp } from "@/app/components/RepoRadarApp";
import { fetchTrending } from "@/app/lib/github";
import { translateRepoDescriptions } from "@/app/lib/translate";
import type { Repo } from "@/app/lib/types";

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
export default async function Home() {
  let initialRepos: Repo[] = [];
  try {
    const since = new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10);
    const data = await fetchTrending({
      topic: "hermes",
      since,
      page: 1,
      perPage: 100,
    });
    await translateRepoDescriptions(data);
    initialRepos = data;
  } catch (e) {
    console.error("[home] hermes SSR prefetch failed:", e);
  }
  return <RepoRadarApp initialRepos={initialRepos} />;
}
