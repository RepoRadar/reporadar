// Local stdio entry for the RepoRadar MCP server.
//
// Claude Desktop launches MCP servers over stdio by default. mcp-use is
// HTTP-first (Hono / SSE / Streamable HTTP) so for the stdio transport we
// use the official @modelcontextprotocol/sdk directly. The two tools are
// the same as the Worker entry — both call the helpers in ./tools.ts.
//
// Run with:    npx tsx src/stdio.ts
// Inspect with: npx @modelcontextprotocol/inspector tsx src/stdio.ts
//
// Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):
//   {
//     "mcpServers": {
//       "reporadar": {
//         "command": "npx",
//         "args": ["-y", "tsx", "/abs/path/to/workers/mcp/src/stdio.ts"]
//       }
//     }
//   }

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { deployVariant, rankRepos, resolveEnv } from "./tools.js";

const env = resolveEnv();

const server = new Server(
  { name: "reporadar", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "rank_repos",
      description:
        "Search GitHub via RepoRadar's curated multi-tier fallback (topic → keyword → all-time) and rank the results across 10 PRD dimensions: Momentum, Velocity, Maturity, Community, Recency, Heat, ProductionReadiness, LicenseSafety, Documentation, EcosystemPull.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search." },
          topic: {
            type: "string",
            description:
              "GitHub topic tag (e.g. 'agents', 'rag', 'llm', 'rust', 'security').",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 12,
            description: "How many repos to return (default 8).",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "deploy_variant",
      description:
        "Deploy a bespoke A2UI generative-UI micro-app for a specific GitHub repo. Returns the slug, live URL, and chosen form factor.",
      inputSchema: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            pattern: "^[\\w.-]+/[\\w.-]+$",
            description: "GitHub repo full name in the form 'owner/name'.",
          },
          hint: {
            type: "string",
            description: "Optional natural-language hint to steer the generated surface.",
          },
        },
        required: ["repo"],
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === "rank_repos") {
      const result = await rankRepos(
        (args ?? {}) as { query?: string; topic?: string; limit?: number },
        env,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    if (name === "deploy_variant") {
      const result = await deployVariant(
        (args ?? {}) as { repo: string; hint?: string },
        env,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Tool ${name} failed: ${msg}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// Keep stderr quiet by default — Claude Desktop pipes it into the chat log.
process.stderr.write(
  `reporadar-mcp stdio: ready (api=${env.reporadarApiBase}, deploy=${env.deployWorkerUrl})\n`,
);
