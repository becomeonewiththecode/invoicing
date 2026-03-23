-- Per-user sequential customer numbers (C-00001, …). Run on existing DBs:
--   psql $DATABASE_URL -f backend/migrations/003_client_customer_number.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS client_counter INTEGER NOT NULL DEFAULT 0;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS customer_number VARCHAR(20);

WITH numbered AS (
  SELECT id, user_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM clients
  WHERE customer_number IS NULL
)
UPDATE clients c
SET customer_number = 'C-' || lpad(n.rn::text, 5, '0')
FROM numbered n
WHERE c.id = n.id;

UPDATE users u
SET client_counter = COALESCE(
  (SELECT COUNT(*)::integer FROM clients WHERE user_id = u.id),
  0
);

ALTER TABLE clients ALTER COLUMN customer_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_user_customer_number ON clients (user_id, customer_number);
