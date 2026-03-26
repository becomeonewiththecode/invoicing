import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { userSearchSchema, updateRoleSchema, flagContentSchema } from '../../models/adminValidation';
import { getUsers, getUserDetail, updateUserRole } from '../../services/adminDashboard';
import { flagContent } from '../../services/adminModeration';
import pool from '../../config/database';

const router = Router();

router.get('/', validate(userSearchSchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, search } = req.validatedQuery as { page: number; limit: number; search?: string };
    const result = await getUsers(page, limit, search);
    res.json(result);
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const user = await getUserDetail(String(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Admin user detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/role', validate(updateRoleSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await updateUserRole(String(req.params.id), req.body.role);
    if (!result) return res.status(404).json({ error: 'User not found' });
    res.json(result);
  } catch (err) {
    console.error('Admin update role error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/flag', validate(flagContentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { contentType, contentSnippet, reason } = req.body;
    const flag = await flagContent(String(req.params.id), contentType, contentSnippet, reason);
    res.status(201).json(flag);
  } catch (err) {
    console.error('Admin flag content error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const targetId = String(req.params.id);

    // Prevent self-deletion
    if (targetId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear reviewed_by references (FK without CASCADE)
      await client.query('UPDATE content_flags SET reviewed_by = NULL WHERE reviewed_by = $1', [targetId]);

      // Delete the user — ON DELETE CASCADE handles clients, invoices,
      // invoice_items, discount_codes, tickets, ticket_messages,
      // content_flags, backup_snapshots, backup_policies, payment_reminders
      const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING email', [targetId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      await client.query('COMMIT');
      res.json({ message: `User ${result.rows[0].email} and all associated data deleted` });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
