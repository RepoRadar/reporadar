/**
 * repochat.style.test.mjs - unit tests for stripEmDashes (em-dash backstop)
 *
 * Tests: stripEmDashes
 *
 * PURE tests - no network, no I/O.
 * Run: node --test tests/repochat.style.test.mjs
 *
 * TDD: written BEFORE the implementation (RED phase).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { stripEmDashes } from "../app/lib/repoChatPrompt.ts";

// ---------------------------------------------------------------------------
// stripEmDashes - basic cases
// ---------------------------------------------------------------------------

describe("stripEmDashes", () => {
  test("input with U+2014 em dash returns string with no em dash", () => {
    const result = stripEmDashes("a—b");
    // The em dash character must not appear in the output
    assert.strictEqual(result.includes("—"), false, "result must not contain U+2014");
  });

  test('input "foo -- bar" returns string with no " -- "', () => {
    const result = stripEmDashes("foo -- bar");
    assert.strictEqual(result.includes(" -- "), false, 'result must not contain " -- "');
  });

  test("clean input passes through unchanged", () => {
    const clean = "Hello, this is a normal sentence with commas, periods, and colons.";
    const result = stripEmDashes(clean);
    assert.strictEqual(result, clean);
  });

  test("input with em dash does not include the em dash character", () => {
    const result = stripEmDashes("There is something—it is important");
    // Asserting on the literal em dash char (U+2014)
    assert.strictEqual(result.includes("—"), false);
  });

  test("input with only em dashes returns no em dashes", () => {
    const result = stripEmDashes("———");
    assert.strictEqual(result.includes("—"), false);
  });

  // ---------------------------------------------------------------------------
  // Chunk-boundary case
  // ---------------------------------------------------------------------------
  //
  // The route's strategy is: buffer the full round text from the Gemini stream,
  // then call stripEmDashes ONCE on the whole buffer before enqueuing. It never
  // calls stripEmDashes on a partial chunk. This test pins that contract at the
  // function level: concatenating two chunks that together contain an em dash
  // and then stripping produces clean output. A dash cannot survive a chunk
  // boundary because we never strip partial chunks.
  //
  test("chunk-boundary: stripEmDashes on concatenated halves removes em dash", () => {
    // Simulate two chunks that together form an em-dash string
    const chunk1 = "foo—";
    const chunk2 = "bar";
    const result = stripEmDashes(chunk1 + chunk2);
    assert.strictEqual(result.includes("—"), false, "em dash must not survive chunk boundary concat");
  });

  test("double-hyphen variant is also stripped", () => {
    const result = stripEmDashes("yes--no");
    assert.strictEqual(result.includes("--"), false);
  });
});
