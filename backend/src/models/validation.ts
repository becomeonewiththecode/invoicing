import { z } from 'zod';

// Auth
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  businessName: z.string().max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Client
export const createClientSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

// Invoice item
const invoiceItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0),
});

// Invoice
export const createInvoiceSchema = z.object({
  clientId: z.string().uuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taxRate: z.number().min(0).max(100).default(0),
  discountCode: z.string().max(50).optional(),
  notes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurrenceInterval: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  items: z.array(invoiceItemSchema).min(1),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue']),
});

// Discount code
export const createDiscountSchema = z.object({
  code: z.string().min(1).max(50),
  description: z.string().max(255).optional(),
  type: z.enum(['percent', 'fixed']),
  value: z.number().positive(),
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
