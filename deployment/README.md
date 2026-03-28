# Deployment

Production and container deployment for the invoicing app.

**Stack:** PostgreSQL (data), Redis (rate limits + cached stats), Express API, nginx (static SPA + `/api` proxy).

## Documents

| File | Description |
|------|-------------|
| [docker-compose.yml](docker-compose.yml) | Docker Compose service definitions (Postgres, Redis, backend, frontend) |
| [guide.md](guide.md) | Docker Compose, environment variables, manual builds, nginx, port notes |
| [architecture.md](../docs/architecture.md) | System architecture diagrams (Docker stack, startup, request flow, backup import, new-invoice project conflict, invoice preview modal) |

---

## Quick start

```bash
git clone <repo-url> invoicing
cd invoicing
cd backend && npm install && cd ../frontend && npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env   # optional; set VITE_API_URL to match API port + /api
```

Configure `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` in `backend/.env`. Apply schema: `psql "$DATABASE_URL" -f backend/src/models/schema.sql` (or start Postgres via Docker as in [docs/getting-started.md](../docs/getting-started.md)).

**Run locally:** `cd backend && npm run dev` and `cd frontend && npm run dev` (UI usually [http://localhost:5173](http://localhost:5173)).

**Docker (full stack):** `cd deployment && docker compose up -d` — see [guide.md](guide.md) for ports and env.

More detail: [docs/getting-started.md](../docs/getting-started.md).

---

## Environment variables

Full tables and production notes: **[guide.md](guide.md)**.

**Backend:** `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`; optional `SMTP_*` for invoice email (per-user SMTP settings can also be configured in Settings → Email); `ADMIN_EMAIL` and `ADMIN_PASSWORD` to seed a default admin user on startup (defaults: `admin@invoicing.local` / random password in `docker-compose.yml`).

**Frontend:** `VITE_API_URL` — base URL **including `/api`**; must match the API port you run (e.g. Docker backend **3001**, or PM2/Vite proxy **3002**).

---

## NPM scripts

| Location | Useful commands |
|----------|-----------------|
| `backend/` | `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm test` |
| `frontend/` | `npm run dev`, `npm run build`, `npm run preview` |

---

## Project documentation

- [docs/README.md](../docs/README.md) — database, API, backend, frontend, tech stack
- [README.md](../README.md) — repository overview
