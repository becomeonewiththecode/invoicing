import nodemailer from 'nodemailer';
import pool from '../config/database';

interface SmtpConfig {
  host: string;
  port: number;
  user: string | null;
  pass: string | null;
}

/** Resolve SMTP config: DB (per-user) first, then env vars as fallback. */
async function resolveSmtpConfig(userId?: string): Promise<SmtpConfig | null> {
  if (userId) {
    const result = await pool.query(
      'SELECT smtp_host, smtp_port, smtp_user, smtp_pass FROM users WHERE id = $1',
      [userId]
    );
    const r = result.rows[0];
    if (r?.smtp_host?.trim()) {
      return {
        host: r.smtp_host.trim(),
        port: Number(r.smtp_port) || 587,
        user: r.smtp_user?.trim() || null,
        pass: r.smtp_pass || null,
      };
    }
  }
  const envHost = process.env.SMTP_HOST?.trim();
  if (envHost) {
    return {
      host: envHost,
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER?.trim() || null,
      pass: process.env.SMTP_PASS || null,
    };
  }
  return null;
}

export async function isSmtpConfigured(userId?: string): Promise<boolean> {
  const cfg = await resolveSmtpConfig(userId);
  return cfg !== null;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  userId?: string;
}): Promise<void> {
  const cfg = await resolveSmtpConfig(opts.userId);
  if (!cfg) {
    throw new Error('SMTP is not configured. Set SMTP settings in Settings or server environment.');
  }
  const secure = cfg.port === 465;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? '' } : undefined,
  });
  const from = process.env.SMTP_FROM?.trim() || cfg.user || 'noreply@localhost';
  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
