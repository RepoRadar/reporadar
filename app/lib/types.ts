export type Repo = {
  fullName: string;        // owner/repo
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  recentCommits: number;   // commits in last 30d (estimate)
  readmeLength: number;    // chars
  topics: string[];
  language: string | null;
  htmlUrl: string;
  pushedAt: string;        // ISO
};

export type AxisWeights = {
  speedToBuild: number;        // 0..1
  communityEngagement: number; // 0..1
  jobPotential: number;        // 0..1
};

export type ScoredRepo = Repo & {
  scores: {
    speedToBuild: number;        // 0..1
    communityEngagement: number; // 0..1
    jobPotential: number;        // 0..1
    complexity: number;          // 0..10 (display)
    uiPotential: number;         // 0..10 (display)
    overall: number;             // weighted sum
  };
  agentSummary?: string;         // populated by agent if available
};
