import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { logQuerySchema } from '../../models/adminValidation';
import { getAllHealthChecks, getSystemLogs } from '../../services/adminHealth';

const router = Router();

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const health = await getAllHealthChecks();
    res.json(health);
  } catch (err) {
    console.error('Admin health check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/logs', validate(logQuerySchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, level, source, startDate, endDate } = req.validatedQuery as {
      page: number;
      limit: number;
      level?: string;
      source?: string;
      startDate?: string;
      endDate?: string;
    };
    const result = await getSystemLogs(page, limit, { level, source, startDate, endDate });
    res.json(result);
  } catch (err) {
    console.error('Admin system logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
