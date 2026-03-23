# Invoicing

Web app for **freelancers and small businesses** to create invoices, manage clients, track revenue, and export PDFs. **React + Vite** frontend, **Express + PostgreSQL + Redis** backend.

---

## Features

- **Invoices** — Draft → Sent → Paid; **Late** when past the late rule after `sent_at`; **Cancelled** via soft-delete for sent/late invoices (drafts hard-delete); line items use **description + hours** and the default hourly rate from Settings
- **Clients** — Customer numbers, optional default discount codes; **[client profile](docs/frontend/routes.md)** (`/clients/:id`) for details, per-client invoice status, and invoice links  
- **Discounts** — Percent or fixed codes  
- **Company profile** — Tax rate, address, logo, optional company email for invoice copy emails  
- **Dashboard** — Revenue stats (cached in Redis)  
- **PDF** — Client-side invoice PDFs (jsPDF)  
- **Share links** — Generate a public URL for any invoice; clients can view and mark as paid without logging in
- **Email** — Optional “email to company” on an invoice (SMTP on the server)
- **Jobs** — Daily cron for late invoices and recurring drafts
- **Data backup** — Download a JSON snapshot of your business data (profile, clients, discount codes, invoices); import replaces that data for the current account (Settings) with strict validation and referential integrity checks

---

## Repository layout

| Path | Purpose |
|------|---------|
| `frontend/` | React SPA (Vite, Tailwind, React Query, React Router) |
| `backend/` | REST API under `/api`, PostgreSQL, Redis, cron jobs |
| `backend/migrations/` | SQL migrations for existing databases |
| `backend/src/models/schema.sql` | Schema for fresh installs / Docker init |
| [`docs/`](docs/README.md) | Project documentation (database, API, stack, guides) |
| [`deployment/`](deployment/README.md) | Deployment guides and diagrams |
| `docker-compose.yml` | Postgres, Redis, backend, frontend |

---

## Documentation

### [`docs/`](docs/README.md)

| Document | Description |
|----------|----------------|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/getting-started.md](docs/getting-started.md) | Local setup, PM2, full Docker stack |
| [docs/tech-stack.md](docs/tech-stack.md) | Languages, frameworks, data stores |
| [docs/database/schema.md](docs/database/schema.md) | Tables, enums, indexes |
| [docs/database/diagram.md](docs/database/diagram.md) | Database ER diagram (Mermaid) |
| [docs/api/review.md](docs/api/review.md) | API design (auth, routing, conventions) |
| [docs/api/reference.md](docs/api/reference.md) | Endpoint reference |
| [docs/frontend/routes.md](docs/frontend/routes.md) | App routes, client profile, deep links |
| [docs/backend/overview.md](docs/backend/overview.md) | Backend architecture and diagram |
| [docs/frontend/overview.md](docs/frontend/overview.md) | Frontend architecture and diagram |

### [`deployment/`](deployment/README.md)

| Document | Description |
|----------|----------------|
| [deployment/README.md](deployment/README.md) | Deployment documentation index |
| [deployment/guide.md](deployment/guide.md) | Docker Compose, environment variables, nginx, manual builds |
| [deployment/diagram.md](deployment/diagram.md) | Deployment topology (Mermaid) |

---

## Quick start

```bash
git clone <repo-url> invoicing
cd invoicing
cd backend && npm install && cd ../frontend && npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env   # optional; set VITE_API_URL to match API port + /api
```

Configure `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` in `backend/.env`. Apply schema: `psql "$DATABASE_URL" -f backend/src/models/schema.sql` (or start Postgres via Docker as in [docs/getting-started.md](docs/getting-started.md)).

**Run locally:** `cd backend && npm run dev` and `cd frontend && npm run dev` (UI usually [http://localhost:5173](http://localhost:5173)).

**Docker (full stack):** `docker compose up -d` — see [deployment/guide.md](deployment/guide.md) for ports and env.

More detail: [docs/getting-started.md](docs/getting-started.md).

---

## Environment variables

Full tables and production notes: **[deployment/guide.md](deployment/guide.md)**.

**Backend:** `PORT`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`; optional `SMTP_*` for invoice email.

**Frontend:** `VITE_API_URL` — base URL **including `/api`**; must match the API port you run (e.g. Docker backend **3001**, or PM2/Vite proxy **3002**).

---

## NPM scripts

| Location | Useful commands |
|----------|-----------------|
| `backend/` | `npm run dev`, `npm run build`, `npm start`, `npm run lint`, `npm test` |
| `frontend/` | `npm run dev`, `npm run build`, `npm run preview` |

---

## License

See repository metadata (e.g. `package.json`); add a `LICENSE` file if you need an explicit license.
