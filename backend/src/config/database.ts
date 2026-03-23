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
}

export default pool;
