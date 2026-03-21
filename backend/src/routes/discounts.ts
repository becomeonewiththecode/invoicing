import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createDiscountSchema } from '../models/validation';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM discount_codes WHERE user_id = $1 ORDER BY created_at DESC', [
      req.userId,
    ]);
    res.json(result.rows);
  } catch (err) {
    console.error('List discounts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validate(createDiscountSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { code, description, type, value } = req.body;
    const result = await pool.query(
      'INSERT INTO discount_codes (user_id, code, description, type, value) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, code.toUpperCase(), description || null, type, value]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Discount code already exists' });
    }
    console.error('Create discount error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM discount_codes WHERE id = $1 AND user_id = $2 RETURNING id', [
      req.params.id,
      req.userId,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Discount code not found' });
    }
    res.status(204).send();
  } catch (err) {
    console.error('Delete discount error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
