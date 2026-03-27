-- Rate limit configuration and analytics
CREATE TABLE IF NOT EXISTS rate_limit_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_pattern VARCHAR(255) NOT NULL UNIQUE,
  window_ms INTEGER NOT NULL DEFAULT 60000,
  max_requests INTEGER NOT NULL DEFAULT 100,
  is_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip VARCHAR(45) NOT NULL,
  path TEXT NOT NULL,
  was_blocked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created_at ON rate_limit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_ip ON rate_limit_events(ip);
