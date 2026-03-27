import pool from '../config/database';

export async function flagContent(
  userId: string,
  contentType: string,
  contentSnippet: string,
  reason?: string
) {
  const result = await pool.query(
    `INSERT INTO content_flags (user_id, content_type, content_snippet, reason)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, contentType, contentSnippet, reason || null]
  );
  return result.rows[0];
}

export async function getContentQueue(
  status: string,
  page: number,
  limit: number
) {
  const offset = (page - 1) * limit;

  const [data, total] = await Promise.all([
    pool.query(
      `SELECT cf.*, u.email AS user_email
       FROM content_flags cf
       JOIN users u ON u.id = cf.user_id
       WHERE cf.status = $1
       ORDER BY cf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    ),
    pool.query('SELECT COUNT(*) AS count FROM content_flags WHERE status = $1', [status]),
  ]);

  return {
    data: data.rows,
    pagination: { page, limit, total: Number(total.rows[0].count) },
  };
}

export async function reviewContent(flagId: string, adminId: string, decision: 'approved' | 'rejected') {
  const result = await pool.query(
    `UPDATE content_flags
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3 RETURNING *`,
    [decision, adminId, flagId]
  );
  return result.rows[0] || null;
}

export async function bulkReviewContent(
  flagIds: string[],
  adminId: string,
  decision: 'approved' | 'rejected'
) {
  const result = await pool.query(
    `UPDATE content_flags
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = ANY($3) AND status = 'pending'
     RETURNING id`,
    [decision, adminId, flagIds]
  );
  return result.rows.length;
}

export async function scanUserContent(userId: string) {
  const [user, clients, invoices] = await Promise.all([
    pool.query('SELECT business_name, business_address FROM users WHERE id = $1', [userId]),
    pool.query('SELECT id, name, company, notes FROM clients WHERE user_id = $1', [userId]),
    pool.query('SELECT id, invoice_number, notes FROM invoices WHERE user_id = $1 AND notes IS NOT NULL', [userId]),
  ]);

  return {
    profile: user.rows[0] || null,
    clients: clients.rows,
    invoices: invoices.rows,
  };
}
