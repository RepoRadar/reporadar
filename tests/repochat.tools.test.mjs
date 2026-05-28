/**
 * repochat.tools.test.mjs - unit tests for validateToolArgs
 *
 * Tests: validateToolArgs (search_reporadar, get_repo_file, unknown tool)
 *
 * PURE tests - no network, no I/O.
 * Run: node --test tests/repochat.tools.test.mjs
 *
 * TDD: written BEFORE the implementation (RED phase).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { validateToolArgs } from "../app/lib/repoChatPrompt.ts";

// ---------------------------------------------------------------------------
// get_repo_file
// ---------------------------------------------------------------------------

describe("validateToolArgs - get_repo_file", () => {
  test("valid relative path is accepted", () => {
    const result = validateToolArgs("get_repo_file", { path: "src/index.ts" });
    assert.strictEqual(result.ok, true);
  });

  test("path traversal with .. is rejected", () => {
    const result = validateToolArgs("get_repo_file", { path: "../../../etc/passwd" });
    assert.strictEqual(result.ok, false);
  });

  test("absolute path starting with / is rejected", () => {
    const result = validateToolArgs("get_repo_file", { path: "/abs/path" });
    assert.strictEqual(result.ok, false);
  });

  test("path containing .. in middle is rejected", () => {
    const result = validateToolArgs("get_repo_file", { path: "src/../secret" });
    assert.strictEqual(result.ok, false);
  });

  test("missing path field is rejected", () => {
    const result = validateToolArgs("get_repo_file", {});
    assert.strictEqual(result.ok, false);
  });

  test("non-string path is rejected", () => {
    const result = validateToolArgs("get_repo_file", { path: 42 });
    assert.strictEqual(result.ok, false);
  });

  test("binary extension .png is rejected", () => {
    const result = validateToolArgs("get_repo_file", { path: "assets/logo.png" });
    assert.strictEqual(result.ok, false);
  });

  test("binary extension .pdf is rejected", () => {
    const result = validateToolArgs("get_repo_file", { path: "docs/manual.pdf" });
    assert.strictEqual(result.ok, false);
  });

  test("binary extension .wasm is rejected", () => {
    const result = validateToolArgs("get_repo_file", { path: "lib/app.wasm" });
    assert.strictEqual(result.ok, false);
  });

  test("normal .ts file is accepted", () => {
    const result = validateToolArgs("get_repo_file", { path: "app/lib/index.ts" });
    assert.strictEqual(result.ok, true);
  });

  test("nested valid path with no traversal is accepted", () => {
    const result = validateToolArgs("get_repo_file", { path: "src/utils/helpers.js" });
    assert.strictEqual(result.ok, true);
  });
});

// ---------------------------------------------------------------------------
// search_reporadar
// ---------------------------------------------------------------------------

describe("validateToolArgs - search_reporadar", () => {
  test("query + limit 5 is accepted", () => {
    const result = validateToolArgs("search_reporadar", { query: "react", limit: 5 });
    assert.strictEqual(result.ok, true);
  });

  test("limit 999 is clamped to <= 10", () => {
    const result = validateToolArgs("search_reporadar", { limit: 999 });
    assert.strictEqual(result.ok, true);
    assert.ok(result.args !== undefined, "args should be present");
    assert.ok(
      result.args.limit <= 10,
      `limit should be clamped to <= 10, got ${result.args?.limit}`
    );
  });

  test("limit 0 is clamped to >= 1", () => {
    const result = validateToolArgs("search_reporadar", { limit: 0 });
    assert.strictEqual(result.ok, true);
    assert.ok(result.args !== undefined);
    assert.ok(
      result.args.limit >= 1,
      `limit should be clamped to >= 1, got ${result.args?.limit}`
    );
  });

  test("omitting all args is accepted (all optional)", () => {
    const result = validateToolArgs("search_reporadar", {});
    assert.strictEqual(result.ok, true);
  });

  test("topic-only call is accepted", () => {
    const result = validateToolArgs("search_reporadar", { topic: "cloudflare" });
    assert.strictEqual(result.ok, true);
  });
});

// ---------------------------------------------------------------------------
// unknown tool
// ---------------------------------------------------------------------------

describe("validateToolArgs - unknown tool", () => {
  test("unknown tool name is rejected", () => {
    const result = validateToolArgs("drop_table", { table: "users" });
    assert.strictEqual(result.ok, false);
  });

  test("empty tool name is rejected", () => {
    const result = validateToolArgs("", {});
    assert.strictEqual(result.ok, false);
  });
});
