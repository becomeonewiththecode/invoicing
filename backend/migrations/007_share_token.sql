-- Shareable invoice links: a unique token that allows public read-only access
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS share_token VARCHAR(64) UNIQUE;
