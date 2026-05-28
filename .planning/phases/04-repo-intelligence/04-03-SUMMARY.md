---
phase: 04-repo-intelligence
plan: 03
subsystem: ui
tags: [next.js, react, server-component, react-markdown, dimension-bars, radar-gradient, workspace]

requires:
  - phase: 04-repo-intelligence
    plan: 01
    provides: fetchRepoContext, RepoContext, isValidFullName, blobUrl, treeUrl

provides:
  - path: app/chat/[owner]/[repo]/page.tsx
    exports: ChatWorkspace (default), generateMetadata
    description: Server component; fetches RepoContext, renders two-pane layout, handles not-found + fetch-failed states
  - path: app/chat/[owner]/[repo]/RepoPane.tsx
    exports: RepoPane (default)
    description: Right pane; identity row, 10 dimension bars, overall score, README via react-markdown, file-tree links
  - path: app/chat/[owner]/[repo]/loading.tsx
    exports: Loading (default), ChatWorkspaceSkeleton
    description: rr-shimmer skeleton for both panes while page.tsx resolves
  - path: app/globals.css
    exports: .rr-shimmer, .rr-think-dot (CSS rules), rr-think (keyframe)
    description: Typing-indicator keyframe and shimmer utility added

affects:
  - app/globals.css

dependency_graph:
  requires: [04-01]
  provides: [chat-workspace-ui]
  affects: [04-04-ChatClient]

tech_stack:
  added: []
  patterns:
    - react-markdown + remark-gfm for README rendering (no rehype-raw, safe by default)
    - RADAR_GRADIENT reused verbatim from RepoCard.tsx for dimension bars
    - Server component with params: Promise<{...}> pattern (Next.js 16)
    - try/catch wrapping fetchRepoContext renders styled error page, no stack trace (T-04-13)
    - isValidFullName gate before fetch (T-04-12)

key_files:
  created:
    - app/chat/[owner]/[repo]/page.tsx
    - app/chat/[owner]/[repo]/RepoPane.tsx
    - app/chat/[owner]/[repo]/loading.tsx
  modified:
    - app/globals.css

decisions:
  - id: D-04-03-a
    decision: "Not-found state renders a styled component instead of calling notFound(). This keeps the back link and try-again visible. Trade-off: no HTTP 404 status code; the plan spec explicitly says do not call notFound() here."
  - id: D-04-03-b
    decision: "RepoPane is a server component (no use client). All mouse-enter/leave handlers inside it are fine because Next.js serialises event handlers on server components to client-side hydration. No interactivity required beyond hover styles."
  - id: D-04-03-c
    description: "04-04 ChatClient mount point props: page.tsx passes fullName (string), repoName = repo (string), apiKeyPresent (boolean), and ctx (RepoContext) to the left pane region. The ChatClient in 04-04 needs these four values."

metrics:
  duration_min: 35
  completed: "2026-05-28"
  tasks: 2
  files_modified: 4
---

# Phase 4 Plan 03: Workspace route and RepoPane Summary

**One-liner:** Two-pane `/chat/[owner]/[repo]` workspace with server-rendered RepoPane (10 RADAR_GRADIENT dimension bars, react-markdown README, file-tree links) and loading skeleton.

## What was built

### Task 1: globals.css keyframes + RepoPane.tsx

Added `@keyframes rr-think` and `.rr-think-dot` rules to `app/globals.css` for the typing indicator (wired in 04-04). Added `.rr-shimmer` utility class to `@layer utilities` with reduced-motion override.

Created `app/chat/[owner]/[repo]/RepoPane.tsx` as a server component. Key elements:

- **Identity row:** `{owner}/{repo}` in `text-base font-bold font-mono`, one GitHub link (`aria-label="Open {owner}/{repo} on GitHub"`) mirroring RepoCard.tsx, stats line with language/stars/license/pushed-at, optional homepage link.
- **10 dimension bars:** `DIMENSION_ORDER.map(...)` with `RADAR_GRADIENT` fill, 4px rail in `var(--surface-3)`, `boxShadow: "0 0 6px var(--primary-glow)"`, label with `title={DIMENSION_META[k].help}` scoped tooltip, score in `var(--primary)`.
- **Overall score row:** border-top separator, full-width gradient bar, `Math.round(overall * 100)/100` label.
- **README section:** heading "Readme" (sentence case per copywriting contract), "View on GitHub" link, `react-markdown` + `remark-gfm` with compact heading sizes (h1 text-lg, h2 text-base, h3 text-sm), all links `target="_blank" rel="noopener noreferrer"`, scrollable container with `tabIndex={0}`. README-missing copy verbatim: "No README found for this repo. The chat can still answer from the file tree and RepoRadar scores."
- **File tree:** heading "Click around the repo", cap at 30 entries, folder/file inline SVG icons, `blobUrl`/`treeUrl` helper links, truncation note linking to tree root.

