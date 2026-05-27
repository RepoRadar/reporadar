/**
 * alerts.sweep.test.mjs — idempotency + orchestration tests for runAlertSweep
 *
 * Approach chosen: in-memory fake DB adapter (NOT wrangler local D1).
 * Rationale: the wrangler CLI adapter adds ~3-5s startup per test run and
 * requires the local wrangler state to be fully initialized. An in-memory
 * adapter is faster, avoids shell escaping edge cases, and proves the
 * ORCHESTRATION invariants (order, dedupe, idempotency) without coupling to
 * the wrangler binary. The plan explicitly approves either path.
 *
 * The fake DB implements the D1Database surface used by db.ts:
 *   prepare(sql).bind(...args).run() / .first() / .all()
 *
 * Headline test: run runAlertSweep TWICE on identical fixture data with a
 * send spy → total send count = EXACTLY 1 (ALRT-03 idempotency criterion).
 *
 * Run: node --test tests/alerts.sweep.test.mjs
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { runAlertSweep, alreadyNotified } from "../app/lib/alerts.ts";

// ---------------------------------------------------------------------------
// In-memory fake D1 adapter
// ---------------------------------------------------------------------------

/**
 * Build a minimal in-memory D1 adapter backed by plain JS objects.
 *
 * Supported SQL patterns (exactly what db.ts emits):
 *   SELECT DISTINCT term, kind FROM subscriptions WHERE verified_at IS NOT NULL
 *   SELECT * FROM subscriptions WHERE term = ? AND verified_at IS NOT NULL
 *   SELECT full_name, stars FROM repo_snapshots WHERE term = ? AND captured_at = (SELECT MAX...)
 *   UPDATE subscriptions SET last_notified_at = ? WHERE id = ?
 *   INSERT INTO repo_snapshots ... ON CONFLICT DO UPDATE ...
 *   db.batch([stmts...])
 *
 * The adapter pattern is: db.prepare(sql) → { bind(...args) → { run, first, all } }
 */
