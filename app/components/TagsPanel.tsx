"use client";

import { useEffect, useState } from "react";

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

export function TagsPanel({
  activeTopics,
  onPick,
  onClose,
}: {
  activeTopics: string[];
  onPick: (topics: string[], label: string) => void;
  onClose: () => void;
}) {
  // Local working set seeded from whatever's currently active. Each chip
  // click toggles in/out of the set and fires onPick immediately so the
  // card grid re-queries with the new combination. Panel stays open so
  // the user can keep adding/removing tags.
  const [selected, setSelected] = useState<string[]>(activeTopics);

  useEffect(() => {
    setSelected(activeTopics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopics.join(",")]);

  const fire = (next: string[]) => {
    if (next.length === 0) {
      // Empty selection → fall back to default trending (Hermes).
      onPick([], "trending");
      return;
    }
    const labels = next.map(
      (s) => TRENDING_TAGS.find((x) => x.topic === s)?.label.toLowerCase() ?? s,
    );
    const label =
      labels.length === 1
        ? `trending: ${labels[0]}`
        : `trending: ${labels.join(" + ")}`;
    onPick(next, label);
  };

  const toggle = (t: string) => {
    const next = selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t];
    setSelected(next);
    fire(next);
  };

  const clear = () => {
    setSelected([]);
    fire([]);
  };

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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
          Pick one or more — click any chip to toggle
          {selected.length > 0 && (
            <span style={{ color: "var(--primary)" }}> ({selected.length} selected)</span>
          )}
        </p>
        <div className="flex items-center gap-3">
          {selected.length > 0 && (
            <button
              onClick={clear}
              className="text-[11px] underline-offset-2 transition hover:underline"
              style={{ color: "var(--fg-dim)" }}
            >
              clear
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border px-3 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-[0.16em] transition"
            style={{
              borderColor: "var(--primary)",
              background: "var(--primary)",
              color: "#08070d",
            }}
          >
            Done ✓
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TRENDING_TAGS.map((t) => {
          const isActive = selected.includes(t.topic);
          return (
            <button
              key={t.topic}
              onClick={() => toggle(t.topic)}
              title={t.help}
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
