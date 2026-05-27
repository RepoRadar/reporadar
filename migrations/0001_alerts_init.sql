-- migrations/0001_alerts_init.sql
-- Threshold-alerts schema (Phase 3, ALRT-01)
-- Applied: wrangler d1 migrations apply reporadar --local   (tests)
--          wrangler d1 migrations apply reporadar --remote  (owner-gated deploy step)
-- Safe alongside the existing `deploys` table (workers/deploy) — additive only.

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  kind TEXT NOT NULL,            -- 'topic' | 'query'
  term TEXT NOT NULL,
  metric TEXT NOT NULL,          -- 'stars_pct' | 'stars_abs' | 'velocity'
  threshold REAL NOT NULL,
  window_days INTEGER NOT NULL,
  digest TEXT,                   -- pref stored; v1 sends instant (D-09)
  created_at TEXT NOT NULL,
  verified_at TEXT,              -- NULL until double opt-in confirmed (D-07)
  last_notified_at TEXT,         -- crossing-dedupe timestamp (Pitfall 1)
  verify_token TEXT NOT NULL,
  unsub_token TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subs_term ON subscriptions(term);
CREATE INDEX IF NOT EXISTS idx_subs_verify_token ON subscriptions(verify_token);
CREATE INDEX IF NOT EXISTS idx_subs_unsub_token ON subscriptions(unsub_token);

CREATE TABLE IF NOT EXISTS repo_snapshots (
  term TEXT NOT NULL,
  full_name TEXT NOT NULL,
  stars INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY (term, full_name, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_term_time ON repo_snapshots(term, captured_at);
