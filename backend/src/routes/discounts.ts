import { randomBytes } from 'crypto';
import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createDiscountSchema } from '../models/validation';

const router = Router();
router.use(authenticate);

/** Alphanumeric without ambiguous 0/O, 1/I */
const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

async function generateUniqueCode(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt++) {
    const bytes = randomBytes(CODE_LENGTH);
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_CHARSET[bytes[i]! % CODE_CHARSET.length];
    }
    const exists = await pool.query('SELECT 1 FROM discount_codes WHERE user_id = $1 AND code = $2', [
      userId,
      code,
    ]);
    if (exists.rows.length === 0) return code;
  }
  throw new Error('Could not generate a unique discount code');
}

router.get('/generate-code', async (req: AuthRequest, res: Response) => {
  try {
    const code = await generateUniqueCode(req.userId!);
    res.json({ code });
  } catch (err) {
    console.error('Generate discount code error:', err);
    res.status(500).json({ error: 'Could not generate a discount code' });
  }
});

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
    const { code: rawCode, description, type, value } = req.body;
    const trimmed = typeof rawCode === 'string' ? rawCode.trim() : '';
    const code = trimmed ? trimmed.toUpperCase() : await generateUniqueCode(req.userId!);
    const result = await pool.query(
      'INSERT INTO discount_codes (user_id, code, description, type, value) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.userId, code, description || null, type, value]
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
