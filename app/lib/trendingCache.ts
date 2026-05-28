import { fetchTrending } from "./github.ts";
import type { Repo } from "./types.ts";
import type { KVNamespace } from "@cloudflare/workers-types";

// Two-tier cache for trending-repo results (GitHub fetch + scoring).
//   L1: per-isolate in-memory Map (fastest; lost when the isolate is recycled).
//   L2: Cloudflare KV (shared across isolates; survives cold starts).
// On Cloudflare Workers, isolates are short-lived and numerous, so L1 alone
// meant every cold isolate re-hit the GitHub Search API (the slow path). L2
// lets a cold isolate serve cached data instead. Stale-while-revalidate keeps
// it feeling fresh: serve immediately, refresh in the background.
const FRESH_MS = 5 * 60 * 1000; // serve without refresh
const STALE_MS = 30 * 60 * 1000; // serve stale, refresh in the background
const KV_TTL_S = 30 * 60; // KV auto-evict (>= STALE_MS so the `at` check governs)

// Max L1 entries to prevent unbounded growth. Each entry is a small Repo[]
// (<=100 items), so this is a memory-safety guard, not a business constraint.
const CACHE_MAX_ENTRIES = 500;

type Params = {
  topic?: string;
  query?: string;
  since?: string;
  page?: number;
  perPage?: number;
};

type Entry = { at: number; data: Repo[] };

// L1: module-level (per-isolate) TTL cache.
const cache = new Map<string, Entry>();

// In-flight coalescing: concurrent identical keys share ONE upstream call.
const inflight = new Map<string, Promise<Repo[]>>();

/** Normalize caller params to a stable cache key (lowercased topic). */
export function keyOf(p: Params): string {
  const topic = (p.topic ?? "").trim().toLowerCase();
  const query = (p.query ?? "").trim();
  const since = (p.since ?? "").slice(0, 10);
  const page = p.page ?? 1;
  const perPage = p.perPage ?? 30;
  return `${topic}|${query}|${since}|${page}|${perPage}`;
}

export type CacheState = "fresh" | "stale" | "expired";

/** Pure freshness classifier (unit-testable, no I/O). */
export function classifyCache(at: number, now: number): CacheState {
  const age = now - at;
  if (age < FRESH_MS) return "fresh";
  if (age < STALE_MS) return "stale";
  return "expired";
}

/** True when a value from KV is a well-formed, non-empty cache entry. */
function isUsableEntry(v: unknown): v is Entry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as Entry).at === "number" &&
    Array.isArray((v as Entry).data) &&
    (v as Entry).data.length > 0
  );
}

function setL1(key: string, entry: Entry): void {
  if (cache.size >= CACHE_MAX_ENTRIES && !cache.has(key)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, entry);
}

/**
 * Resolve the Cloudflare request context (KV binding + waitUntil). Lazy +
 * guarded so this module imports cleanly outside a Worker (tests, the cron path
 * before env wiring): on any failure we return nulls and behave as L1-only.
 */
async function cfContext(): Promise<{
  kv: KVNamespace | null;
  waitUntil: ((p: Promise<unknown>) => void) | null;
}> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const cf = getCloudflareContext();
    const kv = (cf.env as CloudflareEnv).TRENDING_CACHE ?? null;
    const waitUntil = cf.ctx?.waitUntil ? cf.ctx.waitUntil.bind(cf.ctx) : null;
    return { kv, waitUntil };
  } catch {
    return { kv: null, waitUntil: null };
  }
}

/**
 * Fetch from GitHub once (coalesced), then write the result to L1 and KV.
 * Caches ONLY non-empty results so a transient rate-limited/aborted [] does not
 * stick — the next call retries. Returns the fetched data.
 */
function fetchAndStore(key: string, p: Params, kv: KVNamespace | null): Promise<Repo[]> {
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const data = await fetchTrending(p);
    if (data.length > 0) {
      const entry: Entry = { at: Date.now(), data };
      setL1(key, entry);
      if (kv) {
        try {
          await kv.put(key, JSON.stringify(entry), { expirationTtl: KV_TTL_S });
        } catch {
          // KV write failures are non-fatal; L1 still has the value.
        }
      }
    }
    return data;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

/**
 * Cached, request-coalescing wrapper around fetchTrending.
 *
 * L1 fresh → serve. Else KV: fresh → serve (+ warm L1); stale → serve stale +
 * background-refresh (waitUntil); expired/miss → coalesced GitHub fetch. KV is
 * shared across isolates, so cold isolates serve from KV instead of GitHub.
 * fetchTrending's signature + fail-fast behavior are unchanged.
 */
export async function fetchTrendingCached(p: Params = {}): Promise<Repo[]> {
  const key = keyOf(p);
  const now = Date.now();

  // L1 fresh.
  const l1 = cache.get(key);
  if (l1 && classifyCache(l1.at, now) === "fresh") return l1.data;

  // Coalesce with an already-pending upstream call for this key.
  const pending = inflight.get(key);
  if (pending) return pending;

  const { kv, waitUntil } = await cfContext();

  // L2 KV.
  if (kv) {
    let kvEntry: unknown = null;
    try {
      kvEntry = await kv.get(key, "json");
    } catch {
      kvEntry = null;
    }
    if (isUsableEntry(kvEntry)) {
      setL1(key, kvEntry); // warm L1 from the shared cache
      const state = classifyCache(kvEntry.at, now);
      if (state === "fresh") return kvEntry.data;
      if (state === "stale") {
        // Serve stale immediately; refresh in the background so the next
        // request gets fresh data. waitUntil keeps the refresh alive past the
        // response; if it's unavailable, fire-and-forget (best effort).
        const refresh = fetchAndStore(key, p, kv);
        if (waitUntil) waitUntil(refresh);
        else void refresh.catch(() => {});
        return kvEntry.data;
      }
      // expired → fall through to a synchronous fetch
    }
  }

  // Cold / expired / KV miss: fetch synchronously (coalesced).
  return fetchAndStore(key, p, kv);
}
