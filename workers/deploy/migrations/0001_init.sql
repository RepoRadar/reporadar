CREATE TABLE IF NOT EXISTS deploys (
  slug TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  hint TEXT,
  form_factor TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deploys_repo ON deploys(repo);
CREATE INDEX IF NOT EXISTS idx_deploys_created_at ON deploys(created_at);
