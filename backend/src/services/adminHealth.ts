import pool from '../config/database';
import redis from '../config/redis';

interface ServiceCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTimeMs: number;
  message?: string;
}

async function checkDatabase(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { name: 'database', status: 'healthy', responseTimeMs: Date.now() - start };
  } catch (err) {
    return {
      name: 'database',
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      message: String(err),
    };
  }
}

async function checkRedis(): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const pong = await redis.ping();
    return {
      name: 'redis',
      status: pong === 'PONG' ? 'healthy' : 'degraded',
      responseTimeMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name: 'redis',
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      message: String(err),
    };
  }
}

async function checkFrontend(): Promise<ServiceCheck> {
  const url = process.env.FRONTEND_URL || 'http://frontend:80';
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return {
      name: 'frontend',
      status: res.ok ? 'healthy' : 'degraded',
      responseTimeMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name: 'frontend',
      status: 'unhealthy',
      responseTimeMs: Date.now() - start,
      message: String(err),
    };
  }
}

async function checkBackend(): Promise<ServiceCheck> {
  const start = Date.now();
  return { name: 'backend', status: 'healthy', responseTimeMs: Date.now() - start };
}

export async function getAllHealthChecks() {
  const services = await Promise.all([checkDatabase(), checkRedis(), checkFrontend(), checkBackend()]);

  const [metrics] = await Promise.all([getSystemMetrics()]);

  return {
    services,
    errorRate: metrics.errorRate,
    avgResponseTime: metrics.avgResponseTime,
    requestsLastHour: metrics.requestsLastHour,
  };
}

export async function getSystemMetrics() {
  const [errorRate, avgResponse, reqCount] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE level = 'error') AS errors,
         COUNT(*) AS total
       FROM system_logs
       WHERE created_at > NOW() - INTERVAL '1 hour'`
    ),
    pool.query(
      `SELECT COALESCE(AVG(response_time_ms), 0) AS avg_ms
       FROM system_logs
       WHERE created_at > NOW() - INTERVAL '1 hour' AND response_time_ms IS NOT NULL`
    ),
    pool.query(
      `SELECT COUNT(*) AS count FROM system_logs
       WHERE created_at > NOW() - INTERVAL '1 hour'`
    ),
  ]);

  const total = Number(errorRate.rows[0].total) || 1;
  return {
    errorRate: Number(((Number(errorRate.rows[0].errors) / total) * 100).toFixed(2)),
    avgResponseTime: Math.round(Number(avgResponse.rows[0].avg_ms)),
    requestsLastHour: Number(reqCount.rows[0].count),
  };
}

export async function getSystemLogs(
  page: number,
  limit: number,
  filters: { level?: string; source?: string; startDate?: string; endDate?: string }
) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.level) {
    conditions.push(`level = $${idx++}`);
    params.push(filters.level);
  }
  if (filters.source) {
    conditions.push(`source = $${idx++}`);
    params.push(filters.source);
  }
  if (filters.startDate) {
    conditions.push(`created_at >= $${idx++}`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    conditions.push(`created_at <= $${idx++}`);
    params.push(filters.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [data, total] = await Promise.all([
    pool.query(
      `SELECT id, level, source, method, path, status_code, response_time_ms, ip, user_id, error_message, created_at
       FROM system_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, (page - 1) * limit]
    ),
    pool.query(`SELECT COUNT(*) AS count FROM system_logs ${where}`, params),
  ]);

  return {
    data: data.rows,
    pagination: { page, limit, total: Number(total.rows[0].count) },
  };
}
