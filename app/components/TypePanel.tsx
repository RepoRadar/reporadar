"use client";

import { useEffect, useRef, useState } from "react";

const SUGGESTIONS = [
  "A podcast platform",
  "Production-grade RAG library in TypeScript",
  "Voice-first agents",
  "Hermes skill packs",
  "MCP servers I can use in Claude Desktop",
];

export function TypePanel({
  onSubmit,
  onClose,
}: {
  onSubmit: (query: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <form
      id="panel-type"
      role="dialog"
      aria-label="Type a query"
      className="border-t px-6 py-5"
      style={{
        borderColor: "var(--border)",
        background: "linear-gradient(180deg, rgba(34,197,94,0.04) 0%, transparent 100%)",
      }}
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
          What would you like to focus on today?
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-[11px] font-mono transition hover:underline"
          style={{ color: "var(--fg-dim)" }}
        >
          close ✕
        </button>
      </div>
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder='e.g. "Hermes skill packs", "production-grade RAG in TypeScript"'
          className="flex-1 rounded-md border px-3.5 py-2.5 text-sm outline-none transition"
          style={{
            background: "#fafafa",
            color: "#0a0a0a",
            borderColor: "var(--border-strong)",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.boxShadow = "0 0 0 3px var(--primary-glow)";
            (e.currentTarget as HTMLInputElement).style.borderColor = "var(--primary)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.boxShadow = "none";
            (e.currentTarget as HTMLInputElement).style.borderColor = "var(--border-strong)";
          }}
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-md border px-4 py-2.5 text-[12px] font-mono font-semibold uppercase tracking-[0.16em] transition disabled:opacity-40"
          style={{
            borderColor: "var(--primary)",
            background: "var(--primary)",
            color: "#08070d",
          }}
        >
          Go ↵
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--fg-dim)" }}>
          Try:
        </span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s)}
            className="rounded border px-2 py-1 text-[10px] font-mono transition"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              color: "var(--fg-muted)",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </form>
  );
}
