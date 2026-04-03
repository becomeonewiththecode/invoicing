# Deployment

Production and container deployment for the invoicing app.

**Stack:** PostgreSQL (data), Redis (rate limits + cached stats), Express API, nginx (static SPA + `/api` proxy).

## Documents

| File | Description |
|------|-------------|
| [docker-compose-build.yml](docker-compose-build.yml) | Compose with `build:` for backend and frontend — use when developing or building images from this repo on the host |
| [docker-compose-prod.yml](docker-compose-prod.yml) | Compose with `image: invoice-backend:1.0` and `invoice-frontend:1.0` — use on a server when images are already built, tagged, and available (no rebuild on deploy) |
| [guide.md](guide.md) | Docker Compose (build vs prod), environment variables, manual builds, nginx, TLS (acme.sh), port notes |
| [architecture.md](../docs/architecture.md) | System architecture diagrams (Docker stack, startup, request flow, backup import, new-invoice project conflict, invoice preview modal) |

### Which Compose file?

| Goal | File | Typical command (from `deployment/`) |
|------|------|----------------------------------------|
| Build and run from source | `docker-compose-build.yml` | `docker compose -f docker-compose-build.yml up -d --build` |
| Run pre-built images only | `docker-compose-prod.yml` | `docker compose -f docker-compose-prod.yml up -d` (after `docker pull` / `docker load` and correct tags) |

Optional: in `deployment/`, set `export COMPOSE_FILE=docker-compose-build.yml` (or `docker-compose-prod.yml`) so you can omit `-f` for that shell session.

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

**Docker (full stack from source):** `cd deployment && docker compose -f docker-compose-build.yml up -d` — see [guide.md](guide.md) for ports, env, and production image workflow.

More detail: [docs/getting-started.md](../docs/getting-started.md).

---

## Environment variables

Full tables and production notes: **[guide.md](guide.md)**.

**Backend:** `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`; optional `SMTP_*` for invoice email (per-user SMTP settings can also be configured in Settings → Email); `ADMIN_EMAIL` and `ADMIN_PASSWORD` to seed a default admin user on startup (defaults: `admin@invoicing.local` / random password — see `docker-compose-build.yml` and `docker-compose-prod.yml`).

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
