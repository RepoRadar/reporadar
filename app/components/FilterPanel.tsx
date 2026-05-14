"use client";

import {
  DIMENSION_META,
  DIMENSION_ORDER,
} from "@/app/lib/types";
import type { SortKey } from "@/app/components/PriorityBar";

const STARS_META = {
  label: "Most Stars",
  short: "Stars",
  help: "Sort by raw GitHub stars, most-popular first. The default sort and the easiest to reason about.",
};

const MAX_PRIORITIES = 3;

export function FilterPanel({
  priorities,
  onChange,
  onDone,
}: {
  priorities: SortKey[];
  onChange: (next: SortKey[]) => void;
  onDone: () => void;
}) {
  const toggle = (key: SortKey) => {
    const idx = priorities.indexOf(key);
    if (idx >= 0) {
      onChange(priorities.filter((d) => d !== key));
    } else if (priorities.length < MAX_PRIORITIES) {
      onChange([...priorities, key]);
    } else {
      onChange([...priorities.slice(1), key]);
    }
  };

  const HIGHLIGHTED: SortKey[] = ["stars", "velocity", "security"];
  const REST: SortKey[] = DIMENSION_ORDER.filter(
    (d) => !HIGHLIGHTED.includes(d as SortKey),
  );
  const ORDERED: SortKey[] = [...HIGHLIGHTED, ...REST];

  return (
    <div
      id="panel-filter"
      role="dialog"
      aria-label="Sort priorities"
      className="border-t px-6 py-5"
      style={{
        borderColor: "var(--border)",
        background: "linear-gradient(180deg, rgba(34,197,94,0.04) 0%, transparent 100%)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
            Pick up to 3 sort priorities — click in order
          </p>
          <span className="text-[10px] font-mono" style={{ color: "var(--fg-dim)" }}>
            ({priorities.length}/{MAX_PRIORITIES})
          </span>
        </div>
        <div className="flex items-center gap-3">
          {priorities.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="text-[11px] underline-offset-2 transition hover:underline"
              style={{ color: "var(--fg-dim)" }}
            >
              clear
            </button>
          )}
          <button
            onClick={onDone}
            className="rounded-md border px-3 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-[0.16em] transition"
            style={{
              borderColor: "var(--primary)",
              background: "var(--primary)",
              color: "#08070d",
            }}
          >
            Done
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {ORDERED.map((key) => {
          const idx = priorities.indexOf(key);
          const active = idx >= 0;
          const meta = key === "stars" ? STARS_META : DIMENSION_META[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              title={meta.help}
              className="group flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-mono transition"
              style={{
                borderColor: active ? "var(--primary)" : "var(--border)",
                background: active ? "rgba(34,197,94,0.10)" : "var(--surface-2)",
                color: active ? "var(--primary)" : "var(--fg-muted)",
                boxShadow: active ? "0 0 12px var(--primary-glow)" : "none",
              }}
            >
              {active && (
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
                  style={{ background: "var(--primary)", color: "#08070d" }}
                >
                  {idx + 1}
                </span>
              )}
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
