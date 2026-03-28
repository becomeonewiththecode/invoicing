import { randomUUID } from 'crypto';
import pool, { ensureSchema } from '../config/database';
import redis from '../config/redis';

/** Current format written by export; import still accepts v1. */
export const DATA_EXPORT_VERSION = 2 as const;

export type DataExportVersion = 1 | typeof DATA_EXPORT_VERSION;

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
  /** Present in exports v1; older backups may omit */
  payable_text?: string | null;
  client_counter: number;
};

export type InvoiceExportRow = Record<string, unknown> & {
  items: Record<string, unknown>[];
  payment_reminders: Record<string, unknown>[];
};

export type DataExportV1 = {
  version: 1;
  exportedAt: string;
  profile: ExportedProfile;
  clients: Record<string, unknown>[];
  discount_codes: Record<string, unknown>[];
  invoices: InvoiceExportRow[];
};

export type DataExportV2 = {
  version: typeof DATA_EXPORT_VERSION;
  exportedAt: string;
  profile: ExportedProfile;
  clients: Record<string, unknown>[];
  discount_codes: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  project_external_links: Record<string, unknown>[];
  invoices: InvoiceExportRow[];
};

/** Older v2 JSON files may still list legacy `project_attachments` (URLs in file_path). */
export type DataExportV2ImportFile = DataExportV2 & {
  project_attachments?: Record<string, unknown>[];
};

export type DataExportPayload = DataExportV1 | DataExportV2;

const LEGACY_ATTACHMENT_URL = /^https?:\/\//i;

/**
 * Converts legacy backup rows (project_attachments with http(s) file_path) into project_external_links.
 * Current exports only include project_external_links.
 */
export function normalizeV2ImportData(raw: DataExportV2ImportFile): DataExportV2 {
  const links = [...raw.project_external_links];
  const seenPair = new Set<string>();
  for (const l of links) {
    seenPair.add(`${String(l.project_id)}|${String(l.url).trim()}`);
  }
  const maxOrder = new Map<string, number>();
  for (const l of links) {
    const pid = String(l.project_id);
    const so = Number(l.sort_order ?? 0);
    maxOrder.set(pid, Math.max(maxOrder.get(pid) ?? -1, so));
  }
  for (const a of raw.project_attachments ?? []) {
    const url = String(a.file_path ?? '').trim();
    if (!LEGACY_ATTACHMENT_URL.test(url)) continue;
    const pid = String(a.project_id);
    const pair = `${pid}|${url}`;
    if (seenPair.has(pair)) continue;
    const nextOrder = (maxOrder.get(pid) ?? -1) + 1;
    maxOrder.set(pid, nextOrder);
    seenPair.add(pair);
    const fn = a.file_name != null ? String(a.file_name).trim() : '';
    links.push({
      id: randomUUID(),
      project_id: pid,
      url,
      description: fn || null,
      sort_order: nextOrder,
      created_at: a.created_at ?? new Date().toISOString(),
    });
  }
  return {
    version: raw.version,
    exportedAt: raw.exportedAt,
    profile: raw.profile,
    clients: raw.clients,
    discount_codes: raw.discount_codes,
    projects: raw.projects,
    project_external_links: links,
    invoices: raw.invoices,
  };
}

function isV2(data: DataExportPayload): data is DataExportV2 {
  return data.version === DATA_EXPORT_VERSION;
}

