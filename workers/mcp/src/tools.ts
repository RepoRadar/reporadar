// Shared tool definitions for the RepoRadar MCP server.
//
// Both the Cloudflare Worker entry (`worker.ts`, runs on Workers, mcp-use
// HTTP/SSE transport) and the local stdio entry (`stdio.ts`, runs in Node for
// Claude Desktop) reuse the same two tools defined here.
//
// The tools are thin wrappers over the existing reporadar.io API + the
// deploy worker. They forward the upstream JSON verbatim so the heuristic
// scoring in `app/lib/scoring.ts:computeDimensions` stays the single source
// of truth for the 10 PRD dimensions.

export type ToolEnv = {
  /** Base URL of the Next.js app (default: https://reporadar.io). */
  reporadarApiBase: string;
  /** Base URL of the deploy worker. */
  deployWorkerUrl: string;
};

const DEFAULT_ENV: ToolEnv = {
  reporadarApiBase: "https://reporadar.io",
  deployWorkerUrl: "https://reporadar-deploy.let-s-go-christo.workers.dev",
};

export function resolveEnv(partial?: Partial<ToolEnv>): ToolEnv {
  return {
    reporadarApiBase:
      partial?.reporadarApiBase ||
      (typeof process !== "undefined" ? process.env?.REPORADAR_API_BASE : undefined) ||
      DEFAULT_ENV.reporadarApiBase,
    deployWorkerUrl:
      partial?.deployWorkerUrl ||
      (typeof process !== "undefined" ? process.env?.DEPLOY_WORKER_URL : undefined) ||
      DEFAULT_ENV.deployWorkerUrl,
  };
}

// rank_repos --------------------------------------------------------------
//
// Forwards to GET https://reporadar.io/api/repos which already returns the
// scored 10-dimension repos via app/lib/scoring.ts. We pass `enrich=1` so
// README length + recent commits are pulled (richer dimensions). The Next.js
// route only scores the cards on the client, so we pull the raw repos and
// re-score them in `scoreOnReporadar` below by asking for `enrich=1` and
// trusting the upstream heuristic via a tiny re-fetch + score call. To keep
// the worker self-contained we just forward the upstream JSON; the consuming
// LLM can see the raw GitHub fields in addition to whatever scoring metadata
// the API returns.

export type RankReposInput = {
  query?: string;
  topic?: string;
  limit?: number;
};

