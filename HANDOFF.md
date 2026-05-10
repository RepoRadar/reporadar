# RepoRadar — Session Handoff (2026-05-10 ~02:05 PT)

> Christo is asleep. Write picked up at 82% context. The next assistant
> opens this and runs from here.

## TL;DR — what's broken right now (read first)

1. **Cloudflare is caching the homepage HTML for a year** (`cache-control: s-maxage=31536000`, `x-nextjs-cache: HIT`). Every `wrangler deploy` since v0.7 has shipped fine, but the apex `reporadar.io` keeps serving a cached old bundle. **This is why Christo can't see the v0.7/v0.8/v0.9 features — they ARE deployed, just invisible.**
   - Fix shipped this session: `app/page.tsx` now has `export const dynamic = "force-dynamic"; export const revalidate = 0;` — needs a fresh deploy.
   - The CF API token (`cfat_<REDACTED — see Christo's secret store>`) does NOT have `Cache Purge:Purge` permission. Mint a new token at https://dash.cloudflare.com/profile/api-tokens with that scope, or use the dashboard's "Purge Everything" once.
2. **Smoke tests fail 14/16** because of the same cache issue. Once cache is flushed and v0.10 lands, the tests should pass.

## Deploys + URLs

| Resource | URL | Status |
|---|---|---|
| Apex Next.js app | https://reporadar.io | Live, but serving stale HTML — see TL;DR |
| Deploy worker | https://reporadar-deploy.let-s-go-christo.workers.dev | Live |
| Serve worker | https://reporadar-serve.let-s-go-christo.workers.dev (`*.reporadar.io/*`) | Live |
| MCP server | https://reporadar-mcp.let-s-go-christo.workers.dev/mcp | Live (tools `rank_repos` + `deploy_variant`) |
| GitHub repo | https://github.com/RepoRadar/reporadar | Public |

## Cloudflare credentials

```
CLOUDFLARE_ACCOUNT_ID=8eed363c07a698cda288e143e9496070
ZONE_ID (reporadar.io)=9740458463ff09b8cba88851baff9830
API token (limited): cfat_<REDACTED — see Christo's secret store>
   scopes: Zone:DNS:Edit (verified — used to set wildcard AAAA + HTTPS hardening)
   missing: Zone:Cache Purge — request next time
Wrangler OAuth (system keychain) is auth'd as ai4ses@gmail.com with access to
"Let's Go Christo" account.
```

## Secrets already on the workers

| Worker | Secret | Notes |
|---|---|---|
| `reporadar` (apex) | `GOOGLE_API_KEY` | Gemini 2.5 Flash — used by `/api/copilotkit` + `/api/deploy` |
| `reporadar-deploy` | `GOOGLE_API_KEY` | Same Gemini key, called via REST |
| `reporadar-deploy` | (RESEND_API_KEY pending) | Christo said he'd "get Resend" — not yet provided |

## What's currently deployed (commit `25ed87b`, version `1eeced02`)

* All v0.7-v0.9 features are in the bundle but **the cache mask hides them from Christo's browser**:
  - 10 tag chips (Hermes/OpenClaw/AG-UI/A2UI/Claude Code + Cloudflare/Generative UI/MCP/LangChain/Gemini)
  - 10 sort-priority chips with phrase-form labels (Trending Momentum, Shipping Velocity, Project Maturity, Community Engagement, Activity Recency, Engagement Heat, Production Readiness, Security & Trust, Documentation Quality, Ecosystem Pull)
  - "Most Stars" virtual sort priority — auto-selected on page load
  - Time-window chips (1mo / 3mo / 1y / All) — default 1y
  - Infinite scroll via IntersectionObserver, dedupe by fullName, `loading more…` sentinel
  - Hex (decagon) with full-phrase axis labels — bumped SVG to 320×320, padding 70 so labels don't clip
  - Repo cards: 1st/2nd/3rd medal gradients (gold/silver/bronze), HUGE star count, top-5 tag chips clickable, launched + last-update timestamps, score progress bar
  - Click any card → weights snap to that repo's 10-D profile, hex morphs, sliders animate
  - Click any tag chip on a card → re-runs query with that GitHub topic
  - License Safety dimension was renamed to **Security & Trust** with a real heuristic (security topic flags + low-issues-per-star + recently-pushed)
  - MCP server live at `reporadar-mcp.let-s-go-christo.workers.dev/mcp` (4th sponsor protocol)
