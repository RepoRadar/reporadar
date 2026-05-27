/**
 * _localD1.mjs — local-D1 test helper (not a test file itself)
 *
 * Shells out to wrangler to drive the local miniflare D1 so unit/integration tests
 * can seed fixtures and assert DB state without a full Worker deploy.
 *
 * Usage in test files:
 *   import { applyMigrations, execLocal, queryLocal } from "./_localD1.mjs";
 */

import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve repo root so wrangler commands work regardless of cwd when tests run.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const WRANGLER = "npx wrangler";
const DB_NAME = "reporadar";

/** Run a wrangler command from the repo root with a 60s timeout. */
function wranglerCmd(args, opts = {}) {
  return execSync(`${WRANGLER} ${args}`, {
    cwd: REPO_ROOT,
    timeout: 60_000,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...opts,
  });
}

/**
 * Apply all migrations in migrations/ to the LOCAL miniflare D1.
 * Equivalent to: wrangler d1 migrations apply reporadar --local
 */
export function applyMigrations() {
  wranglerCmd(`d1 migrations apply ${DB_NAME} --local`);
}

/**
 * Execute a raw SQL command against the LOCAL D1 (no return value).
 * Useful for seeding fixtures, e.g.:
 *   execLocal("INSERT INTO subscriptions (...) VALUES (...)");
 *
 * @param {string} sql
 */
export function execLocal(sql) {
  // Escape any double-quotes inside the SQL for the shell command string.
  const escaped = sql.replace(/"/g, '\\"');
  wranglerCmd(`d1 execute ${DB_NAME} --local --command "${escaped}"`);
}

/**
 * Execute a SQL query against the LOCAL D1 and return the parsed rows.
 * Uses --json so the result is machine-readable.
 *
 * @param {string} sql
 * @returns {Array<Record<string, unknown>>} rows from the first result set
 */
export function queryLocal(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  const raw = wranglerCmd(
    `d1 execute ${DB_NAME} --local --json --command "${escaped}"`
  );
  // wrangler --json returns an array of result sets; we want the first set's results.
  const parsed = JSON.parse(raw);
  // Shape: [{ results: [...], success: true, ... }]
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed[0].results ?? [];
  }
  return [];
}
