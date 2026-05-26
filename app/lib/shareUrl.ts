// Shareable-URL serialization for the dashboard search state.
//
// The dashboard mirrors its current search into the address bar so a view is
// copy-pasteable and shareable: topics, a freeform "ask", the sort filters, and
// the time window. This module is the single source of truth for that mapping,
// imported by BOTH the server page (app/page.tsx, to hydrate a shared link into
// the SSR prefetch + initial props) and the client (app/components/RepoRadarApp.tsx,
// to write the URL as the user searches). Keeping parse/build together guarantees
// the two directions stay symmetric.
//
// Schema (keyed params; default view = clean "/"):
//   ?topic=cloudflare,workers   one or more topics, comma-joined
//   ?q=rust+web+frameworks      freeform ask (mutually exclusive with topic)
//   ?sort=stars,velocity        up to 3 sort priorities, in click order
//   ?window=all                 time window (omitted when default "365")

import { DIMENSION_ORDER } from "@/app/lib/types";
import type { SortKey } from "@/app/components/PriorityBar";

export type TimeWindow = "30" | "90" | "365" | "all";

export const DEFAULT_WINDOW: TimeWindow = "365";
const DEFAULT_TOPIC = "hermes";
const DEFAULT_SORT: SortKey[] = ["stars"];
const MAX_SORT = 3;

const VALID_WINDOWS = new Set<string>(["30", "90", "365", "all"]);
// "stars" is the virtual sort key (raw GitHub stars) alongside the 10 dimensions.
const VALID_SORT = new Set<string>(["stars", ...DIMENSION_ORDER]);

export type ShareState = {
  topic?: string; // comma-joined topics; undefined in freeform mode
  query?: string; // freeform ask; undefined in topic mode
  priorities: SortKey[];
  timeWindow: TimeWindow;
};

// Next's searchParams give string | string[] | undefined per key; take the first.
function firstParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return (v[0] ?? "").trim();
  return (v ?? "").trim();
}

function parseSort(raw: string): SortKey[] {
  if (!raw) return [...DEFAULT_SORT];
  const picked = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID_SORT.has(s)) as SortKey[];
  // De-dupe while preserving click order, then cap at MAX_SORT.
  const seen = new Set<string>();
  const unique = picked.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
  return unique.length > 0 ? unique.slice(0, MAX_SORT) : [...DEFAULT_SORT];
}

// Parse a shared URL's query params into a concrete dashboard state. Unknown /
// malformed values fall back to defaults so a hand-edited link never breaks the
// page. `q` wins over `topic` (mutually exclusive); an empty/absent search
// resolves to the default Hermes trending view.
export function parseShareParams(
  sp: Record<string, string | string[] | undefined>,
): ShareState {
  const topic = firstParam(sp.topic);
  const query = firstParam(sp.q);
  const windowRaw = firstParam(sp.window);
  const priorities = parseSort(firstParam(sp.sort));
  const timeWindow: TimeWindow = VALID_WINDOWS.has(windowRaw)
    ? (windowRaw as TimeWindow)
    : DEFAULT_WINDOW;

  if (query) return { query, priorities, timeWindow };
  if (topic) return { topic, priorities, timeWindow };
  return { topic: DEFAULT_TOPIC, priorities, timeWindow };
}

// The status-chip label for a given search, matching the app's existing
// conventions ("ask: ..." for freeform, "trending: ..." for topics).
export function labelFor(state: { topic?: string; query?: string }): string {
  if (state.query) return `ask: ${state.query}`;
  if (state.topic) return `trending: ${state.topic}`;
  return `trending: ${DEFAULT_TOPIC}`;
}

function isDefaultSort(priorities: SortKey[]): boolean {
  return priorities.length === 1 && priorities[0] === "stars";
}

// Build the address-bar path for the current state. Returns "/" when everything
// is at its default (Hermes topic, default "stars" sort, default 365 window) so
// the home view stays a clean URL. Inverse of parseShareParams for any state it
// produces.
export function buildShareUrl(state: ShareState): string {
  const p = new URLSearchParams();

  if (state.query) {
    p.set("q", state.query);
  } else if (state.topic && state.topic !== DEFAULT_TOPIC) {
    p.set("topic", state.topic);
  }

  // Omit the default ["stars"] sort. An explicitly-emptied selection ([], i.e.
  // pure weighted ranking) also omits and reverts to default on reload — the
  // radar weights themselves aren't part of the shareable schema.
  if (!isDefaultSort(state.priorities) && state.priorities.length > 0) {
    p.set("sort", state.priorities.join(","));
  }

  if (state.timeWindow !== DEFAULT_WINDOW) {
    p.set("window", state.timeWindow);
  }

  // URLSearchParams encodes commas as %2C; keep them literal so multi-topic /
  // multi-sort links stay readable (?topic=cloudflare,workers). Everything else
  // (spaces in a freeform ask, etc.) stays properly encoded. parseShareParams
  // reads the decoded value, so both literal and %2C commas round-trip.
  const qs = p.toString().replace(/%2C/g, ",");
  return qs ? `/?${qs}` : "/";
}
