import { Request, Response, NextFunction } from 'express';
import redis from '../config/redis';

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimit({ windowMs, max }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `ratelimit:${ip}:${req.path}`;

    try {
      const current = await redis.incr(key);
      if (current === 1) {
        await redis.pexpire(key, windowMs);
      }
      if (current > max) {
        return res.status(429).json({ error: 'Too many requests, please try again later' });
      }
      next();
    } catch {
      // If Redis is unavailable, allow the request
      next();
    }
  };
}
