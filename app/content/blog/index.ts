/**
 * Blog post registry — ordered newest-first by date.
 * Import each post module here and add it to the `posts` array.
 *
 * To add a new post:
 *   1. Create app/content/blog/<slug>.ts exporting `const post: BlogPost`.
 *   2. Import it below.
 *   3. Add it to the `posts` array (keep newest-first order).
 */
import { post as whyWeBuilt } from "./why-we-built-reporadar";
import { post as howItScores } from "./how-reporadar-scores-repos";

export type BlogPost = {
  /** URL-safe identifier, e.g. "why-we-built-reporadar" */
  slug: string;
  /** Display title */
  title: string;
  /** ISO date string, e.g. "2026-05-27" */
  date: string;
  /** 1-2 sentence blurb shown on the /blog list page */
  summary: string;
  /** Full post body as a Markdown string */
  body: string;
};

/** All published posts, newest-first. */
export const posts: BlogPost[] = [
  whyWeBuilt,
  howItScores,
];