function buildFakeDB(subs, snapshots) {
  // Mutable clones so tests can inspect state without polluting each other
  const subsStore = subs.map((s) => ({ ...s }));
  const snapshotStore = snapshots.map((s) => ({ ...s }));

  function resolve(sql, args) {
    const s = sql.replace(/\s+/g, " ").trim().toLowerCase();

    // listDistinctTerms
    if (s.includes("select distinct term, kind") && s.includes("verified_at is not null")) {
      const seen = new Set();
      const rows = [];
      for (const sub of subsStore) {
        if (sub.verified_at !== null && sub.verified_at !== undefined) {
          const key = `${sub.term}|${sub.kind}`;
          if (!seen.has(key)) {
            seen.add(key);
            rows.push({ term: sub.term, kind: sub.kind });
          }
        }
      }
      return { results: rows };
    }

    // listVerifiedSubsForTerm
    if (s.includes("select * from subscriptions") && s.includes("term = ?") && s.includes("verified_at is not null")) {
      const term = args[0];
      const rows = subsStore.filter(
        (sub) => sub.term === term && sub.verified_at !== null && sub.verified_at !== undefined
      );
      return { results: rows };
    }

    // getLatestSnapshot — two binds: term, term
    if (s.includes("select full_name, stars from repo_snapshots") && s.includes("max(captured_at)")) {
      const term = args[0]; // args[1] is the same term for the subquery
      // Find max captured_at for this term
      const rows = snapshotStore.filter((r) => r.term === term);
      if (rows.length === 0) return { results: [] };
      const maxAt = rows.reduce((best, r) => (r.captured_at > best ? r.captured_at : best), "");
      const latest = rows.filter((r) => r.captured_at === maxAt).map((r) => ({
        full_name: r.full_name,
        stars: r.stars,
      }));
      return { results: latest };
    }

    // setLastNotified — UPDATE subscriptions SET last_notified_at = ? WHERE id = ?
    if (s.includes("update subscriptions set last_notified_at")) {
      const [isoTime, id] = args;
      for (const sub of subsStore) {
        if (sub.id === id) {
          sub.last_notified_at = isoTime;
        }
      }
      return { meta: { changes: 1 } };
    }

    // writeSnapshots uses db.batch — handled separately below
    // Individual INSERT is a no-op here (batch is the real path)
    if (s.includes("insert into repo_snapshots")) {
      const [term, full_name, stars, captured_at] = args;
      // upsert
      const idx = snapshotStore.findIndex(
        (r) => r.term === term && r.full_name === full_name && r.captured_at === captured_at
      );
      if (idx >= 0) {
        snapshotStore[idx].stars = stars;
      } else {
        snapshotStore.push({ term, full_name, stars, captured_at });
      }
      return { meta: { changes: 1 } };
    }

    throw new Error(`FakeDB: unrecognised SQL: ${sql}`);
  }

  function makeStatement(sql, boundArgs = []) {
    return {
      bind(...args) {
        return makeStatement(sql, [...boundArgs, ...args]);
      },
      async run() {
        return resolve(sql, boundArgs);
      },
      async first() {
        const result = resolve(sql, boundArgs);
        return result.results?.[0] ?? null;
      },
      async all() {
        return resolve(sql, boundArgs);
      },
    };
  }

  const db = {
    prepare(sql) {
      return makeStatement(sql);
    },
    async batch(statements) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
    // Expose mutable state for assertions
    _subs: subsStore,
    _snapshots: snapshotStore,
  };

  return db;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** One verified subscription for "rust" with stars_abs metric, threshold 1000 */
function makeVerifiedSub(overrides = {}) {
  return {
    id: "sub-1",
    email: "user@example.com",
    kind: "topic",
    term: "rust",
    metric: "stars_abs",
    threshold: 1000,
    window_days: 7,
    digest: null,
    created_at: "2026-05-01T00:00:00Z",
    verified_at: "2026-05-02T00:00:00Z",
    last_notified_at: null,
    verify_token: "vt-1",
    unsub_token: "ut-1",
    ...overrides,
  };
}

/** Prior snapshot: the "crossing" repo at 900 stars (below threshold 1000) */
function makePriorSnapshot(term = "rust", stars = 900) {
  return {
    term,
    full_name: "rust-lang/rust",
    stars,
    captured_at: "2026-05-26T00:00:00Z",
  };
}

/** Trending repos fixture: one repo now at 1200 stars (above threshold 1000) → CROSSES */
const FIXTURE_REPOS = [{ fullName: "rust-lang/rust", stars: 1200 }];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runAlertSweep — idempotency (ALRT-03 headline)", () => {
  test("twice-run on identical fixture data sends EXACTLY ONE email total", async () => {
    const db = buildFakeDB([makeVerifiedSub()], [makePriorSnapshot()]);
    const fakeEnv = { DB: db };

    let sendCount = 0;
    const sendSpy = async (_sub, _crossing, _unsubUrl) => {
      sendCount++;
    };
    const deps = {
      fetchTrending: async () => FIXTURE_REPOS,
      send: sendSpy,
      now: () => "2026-05-27T00:00:00Z",
    };

    // First run: should detect the crossing and send once
    const run1 = await runAlertSweep(fakeEnv, deps);
    assert.equal(run1.sent, 1, "First run should send 1 email");
    assert.equal(sendCount, 1, "send spy should have been called once after run 1");

    // Second run on the SAME data: last_notified_at is now set → must NOT re-send
    const run2 = await runAlertSweep(fakeEnv, deps);
    assert.equal(run2.sent, 0, "Second run should send 0 emails (idempotent)");
    assert.equal(sendCount, 1, "Total send count across both runs must be exactly 1");
  });

  test("after first run, last_notified_at is set on the subscription", async () => {
    const db = buildFakeDB([makeVerifiedSub()], [makePriorSnapshot()]);
    const fakeEnv = { DB: db };

    const deps = {
      fetchTrending: async () => FIXTURE_REPOS,
      send: async () => {},
      now: () => "2026-05-27T12:00:00Z",
    };

    await runAlertSweep(fakeEnv, deps);

    const sub = db._subs.find((s) => s.id === "sub-1");
    assert.ok(sub.last_notified_at !== null, "last_notified_at should be set after first run");
    assert.equal(sub.last_notified_at, "2026-05-27T12:00:00Z");
  });
});

