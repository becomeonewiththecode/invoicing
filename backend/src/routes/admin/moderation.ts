import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { moderationQuerySchema, reviewContentSchema, bulkReviewSchema } from '../../models/adminValidation';
import { getContentQueue, reviewContent, bulkReviewContent } from '../../services/adminModeration';

const router = Router();

router.get('/', validate(moderationQuerySchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, page, limit } = req.validatedQuery as { status: string; page: number; limit: number };
    const result = await getContentQueue(status, page, limit);
    res.json(result);
  } catch (err) {
    console.error('Admin moderation queue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', validate(reviewContentSchema), async (req: AuthRequest, res: Response) => {
  try {
    const result = await reviewContent(String(req.params.id), req.userId!, req.body.decision);
    if (!result) return res.status(404).json({ error: 'Flag not found' });
    res.json(result);
  } catch (err) {
    console.error('Admin review content error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bulk', validate(bulkReviewSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { flagIds, decision } = req.body;
    const count = await bulkReviewContent(flagIds, req.userId!, decision);
    res.json({ updated: count });
  } catch (err) {
    console.error('Admin bulk review error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
