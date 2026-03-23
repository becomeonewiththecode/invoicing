import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { DATA_EXPORT_VERSION, exportUserData, importUserDataReplace, type DataExportV1 } from '../services/dataPort';

const router = Router();
router.use(authenticate);

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
  clients: z.array(z.record(z.string(), z.unknown())),
  discount_codes: z.array(z.record(z.string(), z.unknown())),
  invoices: z.array(
    z
      .object({
        items: z.array(z.record(z.string(), z.unknown())),
        payment_reminders: z.array(z.record(z.string(), z.unknown())),
      })
      .passthrough()
  ),
});

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
