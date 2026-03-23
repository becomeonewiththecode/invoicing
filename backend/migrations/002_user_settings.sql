-- Run once on existing databases:
--   psql $DATABASE_URL -f backend/migrations/002_user_settings.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS default_hourly_rate DECIMAL(12, 2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_tax_rate DECIMAL(5, 2) DEFAULT 0;
UPDATE users SET default_tax_rate = 0 WHERE default_tax_rate IS NULL;
ALTER TABLE users ALTER COLUMN default_tax_rate SET NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_website VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_fax VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url TEXT;
