import pool from '../config/database';

export async function getTickets(
  page: number,
  limit: number,
  filters: { status?: string; priority?: string; search?: string }
) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`st.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.priority) {
    conditions.push(`st.priority = $${idx++}`);
    params.push(filters.priority);
  }
  if (filters.search) {
    conditions.push(`(st.subject ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [data, total] = await Promise.all([
    pool.query(
      `SELECT st.*, u.email AS user_email
       FROM support_tickets st
       JOIN users u ON u.id = st.user_id
       ${where}
       ORDER BY st.updated_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, (page - 1) * limit]
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM support_tickets st JOIN users u ON u.id = st.user_id ${where}`,
      params
    ),
  ]);

  return {
    data: data.rows,
    pagination: { page, limit, total: Number(total.rows[0].count) },
  };
}

export async function getTicketDetail(ticketId: string) {
  const [ticket, messages] = await Promise.all([
    pool.query(
      `SELECT st.*, u.email AS user_email
       FROM support_tickets st
       JOIN users u ON u.id = st.user_id
       WHERE st.id = $1`,
      [ticketId]
    ),
    pool.query(
      `SELECT tm.*, u.email AS sender_email
       FROM ticket_messages tm
       JOIN users u ON u.id = tm.sender_id
       WHERE tm.ticket_id = $1
       ORDER BY tm.created_at ASC`,
      [ticketId]
    ),
  ]);

  if (ticket.rows.length === 0) return null;

  return { ...ticket.rows[0], messages: messages.rows };
}

export async function replyToTicket(ticketId: string, senderId: string, body: string, isAdmin: boolean) {
  const [message] = await Promise.all([
    pool.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, body, is_admin_reply)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [ticketId, senderId, body, isAdmin]
    ),
    pool.query('UPDATE support_tickets SET updated_at = NOW() WHERE id = $1', [ticketId]),
  ]);

  return message.rows[0];
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const result = await pool.query(
    'UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, ticketId]
  );
  return result.rows[0] || null;
}

export async function createTicket(userId: string, subject: string, body: string, priority = 'normal') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ticket = await client.query(
      `INSERT INTO support_tickets (user_id, subject, priority)
       VALUES ($1, $2, $3) RETURNING *`,
      [userId, subject, priority]
    );
    await client.query(
      `INSERT INTO ticket_messages (ticket_id, sender_id, body, is_admin_reply)
       VALUES ($1, $2, $3, FALSE)`,
      [ticket.rows[0].id, userId, body]
    );
    await client.query('COMMIT');
    return ticket.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getUserTickets(userId: string, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [data, total] = await Promise.all([
    pool.query(
      'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    ),
    pool.query('SELECT COUNT(*) AS count FROM support_tickets WHERE user_id = $1', [userId]),
  ]);
  return {
    data: data.rows,
    pagination: { page, limit, total: Number(total.rows[0].count) },
  };
}
