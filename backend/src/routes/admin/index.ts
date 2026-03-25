import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/adminAuth';
import dashboardRoutes from './dashboard';
import usersRoutes from './users';
import moderationRoutes from './moderation';
import ticketsRoutes from './tickets';
import healthRoutes from './health';
import backupsRoutes from './backups';
import rateLimitRoutes from './rateLimit';
import accountRoutes from './account';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.use('/dashboard', dashboardRoutes);
router.use('/users', usersRoutes);
router.use('/moderation', moderationRoutes);
router.use('/tickets', ticketsRoutes);
router.use('/health', healthRoutes);
router.use('/backups', backupsRoutes);
router.use('/rate-limits', rateLimitRoutes);
router.use('/account', accountRoutes);

export default router;
