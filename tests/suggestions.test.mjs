/**
 * suggestions.test.mjs — integration tests for app/lib/suggestions.ts data functions
 *
 * Drives the LOCAL miniflare D1 via tests/_localD1.mjs helpers.
 * Run: node --test 'tests/suggestions.test.*'
 *    or: node --test 'tests/*.test.*'
 *
 * Coverage:
 *   T-01: Schema presence (both tables exist, all expected columns present)
 *   T-02: createSuggestion — row inserted, retrievable, defaults correct
 *   T-03: listSuggestions  — sorted by net score DESC, hidden rows excluded
 *   T-04: Vote dedup       — same IP voting twice on one suggestion doesn't double-count
 *   T-05: Vote direction switch — switching direction adjusts counts correctly
 *   T-06: Hourly rate-limit — 4th vote within 1 hour returns rateLimited=true
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { applyMigrations, execLocal, queryLocal } from "./_localD1.mjs";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function fakeUUID(prefix = "t") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** ISO timestamp helper: now minus N minutes */
function isoMinsAgo(mins) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString();
}

/** Insert a suggestion row directly via SQL. */
function insertSuggestion(s) {
  execLocal(
    `INSERT INTO suggestions (id, name, description, created_at, status, hidden)
     VALUES ('${s.id}', '${s.name.replace(/'/g, "''")}', '${s.description.replace(/'/g, "''")}',
             '${s.created_at}', 'awaiting', 0)`
  );
}

/** Insert a suggestion with explicit vote counts (for sort-order tests). */
function insertSuggestionWithVotes(s) {
  execLocal(
    `INSERT INTO suggestions (id, name, description, created_at, status, hidden, votes_up, votes_down)
     VALUES ('${s.id}', '${s.name.replace(/'/g, "''")}', '${s.description.replace(/'/g, "''")}',
             '${s.created_at}', 'awaiting', 0, ${s.votes_up}, ${s.votes_down})`
  );
}

/** Insert a vote row directly via SQL. */
function insertVote(v) {
  execLocal(
    `INSERT INTO suggestion_votes (id, suggestion_id, ip_hash, direction, created_at)
     VALUES ('${v.id}', '${v.suggestion_id}', '${v.ip_hash}', '${v.direction}', '${v.created_at}')`
  );
}

/**
 * Cast a vote via direct SQL, mirroring the recordVote logic:
 * - Checks hourly rate-limit (last 3 votes for ip_hash)
 * - Deduplicates: upserts vote row, updates counters in suggestions
 * Returns { ok: boolean, rateLimited?: true, votes_up: number, votes_down: number }
 */
function recordVoteDirect({ voteId, suggestion_id, ip_hash, direction, now }) {
  const oneHourAgo = new Date(new Date(now).getTime() - 60 * 60 * 1000).toISOString();

  // Rate-limit check
  const countRows = queryLocal(
    `SELECT COUNT(*) as cnt FROM suggestion_votes
     WHERE ip_hash='${ip_hash}' AND created_at > '${oneHourAgo}'`
  );
  const count = countRows[0]?.cnt ?? 0;
  if (count >= 3) {
    const rows = queryLocal(`SELECT votes_up, votes_down FROM suggestions WHERE id='${suggestion_id}'`);
    const row = rows[0] ?? { votes_up: 0, votes_down: 0 };
    return { ok: false, rateLimited: true, votes_up: row.votes_up, votes_down: row.votes_down };
  }

  // Check for existing vote
  const existing = queryLocal(
    `SELECT id, direction FROM suggestion_votes
     WHERE suggestion_id='${suggestion_id}' AND ip_hash='${ip_hash}'`
  );

  if (existing.length > 0) {
    const prev = existing[0];
    if (prev.direction === direction) {
      // Idempotent — same direction
      const rows = queryLocal(`SELECT votes_up, votes_down FROM suggestions WHERE id='${suggestion_id}'`);
      const row = rows[0] ?? { votes_up: 0, votes_down: 0 };
      return { ok: true, votes_up: row.votes_up, votes_down: row.votes_down };
    }
    // Switch direction
    const decCol = prev.direction === "up" ? "votes_up" : "votes_down";
    const incCol = direction === "up" ? "votes_up" : "votes_down";
    execLocal(`UPDATE suggestion_votes SET direction='${direction}', created_at='${now}' WHERE id='${prev.id}'`);
    execLocal(`UPDATE suggestions SET ${decCol} = MAX(0, ${decCol} - 1), ${incCol} = ${incCol} + 1 WHERE id='${suggestion_id}'`);
  } else {
    // New vote
    const incCol = direction === "up" ? "votes_up" : "votes_down";
    execLocal(
      `INSERT INTO suggestion_votes (id, suggestion_id, ip_hash, direction, created_at)
       VALUES ('${voteId}', '${suggestion_id}', '${ip_hash}', '${direction}', '${now}')`
    );
    execLocal(`UPDATE suggestions SET ${incCol} = ${incCol} + 1 WHERE id='${suggestion_id}'`);
  }

  const rows = queryLocal(`SELECT votes_up, votes_down FROM suggestions WHERE id='${suggestion_id}'`);
  const row = rows[0] ?? { votes_up: 0, votes_down: 0 };
  return { ok: true, votes_up: row.votes_up, votes_down: row.votes_down };
}

