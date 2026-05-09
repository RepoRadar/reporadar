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
 * Fetch a pool of trending public repos. We use GitHub search ordered by stars
 * over the last 30 days as a "trending" proxy. Optionally filtered by topic
 * keywords. Anonymous rate limit is 60 req/hr — fine for hackathon.
 */
export async function fetchTrending({
  topic,
  perPage = 30,
}: {
  topic?: string;
  perPage?: number;
} = {}): Promise<Repo[]> {
  const q = [`created:>${SINCE_ISO}`, "is:public", "stars:>50"];
  if (topic) q.push(`topic:${topic}`);

  const { data } = await octokit().rest.search.repos({
    q: q.join(" "),
    sort: "stars",
    order: "desc",
    per_page: perPage,
  });

  return data.items.map(toRepo);
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
  };
}
