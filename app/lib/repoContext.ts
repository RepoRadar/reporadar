import { Octokit } from "octokit";
import { scoreRepo, DEFAULT_WEIGHTS } from "./scoring.ts";
import { DIMENSION_ORDER } from "./types.ts";
import type { Dimensions, Repo } from "./types.ts";

// ---------------------------------------------------------------------------
// Private octokit singleton (mirrors github.ts; the github.ts singleton is
// not exported, so we maintain a separate one here for the context fetch).
// ---------------------------------------------------------------------------

let _octokit: Octokit | null = null;
function octokit() {
  if (!_octokit) {
    _octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || undefined,
      userAgent: "reporadar/0.1",
      throttle: {
        onRateLimit: () => false,
        onSecondaryRateLimit: () => false,
      },
      retry: { enabled: false },
    });
  }
  return _octokit;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const README_CHAR_CAP = 12_000;
const TREE_PATH_CAP = 200;
const TREE_FETCH_BUDGET_MS = 6000;

// ---------------------------------------------------------------------------
// Pure helpers (no side effects, no I/O)
// ---------------------------------------------------------------------------

/**
 * Returns true when fullName matches the strict owner/repo pattern.
 * Rejects path traversal, spaces, multiple slashes, and empty segments.
 * Called before any network call to block T-04-01 injection attempts.
 */
export function isValidFullName(fullName: string): boolean {
  return /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(fullName);
}

/**
 * Caps a README string at README_CHAR_CAP characters.
 * Appends a truncation note when the source is longer, so downstream callers
 * can see that content was cut.
 */
export function trimReadme(raw: string): { text: string; truncated: boolean } {
  if (raw.length <= README_CHAR_CAP) {
    return { text: raw, truncated: false };
  }
  return {
    text: raw.slice(0, README_CHAR_CAP) + "\n\n[README truncated at 12,000 chars]",
    truncated: true,
  };
}

/**
 * Caps a flat list of git tree items at TREE_PATH_CAP.
 * Directories (type "tree") are sorted before files (type "blob").
 * Directory paths get a trailing slash so callers can distinguish them.
 */
export function capTree(
  items: { path: string; type: string }[],
): { paths: string[]; truncated: boolean } {
  const dirs = items.filter((i) => i.type === "tree");
  const files = items.filter((i) => i.type === "blob");
  const sorted = [...dirs, ...files];
  const capped = sorted.slice(0, TREE_PATH_CAP);
  const paths = capped.map((i) => (i.type === "tree" ? `${i.path}/` : i.path));
  return { paths, truncated: items.length > TREE_PATH_CAP };
}

/**
 * Returns a GitHub blob URL pointing to the HEAD ref.
 * Example: blobUrl("facebook/react", "src/index.js")
 *   -> "https://github.com/facebook/react/blob/HEAD/src/index.js"
 */
export function blobUrl(fullName: string, path: string): string {
  return `https://github.com/${fullName}/blob/HEAD/${path}`;
}

/**
 * Returns a GitHub tree URL pointing to the HEAD ref.
 * Example: treeUrl("facebook/react", "src")
 *   -> "https://github.com/facebook/react/tree/HEAD/src"
 */
export function treeUrl(fullName: string, path: string): string {
  return `https://github.com/${fullName}/tree/HEAD/${path}`;
}

// ---------------------------------------------------------------------------
// RepoContext type
// ---------------------------------------------------------------------------

export type RepoContext = {
  fullName: string;
  owner: string;
  repo: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  createdAt: string | undefined;
  pushedAt: string;
  homepage: string | null;
  topics: string[];
  readme: { text: string; truncated: boolean };
  treePaths: string[];
  treePathsTruncated: boolean;
  dimensions: Dimensions;
  overall: number; // 0..1
  htmlUrl: string;
};

// ---------------------------------------------------------------------------
// fetchRepoContext
// ---------------------------------------------------------------------------

/**
 * Fetches the grounding bundle for a single repo: README body, capped file
 * tree, repo metadata, RepoRadar dimension scores, and overall score.
 *
 * Shape-validates fullName first (T-04-01). The tree fetch is wrapped in an
 * AbortSignal so a giant monorepo degrades to an empty tree (T-04-02).
 */
export async function fetchRepoContext(fullName: string): Promise<RepoContext> {
  if (!isValidFullName(fullName)) {
    throw new Error("Invalid repo name");
  }

  const [owner, repo] = fullName.split("/");
  const ock = octokit();

  // Step 1: fetch metadata first to get default_branch.
  let meta: Awaited<ReturnType<typeof ock.rest.repos.get>>;
  try {
    meta = await ock.rest.repos.get({ owner, repo });
  } catch {
    throw new Error("Repo not found or inaccessible");
  }

  const m = meta.data;

  // Step 2: fetch README and tree in parallel; tolerate each failing
  // independently so a missing README or timed-out tree does not abort the
  // whole context fetch.
  const [readmeRes, treeRes] = await Promise.allSettled([
    ock.rest.repos.getReadme({ owner, repo, mediaType: { format: "raw" } }),
    ock.rest.git.getTree({
      owner,
      repo,
      tree_sha: m.default_branch,
      recursive: "1",
      request: { signal: AbortSignal.timeout(TREE_FETCH_BUDGET_MS) },
    }),
  ]);

  const rawReadme =
    readmeRes.status === "fulfilled" &&
    typeof readmeRes.value.data === "string"
      ? readmeRes.value.data
      : "";

  const treeItems =
    treeRes.status === "fulfilled" ? treeRes.value.data.tree : [];

  const apiTruncated =
    treeRes.status === "fulfilled" ? treeRes.value.data.truncated : false;

  // Step 3: build a Repo object for scoring.
  const repoObj: Repo = {
    fullName: m.full_name,
    description: m.description,
    stars: m.stargazers_count ?? 0,
    forks: m.forks_count ?? 0,
    openIssues: m.open_issues_count ?? 0,
    recentCommits: 0,
    readmeLength: rawReadme.length,
    topics: m.topics ?? [],
    language: m.language,
    htmlUrl: m.html_url,
    pushedAt: m.pushed_at ?? new Date().toISOString(),
    createdAt: m.created_at ?? undefined,
  };

  const scored = scoreRepo(repoObj, DEFAULT_WEIGHTS);

  // Step 4: apply caps.
  const readmeResult = trimReadme(rawReadme);
  const capResult = capTree(treeItems);

  return {
    fullName: m.full_name,
    owner,
    repo,
    description: m.description,
    language: m.language,
    stars: m.stargazers_count ?? 0,
    forks: m.forks_count ?? 0,
    openIssues: m.open_issues_count ?? 0,
    license: m.license?.spdx_id ?? null,
    createdAt: m.created_at ?? undefined,
    pushedAt: m.pushed_at ?? new Date().toISOString(),
    homepage: m.homepage ?? null,
    topics: m.topics ?? [],
    readme: { text: readmeResult.text, truncated: readmeResult.truncated },
    treePaths: capResult.paths,
    treePathsTruncated: apiTruncated || capResult.truncated,
    dimensions: scored.dimensions,
    overall: scored.scores.overall,
    htmlUrl: m.html_url,
  };
}

// Keep DIMENSION_ORDER re-export accessible to downstream callers that need
// the canonical order alongside a RepoContext (e.g. the prompt builder).
export { DIMENSION_ORDER };
