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
  normalizeMetric,
  normalizeKind,
  normalizeThreshold,
  normalizeWindowDays,
} from "../app/lib/notifications.ts";

// ---------------------------------------------------------------------------
// buildVerifyEmail
// ---------------------------------------------------------------------------

describe("buildVerifyEmail", () => {
  test("returns subject and html", () => {
    const result = buildVerifyEmail({
      email: "user@example.com",
      verifyUrl: "https://reporadar.app/api/notifications/verify?token=abc",
    });
    assert.ok(typeof result.subject === "string", "subject should be a string");
    assert.ok(typeof result.html === "string", "html should be a string");
    assert.ok(result.subject.length > 0, "subject should not be empty");
    assert.ok(result.html.length > 0, "html should not be empty");
  });

  test("html contains the verify URL as a link", () => {
    const verifyUrl = "https://reporadar.app/api/notifications/verify?token=abc123";
    const result = buildVerifyEmail({ email: "user@example.com", verifyUrl });
    assert.ok(
      result.html.includes(verifyUrl),
      "html should contain the verify URL"
    );
  });

  test("html escapes a hostile email address (HTML injection guard)", () => {
    const hostileEmail = '<script>alert(1)</script>@example.com';
    const result = buildVerifyEmail({
      email: hostileEmail,
      verifyUrl: "https://reporadar.app/api/notifications/verify?token=x",
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
    });
    assert.ok(
      !result.html.includes("<img"),
      "html must not contain unescaped <img tag"
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
