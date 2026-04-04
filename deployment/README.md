# Deployment

Production and container deployment for the invoicing app.

**Stack:** PostgreSQL (data), Redis (rate limits + cached stats), Express API, nginx (static SPA + `/api` proxy).

## Documents

| File | Description |
|------|-------------|
| [docker-compose-build.yml](docker-compose-build.yml) | Compose with `build:` for **postgres** (schema baked in), **backend**, and **frontend** — use when developing or building images from this repo on the host |
| [docker-compose-prod.yml](docker-compose-prod.yml) | Compose with Docker Hub images **`maxwayne/invoice-postgres:1.0`**, **`maxwayne/invoice-backend:1.0`**, **`maxwayne/invoice-frontend:1.0`** — use when pulling pre-built images (no rebuild on deploy) |
| [postgres/Dockerfile](postgres/Dockerfile) | Builds `invoice-postgres:1.0` with `schema.sql` in the image (no bind mount from the repo at runtime) |
| [guide.md](guide.md) | Docker Compose (build vs prod), environment variables, manual builds, nginx, port notes |
| [tls.md](tls.md) | **HTTPS / TLS:** Let’s Encrypt with **acme.sh**, host bind mounts under **`DEPLOY_DATA_DIR`**, nginx, renewal, troubleshooting |
| [diagram.md](diagram.md) | Mermaid deployment diagram: images, named volumes (`pgdata`, `uploads_data`), TLS bind mounts, traffic flow |
| [architecture.md](../docs/architecture.md) | System architecture diagrams (Docker stack, startup, request flow, backup import, new-invoice project conflict, invoice preview modal) |

### Which Compose file?

| Goal | File | Typical command (from `deployment/`) |
|------|------|----------------------------------------|
| Build and run from source | `docker-compose-build.yml` | `docker compose -f docker-compose-build.yml up -d --build` |
| Run pre-built images only | `docker-compose-prod.yml` | `docker compose -f docker-compose-prod.yml up -d` (after `docker pull` for **`maxwayne/invoice-*:1.0`** or equivalent) |

**Standalone production (no git clone):** Put **`docker-compose-prod.yml`** and **`.env`** in the same **user-owned directory** on the server (e.g. **`~/invoice`**). From **that** directory:

```bash
mkdir -p data/acme_webroot data/ssl_certs
chown -R "$(id -u):$(id -g)" data
docker compose -f docker-compose-prod.yml up -d
```

Relative paths (**`./data`**, **`.env`**) are resolved from that folder — see **[tls.md](tls.md)** (*compose directory*). When developing from the repo, the compose directory is often **`deployment/`** instead.

Optional (from the compose directory): `export COMPOSE_FILE=docker-compose-prod.yml` so you can omit `-f` for that shell session.

For **`NGINX_SERVER_NAME`**, **`COMPOSE_PROJECT_NAME`**, and **`DEPLOY_DATA_DIR`**, see **[`.env.example`](.env.example)** and **[tls.md](tls.md)**.

### Data storage (named volumes + TLS bind mounts)

**Postgres and uploads** use **named volumes** (no app source bind mount). **TLS** uses **host directories** under **`DEPLOY_DATA_DIR`** (default **`./data`** in the **compose directory** — the folder where **`docker-compose-prod.yml`** and **`.env`** live) so the user running **acme.sh** can write without root under `/var/lib/docker/volumes/`.

| Volume / mount | Used by | Purpose |
|----------------|---------|---------|
| `pgdata` (named) | postgres | PostgreSQL data |
| `uploads_data` (named) | backend | User uploads (e.g. logos) at `/app/uploads` |
| `${DEPLOY_DATA_DIR}/acme_webroot` (bind) | frontend | HTTP-01 challenges → `/var/www/acme-webroot` |
| `${DEPLOY_DATA_DIR}/ssl_certs` (bind) | frontend | TLS PEMs → `/etc/nginx/ssl` (read-only in the container) |

Create **`data/acme_webroot`** and **`data/ssl_certs`** from your **compose directory** and **`chown`** to your deploy user **before** the first **`docker compose up`**. Set **`DEPLOY_DATA_DIR`** in **`.env`** beside the compose file (see **[`.env.example`](.env.example)**).

If you used older Compose definitions with **named** `acme_webroot` / `ssl_certs` volumes, copy files into **`data/`** then remove the old volumes.

TLS / HTTPS: **[tls.md](tls.md)** (summary in [guide.md](guide.md#tls-lets-encrypt-with-acmesh)).

### Building images for production

From the **repository root** (so `deployment/postgres/Dockerfile` can `COPY backend/src/models/schema.sql`):

```bash
docker build -f deployment/postgres/Dockerfile -t invoice-postgres:1.0 .
```

Or build all services from `deployment/`:

```bash
cd deployment
docker compose -f docker-compose-build.yml build postgres backend frontend
```

Tag and push **`invoice-postgres:1.0`**, **`invoice-backend:1.0`**, and **`invoice-frontend:1.0`** to Docker Hub (e.g. **`maxwayne/invoice-*:1.0`**) or your registry as needed.

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