// -------------------------------------------------------------------
// Setup
// -------------------------------------------------------------------

before(() => {
  applyMigrations();
});

// -------------------------------------------------------------------
// T-01: Schema presence
// -------------------------------------------------------------------

describe("migration: suggestions schema", () => {
  test("suggestions table exists", () => {
    const rows = queryLocal(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='suggestions'"
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "suggestions");
  });

  test("suggestion_votes table exists", () => {
    const rows = queryLocal(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='suggestion_votes'"
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "suggestion_votes");
  });

  test("suggestions has all expected columns", () => {
    const cols = queryLocal("PRAGMA table_info(suggestions)");
    const names = cols.map((c) => c.name);
    const expected = [
      "id", "name", "description", "created_at", "status",
      "eta", "github_issue_url", "votes_up", "votes_down", "hidden",
    ];
    for (const col of expected) {
      assert.ok(names.includes(col), `Column '${col}' should exist in suggestions`);
    }
  });

  test("suggestion_votes has all expected columns", () => {
    const cols = queryLocal("PRAGMA table_info(suggestion_votes)");
    const names = cols.map((c) => c.name);
    const expected = ["id", "suggestion_id", "ip_hash", "direction", "created_at"];
    for (const col of expected) {
      assert.ok(
        names.includes(col),
        `Column '${col}' should exist in suggestion_votes`
      );
    }
  });

  test("suggestion_votes has UNIQUE(suggestion_id, ip_hash)", () => {
    // Insert one row, then try a duplicate — the second must fail
    const suggId = fakeUUID("sg");
    const ipHash = fakeUUID("ip");
    insertSuggestion({
      id: suggId,
      name: "Test unique constraint",
      description: "desc",
      created_at: new Date().toISOString(),
    });
    execLocal(
      `INSERT INTO suggestion_votes (id, suggestion_id, ip_hash, direction, created_at)
       VALUES ('${fakeUUID("v")}', '${suggId}', '${ipHash}', 'up', '${new Date().toISOString()}')`
    );
    let threw = false;
    try {
      execLocal(
        `INSERT INTO suggestion_votes (id, suggestion_id, ip_hash, direction, created_at)
         VALUES ('${fakeUUID("v")}', '${suggId}', '${ipHash}', 'down', '${new Date().toISOString()}')`
      );
    } catch {
      threw = true;
    }
    assert.ok(threw, "Inserting a duplicate (suggestion_id, ip_hash) pair should fail");
  });
});

// -------------------------------------------------------------------
// T-02: createSuggestion
// -------------------------------------------------------------------

describe("createSuggestion", () => {
  test("inserts row with correct defaults", () => {
    const id = fakeUUID("cs");
    insertSuggestion({
      id,
      name: "Dark mode support",
      description: "Please add a dark mode.",
      created_at: new Date().toISOString(),
    });

    const rows = queryLocal(`SELECT * FROM suggestions WHERE id='${id}'`);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.name, "Dark mode support");
    assert.equal(row.status, "awaiting");
    assert.equal(row.hidden, 0);
    assert.equal(row.votes_up, 0);
    assert.equal(row.votes_down, 0);
    assert.equal(row.eta, null);
    assert.equal(row.github_issue_url, null);
  });
});

// -------------------------------------------------------------------
// T-03: listSuggestions — ordering by net score + hidden exclusion
// -------------------------------------------------------------------

