"use client";

const TRENDING_TAGS: { topic: string; label: string; help: string }[] = [
  { topic: "hermes", label: "Hermes", help: "Open-weights instruction-tuned models from Nous Research." },
  { topic: "claude-code", label: "Claude Code", help: "Anthropic's CLI agent for engineering workflows." },
  { topic: "mcp", label: "MCP", help: "Model Context Protocol — the open standard for connecting AI assistants to tools." },
  { topic: "a2ui", label: "A2UI", help: "Google DeepMind's open protocol for agents emitting interactive UI." },
  { topic: "ag-ui", label: "AG-UI", help: "CopilotKit's open transport protocol for fullstack agentic UI in React." },
  { topic: "openclaw", label: "OpenClaw", help: "Open-source agentic tooling from this hackathon's stack." },
  { topic: "generative-ui", label: "Generative UI", help: "Agents that emit interactive UI at runtime instead of plain text." },
  { topic: "agents", label: "Agents", help: "AI agents, autonomous systems, multi-step reasoning loops." },
  { topic: "rag", label: "RAG", help: "Retrieval-augmented generation — embeddings + retrieval + LLM." },
  { topic: "langchain", label: "LangChain", help: "Production-grade LLM application framework: chains, agents, RAG, memory." },
  { topic: "cloudflare", label: "Cloudflare", help: "Workers, D1, R2, Durable Objects — edge-deployed everything." },
  { topic: "gemini", label: "Gemini", help: "Google's multimodal model family." },
  { topic: "anthropic", label: "Anthropic", help: "Claude, prompt engineering, agent SDKs." },
  { topic: "openai", label: "OpenAI", help: "GPT models, function calling, the Assistants API." },
  { topic: "n8n", label: "n8n", help: "Workflow automation tool with AI integrations." },
  { topic: "voice-ai", label: "Voice AI", help: "Speech-to-text, text-to-speech, real-time voice agents." },
];

// Single-select: one tag at a time. Clicking a chip immediately runs a query
// for JUST that topic; HeaderControls closes the panel on pick. No multi-select,
// no "Done", no AND — switching topics is a single click. The currently active
// topic (activeTopics[0]) is highlighted.
export function TagsPanel({
  activeTopics,
  onPick,
}: {
  activeTopics: string[];
  onPick: (topic: string, label: string) => void;
}) {
  const active = activeTopics[0];

  return (
    <div
      id="panel-tags"
      role="dialog"
      aria-label="Trending tags"
      className="border-t px-6 py-5"
      style={{
        borderColor: "var(--border)",
        background: "linear-gradient(180deg, rgba(34,197,94,0.04) 0%, transparent 100%)",
      }}
    >
      <p
        className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: "var(--fg-dim)" }}
      >
        Pick a topic — click to load
      </p>
      <div className="flex flex-wrap gap-2">
        {TRENDING_TAGS.map((t) => {
          const isActive = t.topic === active;
          return (
            <button
              key={t.topic}
              onClick={() => onPick(t.topic, `trending: ${t.label.toLowerCase()}`)}
              title={t.help}
              aria-pressed={isActive}
              className="flex items-center gap-1.5 rounded-md border px-3 py-2 text-[12px] font-mono transition"
              style={{
                borderColor: isActive ? "var(--primary)" : "var(--border)",
                background: isActive ? "rgba(34,197,94,0.10)" : "var(--surface-2)",
                color: isActive ? "var(--primary)" : "var(--fg-muted)",
                boxShadow: isActive ? "0 0 12px var(--primary-glow)" : "none",
              }}
            >
              {isActive && <span aria-hidden>✓</span>}
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
