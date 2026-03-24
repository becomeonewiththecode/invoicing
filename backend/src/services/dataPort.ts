import pool, { ensureSchema } from '../config/database';
import redis from '../config/redis';

export const DATA_EXPORT_VERSION = 1 as const;

async function invalidateRevenueCache(userId: string) {
  try {
    const keys = await redis.keys(`revenue:${userId}:*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    /* ignore if Redis unavailable */
  }
}

/** Snapshot of user profile fields (no password, email). */
export type ExportedProfile = {
  business_name: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  tax_id: string | null;
  default_hourly_rate: string | null;
  default_tax_rate: string | null;
  business_website: string | null;
  business_fax: string | null;
  logo_url: string | null;
  client_counter: number;
};

export type DataExportV1 = {
  version: typeof DATA_EXPORT_VERSION;
  exportedAt: string;
  profile: ExportedProfile;
  clients: Record<string, unknown>[];
  discount_codes: Record<string, unknown>[];
  invoices: Array<
    Record<string, unknown> & {
      items: Record<string, unknown>[];
      payment_reminders: Record<string, unknown>[];
    }
  >;
};

export async function exportUserData(userId: string): Promise<DataExportV1> {
  const client = await pool.connect();
  try {
    const u = await client.query(
      `SELECT business_name, business_address, business_phone, business_email, tax_id,
              default_hourly_rate, default_tax_rate, business_website, business_fax, logo_url, client_counter
       FROM users WHERE id = $1`,
      [userId]
    );
    if (u.rows.length === 0) throw new Error('User not found');
    const row = u.rows[0];
    const profile: ExportedProfile = {
      business_name: row.business_name,
      business_address: row.business_address,
      business_phone: row.business_phone,
      business_email: row.business_email,
      tax_id: row.tax_id,
      default_hourly_rate: row.default_hourly_rate != null ? String(row.default_hourly_rate) : null,
      default_tax_rate: row.default_tax_rate != null ? String(row.default_tax_rate) : null,
      business_website: row.business_website,
      business_fax: row.business_fax,
      logo_url: row.logo_url,
      client_counter: Number(row.client_counter) || 0,
    };

    const clients = (await client.query('SELECT * FROM clients WHERE user_id = $1 ORDER BY created_at', [userId]))
      .rows;
    const discount_codes = (
      await client.query('SELECT * FROM discount_codes WHERE user_id = $1 ORDER BY created_at', [userId])
    ).rows;

    const invRows = (
      await client.query('SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at', [userId])
    ).rows;

    const invoiceIds = invRows.map((r) => r.id);

    // Batch-fetch items and reminders for all invoices in two queries instead of 2N
    const allItems = invoiceIds.length > 0
      ? (await client.query(
          'SELECT * FROM invoice_items WHERE invoice_id = ANY($1) ORDER BY sort_order, created_at',
          [invoiceIds]
        )).rows
      : [];
    const allReminders = invoiceIds.length > 0
      ? (await client.query(
          'SELECT * FROM payment_reminders WHERE invoice_id = ANY($1) ORDER BY sent_at',
          [invoiceIds]
        )).rows
      : [];

    // Group by invoice_id
    const itemsByInvoice = new Map<string, Record<string, unknown>[]>();
    for (const it of allItems) {
      const list = itemsByInvoice.get(it.invoice_id) ?? [];
      list.push(it);
      itemsByInvoice.set(it.invoice_id, list);
    }
    const remindersByInvoice = new Map<string, Record<string, unknown>[]>();
    for (const pr of allReminders) {
      const list = remindersByInvoice.get(pr.invoice_id) ?? [];
      list.push(pr);
      remindersByInvoice.set(pr.invoice_id, list);
    }

    const invoices: DataExportV1['invoices'] = invRows.map((inv) => ({
      ...inv,
      items: itemsByInvoice.get(inv.id) ?? [],
      payment_reminders: remindersByInvoice.get(inv.id) ?? [],
    }));

    return {
      version: DATA_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
      clients,
      discount_codes,
      invoices,
    };
  } finally {
    client.release();
  }
}

const VALID_STATUSES = new Set(['draft', 'sent', 'paid', 'late', 'cancelled']);

function normStatus(s: string): string {
  if (s === 'overdue') return 'late';
  if (!VALID_STATUSES.has(s)) {
    throw new Error(`Unknown invoice status in backup: "${s}"`);
  }
  return s;
}

/**
 * Replaces all clients, invoices (and line items / reminders), and discount codes for the user
 * with data from the export. Updates profile fields from export.profile.
 * Does not change password or email.
 */
export async function importUserDataReplace(userId: string, data: DataExportV1): Promise<void> {
  await ensureSchema();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    await c.query('DELETE FROM invoices WHERE user_id = $1', [userId]);
    await c.query('DELETE FROM clients WHERE user_id = $1', [userId]);
    await c.query('DELETE FROM discount_codes WHERE user_id = $1', [userId]);

    const p = data.profile;
    await c.query(
      `UPDATE users SET
        business_name = $1,
        business_address = $2,
        business_phone = $3,
        business_email = $4,
        tax_id = $5,
        default_hourly_rate = $6,
        default_tax_rate = $7,
        business_website = $8,
        business_fax = $9,
        logo_url = $10,
        client_counter = $11,
        updated_at = NOW()
      WHERE id = $12`,
      [
        p.business_name,
        p.business_address,
        p.business_phone,
        p.business_email,
        p.tax_id,
        p.default_hourly_rate != null ? Number(p.default_hourly_rate) : null,
        p.default_tax_rate != null ? Number(p.default_tax_rate) : 0,
        p.business_website,
        p.business_fax,
        p.logo_url,
        p.client_counter,
        userId,
      ]
    );

    for (const row of data.clients) {
      await c.query(
        `INSERT INTO clients (
          id, user_id, customer_number, name, email, phone, company, address, notes, discount_code, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          row.id,
          userId,
          row.customer_number,
          row.name,
          row.email,
          row.phone ?? null,
          row.company ?? null,
          row.address ?? null,
          row.notes ?? null,
          row.discount_code ?? null,
          row.created_at,
          row.updated_at,
        ]
      );
    }

    for (const row of data.discount_codes) {
      await c.query(
        `INSERT INTO discount_codes (
          id, user_id, code, description, type, value, is_active, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          row.id,
          userId,
          row.code,
          row.description ?? null,
          row.type,
          row.value,
          row.is_active ?? true,
          row.created_at,
        ]
      );
    }

    for (const inv of data.invoices) {
      const st = normStatus(String(inv.status));
      await c.query(
        `INSERT INTO invoices (
          id, user_id, client_id, invoice_number, status, issue_date, due_date,
          subtotal, tax_rate, tax_amount, discount_code, discount_amount, total, notes,
          is_recurring, recurrence_interval, next_recurrence_date, sent_at, share_token, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5::invoice_status,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [
          inv.id,
          userId,
          inv.client_id,
          inv.invoice_number,
          st,
          inv.issue_date,
          inv.due_date,
          inv.subtotal,
          inv.tax_rate,
          inv.tax_amount,
          inv.discount_code ?? null,
          inv.discount_amount,
          inv.total,
          inv.notes ?? null,
          inv.is_recurring ?? false,
          inv.recurrence_interval ?? null,
          inv.next_recurrence_date ?? null,
          inv.sent_at ?? null,
          inv.share_token ?? null,
          inv.created_at,
          inv.updated_at,
        ]
      );

      for (const it of inv.items || []) {
        await c.query(
          `INSERT INTO invoice_items (
            id, invoice_id, description, quantity, unit_price, amount, sort_order, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            it.id,
            inv.id,
            it.description,
            it.quantity,
            it.unit_price,
            it.amount,
            it.sort_order ?? 0,
            it.created_at,
          ]
        );
      }

      for (const pr of inv.payment_reminders || []) {
        await c.query(
          `INSERT INTO payment_reminders (id, invoice_id, sent_at, reminder_type) VALUES ($1,$2,$3,$4)`,
          [pr.id, inv.id, pr.sent_at, pr.reminder_type ?? 'overdue']
        );
      }
    }

    await c.query('COMMIT');
    await invalidateRevenueCache(userId);
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
