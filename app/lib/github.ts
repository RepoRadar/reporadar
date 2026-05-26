import { Octokit } from "octokit";
import type { Repo } from "./types";

// Total wall-clock budget for one fetchTrending call (across all fallback
// tiers). Keeps a single request well under the Cloudflare Worker time limit
// even when anonymous GitHub connections hang under shared-IP rate-limiting.
const FETCH_BUDGET_MS = 6000;

let _octokit: Octokit | null = null;
function octokit() {
  if (!_octokit) {
    _octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || undefined,
      userAgent: "reporadar/0.1",
      // Fail fast instead of sleeping. Octokit's throttling plugin defaults to
      // WAITING OUT a rate-limit before retrying — the anon limit is tiny and
      // shared across all visitors via Cloudflare's egress IPs, so it sleeps
      // ~48s. In a Cloudflare Worker that blows the request time limit → an
      // uncatchable 500 on the home page's SSR prefetch. Returning false from
      // these handlers tells the plugin NOT to retry, so a rate-limited call
      // throws immediately; fetchTrending's per-tier try/catch then returns
      // fast (empty) and the client bootstrap fills cards in after hydration.
      throttle: {
        onRateLimit: () => false,
        onSecondaryRateLimit: () => false,
      },
      // The octokit meta-package also bundles the retry plugin, which backs off
      // and retries on transient/abuse responses. Disable it too so nothing
      // re-attempts (and waits) inside a request — we want a single fast attempt.
      retry: { enabled: false },
    });
  }
  return _octokit;
}

/**
 * Fetch a pool of trending public repos. Tries (in order) topic-filtered
 * recency-windowed → keyword search → all-time keyword. The first non-empty
 * tier wins so unusual queries like "podcast" still surface something.
 * Anonymous rate limit is 60 req/hr — fine for hackathon.
 */
export async function fetchTrending({
  topic,
  query,
  since,        // ISO date "YYYY-MM-DD". Omit (undefined) for NO cutoff (all-time).
  page = 1,     // GitHub search pagination — caps at 1000 total results
  perPage = 30,
}: {
  topic?: string;
  query?: string;
  since?: string;
  page?: number;
  perPage?: number;
} = {}): Promise<Repo[]> {
  const tiers: string[][] = [];
  const t = (topic || "").trim().toLowerCase();
  const q = (query || "").trim();
  // Apply a recency cutoff ONLY when `since` is provided. Omitting it (the
  // "All" time window) yields no `pushed:>` filter → a true all-time search.
  // Previously an absent `since` silently fell back to a 30-day window, so
  // "All" returned a *narrower* set than the 1-year default — the opposite of
  // intent. `recency` is spread into each tier so it simply vanishes for "All".
  const sinceIso = since ? since.slice(0, 10) : "";
  const recency = sinceIso ? [`pushed:>${sinceIso}`] : [];

  // Multi-tag support: topic can be a comma-joined list ("hermes,cloudflare")
  // meaning "repos tagged BOTH". Single-tag behavior is preserved when there's
  // only one entry.
  const topics = t ? t.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const topicFilters = topics.map((top) => `topic:${top}`);
  // Keyword tiers only make sense when there's a single topic (or no topic
  // and an explicit q). A comma-string like "hermes,cloudflare" passed as a
  // raw keyword would return nothing useful.
  const keyword = q || (topics.length === 1 ? topics[0] : "");

  // Tier 1: keyword in:name,description — surfaces repos NAMED that thing
  // first (Christo's "I expect Peter Steinberg's OpenClaw to be #1" rule).
  if (keyword) {
    tiers.push([keyword, "in:name,description", ...recency, "is:public", "stars:>10"]);
  }

  // Tier 2: topic-tag match within the time window. Multiple topics ANDed.
  if (topics.length > 0) {
    tiers.push([...topicFilters, ...recency, "is:public", "stars:>10"]);
  }

  // Tier 3: broader keyword search (anywhere in repo content).
  if (keyword) tiers.push([keyword, ...recency, "is:public", "stars:>50"]);

  // Tier 4: all-time keyword fallback so we always show *something*.
  if (keyword) tiers.push([keyword, "is:public", "stars:>200"]);

  // Tier 4b: multi-tag all-time fallback so combinations like "hermes +
  // cloudflare" never silently fall through into the generic-trending tier.
  if (topics.length > 1) {
    tiers.push([...topicFilters, "is:public", "stars:>10"]);
  }

  // Tier 5: pure recency (no topic) — final fallback for empty input.
  if (tiers.length === 0) tiers.push([...recency, "is:public", "stars:>50"]);

  // Hard wall-clock bound across ALL tiers via a single abort signal. When the
  // shared anonymous quota is exhausted, GitHub connections can hang for ~50s —
  // which blows the Cloudflare Worker request limit (uncatchable 500 on the home
  // SSR). AbortSignal aborts at the network layer (a JS setTimeout race does not
  // cancel a hung socket), so each call fails fast once the budget is spent and
  // the remaining tiers abort immediately. We degrade to [] → client bootstrap.
  const deadline = AbortSignal.timeout(FETCH_BUDGET_MS);
  // Call the Search API with a plain fetch rather than octokit. The octokit
  // meta-package's throttling plugin proactively SLEEPS (~48s) to respect the
  // anonymous rate limit and ignores attempts to disable it — that sleep blows
  // the Worker time limit. A direct fetch has no hidden ret/throttle: it returns
  // immediately (403 when limited) and the shared AbortSignal aborts any hung
  // socket at the network layer. Token used when present (raises the limit).
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "reporadar/0.1",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (const tier of tiers) {
    if (deadline.aborted) break;
    try {
      const url = new URL("https://api.github.com/search/repositories");
      url.searchParams.set("q", tier.join(" "));
      url.searchParams.set("sort", "stars");
      url.searchParams.set("order", "desc");
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(page));
      const res = await fetch(url, { headers, signal: deadline });
      if (!res.ok) {
        console.warn(`[fetchTrending] tier ${res.status}: ${res.statusText}`);
        continue;
      }
      const data = (await res.json()) as { items?: Parameters<typeof toRepo>[0][] };
      if (data.items && data.items.length > 0) return data.items.map(toRepo);
    } catch (err) {
      console.warn("[fetchTrending] tier failed:", err instanceof Error ? err.message : err);
    }
  }
  return [];
}

