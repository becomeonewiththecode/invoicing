-- Company email for receiving invoice copy emails (optional; falls back to account email)
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_email VARCHAR(255);
