/**
 * repochat.ratelimit.test.mjs - unit tests for checkRateLimit
 *
 * Tests: checkRateLimit (per-IP fixed-window rate limiter)
 *
 * PURE tests - no network, no I/O.
 * Run: node --test tests/repochat.ratelimit.test.mjs
 *
 * TDD: written BEFORE the implementation (RED phase).
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { checkRateLimit, __resetRateLimit } from "../app/lib/repoChatPrompt.ts";

const RATE_LIMIT_MAX = 20;

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

describe("checkRateLimit", () => {
  test("first 20 calls for one IP return true; 21st returns false", () => {
    __resetRateLimit();
    const ip = "1.2.3.4";

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const ok = checkRateLimit(ip);
      assert.strictEqual(ok, true, `call ${i + 1} should be allowed`);
    }

    const blocked = checkRateLimit(ip);
    assert.strictEqual(blocked, false, "21st call must be blocked");
  });

  test("a different IP is unaffected by another IP's limit", () => {
    __resetRateLimit();
    const ipA = "10.0.0.1";
    const ipB = "10.0.0.2";

    // Exhaust ipA
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit(ipA);
    }
    assert.strictEqual(checkRateLimit(ipA), false, "ipA must be blocked");

    // ipB must still be allowed
    assert.strictEqual(checkRateLimit(ipB), true, "ipB must still be allowed");
  });

  test("fresh IP is always allowed on first call", () => {
    __resetRateLimit();
    assert.strictEqual(checkRateLimit("192.168.1.100"), true);
  });
});