/**
 * Fetch a specific repo with extended metadata for ranking + deploy.
 */
export async function fetchRepo(fullName: string): Promise<Repo> {
  const [owner, repo] = fullName.split("/");
  const [meta, readme, commits] = await Promise.all([
    octokit().rest.repos.get({ owner, repo }),
    octokit()
      .rest.repos.getReadme({ owner, repo, mediaType: { format: "raw" } })
      .catch(() => ({ data: "" }) as unknown as { data: string }),
    octokit()
      .rest.repos.listCommits({ owner, repo, per_page: 100, since: new Date(Date.now() - 30 * 86400 * 1000).toISOString() })
      .catch(() => ({ data: [] as unknown[] })),
  ]);

  const m = meta.data;
  const readmeStr = typeof readme.data === "string" ? readme.data : "";
  return {
    fullName: m.full_name,
    description: m.description,
    stars: m.stargazers_count ?? 0,
    forks: m.forks_count ?? 0,
    openIssues: m.open_issues_count ?? 0,
    recentCommits: Array.isArray(commits.data) ? commits.data.length : 0,
    readmeLength: readmeStr.length,
    topics: m.topics ?? [],
    language: m.language,
    htmlUrl: m.html_url,
    pushedAt: m.pushed_at ?? new Date().toISOString(),
    createdAt: m.created_at ?? undefined,
  };
}

function toRepo(item: {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics?: string[];
  language: string | null;
  created_at?: string | null;
  html_url: string;
  pushed_at: string | null;
}): Repo {
  return {
    fullName: item.full_name,
    description: item.description,
    stars: item.stargazers_count,
    forks: item.forks_count,
    openIssues: item.open_issues_count,
    recentCommits: 0,
    readmeLength: 0,
    topics: item.topics ?? [],
    language: item.language,
    htmlUrl: item.html_url,
    pushedAt: item.pushed_at ?? new Date().toISOString(),
    createdAt: item.created_at ?? undefined,
  };
}
