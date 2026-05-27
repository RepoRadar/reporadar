/**
 * alerts.detectCrossings.test.mjs — unit tests for the pure detectCrossings function
 *
 * These are PURE fixture tests — no D1, no network, no I/O.
 * Run: node --test tests/alerts.detectCrossings.test.mjs
 *
 * TDD: written BEFORE the implementation (RED phase).
 * Each test case covers a specific metric and edge case per the plan spec.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// Import the pure function and its types (will fail until app/lib/alerts.ts exists)
import { detectCrossings } from "../app/lib/alerts.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal subscription pick for the function signature.
 * @param {object} overrides
 * @returns {{ metric: string; threshold: number; window_days: number }}
 */
function makeSub(overrides = {}) {
  return {
    metric: "stars_abs",
    threshold: 1000,
    window_days: 7,
    ...overrides,
  };
}

/**
 * Build a minimal repo object.
 * @param {string} fullName
 * @param {number} stars
 * @returns {{ fullName: string; stars: number }}
 */
function makeRepo(fullName, stars) {
  return { fullName, stars };
}

// ---------------------------------------------------------------------------
// stars_abs metric
// ---------------------------------------------------------------------------

describe("detectCrossings — stars_abs", () => {
  test("repo at or above threshold crosses", () => {
    const sub = makeSub({ metric: "stars_abs", threshold: 1000 });
    const repos = [makeRepo("owner/above", 1500)];
    const prior = new Map();

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 1, "Should yield one crossing");
    const c = crossings[0];
    assert.equal(c.fullName, "owner/above");
    assert.equal(c.stars, 1500);
    assert.equal(c.metric, "stars_abs");
    assert.equal(c.value, 1500);
    assert.ok(c.reason.includes("1,000"), `reason should mention the threshold; got: ${c.reason}`);
  });

  test("repo exactly at threshold crosses", () => {
    const sub = makeSub({ metric: "stars_abs", threshold: 1000 });
    const repos = [makeRepo("owner/exact", 1000)];
    const prior = new Map();

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 1, "Exactly at threshold should cross");
    assert.equal(crossings[0].fullName, "owner/exact");
  });

  test("repo below threshold does not cross", () => {
    const sub = makeSub({ metric: "stars_abs", threshold: 1000 });
    const repos = [makeRepo("owner/below", 800)];
    const prior = new Map();

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 0, "Should yield no crossings");
  });

  test("multiple repos — only those at/above threshold cross", () => {
    const sub = makeSub({ metric: "stars_abs", threshold: 1000 });
    const repos = [
      makeRepo("owner/above1", 1200),
      makeRepo("owner/below1", 500),
      makeRepo("owner/above2", 1000),
      makeRepo("owner/below2", 999),
    ];
    const prior = new Map();

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 2, "Two repos should cross");
    const names = crossings.map((c) => c.fullName);
    assert.ok(names.includes("owner/above1"));
    assert.ok(names.includes("owner/above2"));
    assert.ok(!names.includes("owner/below1"));
    assert.ok(!names.includes("owner/below2"));
  });
});

// ---------------------------------------------------------------------------
// stars_pct metric
// ---------------------------------------------------------------------------

describe("detectCrossings — stars_pct", () => {
  test("repo with ≥ threshold% growth crosses", () => {
    // 100 → 130 stars = 30% growth; threshold 20% → should cross
    const sub = makeSub({ metric: "stars_pct", threshold: 20, window_days: 7 });
    const repos = [makeRepo("owner/x", 130)];
    const prior = new Map([["owner/x", 100]]);

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 1, "30% growth should cross a 20% threshold");
    const c = crossings[0];
    assert.equal(c.fullName, "owner/x");
    assert.equal(c.metric, "stars_pct");
    // value should be the computed growth pct (30)
    assert.ok(Math.abs(c.value - 30) < 0.01, `value should be ~30; got ${c.value}`);
    assert.ok(
      c.reason.includes("30") && c.reason.includes("20"),
      `reason should mention both growth and threshold; got: ${c.reason}`
    );
  });

  test("repo with exactly threshold% growth crosses", () => {
    // 100 → 120 = 20% growth; threshold 20% → should cross
    const sub = makeSub({ metric: "stars_pct", threshold: 20, window_days: 7 });
    const repos = [makeRepo("owner/exact", 120)];
    const prior = new Map([["owner/exact", 100]]);

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 1, "Exactly at threshold should cross");
  });

  test("repo below threshold% growth does not cross", () => {
    // 100 → 110 = 10% growth; threshold 20% → should NOT cross
    const sub = makeSub({ metric: "stars_pct", threshold: 20, window_days: 7 });
    const repos = [makeRepo("owner/x", 110)];
    const prior = new Map([["owner/x", 100]]);

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 0, "10% growth should not cross a 20% threshold");
  });

  test("repo absent from prior snapshot does NOT cross (no baseline = no false fire)", () => {
    const sub = makeSub({ metric: "stars_pct", threshold: 20, window_days: 7 });
    const repos = [makeRepo("owner/new", 5000)];
    const prior = new Map(); // empty — this repo is brand new

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 0, "No prior baseline → no crossing (Pitfall 2: no false fire)");
  });

  test("repo with prior stars = 0 does NOT cross (divide-by-zero guard)", () => {
    const sub = makeSub({ metric: "stars_pct", threshold: 20, window_days: 7 });
    const repos = [makeRepo("owner/zero", 100)];
    const prior = new Map([["owner/zero", 0]]);

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 0, "Prior stars = 0 → skip (T-03-04: divide-by-zero guard)");
  });

  test("multiple repos — mixed prior snapshot, only growers cross", () => {
    const sub = makeSub({ metric: "stars_pct", threshold: 20, window_days: 7 });
    const repos = [
      makeRepo("owner/a", 130), // 100 → 130 = 30% → crosses
      makeRepo("owner/b", 110), // 100 → 110 = 10% → does not cross
      makeRepo("owner/c", 200), // no prior → no crossing
    ];
    const prior = new Map([
      ["owner/a", 100],
      ["owner/b", 100],
    ]);

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 1);
    assert.equal(crossings[0].fullName, "owner/a");
  });
});