* Smoke tests at `tests/smoke.spec.ts` cover all the above (16 tests).

## What Christo asked for that's NOT YET shipped

These were requested but pushed to the next session:

1. **Header redesign** (high priority). Currently shows `● LIVE · v0.2 · gen-ui hackathon`. Christo wants:
   - Version: **v0.4** (or just bump to v1.0 — call it shipped)
   - Replace "● LIVE" with **"Last updated codebase: \<build-time\>"** and **"Last updated dataset: \<last-fetch-time\>"**
   - Link "AI Tinkerers" to https://sf.aitinkerers.org/hackathons/h_FZX7ihFWcHA/handbook
   - Add a **refresh button** that re-runs the current query
   - Build time: easiest to set via `next.config.ts` env: `env: { BUILD_TIME: new Date().toISOString() }` then read `process.env.BUILD_TIME` in the component.
   - Dataset time: track `lastRefresh` state in `RepoRadarApp.tsx` and update on every successful repos load.

2. **English-translation pipeline** (high priority). Repos with non-English (mostly Chinese) descriptions need to be translated. Mark with "translated to English" annotation.
   - Suggested implementation: in `app/api/repos/route.ts`, after Octokit fetch, detect non-Latin descriptions (regex `/[㐀-鿿一-鿿Ѐ-ӿ؀-ۿ]/`). Batch them into a single Gemini call. Cache results by `fullName` for the session.
   - Add `descriptionEn?: string` and `descriptionLang?: string` fields to `Repo` in `app/lib/types.ts`.
   - In `RepoCard.tsx`, show `descriptionEn` if present, with small caption: `translated from {lang} to English`.

3. **Header refresh button** must invalidate edge cache or just re-fetch with cache-busting. With force-dynamic now set, a simple re-fetch works.

4. **CF cache purge token**: mint a new API token with `Zone:Cache Purge:Purge` for `reporadar.io` so future deploys can purge from CI.

5. **OpenClaw rank-by-name fix** is in `app/lib/github.ts` — tier 1 now uses `keyword in:name,description`. NOT YET VISIBLE to Christo because of the cache. Validate after cache flush.

## File map (the bits the next session will care about)

```
app/
  page.tsx                       # force-dynamic, force-revalidate (just shipped)
  layout.tsx                     # CopilotKit Providers wrapper, font, body bg
  globals.css                    # Green/blue/yellow/red palette (no synthwave pink)
  api/
    copilotkit/route.ts          # CopilotRuntime + GoogleGenerativeAIAdapter
    deploy/route.ts              # /api/deploy — Gemini → A2UI → forward to worker → Resend
    repos/route.ts               # /api/repos — accepts ?topic, ?q, ?since, ?page, ?limit
  d/[slug]/page.tsx              # local /d/[slug] route mirrors *.reporadar.io serve
  components/
    Providers.tsx                # <CopilotKit runtimeUrl="/api/copilotkit">
    RepoRadarApp.tsx             # the entire home surface — TAGS row, SORT BY (PriorityBar),
                                 # sliders + caret, InteractiveRadar, card grid, deploy modal,
                                 # CopilotPopup. Time-window state, page state for infinite
                                 # scroll, IntersectionObserver, queryRef for current
                                 # topic/query.
    PriorityBar.tsx              # 10-dim chips + "Most Stars" virtual chip. Exports
                                 # `type SortKey = Dimension | "stars"`.
    InteractiveRadar.tsx         # custom-SVG decagon with draggable vertices.
                                 # SIZE 320, PADDING 70, overflow:visible.
    RepoCard.tsx                 # rank medal + StarBadge + RepoTimeline + tags row +
                                 # description + score bar + Deploy CTA. selectable.
    DeployForm.tsx               # in-modal + in-chat deploy flow: form → progress bar +
                                 # 5 milestones → done state with optional Resend notify.
    A2UIRenderer.tsx             # /d/[slug] React renderer (mirror of vanilla worker
                                 # renderer). Subset of A2UI components.
  lib/
    types.ts                     # Repo, ScoredRepo, Dimension union (10), DimensionWeights,
                                 # DIMENSION_META (label/short/help). License → Security
                                 # rename done. Phrase-form labels live here.
    scoring.ts                   # computeDimensions (10-axis heuristic), DEFAULT_WEIGHTS,
                                 # rankRepos with tiered SortKey priorities (handles
                                 # "stars" specially).
    github.ts                    # fetchTrending with multi-tier search:
                                 #   1. keyword in:name,description (NEW)
                                 #   2. topic:t
                                 #   3. broader keyword
                                 #   4. all-time
                                 #   5. pure recency fallback
                                 # accepts since + page params now.
    a2ui-types.ts                # A2UI subset typings
workers/
  deploy/                        # Gemini → A2UI generator + Resend notify
    src/index.ts
    migrations/0001_init.sql     # deploys table
    migrations/0002_records.sql  # records + counters tables (per-slug)
  serve/                         # *.reporadar.io renderer + REST backend
    src/index.ts                 # interactive vanilla A2UI renderer + /api/records,
                                 # /api/counters per slug, D1-backed
  mcp/                           # 4th sponsor protocol — mcp-use server
    src/worker.ts                # Cloudflare Workers HTTP/SSE entry
    src/stdio.ts                 # local stdio entry for Claude Desktop
    src/tools.ts                 # rank_repos + deploy_variant
    README.md                    # install + claude_desktop_config.json snippet
tests/
  smoke.spec.ts                  # 16 prod-only smoke tests, hits reporadar.io
playwright.config.ts             # baseURL = https://reporadar.io
wrangler.jsonc                   # apex Next.js worker (OpenNext) — pinned to reporadar.io
open-next.config.ts              # @opennextjs/cloudflare adapter config
HANDOFF.md                       # this file
```

