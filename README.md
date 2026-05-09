# RepoRadar

> **Tune your radar. Surface trending repos as agent-rendered cards. Click Deploy on any one and an agent emits a bespoke interactive surface for that repo, served at its own URL.**

🌐 **Live demo**: [reporadar.io](https://reporadar.io)
📡 **Sample deploy**: [vercel-ai-ei0s.reporadar.io](https://vercel-ai-ei0s.reporadar.io) — an agent-generated playground for the `vercel/ai` SDK
🔁 **Repo**: [github.com/RepoRadar/reporadar](https://github.com/RepoRadar/reporadar)

Built for the **Generative UI Global Hackathon — AI Tinkerers SF, May 9, 2026** (presented by AI Tinkerers · Google DeepMind · CopilotKit).

## Why this isn't a chatbot

The hackathon's bar: *would this have been impossible with a chat interface?* For RepoRadar, yes — twice over.

1. **The home surface** is a tunable radar. Three sliders (speed-to-build, community engagement, job potential) re-weight a scatter plot in real time. The agent doesn't *describe* repos in prose — it emits **interactive cards** that materialize on the radar at their scored coordinates, ranked by your sliders. Drag a slider, the cards re-rank with no LLM call.
2. **The deploy artifact** is itself generative UI. When you click Deploy on a repo, the agent decides what kind of interactive surface best lets you experience that specific repo — a dashboard, a playground, a control panel, a wizard, a widget grid, a reader — and emits an **[A2UI](https://a2ui.org) JSON document** describing it. Our renderer turns that JSON into a working React surface at a fresh URL. Each deploy is a unique, agent-designed app. Different repos → different surfaces.

A chatbot can describe a repo. RepoRadar lets you *use* it.

## Tracks targeted

- **Kill the Dashboard** — the radar is generated per query, ranked per slider, never pre-built.
- **No Designer, No Problem** (moonshot) — every deployed surface's frontend is agent-emitted A2UI JSON. No designer involved.

## How we used each protocol

| Protocol | Role in RepoRadar | Where it lives |
|---|---|---|
| **CopilotKit** | Top-level React framework. Provides `<CopilotKit>` provider, `<CopilotPopup>` chat dock, and the `useCopilotAction` hooks that bind agent tools to interactive UI. | `app/components/Providers.tsx`, `app/components/RepoRadarApp.tsx` |
| **AG-UI** | Transport between the React client and the runtime. CopilotKit speaks AG-UI events under the hood — chat messages, tool calls, streamed render props. | implicit on every `useCopilotAction` invocation; runtime endpoint at `app/api/copilotkit/route.ts` |
| **A2UI** (Google DeepMind) | The **output format for every deployed surface**. Claude emits an A2UI JSON document. Our renderer (a ~10-component subset: Layout, Container, Heading, Text, Button, TextField, CheckBox, Slider, List, Tabs, ProgressBar, Image, Code) maps it to React at the generated URL. | `app/lib/a2ui-types.ts`, `app/components/A2UIRenderer.tsx`, `app/api/deploy/route.ts` |
| **MCP Apps** (mcp-use) | _Stretch — pending._ Exposes RepoRadar's `rank_repos` and `deploy_variant` actions as an MCP server consumable by Claude Desktop / ChatGPT. | `workers/mcp/` (planned) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser — Next.js 16 (App Router) + Tailwind 4                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ <CopilotKit> Provider                                            │  │
│  │   ├── <CopilotPopup>  (chat dock)                                │  │
│  │   ├── Sliders + RadarPlot (Recharts) + RepoCard grid             │  │
│  │   ├── useCopilotAction("rankRepos")  → handler → /api/repos      │  │
│  │   ├── useCopilotAction("deployRepo") → renderAndWaitForResponse  │  │
│  │   │                                    → DeployForm in chat       │  │
│  │   ├── useCopilotReadable: weights + ranked repos                 │  │
│  │   └── A2UIRenderer (used at /d/[slug] for deployed surfaces)     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                  │                          │                            │
│  AG-UI events ──┘                           │ POST /api/deploy           │
│                  ▼                          ▼                            │
│  /api/copilotkit/route.ts          /api/deploy/route.ts                  │
│    CopilotRuntime + AnthropicAdapter   1. fetchRepo(GitHub)              │
│    (model: claude-opus-4-7)            2. Claude → emit A2UI JSON         │
│                                        3. persist surface + return URL   │
└─────────────────────────────────────────────────────────────────────────┘
                  │
                  │ (production: forward to Cloudflare worker;
                  │  local/demo: in-memory surfaceStore + /d/[slug])
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Generated surface (per deploy, unique URL)                             │
│  /d/<slug>  →  A2UIRenderer mounts the saved A2UI JSON                  │
│  (production: <slug>.reporadar.io via reporadar-serve worker)            │
└─────────────────────────────────────────────────────────────────────────┘
```

## The end-to-end flow

1. User opens RepoRadar. Empty radar, sliders centered, chat dock open.
2. User types in chat: *"show me LangChain repos for a weekend project"*.
3. Claude calls `rankRepos(topic="langchain")`. The handler hits `/api/repos`, fetches via Octokit, runs the deterministic scoring helper, populates state. Cards animate onto the radar at their scored (complexity, ui-potential) coordinates.
4. User drags **Speed to Build**. Cards re-rank live (no LLM call — pure local scoring over cached repos).
5. User clicks **Deploy** on one of the cards (or asks the agent to "deploy that LangChain one as a control panel"). A `DeployForm` appears (in a modal or in chat — both wire to the same component).
6. User submits. POST `/api/deploy` → Claude is asked to choose a form factor for that repo and emit A2UI JSON. We persist the surface and return a URL.
7. A new tab opens at `/d/<slug>`. The A2UI renderer mounts. The user is now using a custom-built interactive surface for that repo, generated 10 seconds ago by an agent.

## Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind 4** + **TypeScript**
- **CopilotKit 1.57** (`@copilotkit/react-core`, `@copilotkit/react-ui`, `@copilotkit/runtime`)
- **Anthropic Claude Opus 4.7** (`@anthropic-ai/sdk`) via CopilotKit's `AnthropicAdapter`
- **Octokit** for GitHub
- **Recharts** for the radar/scatter
- **Cloudflare** for production: D1 (deploy registry), R2 (surface JSON blobs), Workers (`reporadar-deploy` and `reporadar-serve` on `*.reporadar.io`)

## Local development

```bash
# 1. Install
npm install

# 2. Add your Anthropic key
cp .env.local.example .env.local
# edit .env.local and fill in ANTHROPIC_API_KEY

# 3. Run
npm run dev
# → http://localhost:3000
```

### What's in `.env.local`

```
ANTHROPIC_API_KEY=sk-ant-...        # required for chat + deploy
GITHUB_TOKEN=ghp_...                # optional; bumps the GitHub anon rate limit
NEXT_PUBLIC_DEPLOY_WORKER_URL=...   # optional; if set, /api/deploy forwards to it
```

## Deploying the workers (production path)

```bash
# from /workers/deploy or /workers/serve
wrangler d1 create reporadar             # one-time; copy the database_id into both wrangler.toml files
wrangler r2 bucket create reporadar-surfaces
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy
```

Once `reporadar.io` is added as a zone, uncomment the `routes` block in `workers/serve/wrangler.toml` and `wrangler deploy` again. The worker will start serving every `<slug>.reporadar.io` request.

## Submission

- Repo: this one
- Demo video: see top of repo
- Protocols claimed: **CopilotKit** · **AG-UI** · **A2UI** _(MCP Apps if stretch lands)_
- Tracks: Kill the Dashboard · No Designer No Problem
- Team: Christo · Craig · Priyanshu (AI Tinkerers SF)

## License

MIT (or whatever the team agrees — IP is per-team per the hackathon rules).
