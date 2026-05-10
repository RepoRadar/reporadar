"use client";

import {
  DIMENSION_META,
  DIMENSION_ORDER,
  type Dimension,
} from "@/app/lib/types";

const MAX_PRIORITIES = 3;

export function PriorityBar({
  priorities,
  onChange,
}: {
  priorities: Dimension[];
  onChange: (next: Dimension[]) => void;
}) {
  const toggle = (dim: Dimension) => {
    const idx = priorities.indexOf(dim);
    if (idx >= 0) {
      onChange(priorities.filter((d) => d !== dim));
    } else if (priorities.length < MAX_PRIORITIES) {
      onChange([...priorities, dim]);
    } else {
      // Already 3 selected — replace the oldest with the new one.
      onChange([...priorities.slice(1), dim]);
    }
  };

  return (
    <div
      className="flex items-center gap-3 border-b px-6 py-3"
      style={{
        borderColor: "var(--border)",
        background: "linear-gradient(180deg, rgba(34,197,94,0.05) 0%, transparent 100%)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] cursor-help whitespace-nowrap"
          style={{ color: "var(--fg-dim)" }}
          title="Click up to 3 of these dimensions in priority order. First click = primary sort, second click breaks ties, third refines further. Hover any chip to read what that dimension means."
        >
          Sort by
          <span
            className="inline-flex h-3 w-3 items-center justify-center rounded-full border text-[7px]"
            style={{
              borderColor: "var(--border-strong)",
              color: "var(--fg-dim)",
            }}
            aria-hidden
          >
            ?
          </span>
        </span>
        <span
          className="text-[10px] font-mono"
          style={{ color: "var(--fg-dim)" }}
          title="How many sort dimensions you've picked, out of the 3 max."
        >
          ({priorities.length}/{MAX_PRIORITIES})
        </span>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-x-auto">
        {DIMENSION_ORDER.map((dim) => {
          const idx = priorities.indexOf(dim);
          const active = idx >= 0;
          const meta = DIMENSION_META[dim];
          return (
            <button
              key={dim}
              onClick={() => toggle(dim)}
              title={meta.help}
              className="group flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-mono transition"
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
        {priorities.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="ml-1 text-[10px] underline-offset-2 transition hover:underline"
            style={{ color: "var(--fg-dim)" }}
          >
            clear
          </button>
        )}
      </div>
    </div>
  );
}
