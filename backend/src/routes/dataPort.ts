import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { DATA_EXPORT_VERSION, exportUserData, importUserDataReplace, type DataExportV1 } from '../services/dataPort';

const router = Router();
router.use(authenticate);

const clientSchema = z.object({
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
}).passthrough();

const discountCodeSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  description: z.string().nullish(),
  type: z.enum(['percent', 'fixed']),
  value: z.number(),
  is_active: z.boolean().optional().default(true),
  created_at: z.string(),
}).passthrough();

const invoiceItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  quantity: z.number(),
  unit_price: z.number(),
  amount: z.number(),
  sort_order: z.number().optional().default(0),
  created_at: z.string(),
}).passthrough();

const paymentReminderSchema = z.object({
  id: z.string().uuid(),
  sent_at: z.string(),
  reminder_type: z.string().optional().default('overdue'),
}).passthrough();

const invoiceSchema = z.object({
  id: z.string().uuid(),
  client_id: z.string().uuid(),
  invoice_number: z.string().min(1),
  status: z.string().min(1),
  issue_date: z.string(),
  due_date: z.string(),
  subtotal: z.number(),
  tax_rate: z.number(),
  tax_amount: z.number(),
  discount_code: z.string().nullish(),
  discount_amount: z.number(),
  total: z.number(),
  notes: z.string().nullish(),
  is_recurring: z.boolean().optional().default(false),
  recurrence_interval: z.string().nullish(),
  next_recurrence_date: z.string().nullish(),
  sent_at: z.string().nullish(),
  share_token: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
  items: z.array(invoiceItemSchema),
  payment_reminders: z.array(paymentReminderSchema),
}).passthrough();

const exportV1Schema: z.ZodType<DataExportV1> = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  profile: z.object({
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
    client_counter: z.number().int().nonnegative(),
  }),
  clients: z.array(clientSchema),
  discount_codes: z.array(discountCodeSchema),
  invoices: z.array(invoiceSchema),
}) as z.ZodType<DataExportV1>;

const importBodySchema = z.object({
  data: exportV1Schema,
  confirmReplace: z.literal(true),
});

/** Download all account data as JSON (clients, invoices, discounts, profile). */
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
        return res.status(400).json({
          error: 'Invalid backup file',
          details: parsed.error.flatten(),
        });
      }

      // Validate referential integrity: every invoice must reference a client in the backup
      const clientIds = new Set(parsed.data.data.clients.map((c) => c.id));
      const orphanedInvoices = parsed.data.data.invoices.filter(
        (inv) => !clientIds.has(String(inv.client_id))
      );
      if (orphanedInvoices.length > 0) {
        const nums = orphanedInvoices.map((i) => i.invoice_number).join(', ');
        return res.status(400).json({
          error: `Backup contains invoices referencing missing clients: ${nums}`,
        });
      }

      // Validate no duplicate IDs within each entity type
      const dupeCheck = (arr: { id: string }[], label: string) => {
        const seen = new Set<string>();
        for (const r of arr) {
          if (seen.has(r.id)) return r.id;
          seen.add(r.id);
        }
        return null;
      };
      for (const [arr, label] of [
        [parsed.data.data.clients, 'clients'],
        [parsed.data.data.discount_codes, 'discount_codes'],
        [parsed.data.data.invoices, 'invoices'],
      ] as const) {
        const dup = dupeCheck(arr as { id: string }[], label);
        if (dup) {
          return res.status(400).json({ error: `Duplicate ${label} id in backup: ${dup}` });
        }
      }

      await importUserDataReplace(req.userId!, parsed.data.data);
      res.json({ ok: true, message: 'Data imported successfully' });
    } catch (err: unknown) {
      console.error('Data import error:', err);
      const msg = err instanceof Error ? err.message : 'Import failed';
      res.status(500).json({ error: msg });
    }
  }
);

export default router;
