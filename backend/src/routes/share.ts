import { Router, Request, Response } from 'express';
import pool from '../config/database';

const router = Router();

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
              c.name AS client_name, c.email AS client_email, c.company AS client_company,
              c.address AS client_address, c.customer_number AS client_customer_number,
              u.business_name, u.business_phone, u.business_website, u.business_address,
              u.business_fax, u.business_email AS company_email, u.logo_url
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

    const itemsResult = await pool.query(
      `SELECT ii.description, ii.quantity, ii.unit_price, ii.amount, ii.sort_order
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE i.share_token = $1
       ORDER BY ii.sort_order`,
      [token]
    );

    res.json({ ...invoice, items: itemsResult.rows });
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
