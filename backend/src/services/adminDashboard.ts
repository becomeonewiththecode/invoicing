import pool from '../config/database';

export async function getAdminStats() {
  const [users, active, tickets, flags, invoices] = await Promise.all([
    pool.query('SELECT COUNT(*) AS count FROM users'),
    pool.query(
      `SELECT COUNT(DISTINCT user_id) AS count FROM invoices
       WHERE created_at > NOW() - INTERVAL '30 days'`
    ),
    pool.query("SELECT COUNT(*) AS count FROM support_tickets WHERE status != 'closed'"),
    pool.query("SELECT COUNT(*) AS count FROM content_flags WHERE status = 'pending'"),
    pool.query(
      `SELECT COUNT(*) AS total_invoices,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS platform_revenue
       FROM invoices`
    ),
  ]);

  return {
    totalUsers: Number(users.rows[0].count),
    activeUsers: Number(active.rows[0].count),
    openTickets: Number(tickets.rows[0].count),
    pendingFlags: Number(flags.rows[0].count),
    totalInvoices: Number(invoices.rows[0].total_invoices),
    platformRevenue: Number(invoices.rows[0].platform_revenue),
  };
}

export async function getUserGrowth(days = 30) {
  const result = await pool.query(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM users
     WHERE created_at > NOW() - INTERVAL '1 day' * $1
     GROUP BY DATE(created_at)
     ORDER BY date`,
    [days]
  );
  return result.rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

export async function getUsers(page: number, limit: number, search?: string) {
  const offset = (page - 1) * limit;
  const params: unknown[] = [limit, offset];
  let where = '';

  if (search) {
    where = 'WHERE u.email ILIKE $3 OR u.business_name ILIKE $3';
    params.push(`%${search}%`);
  }

  const [data, total] = await Promise.all([
    pool.query(
      `SELECT u.id, u.email, u.business_name, u.role, u.created_at,
              COUNT(i.id) AS invoice_count
       FROM users u
       LEFT JOIN invoices i ON i.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    ),
    pool.query(`SELECT COUNT(*) AS count FROM users u ${where}`, search ? [`%${search}%`] : []),
  ]);

  return {
    data: data.rows.map((r) => ({
      ...r,
      invoice_count: Number(r.invoice_count),
    })),
    pagination: { page, limit, total: Number(total.rows[0].count) },
  };
}

export async function getUserDetail(userId: string) {
  const [user, stats] = await Promise.all([
    pool.query(
      `SELECT u.id, u.email, u.business_name, u.role, u.business_address, u.business_phone,
              u.business_email, u.business_website, u.created_at,
              (SELECT COUNT(*) FROM clients WHERE user_id = u.id) AS client_count,
              (SELECT COUNT(*) FROM invoices WHERE user_id = u.id) AS invoice_count
       FROM users u WHERE u.id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS total_revenue
       FROM invoices WHERE user_id = $1`,
      [userId]
    ),
  ]);

  if (user.rows.length === 0) return null;

  return {
    ...user.rows[0],
    client_count: Number(user.rows[0].client_count),
    invoice_count: Number(user.rows[0].invoice_count),
    total_revenue: Number(stats.rows[0].total_revenue),
  };
}

export async function updateUserRole(userId: string, role: string) {
  const result = await pool.query(
    'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role',
    [role, userId]
  );
  return result.rows[0] || null;
}
