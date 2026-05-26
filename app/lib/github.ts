import { Octokit } from "octokit";
import type { Repo } from "./types";

let _octokit: Octokit | null = null;
function octokit() {
  if (!_octokit) {
    _octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || undefined,
      userAgent: "reporadar/0.1",
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

  for (const tier of tiers) {
    try {
      const { data } = await octokit().rest.search.repos({
        q: tier.join(" "),
        sort: "stars",
        order: "desc",
        per_page: perPage,
        page,
      });
      if (data.items.length > 0) return data.items.map(toRepo);
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
