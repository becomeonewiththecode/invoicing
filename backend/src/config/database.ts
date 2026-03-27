import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/** Ensures columns exist on DBs created before they were added to schema.sql (migrations not run). */
export async function ensureSchema(): Promise<void> {
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS discount_code VARCHAR(50)');
  await pool.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS business_email VARCHAR(255)');
  await pool.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE');
  await pool.query("ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'cancelled'");
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS payable_text TEXT');
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'");

  // Admin tables (idempotent — safe to run on every startup)
  await pool.query(`CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_admin_reply BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS content_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL,
    content_snippet TEXT NOT NULL,
    reason VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    is_automated BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS backup_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    retention_days INTEGER NOT NULL DEFAULT 30,
    max_snapshots INTEGER NOT NULL DEFAULT 10,
    is_enabled BOOLEAN DEFAULT TRUE,
    cron_expression VARCHAR(50) DEFAULT '0 2 * * *',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(10) NOT NULL DEFAULT 'info',
    source VARCHAR(100) NOT NULL,
    method VARCHAR(10),
    path TEXT,
    status_code INTEGER,
    response_time_ms INTEGER,
    ip VARCHAR(45),
    user_id UUID,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS rate_limit_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_pattern VARCHAR(255) NOT NULL UNIQUE,
    window_ms INTEGER NOT NULL DEFAULT 60000,
    max_requests INTEGER NOT NULL DEFAULT 100,
    is_enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS rate_limit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip VARCHAR(45) NOT NULL,
    path TEXT NOT NULL,
    was_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  // Projects table (client-scoped)
  await pool.query(`CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'not_started',
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    external_link TEXT,
    external_link_description TEXT,
    budget DECIMAL(12, 2),
    hours DECIMAL(12, 2),
    hours_is_maximum BOOLEAN NOT NULL DEFAULT FALSE,
    dependencies TEXT,
    milestones JSONB DEFAULT '[]',
    team_members TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)');

  await pool.query(`CREATE TABLE IF NOT EXISTS project_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_project_attachments_project_id ON project_attachments(project_id)');

  await pool.query(`CREATE TABLE IF NOT EXISTS project_external_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_project_external_links_project_id ON project_external_links(project_id)');

  await pool.query(`INSERT INTO project_external_links (project_id, url, description, sort_order)
    SELECT id, TRIM(external_link), NULLIF(TRIM(COALESCE(external_link_description, '')), ''), 0
    FROM projects
    WHERE external_link IS NOT NULL AND TRIM(external_link) <> ''
    AND NOT EXISTS (SELECT 1 FROM project_external_links e WHERE e.project_id = projects.id)`);

  await pool.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id UUID');
  await pool.query(`DO $$ BEGIN
    ALTER TABLE invoices ADD CONSTRAINT invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON invoices(project_id)');

  await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS external_link_description TEXT');
  await pool.query('ALTER TABLE projects ADD COLUMN IF NOT EXISTS hours DECIMAL(12, 2)');
  await pool.query(
    'ALTER TABLE projects ADD COLUMN IF NOT EXISTS hours_is_maximum BOOLEAN NOT NULL DEFAULT FALSE'
  );

  await pool.query(
    'ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN NOT NULL DEFAULT FALSE'
  );
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_login_email VARCHAR(255) UNIQUE');
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token VARCHAR(64) UNIQUE');
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_password_hash VARCHAR(255)');
  await pool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_totp_secret VARCHAR(64)');
  await pool.query(
    'ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_totp_enabled BOOLEAN NOT NULL DEFAULT FALSE'
  );

  // Seed default admin user if configured and not already present
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await pool.query(
        "INSERT INTO users (email, password_hash, business_name, role) VALUES ($1, $2, 'Admin', 'admin')",
        [adminEmail, hash]
      );
      console.log(`Default admin user created: ${adminEmail}`);
    }
  }
}

export default pool;
