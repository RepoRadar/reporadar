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
import { post as wonHackathon } from "./reporadar-2nd-place-generative-ui-hackathon";
import { post as meetFounders } from "./meet-the-founders";

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
  /**
   * Optional LinkedIn embed URL (https://www.linkedin.com/embed/feed/update/...)
   * rendered as a trusted iframe after the body. Team-authored constant, never user input.
   */
  linkedinEmbedUrl?: string;
  /** Optional pixel height for the LinkedIn embed iframe (default 1100). */
  linkedinEmbedHeight?: number;
};

/** All published posts, newest-first. */
export const posts: BlogPost[] = [
  wonHackathon,  // 2026-05-28 (2nd place result)
  meetFounders,  // 2026-05-28 (founder intros)
  howItScores,   // 2026-05-20
  whyWeBuilt,    // 2026-05-10 (hackathon / founding)
];
