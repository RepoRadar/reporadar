import type { AxisWeights, Dimensions, Repo, ScoredRepo } from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const logNormalize = (n: number, ceiling: number) =>
  clamp01(Math.log10(Math.max(1, n)) / Math.log10(ceiling));

const daysSince = (iso: string | undefined): number => {
  if (!iso) return 9999;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 9999;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
};

// Heuristic 10-axis dimensions derived from the GitHub data we already pull.
// Each axis is 0..100, higher = better for the user, per PRD §7.
export function computeDimensions(repo: Repo): Dimensions {
  const ageDays = daysSince(repo.createdAt);
  const sincePush = daysSince(repo.pushedAt);

  const stars = logNormalize(repo.stars, 100000) * 100;
  const forks = logNormalize(repo.forks, 20000) * 100;

  // Momentum — how fast it's gaining traction. Higher stars + younger age = hotter.
  // (Without a real "stars in the last 60 days" series we fake it from age.)
  const ageNormalized = clamp01(1 - logNormalize(Math.max(1, ageDays), 1825)); // 5y ceiling
  const momentum = Math.round(0.65 * stars + 0.35 * ageNormalized * 100);

  // Velocity — commits in last 30d. Without enrichment this is 0 → fall back
  // to "pushed within the last week" as a weak proxy.
  const commitVelocity = logNormalize(repo.recentCommits, 200) * 100;
  const pushedRecently = clamp01(1 - sincePush / 14) * 100;
  const velocity = Math.round(
    repo.recentCommits > 0 ? commitVelocity : 0.6 * pushedRecently,
  );

  // Maturity — older, established, lots of forks. Tag-based bonuses for
  // explicit "stable" or "v1"-flavored topics.
  const stableBonus = repo.topics.some((t) =>
    /(stable|production|enterprise|library|sdk)/i.test(t),
  )
    ? 15
    : 0;
  const maturityBase = 0.55 * forks + 0.30 * (100 - ageNormalized * 100) + stableBonus;
  const maturity = Math.round(clamp01(maturityBase / 100) * 100);

  // Community — stars × forks × engagement. Open issues are double-edged
  // (more issues = more engagement, but also more bug volume), so we damp.
  const issueSignal = logNormalize(repo.openIssues, 1000) * 100;
  const community = Math.round(
    clamp01((0.45 * stars + 0.35 * forks + 0.20 * issueSignal) / 100) * 100,
  );

  // Recency — pushed-recently is a clean signal.
  const recency = Math.round(clamp01(1 - sincePush / 30) * 100); // 0 if >30d stale

  // Heat — fork rate (forks per star) and PR-ish bias from issue volume.
  const forkRate = repo.stars > 0 ? clamp01(repo.forks / Math.max(50, repo.stars * 0.2)) : 0;
  const heat = Math.round(0.6 * forkRate * 100 + 0.4 * recency);

  // Production readiness — proxy from topic tags.
  const prodTags = repo.topics.filter((t) =>
    /(testing|ci|tested|production|enterprise|stable)/i.test(t),
  ).length;
  const productionReadiness = Math.round(
    clamp01((prodTags * 25 + maturity * 0.5 + (repo.openIssues > 0 ? 10 : 0)) / 100) * 100,
  );

  // License safety — we don't fetch the license; default 70 (most popular
  // repos use permissive licenses) and dock for "GPL"/"AGPL" topic markers.
  const copyleft = repo.topics.some((t) => /(gpl|agpl|copyleft)/i.test(t));
  const licenseSafety = copyleft ? 35 : 70;

  // Documentation — README length is a coarse but useful proxy.
  const docs = repo.readmeLength > 0
    ? logNormalize(repo.readmeLength, 30000) * 100
    : 50; // unknown → neutral
  const documentation = Math.round(docs);

  // Ecosystem pull — proxy from stars (real implementation would use npm/pypi).
  const ecosystemPull = Math.round(stars);

  return {
    momentum,
    velocity,
    maturity,
    community,
    recency,
    heat,
    productionReadiness,
    licenseSafety,
    documentation,
    ecosystemPull,
  };
}

export function scoreRepo(repo: Repo, weights: AxisWeights): ScoredRepo {
  // Heuristic scoring axes (higher = better on that axis).
  const readmeShort = clamp01(1 - logNormalize(repo.readmeLength || 1, 30000));
  const fewOpenIssues = clamp01(1 - logNormalize(repo.openIssues, 500));
  const speedToBuild = clamp01(0.6 * readmeShort + 0.4 * fewOpenIssues);

  const starScore = logNormalize(repo.stars, 100000);
  const forkScore = logNormalize(repo.forks, 20000);
  const recentScore = logNormalize(repo.recentCommits, 200);
  const communityEngagement = clamp01(
    0.5 * starScore + 0.25 * forkScore + 0.25 * recentScore,
  );

  const trendyLanguages = new Set(["TypeScript", "Python", "Rust", "Go", "Swift"]);
  const langBonus = repo.language && trendyLanguages.has(repo.language) ? 1 : 0.6;
  const jobPotential = clamp01(0.6 * starScore + 0.4 * langBonus);

  // Weighted average — divide by Σ(weights) so overall stays in [0, 1].
  const weightSum =
    weights.speedToBuild + weights.communityEngagement + weights.jobPotential;
  const overall =
    weightSum > 0
      ? (weights.speedToBuild * speedToBuild +
          weights.communityEngagement * communityEngagement +
          weights.jobPotential * jobPotential) /
        weightSum
      : (speedToBuild + communityEngagement + jobPotential) / 3;

  const complexity = Math.round(
    (logNormalize(repo.readmeLength, 50000) * 0.5 +
      logNormalize(repo.openIssues, 1000) * 0.5) *
      10,
  );
  const uiPotential = Math.round(
    (logNormalize(repo.stars, 50000) * 0.6 +
      (repo.topics.some((t) => /(ui|frontend|design|component)/i.test(t)) ? 1 : 0.4) *
        0.4) *
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
    dimensions: computeDimensions(repo),
  };
}

export function rankRepos(repos: Repo[], weights: AxisWeights): ScoredRepo[] {
  return repos
    .map((r) => scoreRepo(r, weights))
    .sort((a, b) => b.scores.overall - a.scores.overall);
}
