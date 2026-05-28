/**
 * repochat.context.test.mjs - unit tests for repoContext.ts pure helpers
 *
 * Tests: trimReadme, capTree, isValidFullName, blobUrl, treeUrl
 *
 * PURE tests - no network, no I/O.
 * Run: node --test tests/repochat.context.test.mjs
 *
 * TDD: written BEFORE the implementation (RED phase).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  trimReadme,
  capTree,
  isValidFullName,
  blobUrl,
  treeUrl,
} from "../app/lib/repoContext.ts";

// ---------------------------------------------------------------------------
// trimReadme
// ---------------------------------------------------------------------------

describe("trimReadme", () => {
  test("a 20,000-char string is truncated to <= 12,100 chars and flagged", () => {
    const long = "x".repeat(20_000);
    const result = trimReadme(long);
    assert.ok(result.text.length <= 12_100, `expected <= 12,100 chars, got ${result.text.length}`);
    assert.strictEqual(result.truncated, true);
  });

  test("a 500-char string is returned as-is and not flagged", () => {
    const short = "a".repeat(500);
    const result = trimReadme(short);
    assert.strictEqual(result.text, short);
    assert.strictEqual(result.truncated, false);
  });

  test("a string of exactly 12,000 chars is not truncated", () => {
    const exact = "b".repeat(12_000);
    const result = trimReadme(exact);
    assert.strictEqual(result.text, exact);
    assert.strictEqual(result.truncated, false);
  });

  test("truncated text starts with the original content", () => {
    const long = "hello world " + "y".repeat(20_000);
    const result = trimReadme(long);
    assert.ok(result.text.startsWith("hello world "), "truncated text should start with original prefix");
    assert.strictEqual(result.truncated, true);
  });
});

// ---------------------------------------------------------------------------
// capTree
// ---------------------------------------------------------------------------

describe("capTree", () => {
  // Build a fixture of 300 items: ~50 directories, ~250 files
  function makeFixture(count) {
    const items = [];
    for (let i = 0; i < count; i++) {
      if (i < 50) {
        items.push({ path: `dir${i}`, type: "tree" });
      } else {
        items.push({ path: `file${i}.ts`, type: "blob" });
      }
    }
    return items;
  }

  test("300 items are capped to exactly 200", () => {
    const items = makeFixture(300);
    const result = capTree(items);
    assert.strictEqual(result.paths.length, 200);
  });

  test("300 items sets truncated to true", () => {
    const items = makeFixture(300);
    const result = capTree(items);
    assert.strictEqual(result.truncated, true);
  });

  test("directories come before files in the output", () => {
    const items = makeFixture(300);
    const result = capTree(items);
    // All directory paths end with "/"; find first non-directory entry
    let seenFile = false;
    for (const p of result.paths) {
      if (p.endsWith("/")) {
        assert.ok(!seenFile, `directory "${p}" appeared after a file`);
      } else {
        seenFile = true;
      }
    }
  });

  test("directory paths end with '/'", () => {
    const items = makeFixture(300);
    const result = capTree(items);
    const dirs = result.paths.filter((p) => p.endsWith("/"));
    assert.ok(dirs.length > 0, "should have at least one directory path");
    for (const d of dirs) {
      assert.ok(d.endsWith("/"), `directory path "${d}" must end with /`);
    }
  });

  test("10-item array returns 10 paths and truncated is false", () => {
    const items = makeFixture(10);
    const result = capTree(items);
    assert.strictEqual(result.paths.length, 10);
    assert.strictEqual(result.truncated, false);
  });

  test("empty array returns empty paths and truncated is false", () => {
    const result = capTree([]);
    assert.strictEqual(result.paths.length, 0);
    assert.strictEqual(result.truncated, false);
  });
});

// ---------------------------------------------------------------------------
// isValidFullName
// ---------------------------------------------------------------------------

describe("isValidFullName", () => {
  test('"facebook/react" is valid', () => {
    assert.strictEqual(isValidFullName("facebook/react"), true);
  });

  test('"owner/repo-name.js" is valid (hyphens and dots)', () => {
    assert.strictEqual(isValidFullName("owner/repo-name.js"), true);
  });

  test('"react" (no slash) is invalid', () => {
    assert.strictEqual(isValidFullName("react"), false);
  });

  test('"a/b/c" (two slashes) is invalid', () => {
    assert.strictEqual(isValidFullName("a/b/c"), false);
  });

  test('"facebook/" (empty repo part) is invalid', () => {
    assert.strictEqual(isValidFullName("facebook/"), false);
  });

  test('"/react" (empty owner part) is invalid', () => {
    assert.strictEqual(isValidFullName("/react"), false);
  });

  test('"foo bar/baz" (space in owner) is invalid', () => {
    assert.strictEqual(isValidFullName("foo bar/baz"), false);
  });

  test('"" (empty string) is invalid', () => {
    assert.strictEqual(isValidFullName(""), false);
  });
});

// ---------------------------------------------------------------------------
// blobUrl
// ---------------------------------------------------------------------------

describe("blobUrl", () => {
  test('returns correct blob URL for "facebook/react" and "src/index.js"', () => {
    const url = blobUrl("facebook/react", "src/index.js");
    assert.strictEqual(url, "https://github.com/facebook/react/blob/HEAD/src/index.js");
  });
});

// ---------------------------------------------------------------------------
// treeUrl
// ---------------------------------------------------------------------------

describe("treeUrl", () => {
  test('returns correct tree URL for "facebook/react" and "src"', () => {
    const url = treeUrl("facebook/react", "src");
    assert.strictEqual(url, "https://github.com/facebook/react/tree/HEAD/src");
  });
});