export async function rankRepos(input: RankReposInput, env: ToolEnv) {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.topic) params.set("topic", input.topic);
  const limit = Math.min(12, Math.max(1, input.limit ?? 8));
  params.set("limit", String(limit));
  // enrich=1 pulls README length + recent commits → richer dimensions on the
  // client. The upstream endpoint scores per-card on the React app; here we
  // forward the raw repo records along with computed dimensions so an LLM
  // caller has both the heuristic features AND the GitHub primitives.
  params.set("enrich", "1");

  const url = `${env.reporadarApiBase}/api/repos?${params.toString()}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`reporadar /api/repos ${res.status}: ${body.slice(0, 240)}`);
  }
  const repos = (await res.json()) as Array<Record<string, unknown>>;

  // Compute the same dimensions the home surface uses so MCP callers see the
  // 10 PRD scores without needing a second hop.
  const ranked = repos.map((r) => {
    const dimensions = computeDimensions(r as RepoLike);
    const overall =
      Math.round(
        (dimensions.momentum * 0.3 +
          dimensions.velocity * 0.2 +
          dimensions.maturity * 0.15 +
          dimensions.community * 0.1 +
          dimensions.recency * 0.1 +
          dimensions.documentation * 0.05 +
          dimensions.security * 0.05 +
          dimensions.easeOfPrototyping * 0.025 +
          dimensions.productionReadiness * 0.025) *
          10,
      ) / 10;
    return {
      fullName: r.fullName,
      description: r.description,
      htmlUrl: r.htmlUrl,
      stars: r.stars,
      forks: r.forks,
      language: r.language,
      topics: r.topics,
      pushedAt: r.pushedAt,
      createdAt: r.createdAt,
      readmeLength: r.readmeLength,
      recentCommits: r.recentCommits,
      dimensions,
      overallScore: overall,
    };
  });
  ranked.sort((a, b) => b.overallScore - a.overallScore);
  return ranked;
}

// deploy_variant ----------------------------------------------------------
//
// POSTs to the existing deploy worker which runs Gemini → A2UI surface →
// R2 + D1 persist, then returns {slug, url, formFactor} so an MCP client
// (Claude Desktop, ChatGPT) can render a clickable link.

export type DeployVariantInput = {
  repo: string;
  hint?: string;
};

export async function deployVariant(input: DeployVariantInput, env: ToolEnv) {
  if (!input.repo || !/^[\w.-]+\/[\w.-]+$/.test(input.repo)) {
    throw new Error(
      `repo must look like "owner/name" (e.g. "anthropics/claude-cookbooks"); got: ${JSON.stringify(input.repo)}`,
    );
  }
  const res = await fetch(`${env.deployWorkerUrl}/deploy`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ repo: input.repo, hint: input.hint }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`deploy worker ${res.status}: ${body.slice(0, 240)}`);
  }
  const j = (await res.json()) as {
    ok: boolean;
    slug?: string;
    url?: string;
    formFactor?: string;
    error?: string;
  };
  if (!j.ok) {
    throw new Error(`deploy worker returned not-ok: ${j.error ?? "(no error)"}`);
  }
  return {
    slug: j.slug,
    url: j.url,
    formFactor: j.formFactor,
    repo: input.repo,
    hint: input.hint ?? null,
  };
}

// 10-dimension scoring (mirror of app/lib/scoring.ts:computeDimensions) ----
//
// We re-implement the heuristic here so the MCP server can return scored
// repos without a second roundtrip. Keep this in lockstep with the canonical
// implementation in app/lib/scoring.ts.

type RepoLike = {
  stars: number;
  forks: number;
  openIssues: number;
  recentCommits: number;
  readmeLength: number;
  topics: string[];
  pushedAt?: string;
  createdAt?: string;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const logNormalize = (n: number, ceiling: number) =>
  clamp01(Math.log10(Math.max(1, n)) / Math.log10(ceiling));
const daysSince = (iso: string | undefined): number => {
  if (!iso) return 9999;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 9999;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
};

function computeDimensions(repo: RepoLike) {
  const ageDays = daysSince(repo.createdAt);
  const sincePush = daysSince(repo.pushedAt);

  const stars = logNormalize(repo.stars ?? 0, 100000) * 100;
  const forks = logNormalize(repo.forks ?? 0, 20000) * 100;

  const ageNormalized = clamp01(1 - logNormalize(Math.max(1, ageDays), 1825));
  const momentum = Math.round(0.65 * stars + 0.35 * ageNormalized * 100);

  const commitVelocity = logNormalize(repo.recentCommits ?? 0, 200) * 100;
  const pushedRecently = clamp01(1 - sincePush / 14) * 100;
  const velocity = Math.round(
    (repo.recentCommits ?? 0) > 0 ? commitVelocity : 0.6 * pushedRecently,
  );

  const topics = repo.topics ?? [];
  const stableBonus = topics.some((t) => /(stable|production|enterprise|library|sdk)/i.test(t))
    ? 15
    : 0;
  const maturityBase = 0.55 * forks + 0.30 * (100 - ageNormalized * 100) + stableBonus;
  const maturity = Math.round(clamp01(maturityBase / 100) * 100);

  const issueSignal = logNormalize(repo.openIssues ?? 0, 1000) * 100;
  const community = Math.round(
    clamp01((0.45 * stars + 0.35 * forks + 0.20 * issueSignal) / 100) * 100,
  );

  const recency = Math.round(clamp01(1 - sincePush / 30) * 100);

  const forkRate = (repo.stars ?? 0) > 0
    ? clamp01((repo.forks ?? 0) / Math.max(50, (repo.stars ?? 0) * 0.2))
    : 0;
  // Mirror the easeOfPrototyping heuristic from app/lib/scoring.ts.
  const protoStarterTags = topics.filter((t: string) =>
    /(starter|boilerplate|template|example|examples|demo|demos|quickstart|cookbook|recipe|tutorial|getting-started)/i.test(t),
  ).length;
  const protoStarter = Math.min(40, protoStarterTags * 14);
  const protoDocs = readmeLength > 5000 ? 18 : readmeLength > 0 ? 8 : 0;
  const protoFresh = clamp01(1 - sincePush / 30) * 18;
  const heavyOnly = topics.some((t: string) => /(framework|sdk|library)/i.test(t));
  const heaviness = heavyOnly && protoStarterTags === 0 ? -10 : 0;
  const easeOfPrototyping = Math.round(
    clamp01((35 + protoStarter + protoDocs + protoFresh + heaviness) / 100) * 100,
  );

  const prodTags = topics.filter((t) =>
    /(testing|ci|tested|production|enterprise|stable)/i.test(t),
  ).length;
  const productionReadiness = Math.round(
    clamp01((prodTags * 25 + maturity * 0.5 + ((repo.openIssues ?? 0) > 0 ? 10 : 0)) / 100) * 100,
  );

  const copyleft = topics.some((t) => /(gpl|agpl|copyleft)/i.test(t));
  const security = copyleft ? 35 : 70;

  const documentation = Math.round(
    (repo.readmeLength ?? 0) > 0 ? logNormalize(repo.readmeLength ?? 0, 30000) * 100 : 50,
  );

  const ecosystemPull = Math.round(stars);

  return {
    momentum,
    velocity,
    maturity,
    community,
    recency,
    easeOfPrototyping,
    productionReadiness,
    security,
    documentation,
    ecosystemPull,
  };
}
