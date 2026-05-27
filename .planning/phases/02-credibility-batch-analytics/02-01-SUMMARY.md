---
phase: 02-credibility-batch-analytics
plan: "01"
subsystem: content-surfaces
tags: [static-pages, content, react-markdown, route-groups, ssg]
dependency_graph:
  requires: []
  provides:
    - "(site) route group with shared article layout"
    - "Prose Server Component (react-markdown + remark-gfm)"
    - "Bundled content modules (changelog.ts, blog/index.ts, 2 blog posts)"
    - "Static /changelog page"
    - "Static /blog list page"
    - "Static /blog/[slug] per-post page"
  affects:
    - "app/content/ (new module subtree)"
    - "app/(site)/ (new route group)"
    - "package.json (2 new deps)"
tech_stack:
  added:
    - "react-markdown@^10.1.0"
    - "remark-gfm@^4.0.1"
  patterns:
    - "Next.js (site) route group — layout without URL segment"
    - "generateStaticParams for fully pre-rendered dynamic segments"
    - "Bundled TS content modules — no runtime filesystem (Cloudflare Workers constraint)"
    - "Server Component Prose renderer — no client JS cost"
key_files:
  created:
    - app/content/changelog.ts
    - app/content/blog/index.ts
    - app/content/blog/why-we-built-reporadar.ts
    - app/content/blog/how-reporadar-scores-repos.ts
    - app/content/blog/_template-30-day-checkin.ts
    - app/(site)/layout.tsx
    - app/(site)/_components/Prose.tsx
    - app/(site)/changelog/page.tsx
    - app/(site)/blog/page.tsx
    - app/(site)/blog/[slug]/page.tsx
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Content as bundled TS modules (not runtime fs reads) — mandatory for Cloudflare Workers/OpenNext"
  - "react-markdown without rehype-raw — inert HTML/script per T-02-01 threat mitigation"
  - "Server Component Prose (no use client) — static-renderable pages"
  - "dynamicParams=false on /blog/[slug] — unknown slugs 404 cleanly"
metrics:
  duration_minutes: 4
  completed_date: "2026-05-27"
  tasks_completed: 3
  files_created: 10
  files_modified: 2
---

# Phase 2 Plan 01: (site) Route Group + Prose + Content Surfaces Summary

**One-liner:** Static /changelog, /blog, /blog/[slug] via bundled TS content modules + react-markdown Prose Server Component under a new (site) route group — all force-static, Cloudflare Workers safe.

## What Was Built

### Task 1: Deps + bundled content modules (commit 8db4eb4)
- Installed `react-markdown@^10.1.0` and `remark-gfm@^4.0.1` (no gray-matter, no @next/mdx per D-01).
- `app/content/changelog.ts`: curated changelog markdown string covering hackathon launch, Phase 1 prerequisites, and Phase 2 credibility batch.
- `app/content/blog/why-we-built-reporadar.ts`: founding post — AI Tinkerers Generative UI Hackathon origin, the problem solved, the 10-dimension model, roadmap.
- `app/content/blog/how-reporadar-scores-repos.ts`: detailed breakdown of all 10 scoring dimensions with rationale and tuning tips.
- `app/content/blog/_template-30-day-checkin.ts`: fully commented recurring check-in template (exports no active post).
- `app/content/blog/index.ts`: `BlogPost` type definition + `posts: BlogPost[]` array (newest-first).

### Task 2: (site) route group layout + Prose renderer (commit 8ef0241)
- `app/(site)/layout.tsx`: shared content layout using `var(--bg)`/`var(--fg)` tokens; max-width centered column; back-to-dashboard `<Link href="/">← RepoRadar</Link>` in `--primary` green; no white flash.
- `app/(site)/_components/Prose.tsx`: Server Component (`react-markdown` + `remark-gfm`); full `components` map styling h1-h4, p, a, strong, em, ul, ol, li, blockquote, code, pre, hr, table using globals.css tokens; no rehype-raw (T-02-01 mitigation).

### Task 3: Static pages (commit 3f504ff)
- `app/(site)/changelog/page.tsx`: `export const dynamic = "force-static"`; imports `changelog`; renders via `<Prose>`.
- `app/(site)/blog/page.tsx`: `export const dynamic = "force-static"`; imports `posts`; renders list with title (`--fg`), date (`--secondary`), summary (`--fg-muted`).
- `app/(site)/blog/[slug]/page.tsx`: `export const dynamic = "force-static"`; `generateStaticParams()` pre-renders both post slugs; `params: Promise<{slug}>` (Next 16 pattern); `dynamicParams = false`; `generateMetadata` per post.

## Build Output — Static Rendering Confirmed

```
├ ○ /blog
├ ● /blog/[slug]
│ ├ /blog/why-we-built-reporadar
│ └ /blog/how-reporadar-scores-repos
├ ○ /changelog
```

`○` = Static (force-static), `●` = SSG (generateStaticParams pre-rendered). No `ƒ` (Dynamic) — D-00 constraint satisfied.

## Verification

- `npm run build` exit 0; build output confirms static rendering (pasted above).
- `npx eslint "app/(site)/**/*.tsx" app/content/**/*.ts` — clean (0 errors).
- No `fs.` calls in any content or page file.
- Dashboard (`/`) unchanged — this plan added only new files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced `<a href="/">` with `<Link href="/">` in (site)/layout.tsx**
- **Found during:** Task 3 ESLint pass
- **Issue:** ESLint `@next/next/no-html-link-for-pages` error — bare `<a>` to `/` triggers full page reload instead of client navigation.
- **Fix:** Replaced `<a>` with Next.js `<Link>` import in `app/(site)/layout.tsx`.
- **Files modified:** `app/(site)/layout.tsx`
- **Commit:** included in 3f504ff

## Known Stubs

None. All pages render real bundled content. The `_template-30-day-checkin.ts` file is intentionally fully commented — it is a human-copy scaffold, not a stub, and does not appear in the blog list.

## Threat Surface Scan

No new threat surface introduced beyond the plan's threat model:
- T-02-01 (react-markdown without rehype-raw): mitigated — `rehype-raw` was NOT added; embedded HTML/script in markdown is inert.
- T-02-02 (runtime filesystem on Workers): mitigated — all content bundled at build time, `dynamic = "force-static"`, build output verified `○`/`●`.
- No new network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

- app/content/changelog.ts: FOUND
- app/content/blog/index.ts: FOUND
- app/(site)/layout.tsx: FOUND
- app/(site)/_components/Prose.tsx: FOUND
- app/(site)/changelog/page.tsx: FOUND
- app/(site)/blog/page.tsx: FOUND
- app/(site)/blog/[slug]/page.tsx: FOUND
- Commit 8db4eb4: FOUND
- Commit 8ef0241: FOUND
- Commit 3f504ff: FOUND
- Build output /changelog ○: CONFIRMED
- Build output /blog ○: CONFIRMED
- Build output /blog/[slug] ●: CONFIRMED