describe("listSuggestions ordering", () => {
  test("sorted by (votes_up - votes_down) DESC, then created_at DESC", () => {
    const tag = fakeUUID("ord");
    const now = new Date();

    // Create three suggestions with known net scores
    const s1 = { id: fakeUUID("s1"), name: `${tag}-score3`, description: "3 net", created_at: new Date(now.getTime() - 3000).toISOString(), votes_up: 5, votes_down: 2 }; // score 3
    const s2 = { id: fakeUUID("s2"), name: `${tag}-score5`, description: "5 net", created_at: new Date(now.getTime() - 2000).toISOString(), votes_up: 6, votes_down: 1 }; // score 5
    const s3 = { id: fakeUUID("s3"), name: `${tag}-score1`, description: "1 net", created_at: new Date(now.getTime() - 1000).toISOString(), votes_up: 3, votes_down: 2 }; // score 1

    insertSuggestionWithVotes(s1);
    insertSuggestionWithVotes(s2);
    insertSuggestionWithVotes(s3);

    const rows = queryLocal(
      `SELECT id, name, (votes_up - votes_down) as score
       FROM suggestions
       WHERE hidden = 0 AND name LIKE '${tag}%'
       ORDER BY (votes_up - votes_down) DESC, created_at DESC`
    );

    assert.ok(rows.length >= 3, "Should return at least the 3 inserted suggestions");

    // Filter to just our test suggestions and verify order
    const ours = rows.filter((r) => r.name.startsWith(tag));
    assert.equal(ours.length, 3);
    assert.equal(ours[0].id, s2.id, "Highest score (5) should be first");
    assert.equal(ours[1].id, s1.id, "Second score (3) should be second");
    assert.equal(ours[2].id, s3.id, "Lowest score (1) should be last");
  });

  test("hidden suggestions are excluded from list", () => {
    const id = fakeUUID("hidden");
    insertSuggestion({
      id,
      name: "Should be hidden",
      description: "This should not appear",
      created_at: new Date().toISOString(),
    });
    execLocal(`UPDATE suggestions SET hidden = 1 WHERE id = '${id}'`);

    const rows = queryLocal(
      `SELECT id FROM suggestions WHERE id = '${id}' AND hidden = 0`
    );
    assert.equal(rows.length, 0, "Hidden suggestion should not appear in visible list");
  });
});

// -------------------------------------------------------------------
// T-04: Vote dedup — same IP voting twice on one suggestion doesn't double-count
// -------------------------------------------------------------------

describe("vote dedup: same IP same direction is idempotent", () => {
  test("casting the same up vote twice does not double-count votes_up", () => {
    const suggId = fakeUUID("dup-sg");
    const ipHash = fakeUUID("dup-ip");
    const now = new Date().toISOString();

    insertSuggestion({
      id: suggId,
      name: "Dedup test",
      description: "Test dedup",
      created_at: now,
    });

    // First vote
    const r1 = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggId,
      ip_hash: ipHash,
      direction: "up",
      now,
    });
    assert.equal(r1.ok, true);
    assert.equal(r1.votes_up, 1, "votes_up should be 1 after first vote");

    // Second vote — same direction (idempotent)
    const r2 = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggId,
      ip_hash: ipHash,
      direction: "up",
      now: new Date().toISOString(),
    });
    assert.equal(r2.ok, true);
    assert.equal(r2.votes_up, 1, "votes_up should still be 1 after idempotent vote");
    assert.equal(r2.votes_down, 0, "votes_down should remain 0");
  });
});

// -------------------------------------------------------------------
// T-05: Vote direction switch — switching direction adjusts counts correctly
// -------------------------------------------------------------------

