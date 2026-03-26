import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { authenticator } from 'otplib';
import pool from '../config/database';
import { validate } from '../middleware/validate';
import {
  portalLoginSchema,
  portal2faVerifySchema,
  portal2faDisableSchema,
} from '../models/validation';
import { rateLimit } from '../middleware/rateLimit';
import { authenticatePortal, PortalAuthRequest } from '../middleware/portalAuth';

const router = Router();
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';

router.post(
  '/auth/login',
  rateLimit({ windowMs: 60_000, max: 30 }),
  validate(portalLoginSchema),
  async (req: PortalAuthRequest, res: Response) => {
    try {
      const { accessToken, password, totpCode } = req.body as {
        accessToken: string;
        password: string;
        totpCode?: string;
      };

      const r = await pool.query(
        `SELECT c.id, c.user_id, c.name, c.email, c.company, c.portal_enabled, c.portal_password_hash,
                c.portal_totp_secret, c.portal_totp_enabled, u.business_name
         FROM clients c
         JOIN users u ON u.id = c.user_id
         WHERE c.portal_token = $1`,
        [accessToken.trim()]
      );

      if (r.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid access token or portal is disabled' });
      }

      const client = r.rows[0];
      if (!client.portal_enabled) {
        return res.status(403).json({ error: 'Client portal is disabled' });
      }
      if (!client.portal_password_hash) {
        return res.status(403).json({ error: 'Portal login is not configured yet' });
      }

      const passwordOk = await bcrypt.compare(password, client.portal_password_hash);
      if (!passwordOk) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (client.portal_totp_enabled) {
        if (!totpCode?.trim()) {
          return res.status(200).json({
            requiresTwoFactor: true,
            message: 'Enter the code from your authenticator app',
          });
        }
        const secret = client.portal_totp_secret;
        if (!secret) {
          return res.status(500).json({ error: 'Two-factor configuration is invalid' });
        }
        const valid = authenticator.verify({ token: totpCode.trim(), secret });
        if (!valid) {
          return res.status(401).json({ error: 'Invalid two-factor code' });
        }
      }

      const token = jwt.sign(
        { type: 'portal', clientId: client.id, vendorUserId: client.user_id },
        jwtSecret,
        { expiresIn: '7d' } as jwt.SignOptions
      );

      res.json({
        token,
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          company: client.company,
        },
        vendor: { businessName: client.business_name },
        portal: { twoFactorEnabled: Boolean(client.portal_totp_enabled) },
      });
    } catch (err) {
      console.error('Portal login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.use(authenticatePortal);

router.get('/me', async (req: PortalAuthRequest, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT c.id, c.name, c.email, c.company, c.portal_totp_enabled, u.business_name
       FROM clients c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1 AND c.user_id = $2 AND c.portal_enabled = true`,
      [req.portalClientId, req.portalVendorUserId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const row = r.rows[0];

    const inv = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'draft' AND status != 'cancelled')::int AS visible_invoices,
         COUNT(*) FILTER (WHERE status IN ('sent', 'late'))::int AS open_invoices,
         COALESCE(SUM(total) FILTER (WHERE status IN ('sent', 'late')), 0)::text AS outstanding_total
       FROM invoices
       WHERE client_id = $1 AND user_id = $2`,
      [req.portalClientId, req.portalVendorUserId]
    );

    const pr = await pool.query(
      'SELECT COUNT(*)::int AS project_count FROM projects WHERE client_id = $1 AND user_id = $2',
      [req.portalClientId, req.portalVendorUserId]
    );

    const stats = inv.rows[0];
    const projectCount = pr.rows[0]?.project_count ?? 0;

    res.json({
      client: {
        id: row.id,
        name: row.name,
        email: row.email,
        company: row.company,
      },
      vendor: { businessName: row.business_name },
      portal: { twoFactorEnabled: Boolean(row.portal_totp_enabled) },
      stats: {
        visibleInvoices: Number(stats.visible_invoices ?? 0),
        openInvoices: Number(stats.open_invoices ?? 0),
        outstandingTotal: stats.outstanding_total ?? '0',
        projectCount: Number(projectCount),
      },
    });
  } catch (err) {
    console.error('Portal /me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/invoices', async (req: PortalAuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, invoice_number, status, issue_date, due_date, total, tax_amount, updated_at, sent_at
       FROM invoices
       WHERE client_id = $1 AND user_id = $2 AND status != 'draft'
       ORDER BY issue_date DESC NULLS LAST, created_at DESC
       LIMIT 100`,
      [req.portalClientId, req.portalVendorUserId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Portal invoices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/projects', async (req: PortalAuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, status, priority, start_date, end_date, budget, updated_at
       FROM projects
       WHERE client_id = $1 AND user_id = $2
       ORDER BY updated_at DESC
       LIMIT 100`,
      [req.portalClientId, req.portalVendorUserId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    console.error('Portal projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications', async (req: PortalAuthRequest, res: Response) => {
  try {
    const clientId = req.portalClientId!;
    const userId = req.portalVendorUserId!;

    const inv = await pool.query(
      `SELECT id, invoice_number, status, updated_at
       FROM invoices
       WHERE client_id = $1 AND user_id = $2 AND status != 'draft'
       ORDER BY updated_at DESC
       LIMIT 25`,
      [clientId, userId]
    );

    const proj = await pool.query(
      `SELECT id, name, status, updated_at
       FROM projects
       WHERE client_id = $1 AND user_id = $2
       ORDER BY updated_at DESC
       LIMIT 15`,
      [clientId, userId]
    );

    type Notif = { id: string; kind: 'invoice' | 'project'; title: string; detail: string; at: string };
    const items: Notif[] = [];

    for (const row of inv.rows) {
      items.push({
        id: `inv-${row.id}`,
        kind: 'invoice',
        title: `Invoice ${row.invoice_number}`,
        detail: `Status: ${row.status}`,
        at: row.updated_at,
      });
    }
    for (const row of proj.rows) {
      items.push({
        id: `prj-${row.id}`,
        kind: 'project',
        title: row.name,
        detail: `Status: ${row.status}`,
        at: row.updated_at,
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    res.json({ data: items.slice(0, 40) });
  } catch (err) {
    console.error('Portal notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/2fa/setup', async (req: PortalAuthRequest, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT c.email, u.business_name FROM clients c
       JOIN users u ON u.id = c.user_id
       WHERE c.id = $1 AND c.user_id = $2 AND c.portal_enabled = true`,
      [req.portalClientId, req.portalVendorUserId]
    );
    if (r.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const { email, business_name: businessName } = r.rows[0];
    const secret = authenticator.generateSecret();
    await pool.query(
      `UPDATE clients SET portal_totp_secret = $1, portal_totp_enabled = false, updated_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [secret, req.portalClientId, req.portalVendorUserId]
    );

    const issuer = (businessName && String(businessName).trim()) || 'Client portal';
    const otpauthUrl = authenticator.keyuri(email, issuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 2, width: 220 });

    res.json({ qrDataUrl, otpauthUrl, secret });
  } catch (err) {
    console.error('Portal 2FA setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post(
  '/2fa/enable',
  validate(portal2faVerifySchema),
  async (req: PortalAuthRequest, res: Response) => {
    try {
      const { code } = req.body as { code: string };
      const r = await pool.query(
        'SELECT portal_totp_secret FROM clients WHERE id = $1 AND user_id = $2 AND portal_enabled = true',
        [req.portalClientId, req.portalVendorUserId]
      );
      if (r.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }
      const secret = r.rows[0].portal_totp_secret;
      if (!secret) {
        return res.status(400).json({ error: 'Run setup first' });
      }
      const valid = authenticator.verify({ token: code.trim(), secret });
      if (!valid) {
        return res.status(400).json({ error: 'Invalid authenticator code' });
      }
      await pool.query(
        'UPDATE clients SET portal_totp_enabled = true, updated_at = NOW() WHERE id = $1 AND user_id = $2',
        [req.portalClientId, req.portalVendorUserId]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Portal 2FA enable error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post(
  '/2fa/disable',
  validate(portal2faDisableSchema),
  async (req: PortalAuthRequest, res: Response) => {
    try {
      const { password } = req.body as { password: string };
      const r = await pool.query(
        'SELECT portal_password_hash FROM clients WHERE id = $1 AND user_id = $2 AND portal_enabled = true',
        [req.portalClientId, req.portalVendorUserId]
      );
      if (r.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
      }
      const hash = r.rows[0].portal_password_hash;
      if (!hash) {
        return res.status(400).json({ error: 'Portal password not set' });
      }
      const ok = await bcrypt.compare(password, hash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid password' });
      }
      await pool.query(
        `UPDATE clients SET portal_totp_secret = NULL, portal_totp_enabled = false, updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [req.portalClientId, req.portalVendorUserId]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('Portal 2FA disable error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
