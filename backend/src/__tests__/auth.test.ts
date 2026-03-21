import request from 'supertest';
import app from '../app';

// These tests require a running database connection
// For CI, use a test database via DATABASE_URL env var

describe('Auth Routes', () => {
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'testpassword123',
    businessName: 'Test Corp',
  };

  describe('POST /api/auth/register', () => {
    it('should reject invalid email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'not-an-email',
        password: 'testpassword123',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject short password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'valid@example.com',
        password: 'short',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
