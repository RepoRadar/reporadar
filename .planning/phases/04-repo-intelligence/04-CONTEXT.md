# Phase 4 context: Talk to a repo (MVP)

This phase builds **only** the free "talk to a repo" chat (Phase 4 surface 1), plus inline "suggest better repos" via search. The paid adoption report (SC #2) and standalone concierge (SC #3) are deferred. Full detail in `04-PRD.md` (authoritative). The interactive discuss step was skipped: the decisions below are locked by the owner (Christo), 2026-05-28.

## Locked decisions (do not re-open)

- **No persistence in the MVP.** Chat is ephemeral (client React state), not stored in D1/KV, not logged. This is also the privacy posture for SC #4 (proprietary "what I'm building" input not retained). A small "not saved, save coming soon" note only.
- **Model: Gemini 2.5 Flash** via `@google/generative-ai` 0.24.1 + `GOOGLE_API_KEY`, matching `app/lib/translate.ts`. Streaming + function calling.
- **Entry: a repo-card "Ask this repo" action that opens `/chat/[owner]/[repo]` in a new tab** (shareable). Two-pane: chat left, repo context (README + scores + file links) right.
- **Four suggested prompts**, one of which (the "I'm building..." fit chip) gates on the user describing their project before any answer is generated. Exact set in PRD §5.3.
- **Purpose-built streaming endpoint** (`/api/repo-chat`), not the CopilotKit runtime (CopilotKit is in the repo but is a global-popup pattern; we need a scoped analyst with a tool loop + the describe-your-build gate + strict writing style).

## Scope (what to build)

1. `app/lib/repoContext.ts`: `fetchRepoContext(fullName)` returning README body (currently discarded by `fetchRepo`), file tree (new Octokit `git.getTree` recursive, capped ~200 paths), repo metadata, RepoRadar dimensions + overall (via `computeDimensions`/`scoreRepo`, default weights), and GitHub blob/tree link helpers.
2. `POST /api/repo-chat`: streaming route, system-prompt builder (PRD §9), Gemini tool loop, tools `search_reporadar` (+ optional `get_repo_file`), per-IP rate limit, em-dash backstop, graceful degrade when key absent. Never log message bodies.
3. `app/chat/[owner]/[repo]/page.tsx` + right pane (scores bars with the green/blue/yellow/red gradient, rendered README via `react-markdown`, capped file-tree links to GitHub), loading/not-found/no-readme states.
4. `ChatClient.tsx`: streaming chat UI, markdown rendering, the four chips, the describe-your-build gate, the not-saved note, unavailable/rate-limited states.
5. Repo-card "Ask this repo" entry action (mirror the Deploy action) opening the new tab.
6. QA pass (browser, results not mechanics) + fixes.

## Constraints

- Writing rules apply to ALL assistant output and static copy: no em dashes, no AI-isms, sentence case, concrete. `.claude/skills/avoid-ai-writing`.
- Frozen UI contracts intact (repo cards, one GitHub link, gradient language, no card-level title tooltip). Hackathon quality bar: do not regress the dashboard.
- Reuse `github.ts`, `scoring.ts`, `types.ts`, the `translate.ts` Gemini pattern, the rate-limit pattern from `contact`/`subscribe`.
- Read the local Next 16 docs under `node_modules/next/dist/docs/` before writing route/streaming code; confirm the streaming-with-tools shape in `@google/generative-ai` 0.24.1.
- Branch `feat/talk-to-a-repo`. End at a reviewable DRAFT PR. Do NOT deploy (human-gated).

## Requirement scope and deferrals

This MVP pass covers these phase requirements:
- **INTL-01** (talk-to-a-repo chat, seeded with README + file tree + RepoRadar scores, suggested prompts, single fast model): IN SCOPE, fully delivered.
- **INTL-04** (proprietary pasted input handled explicitly, not logged/retained without consent): IN SCOPE, satisfied by the ephemeral no-persistence, no-logging design.

Deferred to a Phase 4 continuation (NOT planned in this pass):
- **INTL-02** (paid personalized adoption report): DEFERRED. The chat gives an inline fit read, but the structured paid report product is later.
- **INTL-03** (standalone concierge recommendation product): DEFERRED. The chat can call `search_reporadar` to suggest alternatives inline, but the standalone concierge product is later.

When the requirements coverage gate runs, INTL-02 and INTL-03 are intentionally uncovered: move them to a follow-up phase, do not block this MVP.

## Success criteria

See PRD §13 (8 falsifiable criteria). The phase MVP is done when all 8 hold and lint/build/tests are green. (Phase 4 as a whole stays open until INTL-02/03 ship later.)

## Key files to mirror

- Gemini call: `app/lib/translate.ts`
- Repo fetch + token: `app/lib/github.ts` (`fetchRepo`, `fetchTrending`)
- Scores + dimension metadata: `app/lib/scoring.ts`, `app/lib/types.ts` (`DIMENSION_META`, `DIMENSION_ORDER`, `computeDimensions`, `scoreRepo`)
- Card entry pattern: `app/components/RepoCard.tsx` (Deploy action) + `RepoRadarApp.tsx` (`onDeploy` wiring)
- Rate-limit + route shape: `app/api/contact/route.ts`, `app/api/notifications/subscribe/route.ts`
- Gradient bars: existing match-score bar / slider rails (RADAR_GRADIENT)
