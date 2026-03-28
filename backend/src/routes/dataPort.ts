import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import {
  DATA_EXPORT_VERSION,
  exportUserData,
  importUserDataReplace,
  type DataExportV1,
  type DataExportV2ImportFile,
} from '../services/dataPort';

const router = Router();
router.use(authenticate);

const clientSchema = z
  .object({
    id: z.string().uuid(),
    customer_number: z.string().nullish(),
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().nullish(),
    company: z.string().nullish(),
    address: z.string().nullish(),
    notes: z.string().nullish(),
    discount_code: z.string().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

const discountCodeSchema = z
  .object({
    id: z.string().uuid(),
    code: z.string().min(1),
    description: z.string().nullish(),
    type: z.enum(['percent', 'fixed']),
    value: z.coerce.number(),
    is_active: z.boolean().optional().default(true),
    created_at: z.string(),
  })
  .passthrough();

const invoiceItemSchema = z
  .object({
    id: z.string().uuid(),
    description: z.string().min(1),
    quantity: z.coerce.number(),
    unit_price: z.coerce.number(),
    amount: z.coerce.number(),
    sort_order: z.coerce.number().optional().default(0),
    created_at: z.string(),
  })
  .passthrough();

const paymentReminderSchema = z
  .object({
    id: z.string().uuid(),
    sent_at: z.string(),
    reminder_type: z.string().optional().default('overdue'),
  })
  .passthrough();

const invoiceSchema = z
  .object({
    id: z.string().uuid(),
    client_id: z.string().uuid(),
    invoice_number: z.string().min(1),
    status: z.string().min(1),
    issue_date: z.string(),
    due_date: z.string(),
    subtotal: z.coerce.number(),
    tax_rate: z.coerce.number(),
    tax_amount: z.coerce.number(),
    discount_code: z.string().nullish(),
    discount_amount: z.coerce.number(),
    total: z.coerce.number(),
    notes: z.string().nullish(),
    is_recurring: z.boolean().optional().default(false),
    recurrence_interval: z.string().nullish(),
    next_recurrence_date: z.string().nullish(),
    sent_at: z.string().nullish(),
    share_token: z.string().nullish(),
    project_id: z.string().uuid().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
    items: z.array(invoiceItemSchema),
    payment_reminders: z.array(paymentReminderSchema),
  })
  .passthrough();

const profileSchema = z.object({
  business_name: z.string().nullable(),
  business_address: z.string().nullable(),
  business_phone: z.string().nullable(),
  business_email: z.string().nullable(),
  tax_id: z.string().nullable(),
  default_hourly_rate: z.string().nullable(),
  default_tax_rate: z.string().nullable(),
  business_website: z.string().nullable(),
  business_fax: z.string().nullable(),
  logo_url: z.string().nullable(),
  payable_text: z.string().nullable().optional(),
  client_counter: z.coerce.number().int().nonnegative(),
});

const projectRowSchema = z
  .object({
    id: z.string().uuid(),
    client_id: z.string().uuid(),
    name: z.string().min(1),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

const projectAttachmentSchema = z
  .object({
    id: z.string().uuid(),
    project_id: z.string().uuid(),
    file_name: z.string().min(1),
    file_path: z.string().min(1),
    created_at: z.string(),
  })
  .passthrough();

const projectExternalLinkSchema = z
  .object({
    id: z.string().uuid(),
    project_id: z.string().uuid(),
    url: z.string().min(1),
    created_at: z.string(),
  })
  .passthrough();

const exportV1Schema: z.ZodType<DataExportV1> = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  profile: profileSchema,
  clients: z.array(clientSchema),
  discount_codes: z.array(discountCodeSchema),
  invoices: z.array(invoiceSchema),
}) as z.ZodType<DataExportV1>;

const exportV2Schema: z.ZodType<DataExportV2ImportFile> = z.object({
  version: z.literal(DATA_EXPORT_VERSION),
  exportedAt: z.string(),
  profile: profileSchema,
  clients: z.array(clientSchema),
  discount_codes: z.array(discountCodeSchema),
  projects: z.array(projectRowSchema),
  /** Legacy v2 backups only; share URLs were stored as file_path. Merged into project_external_links on import. */
  project_attachments: z.array(projectAttachmentSchema).optional().default([]),
  project_external_links: z.array(projectExternalLinkSchema),
  invoices: z.array(invoiceSchema),
}) as z.ZodType<DataExportV2ImportFile>;

const exportPayloadSchema = z.union([exportV1Schema, exportV2Schema]);

const importBodySchema = z.object({
  data: exportPayloadSchema,
  confirmReplace: z.literal(true),
});

function dupeCheck(arr: { id: string }[], label: string): string | null {
  const seen = new Set<string>();
  for (const r of arr) {
    if (seen.has(r.id)) return r.id;
    seen.add(r.id);
  }
  return null;
}

/** Download all account data as JSON (clients, projects, invoices, discounts, profile). */
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const payload = await exportUserData(req.userId!);
    const filename = `invoicing-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    console.error('Data export error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

/** Replace all account business data with contents of a previous export. Destructive. */
router.post(
  '/import',
  rateLimit({ windowMs: 60_000, max: 3 }),
  async (req: AuthRequest, res: Response) => {
    try {
      const parsed = importBodySchema.safeParse(req.body);
      if (!parsed.success) {
        const details = parsed.error.flatten();
        console.error('Data import validation error: Invalid backup file', details);
        return res.status(400).json({
          error: 'Invalid backup file',
          details,
        });
      }

      const data = parsed.data.data;
      const clientIds = new Set(data.clients.map((c) => c.id));

      const orphanedInvoices = data.invoices.filter((inv) => !clientIds.has(String(inv.client_id)));
      if (orphanedInvoices.length > 0) {
        const nums = orphanedInvoices.map((i) => i.invoice_number).join(', ');
        console.error(`Data import validation error: invoices referencing missing clients: ${nums}`);
        return res.status(400).json({
          error: `Backup contains invoices referencing missing clients: ${nums}`,
        });
      }

      for (const [arr, label] of [
        [data.clients, 'clients'],
        [data.discount_codes, 'discount_codes'],
        [data.invoices, 'invoices'],
      ] as const) {
        const dup = dupeCheck(arr as { id: string }[], label);
        if (dup) {
          console.error(`Data import validation error: duplicate ${label} id: ${dup}`);
          return res.status(400).json({ error: `Duplicate ${label} id in backup: ${dup}` });
        }
      }

      if (data.version === DATA_EXPORT_VERSION) {
        const projectIds = new Set(data.projects.map((p) => p.id));

        const dupProj = dupeCheck(data.projects as { id: string }[], 'projects');
        if (dupProj) {
          return res.status(400).json({ error: `Duplicate projects id in backup: ${dupProj}` });
        }
        const legacyAtt = data.project_attachments ?? [];
        const dupAtt = dupeCheck(legacyAtt as { id: string }[], 'project_attachments');
        if (dupAtt) {
          return res.status(400).json({ error: `Duplicate project_attachments id in backup: ${dupAtt}` });
        }
        const dupLink = dupeCheck(data.project_external_links as { id: string }[], 'project_external_links');
        if (dupLink) {
          return res.status(400).json({ error: `Duplicate project_external_links id in backup: ${dupLink}` });
        }

        for (const pr of data.projects) {
          if (!clientIds.has(String(pr.client_id))) {
            return res.status(400).json({
              error: `Backup project "${pr.name}" references a client that is not in the backup`,
            });
          }
        }

        for (const a of legacyAtt) {
          if (!projectIds.has(String(a.project_id))) {
            return res.status(400).json({
              error: 'Backup contains a legacy project attachment referencing a missing project',
            });
          }
        }
        for (const l of data.project_external_links) {
          if (!projectIds.has(String(l.project_id))) {
            return res.status(400).json({
              error: 'Backup contains a project external link referencing a missing project',
            });
          }
        }

        for (const inv of data.invoices) {
          const pid = inv.project_id;
          if (pid != null && pid !== '' && !projectIds.has(String(pid))) {
            return res.status(400).json({
              error: `Invoice ${inv.invoice_number} references a project_id not present in this backup`,
            });
          }
        }
      }

      await importUserDataReplace(req.userId!, data);
      res.json({ ok: true, message: 'Data imported successfully' });
    } catch (err: unknown) {
      console.error('Data import error:', err);
      const msg = err instanceof Error ? err.message : 'Import failed';
      res.status(500).json({ error: msg });
    }
  }
);

export default router;