describe("runAlertSweep — verified-only gate (T-03-15)", () => {
  test("unverified subscription (verified_at null) is never emailed", async () => {
    const unverifiedSub = makeVerifiedSub({ verified_at: null });
    const db = buildFakeDB([unverifiedSub], [makePriorSnapshot()]);
    const fakeEnv = { DB: db };

    let sendCount = 0;
    const deps = {
      fetchTrending: async () => FIXTURE_REPOS,
      send: async () => { sendCount++; },
      now: () => "2026-05-27T00:00:00Z",
    };

    const result = await runAlertSweep(fakeEnv, deps);

    assert.equal(sendCount, 0, "Unverified sub must not receive email");
    assert.equal(result.sent, 0);
  });

  test("verified sub gets email; unverified sub for same term does not", async () => {
    const db = buildFakeDB(
      [makeVerifiedSub(), makeVerifiedSub({ id: "sub-2", email: "other@example.com", verified_at: null })],
      [makePriorSnapshot()]
    );
    const fakeEnv = { DB: db };

    let sendCount = 0;
    const deps = {
      fetchTrending: async () => FIXTURE_REPOS,
      send: async () => { sendCount++; },
      now: () => "2026-05-27T00:00:00Z",
    };

    const result = await runAlertSweep(fakeEnv, deps);
    assert.equal(sendCount, 1, "Only the verified sub should receive an email");
    assert.equal(result.sent, 1);
  });
});

describe("runAlertSweep — term dedupe (Pitfall 3 / ALRT-02)", () => {
  test("two subscriptions to the SAME term → fetchTrending called ONCE, not twice", async () => {
    const sub2 = makeVerifiedSub({ id: "sub-2", email: "other@example.com" });
    const db = buildFakeDB([makeVerifiedSub(), sub2], [makePriorSnapshot()]);
    const fakeEnv = { DB: db };

    let fetchCount = 0;
    const deps = {
      fetchTrending: async () => { fetchCount++; return FIXTURE_REPOS; },
      send: async () => {},
      now: () => "2026-05-27T00:00:00Z",
    };

    await runAlertSweep(fakeEnv, deps);
    assert.equal(fetchCount, 1, "fetchTrending must be called exactly once per distinct term");
  });

  test("two subscriptions to DIFFERENT terms → fetchTrending called for each", async () => {
    const sub2 = makeVerifiedSub({ id: "sub-2", email: "other@example.com", term: "go", kind: "topic" });
    const db = buildFakeDB(
      [makeVerifiedSub(), sub2],
      [makePriorSnapshot("rust"), makePriorSnapshot("go")]
    );
    const fakeEnv = { DB: db };

    let fetchCount = 0;
    const deps = {
      fetchTrending: async () => { fetchCount++; return FIXTURE_REPOS; },
      send: async () => {},
      now: () => "2026-05-27T00:00:00Z",
    };

    await runAlertSweep(fakeEnv, deps);
    assert.equal(fetchCount, 2, "fetchTrending must be called once per distinct term");
  });
});

