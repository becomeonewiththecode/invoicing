import { Pool } from 'pg';
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
}

export default pool;
