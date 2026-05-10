# reporadar-mcp

The fourth sponsor protocol for RepoRadar — a **Model Context Protocol** server built on [`mcp-use`](https://github.com/mcp-use/mcp-use) that exposes RepoRadar's two flagship operations to any MCP client (Claude Desktop, ChatGPT MCP, MCP Inspector, the `mcp-use` agent, etc.).

## Tools

| Tool | What it does |
|---|---|
| `rank_repos(query?, topic?, limit?)` | Calls `https://reporadar.io/api/repos`, then re-scores every repo on the 10 PRD dimensions (Momentum, Velocity, Maturity, Community, Recency, Heat, ProductionReadiness, LicenseSafety, Documentation, EcosystemPull) using the same heuristic as `app/lib/scoring.ts:computeDimensions`. Returns at most 12 repos with raw GitHub fields **and** the dimension scores. |
| `deploy_variant(repo, hint?)` | POSTs to the existing `reporadar-deploy` worker → Gemini → A2UI surface → R2 + per-deploy D1. Returns `{slug, url, formFactor}` so a chat user can immediately click through to a live `<slug>.reporadar.io` micro-app. |

The tools are defined once in [`src/tools.ts`](src/tools.ts) and reused by both transports.

## Two ways to run it

### A. Hosted on Cloudflare Workers (Streamable HTTP / SSE)

Already deployed in the hackathon account:

```
https://reporadar-mcp.let-s-go-christo.workers.dev/mcp     (Streamable HTTP — preferred)
https://reporadar-mcp.let-s-go-christo.workers.dev/sse     (SSE, legacy)
https://reporadar-mcp.let-s-go-christo.workers.dev/health  (sanity check)
```

Re-deploy with:

```bash
export CLOUDFLARE_ACCOUNT_ID=8eed363c07a698cda288e143e9496070
cd workers/mcp
npm install
npx wrangler deploy --config ./wrangler.toml
```

#### Connecting from Claude Desktop (remote)

Claude Desktop launches MCP servers over stdio, so the easiest way to point it at a remote Workers MCP is the official `mcp-remote` proxy:

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "reporadar": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://reporadar-mcp.let-s-go-christo.workers.dev/mcp"
      ]
    }
  }
}
```

#### Connecting from ChatGPT (Apps SDK / MCP)

Add a new MCP server with URL:

```
https://reporadar-mcp.let-s-go-christo.workers.dev/mcp
```

### B. Local stdio (no internet round-trip for the MCP layer)

Use this when you want Claude Desktop to launch the server directly on your machine:

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "reporadar": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/ABS/PATH/TO/reporadar/workers/mcp/src/stdio.ts"
      ],
      "env": {
        "REPORADAR_API_BASE": "https://reporadar.io",
        "DEPLOY_WORKER_URL": "https://reporadar-deploy.let-s-go-christo.workers.dev"
      }
    }
  }
}
```

The stdio entry uses the official `@modelcontextprotocol/sdk` (which `mcp-use` pulls in transitively) — `mcp-use` itself is HTTP/SSE-only.

#### Run + inspect locally

```bash
cd workers/mcp
npm install

# Just run the stdio server (talks JSON-RPC on stdin/stdout)
npm run stdio

# Drive it interactively with the official MCP Inspector
npm run inspect
# → opens http://localhost:5173 with both tools listed
```

## Verification

A full end-to-end smoke against the deployed Worker (this is what was run when the worker was shipped):

```bash
# 1. handshake
curl -s https://reporadar-mcp.let-s-go-christo.workers.dev/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.1"}}}'

# 2. list tools
curl -s https://reporadar-mcp.let-s-go-christo.workers.dev/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. call rank_repos — returns 10-dimension-scored agents repos
curl -s https://reporadar-mcp.let-s-go-christo.workers.dev/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"rank_repos","arguments":{"topic":"agents","limit":2}}}'
```

Both transports return real GitHub data with all 10 PRD dimensions populated.

## File layout

```
workers/mcp/
  src/
    tools.ts        # shared tool implementations + 10-dimension scoring (mirrors app/lib/scoring.ts)
    worker.ts       # Cloudflare Workers entry — mcp-use + getHandler({ provider: 'cloudflare' })
    stdio.ts        # Node stdio entry — official @modelcontextprotocol/sdk
  wrangler.toml     # NODE_ENV=production set so mcp-use skips its widget filesystem watcher
  package.json
  tsconfig.json
  README.md         # this file
```

## Design notes

- **`mcp-use` over hand-roll** — it's the most opinionated TS framework for MCP and it ships first-class Cloudflare Workers support via `getHandler({ provider: 'cloudflare' })`. The Hono app underneath gives us OAuth, DNS-rebinding protection, the inspector, and notification helpers for free.
- **Stateless on Workers** — Workers are short-lived; we set `stateless: true` so the server doesn't try to keep sessions in process memory.
- **NODE_ENV=production on Workers** — `mcp-use`'s dev mode tries to `fs.mkdir` a `widgets/resources` directory at boot, which the unenv polyfill on Workers can't satisfy. Forcing production mode skips the widget filesystem watcher; we don't ship widgets here, only tools.
- **Two transports, one tool definition** — the same `rankRepos` / `deployVariant` functions in `tools.ts` are wired into both `worker.ts` (mcp-use, HTTP) and `stdio.ts` (official SDK, stdio). Tool descriptions and schemas are duplicated since the two SDKs use different schema formats (`zod` for mcp-use, raw JSON Schema for the SDK), but the implementation is shared.
