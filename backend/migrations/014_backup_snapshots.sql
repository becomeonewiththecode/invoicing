-- Automated backup system
CREATE TABLE IF NOT EXISTS backup_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  is_automated BOOLEAN DEFAULT FALSE,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_snapshots_user_id ON backup_snapshots(user_id);

CREATE TABLE IF NOT EXISTS backup_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  retention_days INTEGER NOT NULL DEFAULT 30,
  max_snapshots INTEGER NOT NULL DEFAULT 10,
  is_enabled BOOLEAN DEFAULT TRUE,
  cron_expression VARCHAR(50) DEFAULT '0 2 * * *',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
