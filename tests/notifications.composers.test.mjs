/**
 * notifications.composers.test.mjs — unit tests for email composers and validators
 *
 * Tests: buildVerifyEmail, buildAlertEmail, normalizeMetric, normalizeKind,
 *        normalizeThreshold, normalizeWindowDays
 *
 * PURE tests — no D1, no network, no I/O.
 * Run: node --test tests/notifications.composers.test.mjs
 *
 * TDD: written BEFORE the implementation (RED phase).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  buildVerifyEmail,
  buildAlertEmail,
  describeAlert,
  repoFilterUrl,
  normalizeMetric,
  normalizeKind,
  normalizeThreshold,
  normalizeWindowDays,
} from "../app/lib/notifications.ts";

// Shared alert fields now required by buildVerifyEmail (names the alert being
// confirmed). A topic + stars_abs alert keeps assertions simple.
const ALERT_FIELDS = {
  origin: "https://reporadar.app",
  kind: "topic",
  term: "cloudflare",
  metric: "stars_abs",
  threshold: 50000,
  window_days: 30,
};

// ---------------------------------------------------------------------------
// buildVerifyEmail
// ---------------------------------------------------------------------------

describe("buildVerifyEmail", () => {
  test("returns subject and html", () => {
    const result = buildVerifyEmail({
      email: "user@example.com",
      verifyUrl: "https://reporadar.app/api/notifications/verify?token=abc",
      ...ALERT_FIELDS,
    });
    assert.ok(typeof result.subject === "string", "subject should be a string");
    assert.ok(typeof result.html === "string", "html should be a string");
    assert.ok(result.subject.length > 0, "subject should not be empty");
    assert.ok(result.html.length > 0, "html should not be empty");
  });

  test("html contains the verify URL as a link", () => {
    const verifyUrl = "https://reporadar.app/api/notifications/verify?token=abc123";
    const result = buildVerifyEmail({ email: "user@example.com", verifyUrl, ...ALERT_FIELDS });
    assert.ok(
      result.html.includes(verifyUrl),
      "html should contain the verify URL"
    );
  });

  test("html names the confirmed alert and links to the matching repos", () => {
    const result = buildVerifyEmail({
      email: "user@example.com",
      verifyUrl: "https://reporadar.app/api/notifications/verify?token=abc",
      ...ALERT_FIELDS,
    });
    assert.ok(
      result.html.includes("the cloudflare tag"),
      "html should name the alert's target tag"
    );
    assert.ok(
      result.html.includes("passes 50,000 stars"),
      "html should describe the threshold condition"
    );
    assert.ok(
      result.html.includes("https://reporadar.app/?topic=cloudflare"),
      "html should link to the term-filtered dashboard"
    );
  });

  test("html escapes a hostile email address (HTML injection guard)", () => {
    const hostileEmail = '<script>alert(1)</script>@example.com';
    const result = buildVerifyEmail({
      email: hostileEmail,
      verifyUrl: "https://reporadar.app/api/notifications/verify?token=x",
      ...ALERT_FIELDS,
    });
    // The raw script tag must NOT appear unescaped in the output
    assert.ok(
      !result.html.includes("<script>"),
      "html must not contain unescaped <script> tag from email"
    );
    assert.ok(
      !result.html.includes("</script>"),
      "html must not contain unescaped </script> tag from email"
    );
  });

  test("html escapes angle brackets in email", () => {
    const hostileEmail = "<img src=x onerror=alert(1)>@example.com";
    const result = buildVerifyEmail({
      email: hostileEmail,
      verifyUrl: "https://reporadar.app/api/notifications/verify?token=x",
      ...ALERT_FIELDS,
    });
    assert.ok(
      !result.html.includes("<img"),
      "html must not contain unescaped <img tag"
    );
  });

  test("html escapes a hostile term in the alert summary (T-03-07)", () => {
    const result = buildVerifyEmail({
      email: "user@example.com",
      verifyUrl: "https://reporadar.app/api/notifications/verify?token=x",
      ...ALERT_FIELDS,
      kind: "query",
      term: "<img src=x onerror=alert(1)>",
    });
    assert.ok(
      !result.html.includes("<img src=x"),
      "hostile term must not appear unescaped in the verify email"
    );
  });
});

// ---------------------------------------------------------------------------
// describeAlert + repoFilterUrl
// ---------------------------------------------------------------------------

describe("describeAlert", () => {
  test("stars_abs topic reads naturally with a thousands-separated threshold", () => {
    assert.equal(
      describeAlert({ kind: "topic", term: "hermes", metric: "stars_abs", threshold: 1500, window_days: 30 }),
      "the hermes tag, when a repo passes 1,500 stars"
    );
  });

  test("stars_pct query includes the window in days", () => {
    assert.equal(
      describeAlert({ kind: "query", term: "vector db", metric: "stars_pct", threshold: 20, window_days: 14 }),
      'the search "vector db", when a repo gains more than 20% stars over 14 days'
    );
  });

  test("velocity reads as stars per day", () => {
    assert.equal(
      describeAlert({ kind: "topic", term: "rust", metric: "velocity", threshold: 5, window_days: 7 }),
      "the rust tag, when a repo gains more than 5 stars per day"
    );
  });

  test("contains no em dash", () => {
    const s = describeAlert({ kind: "topic", term: "ai", metric: "stars_abs", threshold: 100, window_days: 30 });
    assert.ok(!s.includes("—"), "summary must not contain an em dash");
  });
});

describe("repoFilterUrl", () => {
  test("topic alerts filter by ?topic=", () => {
    assert.equal(
      repoFilterUrl("https://reporadar.io", { kind: "topic", term: "cloudflare workers" }),
      "https://reporadar.io/?topic=cloudflare%20workers"
    );
  });

  test("query alerts filter by ?q=", () => {
    assert.equal(
      repoFilterUrl("https://reporadar.io", { kind: "query", term: "rag" }),
      "https://reporadar.io/?q=rag"
    );
  });
});

// ---------------------------------------------------------------------------
// buildAlertEmail
// ---------------------------------------------------------------------------

describe("buildAlertEmail", () => {
  const baseCrossing = {
    fullName: "rust-lang/rust",
    stars: 95000,
    metric: "stars_pct",
    value: 25.5,
    reason: "rust-lang/rust gained 25.5% stars, crossing your 20% threshold",
  };

  test("returns subject and html", () => {
    const result = buildAlertEmail({
      term: "rust",
      crossing: baseCrossing,
      unsubUrl: "https://reporadar.app/api/notifications/unsubscribe?token=xyz",
    });
    assert.ok(typeof result.subject === "string", "subject should be a string");
    assert.ok(typeof result.html === "string", "html should be a string");
    assert.ok(result.subject.length > 0, "subject should not be empty");
    assert.ok(result.html.length > 0, "html should not be empty");
  });

  test("html contains the unsubscribe URL (footer link)", () => {
    const unsubUrl = "https://reporadar.app/api/notifications/unsubscribe?token=xyz789";
    const result = buildAlertEmail({
      term: "rust",
      crossing: baseCrossing,
      unsubUrl,
    });
    assert.ok(
      result.html.includes(unsubUrl),
      "html must contain the unsub URL in the footer"
    );
  });

  test("html escapes a hostile term (XSS guard — T-03-07)", () => {
    const hostileTerm = "<img src=x onerror=alert(1)>";
    const result = buildAlertEmail({
      term: hostileTerm,
      crossing: baseCrossing,
      unsubUrl: "https://reporadar.app/api/notifications/unsubscribe?token=x",
    });
    assert.ok(
      !result.html.includes("<img"),
      "html must not contain unescaped <img from term"
    );
    assert.ok(
      result.html.includes("&lt;img"),
      "html should contain the escaped form of the hostile term"
    );
  });

  test("html escapes a hostile fullName", () => {
    const hostileCrossing = {
      ...baseCrossing,
      fullName: '<script>steal()</script>',
      reason: "normal reason",
    };
    const result = buildAlertEmail({
      term: "rust",
      crossing: hostileCrossing,
      unsubUrl: "https://reporadar.app/api/notifications/unsubscribe?token=x",
    });
    assert.ok(
      !result.html.includes("<script>"),
      "html must not contain unescaped <script> from fullName"
    );
  });

  test("html escapes a hostile reason", () => {
    const hostileCrossing = {
      ...baseCrossing,
      reason: '<img src=x onerror=1> crossed threshold',
    };
    const result = buildAlertEmail({
      term: "rust",
      crossing: hostileCrossing,
      unsubUrl: "https://reporadar.app/api/notifications/unsubscribe?token=x",
    });
    assert.ok(
      !result.html.includes("<img"),
      "html must not contain unescaped <img from reason"
    );
  });
});

// ---------------------------------------------------------------------------
// normalizeMetric
// ---------------------------------------------------------------------------

describe("normalizeMetric", () => {
  test("returns 'stars_pct' for valid input", () => {
    assert.equal(normalizeMetric("stars_pct"), "stars_pct");
  });

  test("returns 'stars_abs' for valid input", () => {
    assert.equal(normalizeMetric("stars_abs"), "stars_abs");
  });

  test("returns 'velocity' for valid input", () => {
    assert.equal(normalizeMetric("velocity"), "velocity");
  });

  test("returns null for unknown metric", () => {
    assert.equal(normalizeMetric("followers"), null);
  });

  test("returns null for empty string", () => {
    assert.equal(normalizeMetric(""), null);
  });

  test("returns null for non-string input", () => {
    assert.equal(normalizeMetric(42), null);
    assert.equal(normalizeMetric(null), null);
    assert.equal(normalizeMetric(undefined), null);
  });
});

// ---------------------------------------------------------------------------
// normalizeKind
// ---------------------------------------------------------------------------

describe("normalizeKind", () => {
  test("returns 'topic' for valid input", () => {
    assert.equal(normalizeKind("topic"), "topic");
  });

  test("returns 'query' for valid input", () => {
    assert.equal(normalizeKind("query"), "query");
  });

  test("returns null for unknown kind", () => {
    assert.equal(normalizeKind("category"), null);
  });

  test("returns null for non-string input", () => {
    assert.equal(normalizeKind(1), null);
    assert.equal(normalizeKind(null), null);
  });
});

// ---------------------------------------------------------------------------
// normalizeThreshold
// ---------------------------------------------------------------------------

describe("normalizeThreshold", () => {
  test("returns a positive number unchanged", () => {
    assert.equal(normalizeThreshold(20), 20);
    assert.equal(normalizeThreshold(0.5), 0.5);
  });

  test("returns null for zero (threshold must be > 0)", () => {
    assert.equal(normalizeThreshold(0), null);
  });

  test("returns null for negative numbers", () => {
    assert.equal(normalizeThreshold(-5), null);
  });

  test("returns null for non-numbers", () => {
    assert.equal(normalizeThreshold("20"), null);
    assert.equal(normalizeThreshold(null), null);
    assert.equal(normalizeThreshold(undefined), null);
    assert.equal(normalizeThreshold(NaN), null);
  });
});

// ---------------------------------------------------------------------------
// normalizeWindowDays
// ---------------------------------------------------------------------------

describe("normalizeWindowDays", () => {
  test("returns a value in range [1, 90]", () => {
    assert.equal(normalizeWindowDays(7), 7);
    assert.equal(normalizeWindowDays(1), 1);
    assert.equal(normalizeWindowDays(90), 90);
  });

  test("returns null for 0", () => {
    assert.equal(normalizeWindowDays(0), null);
  });

  test("returns null for values above 90", () => {
    assert.equal(normalizeWindowDays(91), null);
    assert.equal(normalizeWindowDays(365), null);
  });

  test("returns null for non-numbers", () => {
    assert.equal(normalizeWindowDays("7"), null);
    assert.equal(normalizeWindowDays(null), null);
    assert.equal(normalizeWindowDays(NaN), null);
  });
});