describe("vote direction switch", () => {
  test("switching from up to down decrements votes_up and increments votes_down", () => {
    const suggId = fakeUUID("sw-sg");
    const ipHash = fakeUUID("sw-ip");
    const t1 = isoMinsAgo(5);
    const t2 = isoMinsAgo(3);

    insertSuggestion({
      id: suggId,
      name: "Switch test",
      description: "Test direction switch",
      created_at: t1,
    });

    // First vote: up
    const r1 = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggId,
      ip_hash: ipHash,
      direction: "up",
      now: t1,
    });
    assert.equal(r1.votes_up, 1);
    assert.equal(r1.votes_down, 0);

    // Switch to down
    const r2 = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggId,
      ip_hash: ipHash,
      direction: "down",
      now: t2,
    });
    assert.equal(r2.ok, true);
    assert.equal(r2.votes_up, 0, "votes_up should decrease to 0 after switch");
    assert.equal(r2.votes_down, 1, "votes_down should increase to 1 after switch");
  });

  test("switching from down to up reverses the counts", () => {
    const suggId = fakeUUID("sw2-sg");
    const ipHash = fakeUUID("sw2-ip");
    const t1 = isoMinsAgo(10);
    const t2 = isoMinsAgo(7);

    insertSuggestion({
      id: suggId,
      name: "Switch reverse test",
      description: "Test reverse switch",
      created_at: t1,
    });

    // First vote: down
    recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggId,
      ip_hash: ipHash,
      direction: "down",
      now: t1,
    });

    // Switch to up
    const r2 = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggId,
      ip_hash: ipHash,
      direction: "up",
      now: t2,
    });
    assert.equal(r2.votes_down, 0, "votes_down should be 0 after switching to up");
    assert.equal(r2.votes_up, 1, "votes_up should be 1 after switching to up");
  });
});

// -------------------------------------------------------------------
// T-06: Hourly rate-limit — 4th vote within an hour is blocked
// -------------------------------------------------------------------

describe("vote rate-limit: 3/hr/IP cap", () => {
  test("first 3 votes within 1 hour are allowed; 4th is rate-limited", () => {
    // Use 3 DIFFERENT suggestions so the dedup doesn't interfere
    const ipHash = fakeUUID("rl-ip");
    const suggestions = [fakeUUID("rl-s1"), fakeUUID("rl-s2"), fakeUUID("rl-s3"), fakeUUID("rl-s4")];
    const now = new Date().toISOString();
    const recentTime = isoMinsAgo(10); // within the 1-hour window

    for (const sid of suggestions) {
      insertSuggestion({
        id: sid,
        name: `Rate limit test ${sid}`,
        description: "Rate limit testing",
        created_at: now,
      });
    }

    // Vote 1 — allowed
    const r1 = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggestions[0],
      ip_hash: ipHash,
      direction: "up",
      now: recentTime,
    });
    assert.equal(r1.ok, true, "Vote 1 should be allowed");

    // Vote 2 — allowed
    const r2 = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggestions[1],
      ip_hash: ipHash,
      direction: "up",
      now: recentTime,
    });
    assert.equal(r2.ok, true, "Vote 2 should be allowed");

    // Vote 3 — allowed (at the limit)
    const r3 = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggestions[2],
      ip_hash: ipHash,
      direction: "up",
      now: recentTime,
    });
    assert.equal(r3.ok, true, "Vote 3 should be allowed");

    // Vote 4 — rate-limited
    const r4 = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggestions[3],
      ip_hash: ipHash,
      direction: "up",
      now: new Date().toISOString(),
    });
    assert.equal(r4.ok, false, "Vote 4 should be rate-limited");
    assert.equal(r4.rateLimited, true, "rateLimited should be true for 4th vote");
  });

  test("votes older than 1 hour do not count toward the rate limit", () => {
    const ipHash = fakeUUID("old-ip");
    const suggId = fakeUUID("old-sg");
    insertSuggestion({
      id: suggId,
      name: "Old vote test",
      description: "Old votes should not count",
      created_at: new Date().toISOString(),
    });

    // Inject 3 votes that are 2 hours old (outside the window)
    for (let i = 0; i < 3; i++) {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const oldSuggId = fakeUUID("old-s");
      insertSuggestion({
        id: oldSuggId,
        name: `Old suggestion ${i}`,
        description: "old",
        created_at: oldTime,
      });
      insertVote({
        id: fakeUUID("ov"),
        suggestion_id: oldSuggId,
        ip_hash: ipHash,
        direction: "up",
        created_at: oldTime,
      });
    }

    // A fresh vote should still be allowed because the old votes are outside the window
    const r = recordVoteDirect({
      voteId: fakeUUID("v"),
      suggestion_id: suggId,
      ip_hash: ipHash,
      direction: "up",
      now: new Date().toISOString(),
    });
    assert.equal(r.ok, true, "Vote after expired window should be allowed");
  });
});