// ---------------------------------------------------------------------------
// velocity metric
// ---------------------------------------------------------------------------

describe("detectCrossings — velocity", () => {
  test("repo with ≥ threshold stars/day crosses", () => {
    // prior 100, now 200, window 7 days → (200 - 100) / 7 ≈ 14.3 stars/day; threshold 10 → crosses
    const sub = makeSub({ metric: "velocity", threshold: 10, window_days: 7 });
    const repos = [makeRepo("owner/y", 200)];
    const prior = new Map([["owner/y", 100]]);

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 1, "14.3 stars/day should cross a 10/day threshold");
    const c = crossings[0];
    assert.equal(c.fullName, "owner/y");
    assert.equal(c.metric, "velocity");
    // value should be ~14.3
    const expected = 100 / 7;
    assert.ok(
      Math.abs(c.value - expected) < 0.01,
      `value should be ~${expected.toFixed(2)}; got ${c.value}`
    );
  });

  test("repo with exactly threshold stars/day crosses", () => {
    // prior 100, now 170, window 7 → 70/7 = 10 stars/day exactly; threshold 10 → crosses
    const sub = makeSub({ metric: "velocity", threshold: 10, window_days: 7 });
    const repos = [makeRepo("owner/exact", 170)];
    const prior = new Map([["owner/exact", 100]]);

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 1, "Exactly at threshold should cross");
  });

  test("repo below threshold stars/day does not cross", () => {
    // prior 100, now 150, window 7 → 50/7 ≈ 7.1 stars/day; threshold 10 → does NOT cross
    const sub = makeSub({ metric: "velocity", threshold: 10, window_days: 7 });
    const repos = [makeRepo("owner/y", 150)];
    const prior = new Map([["owner/y", 100]]);

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 0, "7.1 stars/day should not cross a 10/day threshold");
  });

  test("repo absent from prior snapshot does NOT cross (no baseline = no false fire)", () => {
    const sub = makeSub({ metric: "velocity", threshold: 10, window_days: 7 });
    const repos = [makeRepo("owner/new", 99999)];
    const prior = new Map(); // no baseline

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 0, "No prior baseline → no crossing");
  });

  test("velocity with window_days = 0 does not crash (uses max(1, window_days))", () => {
    // window_days = 0 → implementation must use max(1, window_days) to prevent division by zero
    const sub = makeSub({ metric: "velocity", threshold: 10, window_days: 0 });
    const repos = [makeRepo("owner/y", 200)];
    const prior = new Map([["owner/y", 100]]);

    // Should not throw; (200 - 100) / max(1, 0) = 100 stars/day → crosses
    let crossings;
    assert.doesNotThrow(() => {
      crossings = detectCrossings(sub, repos, prior);
    }, "Should not throw when window_days = 0");
    assert.equal(crossings.length, 1, "Should still detect the crossing");
  });

  test("multiple repos — only fast-growing repos cross", () => {
    const sub = makeSub({ metric: "velocity", threshold: 10, window_days: 7 });
    const repos = [
      makeRepo("owner/fast", 200), // 100 gain / 7d ≈ 14.3/d → crosses
      makeRepo("owner/slow", 150), // 50 gain / 7d ≈ 7.1/d → does not
      makeRepo("owner/new", 9999), // no prior → no crossing
    ];
    const prior = new Map([
      ["owner/fast", 100],
      ["owner/slow", 100],
    ]);

    const crossings = detectCrossings(sub, repos, prior);

    assert.equal(crossings.length, 1);
    assert.equal(crossings[0].fullName, "owner/fast");
  });
});

// ---------------------------------------------------------------------------
// Purity check — no async, returns synchronously, no side effects
// ---------------------------------------------------------------------------

describe("detectCrossings — purity", () => {
  test("function returns synchronously (not a Promise)", () => {
    const sub = makeSub({ metric: "stars_abs", threshold: 100 });
    const repos = [makeRepo("owner/r", 200)];
    const prior = new Map();

    const result = detectCrossings(sub, repos, prior);

    // If it returned a Promise, the length check would fail or be on a Promise object
    assert.ok(Array.isArray(result), "detectCrossings must return an Array, not a Promise");
  });

  test("empty repos list returns empty array", () => {
    const sub = makeSub({ metric: "stars_abs", threshold: 100 });
    const crossings = detectCrossings(sub, [], new Map());
    assert.deepEqual(crossings, []);
  });

  test("does not mutate the input arrays or Map", () => {
    const sub = makeSub({ metric: "stars_abs", threshold: 100 });
    const repos = [makeRepo("owner/r", 200)];
    const prior = new Map([["owner/r", 100]]);
    const reposCopy = [...repos];
    const priorCopy = new Map(prior);

    detectCrossings(sub, repos, prior);

    // Input unchanged
    assert.deepEqual(repos, reposCopy);
    assert.deepEqual(prior, priorCopy);
  });
});
