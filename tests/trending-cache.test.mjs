/**
 * trending-cache.test.mjs — pure helpers for the KV-backed trending cache.
 *
 * Tests classifyCache (fresh/stale/expired windows that drive the SWR logic)
 * and keyOf (stable cache key: lowercased topic, trimmed, sliced since, defaults).
 * The KV I/O itself is integration-verified in the browser/preview, not here.
 *
 * Pure test — no D1, no KV, no network.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { classifyCache, keyOf } from "../app/lib/trendingCache.ts";

const MIN = 60 * 1000;

describe("classifyCache", () => {
  const now = 1_000_000_000_000;

  test("fresh under 5 minutes", () => {
    assert.equal(classifyCache(now, now), "fresh");
    assert.equal(classifyCache(now - 4 * MIN, now), "fresh");
  });

  test("stale between 5 and 30 minutes", () => {
    assert.equal(classifyCache(now - 6 * MIN, now), "stale");
    assert.equal(classifyCache(now - 29 * MIN, now), "stale");
  });

  test("expired at/after 30 minutes", () => {
    assert.equal(classifyCache(now - 31 * MIN, now), "expired");
  });

  test("boundaries: exactly 5 min is stale, exactly 30 min is expired", () => {
    assert.equal(classifyCache(now - 5 * MIN, now), "stale");
    assert.equal(classifyCache(now - 30 * MIN, now), "expired");
  });
});

describe("keyOf", () => {
  test("defaults for an empty params object", () => {
    assert.equal(keyOf({}), "|||1|30");
  });

  test("lowercases and trims the topic", () => {
    assert.equal(keyOf({ topic: " Hermes " }), "hermes|||1|30");
  });

  test("slices since to YYYY-MM-DD and includes page/perPage", () => {
    assert.equal(
      keyOf({ topic: "Cloudflare", query: "workers", since: "2026-05-28T00:00:00Z", page: 2, perPage: 100 }),
      "cloudflare|workers|2026-05-28|2|100",
    );
  });

  test("query is trimmed but case-preserved", () => {
    assert.equal(keyOf({ query: " RAG " }), "|RAG||1|30");
  });
});