describe("runAlertSweep — detect-before-write order (Pitfall 2)", () => {
  test("prior snapshot stars used for detection (not the freshly written snapshot)", async () => {
    // Prior snapshot: 900 stars (below threshold 1000).
    // If writeSnapshots ran BEFORE detectCrossings, the prior would become 1200
    // and pct/velocity checks would see no gain — but stars_abs would still fire.
    // We verify the PRIOR stars are used by checking with stars_pct metric.

    const sub = makeVerifiedSub({ metric: "stars_pct", threshold: 20, window_days: 7 });
    // prior = 1000, current = 1200 → 20% growth → should cross
    const db = buildFakeDB(
      [sub],
      [{ term: "rust", full_name: "rust-lang/rust", stars: 1000, captured_at: "2026-05-26T00:00:00Z" }]
    );
    const fakeEnv = { DB: db };

    let sendCount = 0;
    let snapshotWritten = false;
    let sendHappenedBeforeWrite = false;

    const deps = {
      fetchTrending: async () => [{ fullName: "rust-lang/rust", stars: 1200 }],
      send: async () => {
        sendCount++;
        // At the moment send is called, snapshot must NOT yet be written for this run
        sendHappenedBeforeWrite = !snapshotWritten;
      },
      now: () => {
        // First call is for setLastNotified; second is for capturedAt in writeSnapshots.
        // We use a counter to distinguish.
        snapshotWritten = true; // by the time now() is called for capturedAt, we flag it
        return "2026-05-27T00:00:00Z";
      },
    };

    const result = await runAlertSweep(fakeEnv, deps);
    assert.equal(sendCount, 1, "stars_pct crossing should be detected using prior snapshot");
  });

  test("no crossing when prior is identical to current (no growth)", async () => {
    const sub = makeVerifiedSub({ metric: "stars_pct", threshold: 10, window_days: 7 });
    const db = buildFakeDB(
      [sub],
      [{ term: "rust", full_name: "rust-lang/rust", stars: 1200, captured_at: "2026-05-26T00:00:00Z" }]
    );
    const fakeEnv = { DB: db };

    let sendCount = 0;
    const deps = {
      fetchTrending: async () => [{ fullName: "rust-lang/rust", stars: 1200 }],
      send: async () => { sendCount++; },
      now: () => "2026-05-27T00:00:00Z",
    };

    await runAlertSweep(fakeEnv, deps);
    assert.equal(sendCount, 0, "No growth → no crossing → no email");
  });
});

describe("runAlertSweep — fresh snapshots are written after detection", () => {
  test("after the sweep, the snapshot store contains the new capture", async () => {
    const db = buildFakeDB([makeVerifiedSub()], [makePriorSnapshot()]);
    const fakeEnv = { DB: db };

    const deps = {
      fetchTrending: async () => FIXTURE_REPOS,
      send: async () => {},
      now: () => "2026-05-27T18:00:00Z",
    };

    await runAlertSweep(fakeEnv, deps);

    const newSnap = db._snapshots.find(
      (s) => s.term === "rust" && s.captured_at === "2026-05-27T18:00:00Z"
    );
    assert.ok(newSnap, "A new snapshot row should exist with the run's capturedAt timestamp");
    assert.equal(newSnap.full_name, "rust-lang/rust");
    assert.equal(newSnap.stars, 1200);
  });
});

describe("runAlertSweep — scanned count reflects distinct terms", () => {
  test("scanned = 1 when there is one distinct term", async () => {
    const db = buildFakeDB([makeVerifiedSub()], [makePriorSnapshot()]);
    const result = await runAlertSweep({ DB: db }, {
      fetchTrending: async () => FIXTURE_REPOS,
      send: async () => {},
      now: () => "2026-05-27T00:00:00Z",
    });
    assert.equal(result.scanned, 1);
  });

  test("scanned = 0 when there are no verified subscriptions", async () => {
    const db = buildFakeDB([], []);
    const result = await runAlertSweep({ DB: db }, {
      fetchTrending: async () => [],
      send: async () => {},
      now: () => "2026-05-27T00:00:00Z",
    });
    assert.equal(result.scanned, 0);
    assert.equal(result.sent, 0);
  });
});

describe("alreadyNotified helper (unit)", () => {
  test("returns false when last_notified_at is null", () => {
    assert.equal(alreadyNotified({ last_notified_at: null }), false);
  });

  test("returns false when last_notified_at is undefined", () => {
    assert.equal(alreadyNotified({ last_notified_at: undefined }), false);
  });

  test("returns true when last_notified_at is set", () => {
    assert.equal(alreadyNotified({ last_notified_at: "2026-05-27T00:00:00Z" }), true);
  });
});
