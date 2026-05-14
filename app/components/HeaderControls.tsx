"use client";

import { useEffect, useState } from "react";
import type { SortKey } from "@/app/components/PriorityBar";
import { TagsPanel } from "@/app/components/TagsPanel";
import { TalkPanel } from "@/app/components/TalkPanel";
import { TypePanel } from "@/app/components/TypePanel";
import { FilterPanel } from "@/app/components/FilterPanel";

export type TimeWindow = "30" | "90" | "365" | "all";

const TIME_WINDOWS: { key: TimeWindow; label: string; help: string }[] = [
  { key: "30", label: "1mo", help: "Pushed in the last 30 days — freshest, smallest pool." },
  { key: "90", label: "3mo", help: "Pushed in the last 90 days." },
  { key: "365", label: "1y", help: "Pushed in the last year. Default — broad enough for most queries." },
  { key: "all", label: "All", help: "No time filter — surfaces classic + long-tail repos too." },
];

type ActivePanel = "tags" | "talk" | "type" | "filter" | null;

export function HeaderControls({
  activeTopics,
  priorities,
  timeWindow,
  bootstrapping,
  priorityCount,
  onRunQuery,
  onSetPriorities,
  onSetTimeWindow,
}: {
  activeTopics: string[];
  priorities: SortKey[];
  timeWindow: TimeWindow;
  bootstrapping: boolean;
  priorityCount: number;
  onRunQuery: (args: { topic?: string; query?: string; label: string }) => void;
  onSetPriorities: (next: SortKey[]) => void;
  onSetTimeWindow: (next: TimeWindow) => void;
}) {
  const [active, setActive] = useState<ActivePanel>(null);
  // Number of times the user has submitted a voice query in this session,
  // so TalkPanel can rotate first-turn vs follow-up greetings.
  const [talkTurns, setTalkTurns] = useState(0);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const toggle = (key: Exclude<ActivePanel, null>) =>
    setActive((prev) => (prev === key ? null : key));

  const buttons: {
    key: Exclude<ActivePanel, null>;
    label: string;
    sub?: string;
    title: string;
  }[] = [
    {
      key: "tags",
      label: "TAGS",
      sub:
        activeTopics.length === 0
          ? undefined
          : activeTopics.length === 1
            ? activeTopics[0]
            : `${activeTopics.length} tags`,
      title: "Pick one or more popular GitHub topics — click chips to combine them.",
    },
    { key: "talk", label: "TALK", title: "Talk to RepoRadar with your voice." },
    { key: "type", label: "TYPE", title: "Type what you're looking for in natural language." },
    { key: "filter", label: "FILTER", sub: priorityCount > 0 ? `${priorityCount}/3` : undefined, title: "Pick up to 3 sort priorities." },
  ];

  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 px-6 py-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {buttons.map((b) => {
            const isActive = active === b.key;
            return (
              <button
                key={b.key}
                onClick={() => toggle(b.key)}
                title={b.title}
                aria-expanded={isActive}
                aria-controls={`panel-${b.key}`}
                className="group flex items-center gap-2 rounded-md border px-3.5 py-2 text-[12px] font-mono font-semibold uppercase tracking-[0.16em] transition disabled:opacity-50"
                style={{
                  borderColor: isActive ? "var(--primary)" : "var(--border-strong)",
                  background: isActive ? "rgba(34,197,94,0.12)" : "var(--surface-2)",
                  color: isActive ? "var(--primary)" : "var(--fg-muted)",
                  boxShadow: isActive ? "0 0 14px var(--primary-glow)" : "none",
                }}
              >
                <span>{b.label}</span>
                {b.sub && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal"
                    style={{
                      background: isActive ? "var(--primary)" : "var(--border)",
                      color: isActive ? "#08070d" : "var(--fg-muted)",
                    }}
                  >
                    {b.sub}
                  </span>
                )}
                <span
                  className="text-[9px] transition"
                  aria-hidden
                  style={{ transform: isActive ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  ▾
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        <div
          className="flex items-center gap-1"
          title="Time window for the GitHub search. Tighter = fresher repos but smaller pool."
        >
          {TIME_WINDOWS.map((w) => {
            const isActive = timeWindow === w.key;
            return (
              <button
                key={w.key}
                onClick={() => onSetTimeWindow(w.key)}
                title={w.help}
                className="rounded-md border px-2 py-1 text-[10px] font-mono transition"
                style={{
                  borderColor: isActive ? "var(--secondary)" : "var(--border)",
                  background: isActive ? "rgba(59,130,246,0.10)" : "var(--surface-2)",
                  color: isActive ? "var(--secondary)" : "var(--fg-muted)",
                  boxShadow: isActive ? "0 0 8px var(--secondary-glow)" : "none",
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {active === "tags" && (
        <TagsPanel
          activeTopics={activeTopics}
          onPick={(topics, label) => {
            // Multi-tag: keep the panel open so the user can keep
            // adding/removing chips. Each toggle fires this with the
            // new combination as a comma-joined topic string.
            onRunQuery({ topic: topics.join(",") || undefined, label });
          }}
          onClose={() => setActive(null)}
        />
      )}
      {active === "talk" && (
        <TalkPanel
          turnIndex={talkTurns}
          onSubmit={(intent) => {
            onRunQuery(intent);
            setTalkTurns((n) => n + 1);
            setActive(null);
          }}
          onClose={() => setActive(null)}
        />
      )}
      {active === "type" && (
        <TypePanel
          onSubmit={(query) => {
            onRunQuery({ query, label: `ask: ${query}` });
            setActive(null);
          }}
          onClose={() => setActive(null)}
        />
      )}
      {active === "filter" && (
        <FilterPanel
          priorities={priorities}
          onChange={onSetPriorities}
          onDone={() => setActive(null)}
        />
      )}
    </div>
  );
}
