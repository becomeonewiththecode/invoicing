import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';
import pool from '../config/database';

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

let configCache: Map<string, { windowMs: number; max: number; enabled: boolean }> | null = null;
let configCacheTime = 0;
const CONFIG_CACHE_TTL = 60_000;

async function getConfigForRoute(path: string): Promise<{ windowMs: number; max: number } | null> {
  try {
    const now = Date.now();
    if (!configCache || now - configCacheTime > CONFIG_CACHE_TTL) {
      const result = await pool.query(
        'SELECT route_pattern, window_ms, max_requests, is_enabled FROM rate_limit_configs'
      );
      configCache = new Map();
      for (const row of result.rows) {
        configCache.set(row.route_pattern, {
          windowMs: row.window_ms,
          max: row.max_requests,
          enabled: row.is_enabled,
        });
      }
      configCacheTime = now;
    }

    for (const [pattern, config] of configCache) {
      if (config.enabled && path.startsWith(pattern)) {
        return { windowMs: config.windowMs, max: config.max };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function logRateLimitEvent(ip: string, path: string, wasBlocked: boolean) {
  pool
    .query('INSERT INTO rate_limit_events (ip, path, was_blocked) VALUES ($1, $2, $3)', [
      ip,
      path,
      wasBlocked,
    ])
    .catch(() => {});
}

export function rateLimit({ windowMs, max }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const path = req.path;

    // Check for dynamic config override
    const dynamicConfig = await getConfigForRoute(req.originalUrl);
    const effectiveWindow = dynamicConfig?.windowMs ?? windowMs;
    const effectiveMax = dynamicConfig?.max ?? max;

    const key = `ratelimit:${ip}:${path}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.pexpire(key, effectiveWindow);
      }
      if (current > effectiveMax) {
        logRateLimitEvent(ip, req.originalUrl, true);
        return res.status(429).json({ error: 'Too many requests, please try again later' });
      }
      logRateLimitEvent(ip, req.originalUrl, false);
      next();
    } catch {
      // If Redis is unavailable, allow the request
      next();
    }
  };
}

export function invalidateRateLimitConfigCache() {
  configCache = null;
  configCacheTime = 0;
}
