import { Router, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { rateLimitConfigSchema, updateRateLimitSchema, analyticsQuerySchema } from '../../models/adminValidation';
import { invalidateRateLimitConfigCache } from '../../middleware/rateLimit';
import pool from '../../config/database';

const router = Router();

router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM rate_limit_configs ORDER BY route_pattern');
    res.json(result.rows);
  } catch (err) {
    console.error('Admin list rate limits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', validate(rateLimitConfigSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { route_pattern, window_ms, max_requests, is_enabled } = req.body;
    const result = await pool.query(
      `INSERT INTO rate_limit_configs (route_pattern, window_ms, max_requests, is_enabled)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [route_pattern, window_ms, max_requests, is_enabled]
    );
    invalidateRateLimitConfigCache();
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === '23505') {
      return res.status(409).json({ error: 'Route pattern already exists' });
    }
    console.error('Admin create rate limit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', validate(updateRateLimitSchema), async (req: AuthRequest, res: Response) => {
  try {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (req.body.window_ms !== undefined) {
      fields.push(`window_ms = $${idx++}`);
      params.push(req.body.window_ms);
    }
    if (req.body.max_requests !== undefined) {
      fields.push(`max_requests = $${idx++}`);
      params.push(req.body.max_requests);
    }
    if (req.body.is_enabled !== undefined) {
      fields.push(`is_enabled = $${idx++}`);
      params.push(req.body.is_enabled);
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    fields.push('updated_at = NOW()');
    const result = await pool.query(
      `UPDATE rate_limit_configs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      [...params, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Config not found' });

    invalidateRateLimitConfigCache();
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update rate limit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/analytics', validate(analyticsQuerySchema, 'query'), async (req: AuthRequest, res: Response) => {
  try {
    const { hours } = req.validatedQuery as { hours: number };

    const [totals, topIps, topRoutes, timeline] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE was_blocked) AS blocked
         FROM rate_limit_events
         WHERE created_at > NOW() - INTERVAL '1 hour' * $1`,
        [hours]
      ),
      pool.query(
        `SELECT ip,
                COUNT(*) AS count,
                COUNT(*) FILTER (WHERE was_blocked) AS blocked
         FROM rate_limit_events
         WHERE created_at > NOW() - INTERVAL '1 hour' * $1
         GROUP BY ip
         ORDER BY count DESC
         LIMIT 10`,
        [hours]
      ),
      pool.query(
        `SELECT path,
                COUNT(*) AS count,
                COUNT(*) FILTER (WHERE was_blocked) AS blocked
         FROM rate_limit_events
         WHERE created_at > NOW() - INTERVAL '1 hour' * $1
         GROUP BY path
         ORDER BY blocked DESC
         LIMIT 10`,
        [hours]
      ),
      pool.query(
        `SELECT date_trunc('hour', created_at) AS time,
                COUNT(*) AS requests,
                COUNT(*) FILTER (WHERE was_blocked) AS blocked
         FROM rate_limit_events
         WHERE created_at > NOW() - INTERVAL '1 hour' * $1
         GROUP BY time
         ORDER BY time`,
        [hours]
      ),
    ]);

    const total = Number(totals.rows[0].total);
    const blocked = Number(totals.rows[0].blocked);

    res.json({
      totalRequests: total,
      blockedRequests: blocked,
      blockRate: total > 0 ? Number(((blocked / total) * 100).toFixed(2)) : 0,
      topIps: topIps.rows.map((r) => ({ ip: r.ip, count: Number(r.count), blocked: Number(r.blocked) })),
      topRoutes: topRoutes.rows.map((r) => ({ path: r.path, count: Number(r.count), blocked: Number(r.blocked) })),
      timeline: timeline.rows.map((r) => ({ time: r.time, requests: Number(r.requests), blocked: Number(r.blocked) })),
    });
  } catch (err) {
    console.error('Admin rate limit analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
