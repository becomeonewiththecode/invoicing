import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import redis from '../config/redis';
import pool from '../config/database';

export interface AdminRequest extends AuthRequest {
  userRole?: string;
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const cacheKey = `user:role:${userId}`;

  redis
    .get(cacheKey)
    .then(async (cached) => {
      let role = cached;
      if (!role) {
        const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'User not found' });
        }
        role = result.rows[0].role;
        await redis.set(cacheKey, role!, 'EX', 300).catch(() => {});
      }

      if (role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      req.userRole = role;
      next();
    })
    .catch(() => {
      // If Redis fails, fall back to DB-only check
      pool
        .query('SELECT role FROM users WHERE id = $1', [userId])
        .then((result) => {
          if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
          }
          if (result.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
          }
          req.userRole = result.rows[0].role;
          next();
        })
        .catch(() => {
          res.status(500).json({ error: 'Internal server error' });
        });
    });
}
