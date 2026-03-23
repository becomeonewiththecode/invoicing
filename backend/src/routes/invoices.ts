import crypto from 'crypto';
import { Router, Response } from 'express';
import pool from '../config/database';
import redis from '../config/redis';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createInvoiceSchema,
  updateInvoiceStatusSchema,
  paginationSchema,
} from '../models/validation';
import { rateLimit } from '../middleware/rateLimit';
import { isSmtpConfigured, sendMail } from '../services/mail';
import {
  buildInvoiceEmailHtml,
  buildInvoiceEmailText,
  type InvoiceEmailRow,
  type InvoiceItemEmailRow,
} from '../services/invoiceEmailHtml';

const router = Router();
router.use(authenticate);

async function generateInvoiceNumber(userId: string): Promise<string> {
  const result = await pool.query(
    "SELECT invoice_number FROM invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  if (result.rows.length === 0) return 'INV-0001';
  const last = result.rows[0].invoice_number;
  const num = parseInt(last.replace('INV-', '')) + 1;
  return `INV-${num.toString().padStart(4, '0')}`;
}

async function applyDiscount(userId: string, code: string, subtotal: number): Promise<number> {
  const result = await pool.query(
    'SELECT type, value FROM discount_codes WHERE user_id = $1 AND code = $2 AND is_active = true',
    [userId, code]
  );
  if (result.rows.length === 0) return 0;
  const discount = result.rows[0];
  if (discount.type === 'percent') {
    return (subtotal * discount.value) / 100;
  }
  return Math.min(discount.value, subtotal);
}

async function invalidateRevenueCache(userId: string) {
  const keys = await redis.keys(`revenue:${userId}:*`);
  if (keys.length > 0) await redis.del(...keys);
}

// List invoices (optional ?clientId= to filter by client)
router.get('/', validate(paginationSchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, clientId } = req.validatedQuery as {
      page: number;
      limit: number;
      clientId?: string;
    };
    const offset = (page - 1) * limit;

    if (clientId) {
      const check = await pool.query('SELECT 1 FROM clients WHERE id = $1 AND user_id = $2', [
        clientId,
        req.userId,
      ]);
      if (check.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }
    }

    const filterParam = clientId || null;

    const [invoices, countResult] = await Promise.all([
      pool.query(
        `SELECT i.*, c.name as client_name, c.email as client_email, c.company as client_company,
                c.customer_number as client_customer_number
         FROM invoices i JOIN clients c ON i.client_id = c.id
         WHERE i.user_id = $1 AND ($2::uuid IS NULL OR i.client_id = $2::uuid)
         ORDER BY i.created_at DESC LIMIT $3 OFFSET $4`,
        [req.userId, filterParam, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM invoices i
         WHERE i.user_id = $1 AND ($2::uuid IS NULL OR i.client_id = $2::uuid)`,
        [req.userId, filterParam]
      ),
    ]);

    res.json({
      data: invoices.rows,
      pagination: { page, limit, total: parseInt(countResult.rows[0].count) },
    });
  } catch (err) {
    console.error('List invoices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revenue stats (register before /:id so "stats" is not captured as an id)
router.get('/stats/revenue', async (req: AuthRequest, res: Response) => {
  try {
    const cacheKey = `revenue:${req.userId}:summary`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
         COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0) as total_revenue,
         COUNT(*) FILTER (WHERE status = 'late') as late_count,
         COALESCE(SUM(total) FILTER (WHERE status = 'late'), 0) as late_amount,
         COUNT(*) FILTER (WHERE status = 'sent') as pending_count,
         COALESCE(SUM(total) FILTER (WHERE status = 'sent'), 0) as pending_amount
       FROM invoices WHERE user_id = $1`,
      [req.userId]
    );

    const stats = result.rows[0];
    await redis.setex(cacheKey, 300, JSON.stringify(stats)); // Cache 5 minutes
    res.json(stats);
  } catch (err) {
    console.error('Revenue stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Invoice counts and totals by status for one client (register before /:id) */
router.get('/stats/by-client/:clientId', async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const check = await pool.query('SELECT 1 FROM clients WHERE id = $1 AND user_id = $2', [
      clientId,
      req.userId,
    ]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'draft')::text AS draft_count,
         COUNT(*) FILTER (WHERE status = 'sent')::text AS sent_count,
         COUNT(*) FILTER (WHERE status = 'paid')::text AS paid_count,
         COUNT(*) FILTER (WHERE status = 'late')::text AS late_count,
         COALESCE(SUM(total) FILTER (WHERE status = 'draft'), 0)::text AS draft_total,
         COALESCE(SUM(total) FILTER (WHERE status = 'sent'), 0)::text AS sent_total,
         COALESCE(SUM(total) FILTER (WHERE status = 'paid'), 0)::text AS paid_total,
         COALESCE(SUM(total) FILTER (WHERE status = 'late'), 0)::text AS late_total
       FROM invoices
       WHERE user_id = $1 AND client_id = $2`,
      [req.userId, clientId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Client invoice stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CSV export (register before /:id)
router.get('/export/csv', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT i.invoice_number, i.status, i.issue_date, i.due_date, i.subtotal, i.tax_amount, i.discount_amount, i.total,
              c.customer_number as client_customer_number, c.name as client_name
       FROM invoices i JOIN clients c ON i.client_id = c.id
       WHERE i.user_id = $1 ORDER BY i.issue_date DESC`,
      [req.userId]
    );

    const csvField = (v: unknown): string => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const headers =
      'Invoice Number,Customer #,Client,Status,Issue Date,Due Date,Subtotal,Tax,Discount,Total\n';
    const rows = result.rows
      .map(
        (r) =>
          [r.invoice_number, r.client_customer_number, r.client_name, r.status, r.issue_date, r.due_date, r.subtotal, r.tax_amount, r.discount_amount, r.total]
            .map(csvField)
            .join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.csv"');
    res.send(headers + rows);
  } catch (err) {
    console.error('CSV export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Generate a shareable link token for an invoice. */
router.post('/:id/share', async (req: AuthRequest, res: Response) => {
  try {
    const existing = await pool.query(
      'SELECT share_token FROM invoices WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    // Return existing token if already shared
    if (existing.rows[0].share_token) {
      return res.json({ token: existing.rows[0].share_token });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'UPDATE invoices SET share_token = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [token, req.params.id, req.userId]
    );
    res.json({ token });
  } catch (err) {
    console.error('Create share link error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Revoke the shareable link for an invoice. */
router.delete('/:id/share', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'UPDATE invoices SET share_token = NULL, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Revoke share link error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Email invoice summary to the company address (business email or account email). */
router.post('/:id/send-to-company', rateLimit({ windowMs: 60_000, max: 5 }), async (req: AuthRequest, res: Response) => {
  try {
    if (!isSmtpConfigured()) {
      return res.status(503).json({
        error:
          'Email is not configured. Set SMTP_HOST (and typically SMTP_PORT, SMTP_USER, SMTP_PASS) on the server.',
      });
    }

    const userRow = await pool.query(
      'SELECT email, business_email FROM users WHERE id = $1',
      [req.userId]
    );
    if (userRow.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const to =
      (userRow.rows[0].business_email as string | null)?.trim() ||
      (userRow.rows[0].email as string)?.trim();
    if (!to) {
      return res.status(400).json({
        error: 'No company email on file. Add a company email in Settings or use your account email.',
      });
    }

    const [invoiceResult, itemsResult] = await Promise.all([
      pool.query(
        `SELECT i.*, c.name as client_name, c.email as client_email, c.company as client_company, c.address as client_address,
                c.customer_number as client_customer_number
         FROM invoices i JOIN clients c ON i.client_id = c.id
         WHERE i.id = $1 AND i.user_id = $2`,
        [req.params.id, req.userId]
      ),
      pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order', [req.params.id]),
    ]);

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const inv = invoiceResult.rows[0] as InvoiceEmailRow;
    const items = itemsResult.rows as InvoiceItemEmailRow[];
    const subject = `Invoice ${inv.invoice_number} — ${inv.client_name ?? 'Client'}`;
    const html = buildInvoiceEmailHtml(inv, items);
    const text = buildInvoiceEmailText(inv, items);

    await sendMail({ to, subject, html, text });
    res.json({ ok: true, sentTo: to });
  } catch (err) {
    console.error('Send invoice email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Get single invoice with items
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const [invoiceResult, itemsResult] = await Promise.all([
      pool.query(
        `SELECT i.*, c.name as client_name, c.email as client_email, c.company as client_company, c.address as client_address,
                c.customer_number as client_customer_number
         FROM invoices i JOIN clients c ON i.client_id = c.id
         WHERE i.id = $1 AND i.user_id = $2`,
        [req.params.id, req.userId]
      ),
      pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order', [req.params.id]),
    ]);

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json({ ...invoiceResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error('Get invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create invoice
router.post('/', validate(createInvoiceSchema), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { clientId, issueDate, dueDate, taxRate, notes, isRecurring, recurrenceInterval, items } = req.body;

    // Verify client belongs to user and read default discount from client profile
    const clientCheck = await client.query<{ discount_code: string | null }>(
      'SELECT discount_code FROM clients WHERE id = $1 AND user_id = $2',
      [clientId, req.userId]
    );
    if (clientCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Client not found' });
    }

    const effectiveCode = (clientCheck.rows[0].discount_code || '').trim() || null;

    const invoiceNumber = await generateInvoiceNumber(req.userId!);

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice,
      0
    );
    const discountAmount = effectiveCode ? await applyDiscount(req.userId!, effectiveCode, subtotal) : 0;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * (taxRate || 0)) / 100;
    const total = taxableAmount + taxAmount;

    const invoiceResult = await client.query(
      `INSERT INTO invoices (user_id, client_id, invoice_number, issue_date, due_date, subtotal, tax_rate, tax_amount, discount_code, discount_amount, total, notes, is_recurring, recurrence_interval)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        req.userId,
        clientId,
        invoiceNumber,
        issueDate,
        dueDate,
        subtotal,
        taxRate || 0,
        taxAmount,
        effectiveCode,
        discountAmount,
        total,
        notes || null,
        isRecurring,
        recurrenceInterval || null,
      ]
    );

    // Insert items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const amount = item.quantity * item.unitPrice;
      await client.query(
        'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [invoiceResult.rows[0].id, item.description, item.quantity, item.unitPrice, amount, i]
      );
    }

    await client.query('COMMIT');
    await invalidateRevenueCache(req.userId!);

    res.status(201).json(invoiceResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Update invoice (draft only — same payload shape as create)
router.put('/:id', validate(createInvoiceSchema), async (req: AuthRequest, res: Response) => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');

    const lock = await db.query(
      "SELECT id FROM invoices WHERE id = $1 AND user_id = $2 AND status = 'draft' FOR UPDATE",
      [req.params.id, req.userId]
    );
    if (lock.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        error: 'Invoice not found or cannot be edited (only draft invoices can be updated)',
      });
    }

    const { clientId, issueDate, dueDate, taxRate, notes, isRecurring, recurrenceInterval, items } = req.body;

    const clientCheck = await db.query<{ discount_code: string | null }>(
      'SELECT discount_code FROM clients WHERE id = $1 AND user_id = $2',
      [clientId, req.userId]
    );
    if (clientCheck.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Client not found' });
    }

    const effectiveCode = (clientCheck.rows[0].discount_code || '').trim() || null;

    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice,
      0
    );
    const discountAmount = effectiveCode ? await applyDiscount(req.userId!, effectiveCode, subtotal) : 0;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * (taxRate || 0)) / 100;
    const total = taxableAmount + taxAmount;

    await db.query('DELETE FROM invoice_items WHERE invoice_id = $1', [req.params.id]);

    await db.query(
      `UPDATE invoices SET
        client_id = $1,
        issue_date = $2,
        due_date = $3,
        subtotal = $4,
        tax_rate = $5,
        tax_amount = $6,
        discount_code = $7,
        discount_amount = $8,
        total = $9,
        notes = $10,
        is_recurring = $11,
        recurrence_interval = $12,
        updated_at = NOW()
      WHERE id = $13 AND user_id = $14`,
      [
        clientId,
        issueDate,
        dueDate,
        subtotal,
        taxRate || 0,
        taxAmount,
        effectiveCode,
        discountAmount,
        total,
        notes || null,
        isRecurring,
        recurrenceInterval || null,
        req.params.id,
        req.userId,
      ]
    );

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const amount = item.quantity * item.unitPrice;
      await db.query(
        'INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, amount, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [req.params.id, item.description, item.quantity, item.unitPrice, amount, i]
      );
    }

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('Update invoice error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    db.release();
  }

  try {
    await invalidateRevenueCache(req.userId!);
    const [invoiceResult, itemsResult] = await Promise.all([
      pool.query(
        `SELECT i.*, c.name as client_name, c.email as client_email, c.company as client_company, c.address as client_address,
                c.customer_number as client_customer_number
         FROM invoices i JOIN clients c ON i.client_id = c.id
         WHERE i.id = $1 AND i.user_id = $2`,
        [req.params.id, req.userId]
      ),
      pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order', [req.params.id]),
    ]);
    res.json({ ...invoiceResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error('Update invoice fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update invoice status (sets sent_at when moving draft → sent)
router.patch('/:id/status', validate(updateInvoiceStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE invoices SET
        status = $1::invoice_status,
        sent_at = CASE
          WHEN $1::text = 'sent' AND (sent_at IS NULL OR status = 'draft') THEN NOW()
          ELSE sent_at
        END,
        updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    await invalidateRevenueCache(req.userId!);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete invoice (only drafts)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "DELETE FROM invoices WHERE id = $1 AND user_id = $2 AND status = 'draft' RETURNING id",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found or cannot be deleted (only drafts can be deleted)' });
    }
    await invalidateRevenueCache(req.userId!);
    res.status(204).send();
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
