import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createClientSchema, updateClientSchema, paginationSchema } from '../models/validation';

const router = Router();
router.use(authenticate);

// List clients
router.get('/', validate(paginationSchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
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

// Create client
router.post('/', validate(createClientSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, company, address, notes } = req.body;
    const result = await pool.query(
      'INSERT INTO clients (user_id, name, email, phone, company, address, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.userId, name, email, phone || null, company || null, address || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update client
router.put('/:id', validate(updateClientSchema), async (req: AuthRequest, res: Response) => {
  try {
    const fields = req.body;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      company: 'company',
      address: 'address',
      notes: 'notes',
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (fields[key] !== undefined) {
        setClauses.push(`${column} = $${paramIndex++}`);
        values.push(fields[key]);
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
