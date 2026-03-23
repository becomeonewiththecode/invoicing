-- Add sent_at; introduce "late" status (replaces "overdue" in app); migrate data.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TYPE invoice_status ADD VALUE 'late';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE invoices SET status = 'late'::invoice_status WHERE status::text = 'overdue';

UPDATE invoices
SET sent_at = COALESCE(updated_at, created_at)
WHERE sent_at IS NULL AND status::text IN ('sent', 'paid', 'late');
