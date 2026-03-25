# Deployment guide

Repository overview: [README.md](../README.md). Project docs (API, database, architecture): [docs/README.md](../docs/README.md). System architecture diagrams: [architecture.md](../docs/architecture.md).

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

**Code changes and `docker compose restart`:** Restarting containers does **not** rebuild images. The frontend and backend Dockerfiles run `npm run build` at **image build** time; the running containers keep whatever was last baked in. After you change source files, rebuild and recreate:

```bash
cd deployment
docker compose up -d --build
```

Use `docker compose build --no-cache` first if you suspect a stale layer. To wipe Postgres data (destructive), remove the `pgdata` volume — see volume notes below.

**Rebuilt but the UI still looks old?**

1. Rebuild **and recreate** containers (not just `restart`):  
   `cd deployment && docker compose build --no-cache && docker compose up -d --force-recreate`
2. **Hard refresh** the browser (Ctrl+Shift+R / Cmd+Shift+R) or open in a private window — browsers cache `index.html`; nginx is configured to send `no-cache` for it after you rebuild the image that includes the updated `nginx.conf`.
3. Confirm you built from the repo that contains your edits: `docker compose` must run from the **`deployment/`** directory so `context: ../frontend` and `../backend` point at your project.
4. The frontend image bakes **`VITE_API_URL=/api`** at build time so the SPA talks to nginx’s `/api` proxy (same host). Building without this can leave API calls pointing at `localhost:3002` in the bundle.

**502 / “Host is unreachable” on `/api` after `docker compose up --build`:** nginx used to resolve the `backend` hostname once and keep a stale container IP after the API container was recreated. The frontend **`nginx.conf`** uses Docker’s DNS (`127.0.0.11`) and a `proxy_pass` **variable** so each request re-resolves `backend`. Rebuild the **frontend** image after pulling that change. Compose also waits for Postgres/Redis to be healthy before starting the API, and for the API health check before starting nginx—see `deployment/docker-compose.yml`.

**`http://localhost:3001/api/health` does not load (connection refused / timeout):** The API must listen on **`0.0.0.0`** inside the container so Docker’s port publish (`3001:3001`) works; `server.ts` uses `LISTEN_HOST` (default `0.0.0.0`). If the page still fails:

1. `docker compose ps` — the **backend** container should be **Up** (not **Restarting**).
2. `docker compose logs backend --tail 100` — look for **`Server listening on http://0.0.0.0:3001`**. If you see **`Failed to ensure database schema`**, Postgres is unreachable or migrations failed (fix `DATABASE_URL`, ensure Postgres is healthy).
3. Rebuild the backend image after changing `server.ts`: `docker compose build backend && docker compose up -d backend`.
4. Confirm nothing else on the host is using port **3001**: `ss -tlnp | grep 3001` (Linux).

For existing databases, apply SQL files in `backend/migrations/` in numeric order after the base schema, or rely on **`ensureSchema()`** on API startup (and before backup import). Details: [Runtime schema upgrades](../docs/database/schema.md#runtime-schema-upgrades).

### Environment variables

#### Backend

| Variable | Typical value | Description |
|----------|---------------|-------------|
| PORT | 3001 (Docker) | API listen port inside the container |
| LISTEN_HOST | `0.0.0.0` (default) | Bind address; use `127.0.0.1` only if you must not listen on all interfaces (not typical in Docker) |
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
