-- migrations/0002_suggestions.sql
-- Public suggestions voting board (suggestions-board feature)
-- Applied: wrangler d1 migrations apply reporadar --local   (tests)
--          wrangler d1 migrations apply reporadar --remote  (owner-gated deploy step)
-- Additive — does not touch existing tables (subscriptions, repo_snapshots, deploys).

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting', -- 'awaiting' | 'accepted' | 'declined'
  eta TEXT,
  github_issue_url TEXT,
  votes_up INTEGER NOT NULL DEFAULT 0,
  votes_down INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_suggestions_hidden_status ON suggestions(hidden, status);

CREATE TABLE IF NOT EXISTS suggestion_votes (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'up' | 'down'
  created_at TEXT NOT NULL,
  UNIQUE(suggestion_id, ip_hash)
);
CREATE INDEX IF NOT EXISTS idx_suggestion_votes_ip_time ON suggestion_votes(ip_hash, created_at);
