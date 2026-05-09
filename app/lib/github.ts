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

const SINCE_ISO = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
})();

/**
 * Fetch a pool of trending public repos. Tries (in order) topic-filtered
 * recency-windowed → keyword search → all-time keyword. The first non-empty
 * tier wins so unusual queries like "podcast" still surface something.
 * Anonymous rate limit is 60 req/hr — fine for hackathon.
 */
export async function fetchTrending({
  topic,
  query,
  perPage = 30,
}: {
  topic?: string;
  query?: string;
  perPage?: number;
} = {}): Promise<Repo[]> {
  const tiers: string[][] = [];
  const t = (topic || "").trim().toLowerCase();
  const q = (query || "").trim();

  // Tier 1: recency-windowed topic filter (the "trending" sweet spot).
  if (t) tiers.push([`created:>${SINCE_ISO}`, "is:public", "stars:>50", `topic:${t}`]);

  // Tier 2: recency-windowed freeform keyword (covers things that aren't a topic slug).
  const keyword = q || t;
  if (keyword) tiers.push([keyword, `pushed:>${SINCE_ISO}`, "is:public", "stars:>50"]);

  // Tier 3: all-time keyword + topic — last resort so we always show *something*.
  if (keyword) tiers.push([keyword, "is:public", "stars:>200"]);

  // Tier 4: pure recency (no topic) — final fallback for empty input.
  if (tiers.length === 0) tiers.push([`created:>${SINCE_ISO}`, "is:public", "stars:>50"]);

  for (const tier of tiers) {
    try {
      const { data } = await octokit().rest.search.repos({
        q: tier.join(" "),
        sort: "stars",
        order: "desc",
        per_page: perPage,
      });
      if (data.items.length > 0) return data.items.map(toRepo);
    } catch (err) {
      // Skip tier on error (likely rate limit) and try the next.
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
