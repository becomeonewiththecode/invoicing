import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../../config/database';
import { AdminRequest } from '../../middleware/adminAuth';
import { validate } from '../../middleware/validate';
import { z } from 'zod';

const router = Router();

const resetPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

router.put('/password', validate(resetPasswordSchema), async (req: AdminRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.userId;

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Admin password reset error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
