"use client";

import {
  DIMENSION_META,
  DIMENSION_ORDER,
  type Dimension,
} from "@/app/lib/types";

const MAX_PRIORITIES = 3;

// Sort key is either one of the 10 PRD dimensions, or the special "stars"
// virtual key that sorts by raw GitHub stars (most-popular). "stars" is the
// default first priority on page load per Christo's spec.
export type SortKey = Dimension | "stars";

const STARS_META = {
  label: "Most Stars",
  short: "Stars",
  help: "Sort by raw GitHub stars, most-popular first. The default sort and the easiest one to reason about.",
};

export function PriorityBar({
  priorities,
  onChange,
}: {
  priorities: SortKey[];
  onChange: (next: SortKey[]) => void;
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

  // The chip ordering Christo specced: Stars first, then Velocity, then
  // Security as the highlighted quick-picks; the rest follow in PRD order.
  const HIGHLIGHTED: SortKey[] = ["stars", "velocity", "security"];
  const REST: SortKey[] = DIMENSION_ORDER.filter(
    (d) => !HIGHLIGHTED.includes(d as SortKey),
  );
  const ORDERED: SortKey[] = [...HIGHLIGHTED, ...REST];

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
          title="Click up to 3 sort options in priority order. The first you click is the primary sort, second breaks ties, third refines further. 'Most Stars' is on by default — toggle it off if you want a different ranking."
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
          title="How many sort options you've picked, out of the 3 max."
        >
          ({priorities.length}/{MAX_PRIORITIES})
        </span>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-x-auto">
        {ORDERED.map((key) => {
          const idx = priorities.indexOf(key);
          const active = idx >= 0;
          const meta = key === "stars" ? STARS_META : DIMENSION_META[key];
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
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
            title="Clear all sort priorities"
          >
            clear
          </button>
        )}
      </div>
    </div>
  );
}
