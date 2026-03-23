# Invoicing

Web app for **freelancers and small businesses** to create invoices, manage clients, track revenue, and export PDFs. Stack: **React + Vite** frontend, **Express + PostgreSQL + Redis** backend.

---

## Features

- **Invoices** — Draft → Sent → Paid; **Late** when 30+ days after sent (`sent_at`); line items as **description + hours** with company hourly rate from Settings  
- **Clients** — Customer numbers, default discount codes  
- **Discounts** — Percent or fixed codes  
- **Company profile** — Tax rate, address, logo, optional **company email** for invoice copy emails  
- **Dashboard** — Revenue stats (cached in Redis)  
- **PDF** — Generate invoice PDFs in the browser (jsPDF)  
- **Email** — Optional **“Email to company”** on an invoice (requires SMTP or API-configured mail on the server)  
- **Jobs** — Daily cron: sent invoices past 30 days → late; recurring invoice drafts  

---

## Repository layout

| Path | Purpose |
|------|---------|
| `frontend/` | React SPA (Vite, Tailwind, React Query, React Router) |
| `backend/` | REST API (`/api`), PostgreSQL, Redis, cron jobs |
| `backend/migrations/` | SQL migrations for existing databases (run manually or via CI) |
| `backend/src/models/schema.sql` | Full schema for fresh installs / Docker init |
| `docs/` | Extra notes (e.g. `deployment.md`) |
| `docker-compose.yml` | Postgres, Redis, backend, frontend |

---

## Prerequisites

- **Node.js 18+**
- **PostgreSQL 16** (or compatible)
- **Redis** (rate limits + revenue cache)

---

## Quick start (local)

### 1. Clone and install

```bash
git clone <repo-url> invoicing
cd invoicing
cd backend && npm install
cd ../frontend && npm install
```

### 2. Environment

**Backend** — copy and edit:

```bash
cp backend/.env.example backend/.env
```

Set at least `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`. See [Environment variables](#environment-variables).

**Frontend** — optional; defaults assume API at `http://localhost:3001/api`:

```bash
cp frontend/.env.example frontend/.env
# Set VITE_API_URL if your API differs (include /api suffix)
```

### 3. Database

Point `DATABASE_URL` at an empty database, then either:

- **Fresh schema:**  
  `psql "$DATABASE_URL" -f backend/src/models/schema.sql`

- **Existing DB:** run migrations in `backend/migrations/` in order (see files `002`–`007`, etc.), or rely on `ensureSchema()` in `backend/src/config/database.ts` for a subset of columns.

### 4. Run

Terminal 1 — API (default port from `backend/.env`, often `3001` or `3002`):

```bash
cd backend && npm run dev
```

Terminal 2 — UI:

```bash
cd frontend && npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Register a user, then use the app.

---

## Docker Compose

From the repo root:

```bash
docker compose up -d
```

Typical ports: **Postgres 5432**, **Redis 6379**, **backend 3001**, **frontend 80**. The backend container uses `DATABASE_URL` pointing at the `postgres` service. Set `SMTP_*` in the shell or a root `.env` if you use **Email to company**.

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port for the API |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWTs (**change in production**) |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `SMTP_HOST` | If set, enables server-side email (e.g. invoice copy). Empty = email endpoint returns 503 |
| `SMTP_PORT` | Usually `587` or `465` |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials when required |
| `SMTP_FROM` | Optional `From` address (defaults toward `SMTP_USER`) |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Base URL for the API **including `/api`** (e.g. `http://localhost:3002/api`) |

---

## NPM scripts

### Backend (`cd backend`)

| Script | Command |
|--------|---------|
| `npm run dev` | Dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run production build |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Jest |

### Frontend (`cd frontend`)

| Script | Command |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production bundle |
| `npm run preview` | Preview production build |

---

## API overview

All JSON routes are under **`/api`** (axios `baseURL` should end with `/api`).

- **Auth** — `POST /auth/register`, `POST /auth/login`  
- **Clients** — CRUD under `/clients`  
- **Invoices** — List/create/update, status, PDF-related data, stats, CSV export, optional `POST /invoices/:id/send-to-company`  
- **Settings** — Company profile and defaults  
- **Discounts** — Discount codes  

Detailed deployment and nginx notes: [`docs/deployment.md`](docs/deployment.md).

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Zustand, React Hook Form, Zod, jsPDF |
| Backend | Express 5, TypeScript, `pg`, `ioredis`, JWT, Zod, `node-cron`, `nodemailer` (optional SMTP) |
| Data | PostgreSQL, Redis |

---

## License

See repository metadata (e.g. `package.json`); add a `LICENSE` file if you need an explicit license.