### Task 2: page.tsx and loading.tsx

`app/chat/[owner]/[repo]/page.tsx`:

- `export const runtime = "nodejs"`, `generateMetadata` with dynamic title `{repo} | RepoRadar chat`.
- `isValidFullName` gate before fetch; `try/catch` around `fetchRepoContext` renders `<NotAvailable>` component (not `notFound()`), per plan spec, so back link and try-again are always visible.
- Page header (48px sticky): RepoRadar mark + text wordmark `Repo`/`Radar` linking to `/`, slash separator, `{owner}/{repo}` in `font-mono text-sm`, `<- Back to dashboard` link.
- Two-pane flex layout: left 55% (`min-width: 320px`), right 45% (`min-width: 280px`), gap 24px, each pane `calc(100dvh - 48px - 48px)` height, own `overflow-y: auto`, `var(--surface)` bg, `border-radius: 16px`, padding 24px.
- Left pane chat header: repo name `text-xl font-bold`, trust line "Grounded in this repo's README, file tree, and RepoRadar scores", not-saved note "Not saved. Conversations end when you close this tab." with lock icon, `var(--fg-dim) font-mono text-xs`.
- `{/* ChatClient mounts here in 04-04 */}` mount point comment. `apiKeyPresent` renders "Chat is not available right now." fallback until 04-04 wires the real client.
- `<NotAvailable>` component: "This repo is not available." heading, body "{owner}/{repo} could not be loaded. It may be private, have been deleted, or GitHub may be unavailable right now.", back link + try-again link. No stack traces.

`app/chat/[owner]/[repo]/loading.tsx`:

- `ChatWorkspaceSkeleton` with left pane (header shimmer, 4 chip shimmers, composer shimmer) and right pane (identity shimmer, 10 bar shimmers, 320px README shimmer, 120px tree shimmer).
- All shimmer divs use `.rr-shimmer` class.

## Props contract for 04-04

The `page.tsx` left pane passes these values to the ChatClient mount point:

| Prop | Type | Source | Notes |
|------|------|--------|-------|
| `fullName` | `string` | `${owner}/${repo}` | e.g. `"facebook/react"` |
| `repoName` | `string` | `repo` param | Short name without owner prefix |
| `ctx` | `RepoContext` | `fetchRepoContext(fullName)` | Full grounding bundle from 04-01 |
| `apiKeyPresent` | `boolean` | `Boolean(process.env.GOOGLE_API_KEY)` | True if chat is available |

04-04 should replace the placeholder `<div>` in the left pane with `<ChatClient fullName={fullName} repoName={repo} ctx={ctx} apiKeyPresent={apiKeyPresent} />`.

## Security compliance

| Threat ID | Status |
|-----------|--------|
| T-04-11 (XSS via README) | Mitigated: react-markdown without rehype-raw; no dangerouslySetInnerHTML; links target=_blank rel=noopener |
| T-04-12 (malformed path param) | Mitigated: isValidFullName gate before fetch; failure renders clean NotAvailable |
| T-04-13 (raw error disclosure) | Mitigated: try/catch renders only styled copy, no stack traces |

## Deviations from plan

None significant. The plan explicitly says to render the styled not-found message (not call `notFound()`), which was implemented as specified.

## Known stubs

- Left pane chat body: renders a placeholder "Chat loading..." or "Chat is not available right now." until 04-04's `ChatClient` is wired.
- This is intentional: the plan states `{/* ChatClient mounts here in 04-04 */}` and 04-04 will replace the placeholder.

## Threat flags

None. No new network endpoints or auth paths introduced. This is a rendering-only server component.

## Self-Check: PASSED

Files exist:
- app/chat/[owner]/[repo]/page.tsx: YES
- app/chat/[owner]/[repo]/RepoPane.tsx: YES
- app/chat/[owner]/[repo]/loading.tsx: YES
- app/globals.css (modified): YES

Commit: a3233a2 — feat(04-03): workspace route with two-pane layout and RepoPane
