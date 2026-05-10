import type {
  Dimension,
  DimensionWeights,
  Dimensions,
  Repo,
  ScoredRepo,
} from "./types";
import { DIMENSION_ORDER } from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const logNormalize = (n: number, ceiling: number) =>
  clamp01(Math.log10(Math.max(1, n)) / Math.log10(ceiling));

const daysSince = (iso: string | undefined): number => {
  if (!iso) return 9999;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 9999;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
};

// Default weights — top 3 (Momentum/Velocity/Maturity) at 0.7, rest at 0.3.
// User tunes these via the sliders + interactive hex; scoreRepo computes a
// weighted average over each repo's 0..100 dimensions.
export const DEFAULT_WEIGHTS: DimensionWeights = {
  momentum: 0.7,
  velocity: 0.7,
  maturity: 0.7,
  community: 0.3,
  recency: 0.3,
  easeOfPrototyping: 0.6,
  productionReadiness: 0.3,
  security: 0.3,
  documentation: 0.3,
  ecosystemPull: 0.3,
};

// Heuristic 10-axis dimensions derived from the GitHub data we already pull.
// Each axis is 0..100, higher = better for the user, per PRD §7.
export function computeDimensions(repo: Repo): Dimensions {
  const ageDays = daysSince(repo.createdAt);
  const sincePush = daysSince(repo.pushedAt);

  const stars = logNormalize(repo.stars, 100000) * 100;
  const forks = logNormalize(repo.forks, 20000) * 100;

  const ageNormalized = clamp01(1 - logNormalize(Math.max(1, ageDays), 1825));
  const momentum = Math.round(0.65 * stars + 0.35 * ageNormalized * 100);

  const commitVelocity = logNormalize(repo.recentCommits, 200) * 100;
  const pushedRecently = clamp01(1 - sincePush / 14) * 100;
  const velocity = Math.round(
    repo.recentCommits > 0 ? commitVelocity : 0.6 * pushedRecently,
  );

  const stableBonus = repo.topics.some((t) =>
    /(stable|production|enterprise|library|sdk)/i.test(t),
  )
    ? 15
    : 0;
  const maturityBase = 0.55 * forks + 0.30 * (100 - ageNormalized * 100) + stableBonus;
  const maturity = Math.round(clamp01(maturityBase / 100) * 100);

  const issueSignal = logNormalize(repo.openIssues, 1000) * 100;
  const community = Math.round(
    clamp01((0.45 * stars + 0.35 * forks + 0.20 * issueSignal) / 100) * 100,
  );

  const recency = Math.round(clamp01(1 - sincePush / 30) * 100);

  // Ease of Prototyping — how fast you can spin up a working prototype
  // without touching anything. Mix of explicit "starter / boilerplate /
  // example / template / quickstart" topic signals + README presence +
  // recent activity. Penalize if the repo signals "library/sdk/framework"
  // (more glue work needed) and there's no offsetting starter signal.
  const protoStarterTags = repo.topics.filter((t) =>
    /(starter|boilerplate|template|example|examples|demo|demos|quickstart|cookbook|recipe|tutorial|getting-started)/i.test(t),
  ).length;
  const protoStarter = Math.min(40, protoStarterTags * 14);
  const protoDocs = repo.readmeLength > 5000 ? 18 : repo.readmeLength > 0 ? 8 : 0;
  const protoFresh = clamp01(1 - sincePush / 30) * 18;
  const heavyOnly = repo.topics.some((t) => /(framework|sdk|library)/i.test(t));
  const heaviness = heavyOnly && protoStarterTags === 0 ? -10 : 0;
  const easeOfPrototyping = Math.round(
    clamp01((35 + protoStarter + protoDocs + protoFresh + heaviness) / 100) * 100,
  );

  const prodTags = repo.topics.filter((t) =>
    /(testing|ci|tested|production|enterprise|stable)/i.test(t),
  ).length;
  const productionReadiness = Math.round(
    clamp01((prodTags * 25 + maturity * 0.5 + (repo.openIssues > 0 ? 10 : 0)) / 100) * 100,
  );

  // Security & Trust — heuristic from topics + open-vuln pressure + maintenance.
  // Higher = safer to adopt. We don't have CVE data so this is approximate.
  const securityTags = repo.topics.filter((t) =>
    /(security|secure|vulnerab|cve|audit|scanner|firewall|sast|dast)/i.test(t),
  ).length;
  const trustBonus = securityTags > 0 ? 30 : 0;
  // Healthy maintenance signal — recently active + few open issues per star
  const issuesPerStar = repo.stars > 0 ? repo.openIssues / Math.max(1, repo.stars) : 1;
  const lowIssuePressure = clamp01(1 - issuesPerStar * 50) * 25; // 0..25
  const recentBonus = clamp01(1 - sincePush / 60) * 25; // 0..25
  const security = Math.round(
    clamp01((40 + trustBonus + lowIssuePressure + recentBonus) / 100) * 100,
  );

  const docs = repo.readmeLength > 0
    ? logNormalize(repo.readmeLength, 30000) * 100
    : 50;
  const documentation = Math.round(docs);

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

export function scoreRepo(repo: Repo, weights: DimensionWeights): ScoredRepo {
  const dims = computeDimensions(repo);

  // Weighted average over the 10 PRD dimensions. Σ(weight × dim) / Σ(weight)
  // keeps the result in [0, 100] regardless of slider configuration.
  let weighted = 0;
  let totalWeight = 0;
  for (const k of DIMENSION_ORDER) {
    const w = weights[k];
    weighted += w * dims[k];
    totalWeight += w;
  }
  const overall100 = totalWeight > 0 ? weighted / totalWeight : 50; // neutral fallback
  const overall = clamp01(overall100 / 100);

  // Legacy 3-bucket scores for backward compat with the SpiderRadar legend
  // and the cards' "depth/ui" pills (kept until they migrate to dimensions).
  const speedToBuild = clamp01(
    (dims.documentation * 0.4 + (100 - dims.maturity) * 0.6) / 100,
  );
  const communityEngagement = clamp01(dims.community / 100);
  const jobPotential = clamp01(
    (dims.momentum * 0.5 + dims.ecosystemPull * 0.5) / 100,
  );

  const complexity = Math.round(dims.maturity / 10);
  const uiPotential = Math.round(
    (dims.documentation * 0.6 +
      (repo.topics.some((t) => /(ui|frontend|design|component)/i.test(t)) ? 100 : 40) *
        0.4) /
      10,
  );

  return {
    ...repo,
    scores: {
      speedToBuild,
      communityEngagement,
      jobPotential,
      complexity,
      uiPotential,
      overall,
    },
    dimensions: dims,
  };
}

// Sort priority — click order = priority 1/2/3. Tiered comparison.
// Accepts the 10 PRD dimensions plus the "stars" virtual key which sorts by
// raw GitHub stars (the default first priority on page load).
export type SortKey = Dimension | "stars";
export function rankRepos(
  repos: Repo[],
  weights: DimensionWeights,
  priorities: SortKey[] = [],
): ScoredRepo[] {
  const scored = repos.map((r) => scoreRepo(r, weights));
  return scored.sort((a, b) => {
    for (const key of priorities) {
      const diff =
        key === "stars"
          ? b.stars - a.stars
          : b.dimensions[key] - a.dimensions[key];
      if (diff !== 0) return diff;
    }
    return b.scores.overall - a.scores.overall;
  });
}
