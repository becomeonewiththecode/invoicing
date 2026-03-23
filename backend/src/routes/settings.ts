import { Router, Response } from 'express';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { settingsSchema } from '../models/validation';

const router = Router();
router.use(authenticate);

function rowToJson(row: Record<string, unknown>) {
  return {
    businessName: row.business_name as string | null,
    defaultTaxRate: row.default_tax_rate != null ? Number(row.default_tax_rate) : 0,
    businessPhone: row.business_phone as string | null,
    businessWebsite: row.business_website as string | null,
    businessAddress: row.business_address as string | null,
    taxId: row.tax_id as string | null,
    defaultHourlyRate:
      row.default_hourly_rate != null ? Number(row.default_hourly_rate) : null,
    businessFax: row.business_fax as string | null,
    logoUrl: row.logo_url as string | null,
  };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT business_name, default_tax_rate, business_phone, business_website, business_address,
              tax_id, default_hourly_rate, business_fax, logo_url
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rowToJson(result.rows[0]));
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/', validate(settingsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const {
      businessName,
      defaultTaxRate,
      businessPhone,
      businessWebsite,
      businessAddress,
      taxId,
      defaultHourlyRate,
      businessFax,
      logoUrl,
    } = req.body;

    const emptyToNull = (s: string | undefined) => (s === '' || s === undefined ? null : s);

    const result = await pool.query(
      `UPDATE users SET
        business_name = $1,
        default_tax_rate = $2,
        business_phone = $3,
        business_website = $4,
        business_address = $5,
        tax_id = $6,
        default_hourly_rate = $7,
        business_fax = $8,
        logo_url = $9,
        updated_at = NOW()
      WHERE id = $10
      RETURNING business_name, default_tax_rate, business_phone, business_website, business_address,
                tax_id, default_hourly_rate, business_fax, logo_url`,
      [
        businessName,
        defaultTaxRate,
        businessPhone,
        businessWebsite,
        emptyToNull(businessAddress),
        emptyToNull(taxId),
        defaultHourlyRate === null || defaultHourlyRate === undefined ? null : defaultHourlyRate,
        emptyToNull(businessFax),
        emptyToNull(logoUrl),
        req.userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rowToJson(result.rows[0]));
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
