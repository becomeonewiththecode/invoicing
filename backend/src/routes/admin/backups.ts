import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { paginationSchema, updatePolicySchema } from '../../models/adminValidation';
import {
  getBackupSnapshots,
  createBackupForUser,
  restoreBackup,
  verifyBackup,
  deleteBackupSnapshot,
  getBackupPolicies,
  updateBackupPolicy,
} from '../../services/adminBackup';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit } = req.validatedQuery as { page: number; limit: number };
    const userId = req.query.userId as string | undefined;
    const result = await getBackupSnapshots(page, limit, userId);
    res.json(result);
  } catch (err) {
    console.error('Admin list backups error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await createBackupForUser(String(req.params.userId), false);
    res.status(201).json(snapshot);
  } catch (err) {
    console.error('Admin trigger backup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:snapshotId/restore', async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await restoreBackup(String(req.params.snapshotId));
    res.json({ ok: true, message: 'Backup restored successfully', snapshot });
  } catch (err) {
    console.error('Admin restore backup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:snapshotId/verify', async (req: AuthRequest, res: Response) => {
  try {
    const result = await verifyBackup(String(req.params.snapshotId));
    res.json(result);
  } catch (err) {
    console.error('Admin verify backup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:snapshotId', async (req: AuthRequest, res: Response) => {
  try {
    await deleteBackupSnapshot(String(req.params.snapshotId));
    res.json({ ok: true });
  } catch (err) {
    console.error('Admin delete backup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/policies', async (_req: AuthRequest, res: Response) => {
  try {
    const policies = await getBackupPolicies();
    res.json(policies);
  } catch (err) {
    console.error('Admin list policies error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/policies/:id', validate(updatePolicySchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await updateBackupPolicy(String(req.params.id), req.body);
    if (!result) return res.status(404).json({ error: 'Policy not found' });
    res.json(result);
  } catch (err) {
    console.error('Admin update policy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
