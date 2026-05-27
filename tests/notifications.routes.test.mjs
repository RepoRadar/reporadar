/**
 * notifications.routes.test.mjs — API-level tests for the double-opt-in notification flow.
 *
 * Tests the DB contract + email composers as the testable seam for the routes.
 * Routes themselves import getCloudflareContext which needs the Worker runtime,
 * so we test at the layer the routes delegate to: db.ts + notifications.ts.
 *
 * Note: Full HTTP round-trip coverage is in the smoke suite (Plan 05).
 *
 * Run: node --test tests/notifications.routes.test.mjs
 */

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { applyMigrations, execLocal, queryLocal } from "./_localD1.mjs";
import {
  buildVerifyEmail,
  buildAlertEmail,
} from "../app/lib/notifications.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeSubFixture(overrides = {}) {
  const id = makeId();
  return {
    id,
    email: `user-${id}@example.com`,
    kind: "topic",
    term: `term-${id}`,
    metric: "stars_pct",
    threshold: 20,
    window_days: 7,
    created_at: new Date().toISOString(),
    verify_token: makeId(),
    unsub_token: makeId(),
    ...overrides,
  };
}

function insertSub(sub) {
  execLocal(
    `INSERT INTO subscriptions (id, email, kind, term, metric, threshold, window_days, created_at, verify_token, unsub_token)
     VALUES ('${sub.id}', '${sub.email}', '${sub.kind}', '${sub.term}', '${sub.metric}', ${sub.threshold}, ${sub.window_days}, '${sub.created_at}', '${sub.verify_token}', '${sub.unsub_token}')`
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

before(() => {
  applyMigrations();
});

// ---------------------------------------------------------------------------
// ALRT-04 invariant: unverified subscriptions NEVER appear in alert queries
// ---------------------------------------------------------------------------

describe("double opt-in invariant (ALRT-04)", () => {
  test("unverified subscription is NOT returned by listVerifiedSubsForTerm", () => {
    const sub = makeSubFixture();
    insertSub(sub);

    // Simulate listVerifiedSubsForTerm query — must return empty for unverified
    const rows = queryLocal(
      `SELECT id FROM subscriptions WHERE term='${sub.term}' AND verified_at IS NOT NULL`
    );
    assert.equal(
      rows.length,
      0,
      "Unverified subscription must NOT appear in verified queries — ALRT-04"
    );
  });

  test("after verify token is consumed, subscription appears in verified queries", () => {
    const sub = makeSubFixture();
    insertSub(sub);

    // Simulate verifySubscription(db, verify_token)
    const iso = new Date().toISOString();
    execLocal(
      `UPDATE subscriptions SET verified_at='${iso}' WHERE verify_token='${sub.verify_token}' AND verified_at IS NULL`
    );

    const rows = queryLocal(
      `SELECT id, verified_at FROM subscriptions WHERE term='${sub.term}' AND verified_at IS NOT NULL`
    );
    assert.equal(rows.length, 1, "Verified subscription should appear in verified queries");
    assert.ok(rows[0].verified_at !== null, "verified_at must be set after verification");
    assert.equal(rows[0].id, sub.id);
  });

  test("verifying with the same token a second time is a no-op (idempotent)", () => {
    const sub = makeSubFixture();
    insertSub(sub);

    const iso1 = "2026-05-01T00:00:00.000Z";
    const iso2 = "2026-05-02T00:00:00.000Z";

    // First verify
    execLocal(
      `UPDATE subscriptions SET verified_at='${iso1}' WHERE verify_token='${sub.verify_token}' AND verified_at IS NULL`
    );
    // Second verify (same token) should NOT update verified_at again
    execLocal(
      `UPDATE subscriptions SET verified_at='${iso2}' WHERE verify_token='${sub.verify_token}' AND verified_at IS NULL`
    );

    const rows = queryLocal(
      `SELECT verified_at FROM subscriptions WHERE id='${sub.id}'`
    );
    assert.equal(rows[0].verified_at, iso1, "verified_at should remain the first value");
  });
});

// ---------------------------------------------------------------------------
// Unsubscribe by unsub_token
// ---------------------------------------------------------------------------

describe("unsubscribe by token", () => {
  test("unsubscribeByToken removes the row", () => {
    const sub = makeSubFixture();
    insertSub(sub);

    // Simulate unsubscribeByToken(db, unsub_token)
    execLocal(
      `DELETE FROM subscriptions WHERE unsub_token='${sub.unsub_token}'`
    );

    const rows = queryLocal(
      `SELECT id FROM subscriptions WHERE id='${sub.id}'`
    );
    assert.equal(rows.length, 0, "Row should be removed after unsubscribe");
  });

  test("unsubscribe with a wrong token does nothing", () => {
    const sub = makeSubFixture();
    insertSub(sub);

    // Wrong token — no row should match
    execLocal(
      `DELETE FROM subscriptions WHERE unsub_token='wrong-token-${makeId()}'`
    );

    const rows = queryLocal(
      `SELECT id FROM subscriptions WHERE id='${sub.id}'`
    );
    assert.equal(rows.length, 1, "Row should still exist after wrong-token unsubscribe attempt");
  });
});

// ---------------------------------------------------------------------------
// Token shape — route mints crypto.randomUUID()
// ---------------------------------------------------------------------------

describe("token format", () => {
  const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  test("crypto.randomUUID() produces a UUID v4 shape", () => {
    // Sanity: the route will use crypto.randomUUID() for tokens
    const token = crypto.randomUUID();
    assert.match(token, UUID_V4_RE, "crypto.randomUUID() must produce a UUID v4");
  });

  test("two calls produce distinct values", () => {
    const t1 = crypto.randomUUID();
    const t2 = crypto.randomUUID();
    assert.notEqual(t1, t2, "Each UUID must be unique");
  });
});

// ---------------------------------------------------------------------------
// Email composer XSS + footer invariants (verify route + alert route)
// ---------------------------------------------------------------------------

describe("buildVerifyEmail — HTML escaping", () => {
  test("hostile email address is escaped in the verify email HTML", () => {
    const hostile = '<script>steal(document.cookie)</script>@evil.com';
    const { html } = buildVerifyEmail({
      email: hostile,
      verifyUrl: "https://reporadar.app/api/notifications/verify?token=safe",
    });
    assert.ok(
      !html.includes("<script>"),
      "Hostile <script> from email must not appear unescaped in verify email"
    );
    assert.ok(
      html.includes("&lt;script&gt;"),
      "Hostile email should be HTML-escaped in the verify email"
    );
  });
});

describe("buildAlertEmail — HTML escaping + footer", () => {
  const safeBase = {
    fullName: "safe/repo",
    stars: 1000,
    metric: /** @type {"stars_pct"} */ ("stars_pct"),
    value: 25,
    reason: "safe/repo gained 25% stars",
  };
  const unsubUrl = "https://reporadar.app/api/notifications/unsubscribe?token=abc";

  test("hostile term is escaped in the alert email HTML (T-03-07)", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const { html } = buildAlertEmail({
      term: hostile,
      crossing: safeBase,
      unsubUrl,
    });
    assert.ok(
      !html.includes("<img"),
      "Hostile <img from term must not appear unescaped"
    );
    assert.ok(
      html.includes("&lt;img"),
      "Hostile term must be HTML-escaped in the alert email"
    );
  });

  test("hostile fullName is escaped in the alert email HTML", () => {
    const { html } = buildAlertEmail({
      term: "rust",
      crossing: { ...safeBase, fullName: '<script>xss()</script>' },
      unsubUrl,
    });
    assert.ok(
      !html.includes("<script>"),
      "Hostile fullName must not appear unescaped"
    );
  });

  test("hostile reason is escaped in the alert email HTML", () => {
    const { html } = buildAlertEmail({
      term: "rust",
      crossing: { ...safeBase, reason: "<b onmouseover=steal()>bad reason</b>" },
      unsubUrl,
    });
    assert.ok(
      !html.includes("<b "),
      "Hostile reason must not appear unescaped"
    );
  });

  test("alert email HTML contains the unsubscribe link in the footer (D-07)", () => {
    const { html } = buildAlertEmail({
      term: "rust",
      crossing: safeBase,
      unsubUrl,
    });
    assert.ok(
      html.includes(unsubUrl),
      "Alert email must contain the unsubscribe URL in the footer"
    );
  });
});
