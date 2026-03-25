-- Add 'cancelled' status for soft-deleting sent invoices
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'cancelled';
