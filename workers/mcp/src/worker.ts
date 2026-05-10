// reporadar-mcp Cloudflare Worker entry.
//
// Hosts the RepoRadar MCP server over HTTP/SSE using the mcp-use framework
// (https://github.com/mcp-use/mcp-use). MCP clients (Claude Desktop via
// `mcp-remote`, ChatGPT MCP, Inspector) connect to:
//
//   https://reporadar-mcp.<account>.workers.dev/mcp   (Streamable HTTP)
//   https://reporadar-mcp.<account>.workers.dev/sse   (legacy SSE)
//
// Tools are defined once in ./tools.ts and are also reused by ./stdio.ts
// for local stdio mode (Claude Desktop direct).

import { MCPServer, text } from "mcp-use/server";
import { z } from "zod";
import { deployVariant, rankRepos, resolveEnv, type ToolEnv } from "./tools.js";

export interface Env {
  REPORADAR_API_BASE?: string;
  DEPLOY_WORKER_URL?: string;
}

function buildServer(env: Env) {
  const toolEnv: ToolEnv = resolveEnv({
    reporadarApiBase: env.REPORADAR_API_BASE,
    deployWorkerUrl: env.DEPLOY_WORKER_URL,
  });

  const server = new MCPServer({
    name: "reporadar",
    version: "0.1.0",
    description:
      "RepoRadar — rank trending GitHub repos on 10 PRD dimensions, then deploy a bespoke A2UI micro-app for any repo at <slug>.reporadar.io.",
    stateless: true, // Workers are short-lived; don't try to keep sessions in memory.
  });

  server.tool(
    {
      name: "rank_repos",
      description:
        "Search GitHub via RepoRadar's curated multi-tier fallback (topic → keyword → all-time) and rank the results across 10 PRD dimensions: Momentum, Velocity, Maturity, Community, Recency, Heat, ProductionReadiness, LicenseSafety, Documentation, EcosystemPull. Each repo comes back with raw GitHub stats (stars/forks/topics/pushedAt) and a 0-100 score per dimension. Pass `topic` for a curated tag (e.g. \"agents\", \"rag\", \"llm\", \"rust\", \"security\") or `query` for free-text search. Returns at most 12 repos.",
      schema: z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Free-text search (e.g. 'a podcast platform', 'memory for agents'). Routed through RepoRadar's multi-tier topic→keyword→all-time fallback.",
          ),
        topic: z
          .string()
          .optional()
          .describe(
            "GitHub topic tag (e.g. 'agents', 'rag', 'llm', 'rust', 'security'). Mutually compatible with `query`.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(12)
          .optional()
          .describe("How many repos to return (1-12, default 8)."),
      }),
    },
    async ({ query, topic, limit }) => {
      const ranked = await rankRepos({ query, topic, limit }, toolEnv);
      return text(JSON.stringify(ranked, null, 2));
    },
  );

  server.tool(
    {
      name: "deploy_variant",
      description:
        "Deploy a bespoke A2UI generative-UI micro-app for a specific GitHub repo. Pipes through RepoRadar's deploy worker, which asks Gemini to pick an interactive form factor (playground, dashboard, control-panel, wizard, widget-grid, reader), emits an A2UI surface, persists it to R2 + per-deploy D1, and returns a live URL at <slug>.reporadar.io that the user can open immediately.",
      schema: z.object({
        repo: z
          .string()
          .regex(/^[\w.-]+\/[\w.-]+$/, "Must be 'owner/name' (e.g. 'anthropics/claude-cookbooks')")
          .describe("GitHub repo full name in the form 'owner/name'."),
        hint: z
          .string()
          .optional()
          .describe(
            "Optional natural-language hint to steer the generated surface (e.g. 'focus on the prompt-caching examples').",
          ),
      }),
    },
    async ({ repo, hint }) => {
      const result = await deployVariant({ repo, hint }, toolEnv);
      return text(JSON.stringify(result, null, 2));
    },
  );

  return server;
}

// Build once per cold start. mcp-use's Hono app + SDK are lazy enough for
// this to be safe on Workers.
let cachedHandler: ((req: Request) => Promise<Response>) | null = null;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, server: "reporadar-mcp" }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(landingPage(), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (!cachedHandler) {
      const server = buildServer(env);
      cachedHandler = await server.getHandler({ provider: "cloudflare" });
    }
    return cachedHandler(req);
  },
};

function landingPage(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>reporadar-mcp</title>
<style>
body { font: 14px ui-sans-serif, system-ui; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #fafafa; background: #08070d; }
code { background: #1c1b27; padding: 2px 6px; border-radius: 4px; }
pre  { background: #1c1b27; padding: 12px; border-radius: 8px; overflow-x: auto; }
a { color: #22d3ee; }
</style></head><body>
<h1>RepoRadar MCP</h1>
<p>Model Context Protocol server for <a href="https://reporadar.io">reporadar.io</a>. Two tools: <code>rank_repos</code>, <code>deploy_variant</code>.</p>
<h2>Connect (Streamable HTTP)</h2>
<pre>${"https://reporadar-mcp.&lt;account&gt;.workers.dev/mcp"}</pre>
<h2>Connect (SSE, legacy)</h2>
<pre>${"https://reporadar-mcp.&lt;account&gt;.workers.dev/sse"}</pre>
<p>Built with <a href="https://github.com/mcp-use/mcp-use">mcp-use</a> on Cloudflare Workers.</p>
</body></html>`;
}
