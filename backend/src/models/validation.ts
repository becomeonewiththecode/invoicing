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
  /** Explicit null clears the default discount on update; optional fields reject null in Zod unless nullable. */
  discountCode: z.string().max(50).optional().nullable(),
});

export const updateClientSchema = createClientSchema.partial();

export const portalLoginSchema = z
  .object({
    accessToken: z.string().min(1).max(64).optional(),
    email: z.string().email().optional(),
    password: z.string().min(1).max(200),
    totpCode: z.string().min(6).max(12).optional(),
  })
  .refine((d) => Boolean(d.accessToken) || Boolean(d.email), {
    message: 'Either accessToken or email is required',
  });

export const portalAccountUpdateSchema = z
  .object({
    email: z.string().email().optional(),
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(128).optional(),
  })
  .refine((d) => d.email !== undefined || d.newPassword !== undefined, {
    message: 'At least one of email or newPassword is required',
  });

export const updateClientPortalSchema = z
  .object({
    enabled: z.boolean().optional(),
    password: z.string().min(8).max(128).optional(),
    regenerateToken: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.enabled !== undefined || d.password !== undefined || d.regenerateToken !== undefined,
    { message: 'At least one of enabled, password, or regenerateToken is required' }
  );

export const portal2faVerifySchema = z.object({
  code: z.string().min(6).max(12),
});

export const portal2faDisableSchema = z.object({
  password: z.string().min(1).max(200),
});

// Project (per client)
const projectMilestoneSchema = z.object({
  title: z.string().min(1).max(255),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

/** Google Docs/Drive or Microsoft 365 (SharePoint, OneDrive, etc.) — no hosted file storage */
export function isDocShareLinkUrl(s: string): boolean {
  const t = s.trim();
  /** Legacy rows from when the app stored files under uploads (still valid until removed) */
  if (t.startsWith('/api/uploads/project-attachments/')) return true;
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const h = u.hostname.toLowerCase();
    if (h === 'docs.google.com' || h === 'drive.google.com') return true;
    if (h.endsWith('.sharepoint.com') || h.endsWith('.sharepoint.de')) return true;
    if (h === '1drv.ms' || h.endsWith('.1drv.ms')) return true;
    if (h.includes('onedrive')) return true;
    if (h.includes('sharepoint')) return true;
    if (h === 'office.com' || h.endsWith('.office.com')) return true;
    if (h === 'live.com' || h.endsWith('.live.com')) return true;
    if (h === 'teams.microsoft.com') return true;
    return false;
  } catch {
    return false;
  }
}

const projectAttachmentUrlSchema = z
  .string()
  .max(2000)
  .refine((s) => isDocShareLinkUrl(s), {
    message: 'Must be a Google Docs/Drive or Microsoft 365 share link (no file uploads)',
  });

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(10000).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z
    .enum(['not_started', 'planning', 'in_progress', 'on_hold', 'completed', 'cancelled'])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  /** Google Docs/Drive or Microsoft 365 share links with optional labels */
  externalLinks: z
    .array(
      z.object({
        url: projectAttachmentUrlSchema,
        description: z.string().max(500).optional().nullable(),
      })
    )
    .max(20)
    .optional(),
  budget: z.number().min(0).nullable().optional(),
  /** Planned or logged hours; meaning depends on hoursIsMaximum */
  hours: z.number().min(0).nullable().optional(),
  /** If true, hours is a cap / maximum; if false, an estimate or non-cap value */
  hoursIsMaximum: z.boolean().optional(),
  dependencies: z.string().max(10000).optional().nullable(),
  milestones: z.array(projectMilestoneSchema).optional(),
  teamMembers: z.array(z.string().max(255)).max(100).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  notes: z.string().max(10000).optional().nullable(),
  /** Share links only (Google Docs/Drive or Microsoft 365); stored as rows, no server files */
  attachmentUrls: z.array(projectAttachmentUrlSchema).max(50).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

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
  /** Optional project for this client (must belong to the same client and user) */
  projectId: z.string().uuid().optional().nullable(),
  isRecurring: z.boolean().default(false),
  recurrenceInterval: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
  items: z.array(invoiceItemSchema).min(1),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'late', 'cancelled']),
});

// Discount code (code optional on create — server generates if omitted)
export const createDiscountSchema = z.object({
  code: z.string().max(50).optional(),
  description: z.string().max(255).optional(),
  type: z.enum(['percent', 'fixed']),
  value: z.number().positive(),
});

// Pagination (optional clientId for invoice list filter)
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  clientId: z.string().uuid().optional(),
});

// Company / invoice defaults (required: company name, tax rate, phone, website)
export const settingsSchema = z.object({
  businessName: z.string().min(1).max(255),
  defaultTaxRate: z.coerce.number().min(0).max(100),
  businessPhone: z.string().min(1).max(50),
  businessWebsite: z.string().min(1).max(500),
  businessAddress: z.string().max(2000).optional(),
  taxId: z.string().max(100).optional(),
  defaultHourlyRate: z.union([z.number().min(0), z.null()]).optional(),
  businessFax: z.string().max(50).optional(),
  logoUrl: z.string().max(2000).optional(),
  /** Company inbox for invoice copy emails; empty string clears */
  businessEmail: z.union([z.string().email(), z.literal('')]).optional(),
  /** Shown at bottom of invoices/PDFs/shared view; empty clears */
  payableText: z.string().max(5000).optional(),
});
