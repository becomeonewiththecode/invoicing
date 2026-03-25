import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { getAdminStats, getUserGrowth } from '../../services/adminDashboard';

const router = Router();

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await getAdminStats();
    res.json(stats);
  } catch (err) {
    console.error('Admin dashboard stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/user-growth', async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const growth = await getUserGrowth(days);
    res.json(growth);
  } catch (err) {
    console.error('Admin user growth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
