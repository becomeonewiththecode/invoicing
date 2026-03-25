import { randomUUID } from 'node:crypto';
import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import pool from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { settingsSchema } from '../models/validation';

const router = Router();
router.use(authenticate);

const LOGO_DIR = path.join(process.cwd(), 'uploads', 'logos');
const LOGO_PUBLIC_PREFIX = '/api/uploads/logos';

function ensureLogoDir() {
  if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  return '.png';
}

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function normalizeExtFromFilename(originalname: string): string | null {
  const ext = path.extname(originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return null;
  if (ext === '.jpeg') return '.jpg';
  return ext;
}

/** Resolves a stored logo_url to an on-disk path, or null if external / not ours. */
function storagePathFromPublicUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl || typeof logoUrl !== 'string') return null;
  if (!logoUrl.startsWith(`${LOGO_PUBLIC_PREFIX}/`)) return null;
  const name = path.basename(logoUrl);
  if (!name || name === '.' || name === '..') return null;
  return path.join(LOGO_DIR, name);
}

function deleteStoredLogoFileIfOwned(logoUrl: string | null | undefined) {
  const p = storagePathFromPublicUrl(logoUrl);
  if (p && fs.existsSync(p)) fs.unlinkSync(p);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureLogoDir();
    cb(null, LOGO_DIR);
  },
  filename: (_req, file, cb) => {
    const fromMime = extFromMime(file.mimetype);
    const fromName = normalizeExtFromFilename(file.originalname);
    const ext =
      file.mimetype === 'application/octet-stream' || !file.mimetype?.trim()
        ? fromName ?? fromMime
        : fromMime;
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mimeOk =
      /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype) ||
      /^image\/x-png$/i.test(file.mimetype);
    const extOk = normalizeExtFromFilename(file.originalname) !== null;
    /** Browsers often send PNG/JPEG as application/octet-stream or omit the type. */
    const octetOk =
      (file.mimetype === 'application/octet-stream' || !file.mimetype?.trim()) && extOk;
    if (mimeOk || octetOk) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'));
    }
  },
});

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
    businessEmail: (row.business_email as string | null) ?? null,
    logoUrl: row.logo_url as string | null,
    payableText: (row.payable_text as string | null) ?? null,
  };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT business_name, default_tax_rate, business_phone, business_website, business_address,
              tax_id, default_hourly_rate, business_fax, business_email, logo_url, payable_text
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

