import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema } from '../models/validation';
import { rateLimit } from '../middleware/rateLimit';

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
      const passwordHash = await bcrypt.hash(password, 12);
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, business_name) VALUES ($1, $2, $3) RETURNING id, email, business_name',
        [email, passwordHash, businessName || null]
      );
      const user = result.rows[0];
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'dev-secret', {
        expiresIn: '7d',
      } as jwt.SignOptions);
      res.status(201).json({ user: { id: user.id, email: user.email, businessName: user.business_name }, token });
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
      const result = await pool.query('SELECT id, email, password_hash, business_name FROM users WHERE email = $1', [
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
      res.json({ user: { id: user.id, email: user.email, businessName: user.business_name }, token });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;
