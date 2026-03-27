import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const userSearchSchema = paginationSchema.extend({
  search: z.string().optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

export const flagContentSchema = z.object({
  contentType: z.string().min(1).max(50),
  contentSnippet: z.string().min(1).max(2000),
  reason: z.string().max(255).optional(),
});

export const moderationQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

export const reviewContentSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
});

export const bulkReviewSchema = z.object({
  flagIds: z.array(z.string().uuid()).min(1).max(100),
  decision: z.enum(['approved', 'rejected']),
});

export const ticketQuerySchema = paginationSchema.extend({
  status: z.enum(['open', 'in_progress', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  search: z.string().optional(),
});

export const ticketReplySchema = z.object({
  body: z.string().min(1).max(10000),
});

export const ticketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'closed']),
});

export const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  body: z.string().min(1).max(10000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

export const logQuerySchema = paginationSchema.extend({
  level: z.enum(['info', 'warn', 'error']).optional(),
  source: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const updatePolicySchema = z.object({
  retention_days: z.number().int().min(1).max(365).optional(),
  max_snapshots: z.number().int().min(1).max(1000).optional(),
  is_enabled: z.boolean().optional(),
  cron_expression: z.string().max(50).optional(),
});

export const rateLimitConfigSchema = z.object({
  route_pattern: z.string().min(1).max(255),
  window_ms: z.number().int().min(1000).max(3600000),
  max_requests: z.number().int().min(1).max(10000),
  is_enabled: z.boolean().default(true),
});

export const updateRateLimitSchema = z.object({
  window_ms: z.number().int().min(1000).max(3600000).optional(),
  max_requests: z.number().int().min(1).max(10000).optional(),
  is_enabled: z.boolean().optional(),
});

export const analyticsQuerySchema = z.object({
  hours: z.coerce.number().int().min(1).max(720).default(24),
});