router.post(
  '/logo',
  (req: AuthRequest, res: Response, next) => {
    upload.single('logo')(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  async (req: AuthRequest, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const prev = await pool.query('SELECT logo_url FROM users WHERE id = $1', [req.userId]);
      deleteStoredLogoFileIfOwned(prev.rows[0]?.logo_url as string | null);

      const publicPath = `${LOGO_PUBLIC_PREFIX}/${file.filename}`;
      const result = await pool.query(
        `UPDATE users SET logo_url = $1, updated_at = NOW() WHERE id = $2
         RETURNING business_name, default_tax_rate, business_phone, business_website, business_address,
                   tax_id, default_hourly_rate, business_fax, business_email, logo_url, payable_text`,
        [publicPath, req.userId]
      );

      if (result.rows.length === 0) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(rowToJson(result.rows[0]));
    } catch (err) {
      console.error('Logo upload error:', err);
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/logo', async (req: AuthRequest, res: Response) => {
  try {
    const prev = await pool.query('SELECT logo_url FROM users WHERE id = $1', [req.userId]);
    deleteStoredLogoFileIfOwned(prev.rows[0]?.logo_url as string | null);

    const result = await pool.query(
      `UPDATE users SET logo_url = NULL, updated_at = NOW() WHERE id = $1
       RETURNING business_name, default_tax_rate, business_phone, business_website, business_address,
                 tax_id, default_hourly_rate, business_fax, business_email, logo_url, payable_text`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(rowToJson(result.rows[0]));
  } catch (err) {
    console.error('Logo delete error:', err);
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
      businessEmail,
      logoUrl,
      payableText,
    } = req.body;

    const emptyToNull = (s: string | undefined) => (s === '' || s === undefined ? null : s);

    const prev = await pool.query('SELECT logo_url FROM users WHERE id = $1', [req.userId]);
    const oldUrl = prev.rows[0]?.logo_url as string | null;
    const newUrl = emptyToNull(logoUrl);
    if (oldUrl && oldUrl.startsWith(LOGO_PUBLIC_PREFIX) && oldUrl !== newUrl) {
      deleteStoredLogoFileIfOwned(oldUrl);
    }

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
        business_email = $9,
        logo_url = $10,
        payable_text = $11,
        updated_at = NOW()
      WHERE id = $12
      RETURNING business_name, default_tax_rate, business_phone, business_website, business_address,
                tax_id, default_hourly_rate, business_fax, business_email, logo_url, payable_text`,
      [
        businessName,
        defaultTaxRate,
        businessPhone,
        businessWebsite,
        emptyToNull(businessAddress),
        emptyToNull(taxId),
        defaultHourlyRate === null || defaultHourlyRate === undefined ? null : defaultHourlyRate,
        emptyToNull(businessFax),
        emptyToNull(businessEmail),
        newUrl,
        emptyToNull(payableText as string | undefined),
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

// --- SMTP settings (separate from main settings to avoid exposing credentials) ---

router.get('/smtp', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const r = result.rows[0];
    res.json({
      smtpHost: (r.smtp_host as string | null) ?? '',
      smtpPort: r.smtp_port != null ? Number(r.smtp_port) : 587,
      smtpUser: (r.smtp_user as string | null) ?? '',
      smtpPass: (r.smtp_pass as string | null) ?? '',
      smtpFrom: (r.smtp_from as string | null) ?? '',
    });
  } catch (err) {
    console.error('Get SMTP settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/smtp', async (req: AuthRequest, res: Response) => {
  try {
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = req.body;
    const host = typeof smtpHost === 'string' ? smtpHost.trim() || null : null;
    const port = Number(smtpPort) || 587;
    const user = typeof smtpUser === 'string' ? smtpUser.trim() || null : null;
    const pass = typeof smtpPass === 'string' ? smtpPass || null : null;
    const from = typeof smtpFrom === 'string' ? smtpFrom.trim() || null : null;

    const result = await pool.query(
      `UPDATE users SET smtp_host = $1, smtp_port = $2, smtp_user = $3, smtp_pass = $4, smtp_from = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from`,
      [host, port, user, pass, from, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const r = result.rows[0];
    res.json({
      smtpHost: (r.smtp_host as string | null) ?? '',
      smtpPort: r.smtp_port != null ? Number(r.smtp_port) : 587,
      smtpUser: (r.smtp_user as string | null) ?? '',
      smtpPass: (r.smtp_pass as string | null) ?? '',
      smtpFrom: (r.smtp_from as string | null) ?? '',
    });
  } catch (err) {
    console.error('Update SMTP settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- SMTP test email ---

router.post('/smtp/test', async (req: AuthRequest, res: Response) => {
  try {
    const { sendMail } = await import('../services/mail');
    const result = await pool.query(
      'SELECT email, smtp_host FROM users WHERE id = $1',
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { email, smtp_host } = result.rows[0];
    if (!smtp_host?.trim()) {
      return res.status(400).json({ error: 'SMTP is not configured. Save your SMTP settings first.' });
    }
    await sendMail({
      to: email,
      subject: 'SMTP Test — Invoicing App',
      html: '<p>Your SMTP configuration is working correctly.</p>',
      text: 'Your SMTP configuration is working correctly.',
      userId: req.userId,
    });
    res.json({ message: `Test email sent to ${email}` });
  } catch (err: unknown) {
    console.error('SMTP test error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to send test email';
    res.status(400).json({ error: msg });
  }
});

export default router;
