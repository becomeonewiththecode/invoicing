import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createClientSchema, updateClientSchema, paginationSchema } from '../models/validation';

const router = Router();
router.use(authenticate);

/** Empty / omitted → null; non-empty must match an active discount_codes row for this user. */
async function normalizeClientDiscountCode(
  userId: string,
  raw: string | undefined | null
): Promise<string | null> {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const r = await pool.query<{ code: string }>(
    'SELECT code FROM discount_codes WHERE user_id = $1 AND code = $2 AND is_active = true LIMIT 1',
    [userId, trimmed]
  );
  if (r.rows.length === 0) {
    const err = new Error('Invalid or inactive discount code') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  return r.rows[0].code;
}

// List clients
router.get('/', validate(paginationSchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit } = req.validatedQuery as { page: number; limit: number };
    const offset = (page - 1) * limit;

    const [clients, countResult] = await Promise.all([
      pool.query('SELECT * FROM clients WHERE user_id = $1 ORDER BY name ASC LIMIT $2 OFFSET $3', [
        req.userId,
        limit,
        offset,
      ]),
      pool.query('SELECT COUNT(*) FROM clients WHERE user_id = $1', [req.userId]),
    ]);

    res.json({
      data: clients.rows,
      pagination: { page, limit, total: parseInt(countResult.rows[0].count) },
    });
  } catch (err) {
    console.error('List clients error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single client
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM clients WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.userId,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function formatCustomerNumber(seq: number): string {
  return `C-${String(seq).padStart(5, '0')}`;
}

// Create client
router.post('/', validate(createClientSchema), async (req: AuthRequest, res: Response) => {
  const db = await pool.connect();
  try {
    const { name, email, phone, company, address, notes, discountCode } = req.body;
    let discount_code: string | null;
    try {
      discount_code = await normalizeClientDiscountCode(req.userId!, discountCode);
    } catch (e) {
      if ((e as Error & { status?: number }).status === 400) {
        return res.status(400).json({ error: (e as Error).message });
      }
      throw e;
    }
    await db.query('BEGIN');
    const seqResult = await db.query(
      'UPDATE users SET client_counter = client_counter + 1 WHERE id = $1 RETURNING client_counter',
      [req.userId]
    );
    if (seqResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const seq = Number(seqResult.rows[0].client_counter);
    const customerNumber = formatCustomerNumber(seq);
    const result = await db.query(
      `INSERT INTO clients (user_id, customer_number, name, email, phone, company, address, notes, discount_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.userId,
        customerNumber,
        name,
        email,
        phone || null,
        company || null,
        address || null,
        notes || null,
        discount_code,
      ]
    );
    await db.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    db.release();
  }
});

// Update client
router.put('/:id', validate(updateClientSchema), async (req: AuthRequest, res: Response) => {
  try {
    const fields = req.body as Record<string, unknown>;
    const { discountCode, ...rest } = fields;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (discountCode !== undefined) {
      let normalized: string | null;
      try {
        normalized = await normalizeClientDiscountCode(req.userId!, discountCode as string | null);
      } catch (e) {
        if ((e as Error & { status?: number }).status === 400) {
          return res.status(400).json({ error: (e as Error).message });
        }
        throw e;
      }
      setClauses.push(`discount_code = $${paramIndex++}`);
      values.push(normalized);
    }

    const fieldMap: Record<string, string> = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      company: 'company',
      address: 'address',
      notes: 'notes',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (rest[key] !== undefined) {
        setClauses.push(`${column} = $${paramIndex++}`);
        values.push(rest[key]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(req.params.id, req.userId);

    const result = await pool.query(
      `UPDATE clients SET ${setClauses.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete client
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.userId,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
