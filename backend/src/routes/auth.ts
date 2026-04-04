import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../models/validation';
import { rateLimit } from '../middleware/rateLimit';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

router.post(
  '/register',
  rateLimit({ windowMs: 60_000, max: 5 }),
  validate(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password, businessName } = req.body;
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      const trimmedBusiness =
        typeof businessName === 'string' && businessName.trim() ? businessName.trim() : '';
      if (trimmedBusiness) {
        const dupName = await pool.query(
          `SELECT id FROM users
           WHERE business_name IS NOT NULL AND TRIM(business_name) <> ''
             AND LOWER(TRIM(business_name)) = LOWER($1)`,
          [trimmedBusiness]
        );
        if (dupName.rows.length > 0) {
          return res.status(409).json({ error: 'Company name already in use' });
        }
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, business_name) VALUES ($1, $2, $3) RETURNING id, email, business_name, role',
        [email, passwordHash, trimmedBusiness || null]
      );
      const user = result.rows[0];
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'dev-secret', {
        expiresIn: '7d',
      } as jwt.SignOptions);
      res.status(201).json({ user: { id: user.id, email: user.email, businessName: user.business_name, role: user.role }, token });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post(
  '/login',
  rateLimit({ windowMs: 60_000, max: 10 }),
  validate(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await pool.query('SELECT id, email, password_hash, business_name, role FROM users WHERE email = $1', [
        email,
      ]);
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const user = result.rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'dev-secret', {
        expiresIn: '7d',
      } as jwt.SignOptions);
      res.json({ user: { id: user.id, email: user.email, businessName: user.business_name, role: user.role }, token });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// --- Change email / password (authenticated) ---

router.put(
  '/account',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newEmail, newPassword } = req.body;

      if (!currentPassword || typeof currentPassword !== 'string') {
        return res.status(400).json({ error: 'Current password is required' });
      }
      if (!newEmail && !newPassword) {
        return res.status(400).json({ error: 'Provide a new email or new password' });
      }

      const userResult = await pool.query(
        'SELECT id, email, password_hash FROM users WHERE id = $1',
        [req.userId]
      );
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const user = userResult.rows[0];

      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      let email = user.email;
      let passwordHash = user.password_hash;

      if (newEmail && typeof newEmail === 'string') {
        const trimmed = newEmail.trim().toLowerCase();
        if (trimmed !== user.email) {
          const dup = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [trimmed, req.userId]);
          if (dup.rows.length > 0) {
            return res.status(409).json({ error: 'Email already in use by another account' });
          }
          email = trimmed;
        }
      }

      if (newPassword && typeof newPassword === 'string') {
        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        passwordHash = await bcrypt.hash(newPassword, 12);
      }

      const result = await pool.query(
        `UPDATE users SET email = $1, password_hash = $2, updated_at = NOW()
         WHERE id = $3 RETURNING id, email, business_name, role`,
        [email, passwordHash, req.userId]
      );

      const updated = result.rows[0];
      const token = jwt.sign({ userId: updated.id }, process.env.JWT_SECRET || 'dev-secret', {
        expiresIn: '7d',
      } as jwt.SignOptions);

      res.json({
        user: { id: updated.id, email: updated.email, businessName: updated.business_name, role: updated.role },
        token,
      });
    } catch (err) {
      console.error('Account update error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
