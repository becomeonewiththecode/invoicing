-- Footer text shown at the bottom of invoices (PDF, shared view, email)
ALTER TABLE users ADD COLUMN IF NOT EXISTS payable_text TEXT;