export async function exportUserData(userId: string): Promise<DataExportV2> {
  const client = await pool.connect();
  try {
    const u = await client.query(
      `SELECT business_name, business_address, business_phone, business_email, tax_id,
              default_hourly_rate, default_tax_rate, business_website, business_fax, logo_url, payable_text, client_counter
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
      payable_text: row.payable_text != null ? String(row.payable_text) : null,
      client_counter: Number(row.client_counter) || 0,
    };

    const clients = (await client.query('SELECT * FROM clients WHERE user_id = $1 ORDER BY created_at', [userId]))
      .rows;
    const discount_codes = (
      await client.query('SELECT * FROM discount_codes WHERE user_id = $1 ORDER BY created_at', [userId])
    ).rows;

    const projects = (await client.query('SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at', [userId]))
      .rows;
    const projectIds = projects.map((p) => p.id);

    const project_external_links =
      projectIds.length > 0
        ? (
            await client.query(
              'SELECT * FROM project_external_links WHERE project_id = ANY($1) ORDER BY sort_order, created_at',
              [projectIds]
            )
          ).rows
        : [];

    const invRows = (
      await client.query('SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at', [userId])
    ).rows;

    const invoiceIds = invRows.map((r) => r.id);

    const allItems =
      invoiceIds.length > 0
        ? (
            await client.query(
              'SELECT * FROM invoice_items WHERE invoice_id = ANY($1) ORDER BY sort_order, created_at',
              [invoiceIds]
            )
          ).rows
        : [];
    const allReminders =
      invoiceIds.length > 0
        ? (
            await client.query(
              'SELECT * FROM payment_reminders WHERE invoice_id = ANY($1) ORDER BY sent_at',
              [invoiceIds]
            )
          ).rows
        : [];

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

    const invoices: InvoiceExportRow[] = invRows.map((inv) => ({
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
      projects,
      project_external_links,
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

function normTextArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

/** JSONB column: accept object/array from DB or parsed backup, or a JSON string. */
function milestonesToJsonbString(v: unknown): string {
  if (v == null) return '[]';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

/**
 * Replaces clients, projects (v2), invoices (and line items / reminders), and discount codes
 * for the user with data from the export. v1 omits projects and clears invoice project_id on insert.
 * Updates profile fields from export.profile. Does not change password or email.
 */
export async function importUserDataReplace(userId: string, data: DataExportPayload): Promise<void> {
  await ensureSchema();
  const normalized: DataExportPayload = isV2(data)
    ? normalizeV2ImportData(data as DataExportV2ImportFile)
    : data;
  const v2 = isV2(normalized);
  const projects = v2 ? normalized.projects : [];
  const projectExternalLinks = v2 ? normalized.project_external_links : [];

  const c = await pool.connect();
  try {
    await c.query('BEGIN');

    await c.query('DELETE FROM invoices WHERE user_id = $1', [userId]);
    await c.query('DELETE FROM clients WHERE user_id = $1', [userId]);
    await c.query('DELETE FROM discount_codes WHERE user_id = $1', [userId]);

    const backupClientIds = normalized.clients.map((r) => r.id as string);
    const backupDiscountIds = normalized.discount_codes.map((r) => r.id as string);
    const backupInvoiceIds = normalized.invoices.map((r) => r.id as string);
    const backupProjectIds = projects.map((r) => r.id as string);

    if (backupInvoiceIds.length > 0) {
      await c.query('DELETE FROM invoices WHERE id = ANY($1)', [backupInvoiceIds]);
    }
    if (backupClientIds.length > 0) {
      await c.query('DELETE FROM invoices WHERE client_id = ANY($1)', [backupClientIds]);
      await c.query('DELETE FROM clients WHERE id = ANY($1)', [backupClientIds]);
    }
    if (backupDiscountIds.length > 0) {
      await c.query('DELETE FROM discount_codes WHERE id = ANY($1)', [backupDiscountIds]);
    }
    if (backupProjectIds.length > 0) {
      await c.query('DELETE FROM project_external_links WHERE project_id = ANY($1)', [backupProjectIds]);
      await c.query('DELETE FROM project_attachments WHERE project_id = ANY($1)', [backupProjectIds]);
      await c.query('DELETE FROM projects WHERE id = ANY($1)', [backupProjectIds]);
    }

    const p = normalized.profile;
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
        payable_text = $11,
        client_counter = $12,
        updated_at = NOW()
      WHERE id = $13`,
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
        p.payable_text ?? null,
        p.client_counter,
        userId,
      ]
    );

    for (const row of normalized.clients) {
      await c.query(
        `INSERT INTO clients (
          id, user_id, customer_number, name, email, phone, company, address, notes, discount_code,
          portal_enabled, portal_login_email, portal_token, portal_password_hash, portal_totp_secret, portal_totp_enabled,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
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
          row.portal_enabled ?? false,
          row.portal_login_email ?? null,
          row.portal_token ?? null,
          row.portal_password_hash ?? null,
          row.portal_totp_secret ?? null,
          row.portal_totp_enabled ?? false,
          row.created_at,
          row.updated_at,
        ]
      );
    }

    if (v2) {
      for (const row of projects) {
        await c.query(
          `INSERT INTO projects (
            id, client_id, user_id, name, description, start_date, end_date, status, priority,
            external_link, external_link_description, budget, hours, hours_is_maximum, dependencies,
            milestones, team_members, tags, notes, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::text[],$18::text[],$19,$20,$21
          )`,
          [
            row.id,
            row.client_id,
            userId,
            row.name,
            row.description ?? null,
            row.start_date ?? null,
            row.end_date ?? null,
            row.status ?? 'not_started',
            row.priority ?? 'medium',
            row.external_link ?? null,
            row.external_link_description ?? null,
            row.budget ?? null,
            row.hours ?? null,
            row.hours_is_maximum ?? false,
            row.dependencies ?? null,
            milestonesToJsonbString(row.milestones),
            normTextArray(row.team_members),
            normTextArray(row.tags),
            row.notes ?? null,
            row.created_at,
            row.updated_at,
          ]
        );
      }

      for (const row of projectExternalLinks) {
        await c.query(
          `INSERT INTO project_external_links (
            id, project_id, url, description, sort_order, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            row.id,
            row.project_id,
            row.url,
            row.description ?? null,
            row.sort_order ?? 0,
            row.created_at,
          ]
        );
      }
    }

    for (const row of normalized.discount_codes) {
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

    for (const inv of normalized.invoices) {
      const st = normStatus(String(inv.status));
      const projectId = v2 && inv.project_id != null ? inv.project_id : null;
      await c.query(
        `INSERT INTO invoices (
          id, user_id, client_id, invoice_number, status, issue_date, due_date,
          subtotal, tax_rate, tax_amount, discount_code, discount_amount, total, notes,
          is_recurring, recurrence_interval, next_recurrence_date, sent_at, share_token, project_id,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5::invoice_status,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
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
          projectId,
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