## Commands cheat-sheet

```bash
# Always export this when running wrangler:
export CLOUDFLARE_ACCOUNT_ID=8eed363c07a698cda288e143e9496070

# Build + deploy apex (Next.js)
cd /Users/cro/dev/reporadar
npx opennextjs-cloudflare build
wrangler deploy

# Deploy individual workers
wrangler deploy --config workers/deploy/wrangler.toml
wrangler deploy --config workers/serve/wrangler.toml
wrangler deploy --config workers/mcp/wrangler.toml

# Smoke tests against PROD (no localhost — Christo's standing rule)
npm run test:smoke

# Set a worker secret
echo "<value>" | wrangler secret put NAME --config workers/<which>/wrangler.toml

# Purge CF cache (NEEDS new token with Cache Purge scope)
TOKEN="<new-token>"
ZONE="9740458463ff09b8cba88851baff9830"
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/purge_cache" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

## Open questions to ask Christo when he wakes up

1. Does he want v0.4 or jump to v1.0 in the header version?
2. Translation: real Gemini calls per-fetch (adds 2-3s latency) or a smaller TODO tag for now?
3. Refresh button: should it just re-fetch the current query, or also reset weights/priorities to defaults?
4. RESEND_API_KEY — still pending; without it email notifications are mocked.

## What I'd do first thing in the next session

1. **Force a fresh deploy with the page.tsx force-dynamic change already in place** — it's committed but not deployed yet:
   ```bash
   cd /Users/cro/dev/reporadar
   export CLOUDFLARE_ACCOUNT_ID=8eed363c07a698cda288e143e9496070
   npx opennextjs-cloudflare build && wrangler deploy
   ```
2. Verify the cache header is GONE — `curl -sI https://reporadar.io/ | grep cache` should NOT return `s-maxage=31536000`.
3. Run smoke tests — should be 16/16 once cache is gone.
4. Knock out the header redesign + translation pipeline (the two outstanding asks).
5. Push commits as separate small PRs/commits so Christo can review.

## What this codebase is, in one sentence

A Generative UI Global Hackathon submission (AI Tinkerers SF, May 9, 2026): an
agent surfaces trending GitHub repos as interactive cards on a 10-dimension
draggable decagon radar, then on Deploy generates a bespoke A2UI surface for
that repo backed by its own per-slug Cloudflare D1 database — exposing the
same flow as a CopilotKit Next.js app, an MCP server, and a remote MCP HTTP
endpoint. Stack: Next.js 16 + React 19 + Tailwind 4 + CopilotKit 1.57 + Gemini
2.5 Flash + Cloudflare Workers/D1/R2 + OpenNext + Resend.

## Last words

Christo went to sleep at 02:05 PT after pushing for ~14 hours straight. He's
asked the next session to do this autonomously. The cache fix is the unlock —
once it's deployed, everything from the past several sessions becomes visible
and a lot of his confusion goes away. Then the two real outstanding features
are the header redesign and English translation. Sleep tight. 🌙
