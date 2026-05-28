/**
 * repochat.readme-urls.test.mjs — resolveReadmeUrl()
 *
 * Regression: /qa (2026-05-28) found that a README with a relative image path
 * (NousResearch/hermes-agent's `assets/banner.png`) 404'd because it resolved
 * against reporadar.io/chat/owner/... instead of GitHub. resolveReadmeUrl
 * rewrites relative paths to GitHub; absolute/anchor/data/mailto pass through.
 *
 * Pure test — no D1, no network, no browser.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { resolveReadmeUrl } from "../app/lib/repoContext.ts";

const O = "NousResearch";
const R = "hermes-agent";
const RAW = `https://raw.githubusercontent.com/${O}/${R}/HEAD`;
const BLOB = `https://github.com/${O}/${R}/blob/HEAD`;

describe("resolveReadmeUrl", () => {
  test("relative image src -> raw.githubusercontent (fixes the 404)", () => {
    assert.equal(resolveReadmeUrl(O, R, "assets/banner.png", "src"), `${RAW}/assets/banner.png`);
  });

  test("relative link href -> github blob", () => {
    assert.equal(resolveReadmeUrl(O, R, "docs/security.md", "href"), `${BLOB}/docs/security.md`);
  });

  test("strips leading ./ and /", () => {
    assert.equal(resolveReadmeUrl(O, R, "./assets/a.png", "src"), `${RAW}/assets/a.png`);
    assert.equal(resolveReadmeUrl(O, R, "/assets/b.png", "src"), `${RAW}/assets/b.png`);
  });

  test("absolute http(s) URLs pass through unchanged (shields.io badges)", () => {
    const badge = "https://img.shields.io/github/stars/x/y";
    assert.equal(resolveReadmeUrl(O, R, badge, "src"), badge);
    assert.equal(resolveReadmeUrl(O, R, "http://example.com/x", "href"), "http://example.com/x");
  });

  test("protocol-relative, anchor, data:, mailto: pass through unchanged", () => {
    assert.equal(resolveReadmeUrl(O, R, "//cdn.example.com/x.png", "src"), "//cdn.example.com/x.png");
    assert.equal(resolveReadmeUrl(O, R, "#installation", "href"), "#installation");
    assert.equal(resolveReadmeUrl(O, R, "data:image/png;base64,AAAA", "src"), "data:image/png;base64,AAAA");
    assert.equal(resolveReadmeUrl(O, R, "mailto:hi@example.com", "href"), "mailto:hi@example.com");
  });

  test("empty url is returned as-is", () => {
    assert.equal(resolveReadmeUrl(O, R, "", "src"), "");
  });
});
