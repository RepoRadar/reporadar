import type { AxisWeights, Repo, ScoredRepo } from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const logNormalize = (n: number, ceiling: number) =>
  clamp01(Math.log10(Math.max(1, n)) / Math.log10(ceiling));

export function scoreRepo(repo: Repo, weights: AxisWeights): ScoredRepo {
  // Heuristic scoring axes (higher = better on that axis).
  // speedToBuild: short README + few open issues + clear language.
  const readmeShort = clamp01(1 - logNormalize(repo.readmeLength || 1, 30000));
  const fewOpenIssues = clamp01(1 - logNormalize(repo.openIssues, 500));
  const speedToBuild = clamp01(0.6 * readmeShort + 0.4 * fewOpenIssues);

  // communityEngagement: stars × forks × recent commits.
  const starScore = logNormalize(repo.stars, 100000);
  const forkScore = logNormalize(repo.forks, 20000);
  const recentScore = logNormalize(repo.recentCommits, 200);
  const communityEngagement = clamp01(0.5 * starScore + 0.25 * forkScore + 0.25 * recentScore);

  // jobPotential: trendy language × stars × topic relevance (rough).
  const trendyLanguages = new Set(["TypeScript", "Python", "Rust", "Go", "Swift"]);
  const langBonus = repo.language && trendyLanguages.has(repo.language) ? 1 : 0.6;
  const jobPotential = clamp01(0.6 * starScore + 0.4 * langBonus);

  // Weighted average — divide by Σ(weights) so overall stays in [0, 1] no
  // matter how the user tunes the sliders. Without this, three sliders at 1.0
  // would push overall to 3.0 (the old "150/100" bug).
  const weightSum =
    weights.speedToBuild + weights.communityEngagement + weights.jobPotential;
  const overall = weightSum > 0
    ? (weights.speedToBuild * speedToBuild +
        weights.communityEngagement * communityEngagement +
        weights.jobPotential * jobPotential) /
      weightSum
    : (speedToBuild + communityEngagement + jobPotential) / 3;

  // Display metrics (0..10) for the radar/card UI.
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
  };
}

export function rankRepos(repos: Repo[], weights: AxisWeights): ScoredRepo[] {
  return repos.map((r) => scoreRepo(r, weights)).sort(
    (a, b) => b.scores.overall - a.scores.overall,
  );
}
