# Deployment guide

Repository overview: [README.md](../README.md). Project docs (API, database, architecture): [docs/README.md](../docs/README.md).

## Docker Compose (recommended)

### Full stack

```bash
docker compose up -d
```

| Service | Host port | Description |
|---------|-----------|-------------|
| postgres | 5432 | PostgreSQL (schema from `backend/src/models/schema.sql` on first init) |
| redis | 6379 | Redis |
| backend | **3001** | Express API (`PORT=3001` in the container) |
| frontend | 80 | nginx serving the React SPA |

For existing databases, apply SQL files in `backend/migrations/` in numeric order after the base schema, or rely on `ensureSchema()` where implemented.

### Environment variables

#### Backend

| Variable | Typical value | Description |
|----------|---------------|-------------|
| PORT | 3001 (Docker) | API listen port inside the container |
| NODE_ENV | production | Environment name |
| DATABASE_URL | `postgresql://postgres:postgres@postgres:5432/invoicing` | PostgreSQL URL (use `postgres` hostname in Compose) |
| REDIS_URL | `redis://redis:6379` | Redis URL |
| JWT_SECRET | strong random secret | JWT signing key |
| JWT_EXPIRES_IN | 7d | Token lifetime |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM | optional | Required for **Send to company email** on invoices |

#### Frontend (build-time)

| Variable | Description |
|----------|-------------|
| VITE_API_URL | Full API base including `/api`, e.g. `http://localhost:3001/api` (must match the backend URL the browser can reach) |

### Production considerations

1. **JWT_SECRET** — Use a long, random value; never commit real secrets.
2. **Database backups** — The `pgdata` volume holds data; schedule backups (e.g. `pg_dump` to object storage).
3. **TLS** — Terminate HTTPS at nginx, a load balancer, or a reverse proxy (Traefik, Caddy, etc.).
4. **Redis** — Default setup is suitable for rate limits and short-lived caches; data loss on restart is usually acceptable for those use cases.

## Manual deployment

### Backend

```bash
cd backend
npm ci
npm run build
NODE_ENV=production node dist/server.js
```

Ensure `PORT`, `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` are set in the environment.

### Frontend

```bash
cd frontend
npm ci
npm run build
```

Output is in `frontend/dist/`. Serve with any static host (nginx, Caddy, S3 + CloudFront, etc.).

### nginx

The production-oriented config is `frontend/nginx.conf`. It:

- Serves the SPA from `/usr/share/nginx/html`
- Proxies `/api` to the backend upstream
- Uses `try_files` so client-side routes fall back to `index.html`

## Local dev vs Docker ports

- **Docker Compose** maps the backend to **3001** on the host (`3001:3001`).
- **PM2** (`ecosystem.config.js`) uses **3002** for the API; **Vite** proxies `/api` to `localhost:3002` in `frontend/vite.config.ts`.
- **Frontend** `frontend/.env.example` uses `VITE_API_URL=http://localhost:3001/api` — align `PORT`, Vite proxy, and `VITE_API_URL` so they all point at the same API.
