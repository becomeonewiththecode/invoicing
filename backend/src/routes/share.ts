import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

async function fetchProjectExternalLinksForInvoice(projectId: string | null): Promise<
  { url: string; description: string | null }[]
> {
  if (!projectId) return [];
  const links = await pool.query<{ url: string; description: string | null }>(
    `SELECT url, description FROM project_external_links WHERE project_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [projectId]
  );
  const out = links.rows.map((r) => ({ url: r.url, description: r.description }));
  const legacy = await pool.query<{
    external_link: string | null;
    external_link_description: string | null;
  }>(`SELECT external_link, external_link_description FROM projects WHERE id = $1`, [projectId]);
  const row = legacy.rows[0];
  if (row?.external_link?.trim()) {
    const u = row.external_link.trim();
    if (!out.some((x) => x.url === u)) {
      out.push({ url: u, description: row.external_link_description?.trim() || null });
    }
  }
  return out;
}

/** Public endpoint — returns invoice + items + business info for a valid share token. */
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    if (!token || token.length !== 64) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoiceResult = await pool.query(
      `SELECT i.invoice_number, i.status, i.issue_date, i.due_date,
              i.subtotal, i.tax_rate, i.tax_amount, i.discount_code, i.discount_amount, i.total, i.notes,
              i.project_id,
              c.name AS client_name, c.email AS client_email, c.company AS client_company,
              c.address AS client_address, c.customer_number AS client_customer_number,
              u.business_name, u.business_phone, u.business_website, u.business_address,
              u.business_fax, u.business_email AS company_email, u.logo_url, u.payable_text
       FROM invoices i
       JOIN clients c ON i.client_id = c.id
       JOIN users u ON i.user_id = u.id
       WHERE i.share_token = $1`,
      [token]
    );

    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];
    const project_external_links = await fetchProjectExternalLinksForInvoice(
      invoice.project_id as string | null
    );

    const itemsResult = await pool.query(
      `SELECT ii.description, ii.quantity, ii.unit_price, ii.amount, ii.sort_order
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.share_token = $1
       ORDER BY ii.sort_order`,
      [token]
    );

    res.json({ ...invoice, project_external_links, items: itemsResult.rows });
  } catch (err) {
    console.error('Public share view error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Public endpoint — allows a client to mark a shared invoice as paid. */
router.patch('/:token/status', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { status } = req.body ?? {};

    if (!token || token.length !== 64) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    if (status !== 'paid') {
      return res.status(400).json({ error: 'Only "paid" status is allowed from a share link' });
    }

    const result = await pool.query(
      `UPDATE invoices
         SET status = 'paid'::invoice_status, updated_at = NOW()
       WHERE share_token = $1 AND status IN ('sent', 'late')
       RETURNING invoice_number, status`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found or cannot be marked as paid' });
    }

    // Invalidate revenue cache for the invoice owner
    const ownerResult = await pool.query(
      'SELECT user_id FROM invoices WHERE share_token = $1',
      [token]
    );
    if (ownerResult.rows.length > 0) {
      const userId = ownerResult.rows[0].user_id;
      const redis = (await import('../config/redis')).default;
      const keys = await redis.keys(`revenue:${userId}:*`);
      if (keys.length > 0) await redis.del(...keys);
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Public share status update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
