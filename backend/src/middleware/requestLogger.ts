import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import pool from '../config/database';

export function requestLogger(req: AuthRequest, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    pool
      .query(
        `INSERT INTO system_logs (level, source, method, path, status_code, response_time_ms, ip, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          level,
          'api',
          req.method,
          req.originalUrl,
          res.statusCode,
          duration,
          req.ip || req.socket.remoteAddress || 'unknown',
          req.userId || null,
        ]
      )
      .then(() =>
        pool.query(
          `DELETE FROM system_logs WHERE id NOT IN (
             SELECT id FROM system_logs ORDER BY created_at DESC LIMIT 600
           )`
        )
      )
      .catch(() => {});
  });

  next();
}
