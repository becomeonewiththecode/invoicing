import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/** Express 5 exposes `req.query` as read-only; validated query params go here instead. */
declare module 'express-serve-static-core' {
  interface Request {
    validatedQuery?: unknown;
  }
}

export function validate(schema: ZodSchema, source: 'body' | 'query' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map((issue) => ({
          field: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      });
    }
    if (source === 'query') {
      req.validatedQuery = result.data;
    } else {
      req[source] = result.data;
    }
    next();
  };
}
