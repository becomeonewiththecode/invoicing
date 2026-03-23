-- Optional default discount code per client (must match an active row in discount_codes).
--   psql $DATABASE_URL -f backend/migrations/004_client_discount_code.sql

ALTER TABLE clients ADD COLUMN IF NOT EXISTS discount_code VARCHAR(50);
