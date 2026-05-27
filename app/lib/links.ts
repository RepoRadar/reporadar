/**
 * Shared link constants for the RepoRadar footer and nav.
 *
 * D-10: DONATION_URL is an owner-supplied value. The default
 * "https://ko-fi.com/reporadar" is a placeholder — confirm or replace
 * the real Ko-fi / Buy Me a Coffee handle by setting
 * NEXT_PUBLIC_DONATION_URL in your deployment env (Cloudflare Workers
 * secret or .dev.vars).
 */
export const DONATION_URL =
  process.env.NEXT_PUBLIC_DONATION_URL || "https://ko-fi.com/reporadar";

export const GITHUB_URL = "https://github.com/RepoRadar/reporadar";

/**
 * Frozen hackathon link — must stay byte-for-byte identical to the
 * header anchor in RepoRadarApp.tsx (lines 739-747).
 */
export const HACKATHON_URL =
  "https://sf.aitinkerers.org/hackathons/h_FZX7ihFWcHA/handbook";
