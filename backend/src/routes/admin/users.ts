import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { userSearchSchema, updateRoleSchema, flagContentSchema } from '../../models/adminValidation';
import { getUsers, getUserDetail, updateUserRole } from '../../services/adminDashboard';
import { flagContent } from '../../services/adminModeration';

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

export default router;
