# Deployment guide

Repository overview: [README.md](../README.md). Project docs (API, database, architecture): [docs/README.md](../docs/README.md). System architecture diagrams: [architecture.md](../docs/architecture.md).

## Docker Compose (recommended)

Two files live in **`deployment/`**:

| File | Use when |
|------|----------|
| **`docker-compose-build.yml`** | You build images from this repo: **`postgres`** (schema baked into `invoice-postgres`), **`backend`**, **`frontend`**. Development, CI, or any host where you run `docker compose build` / `up --build`. |
| **`docker-compose-prod.yml`** | Images are Docker Hub **`maxwayne/invoice-postgres:1.0`**, **`maxwayne/invoice-backend:1.0`**, **`maxwayne/invoice-frontend:1.0`** (or retag after `docker pull`). Production deploy without rebuilding on the server. |

**Convention in this guide:** examples that rebuild images use **`-f docker-compose-build.yml`**. Examples for a server running tagged images use **`-f docker-compose-prod.yml`**. Use the **same `-f` file** you used to start the stack for `exec`, `logs`, and `acme.sh --reloadcmd`.

Optional (from `deployment/`): `export COMPOSE_FILE=docker-compose-build.yml` so you can omit `-f` in that shell.

### Full stack (build from source)

```bash
cd deployment
docker compose -f docker-compose-build.yml up -d
```

### Full stack (pre-built images)

On a server that pulls **`maxwayne/invoice-postgres:1.0`**, **`maxwayne/invoice-backend:1.0`**, and **`maxwayne/invoice-frontend:1.0`** from Docker Hub (or uses images retagged from those names):

```bash
cd deployment
docker compose -f docker-compose-prod.yml up -d
```

No `build:` step on this host; pull/load images first so those tags exist.

| Service | Host port | Description |
|---------|-----------|-------------|
| postgres | 5432 | PostgreSQL (`schema.sql` is baked into the **`invoice-postgres`** image; data under **`${DEPLOY_DATA_DIR}/pgdata`** on the host) |
| redis | *(see below)* | Redis — **not** published to `0.0.0.0` in **`docker-compose-prod.yml`** (internal network only). **`docker-compose-build.yml`** maps **`127.0.0.1:6379`** for local `redis-cli` from the same machine only. |
| backend | **3001** | Express API (`PORT=3001` in the container) |
| frontend | **80**, **443** | nginx serving the React SPA; TLS when PEMs exist under **`DEPLOY_DATA_DIR/ssl_certs`** (bind mount; see [TLS](#tls-lets-encrypt-with-acmesh)) |

**Code changes and `docker compose restart`:** Restarting containers does **not** rebuild images. The frontend and backend Dockerfiles run `npm run build` at **image build** time; the running containers keep whatever was last baked in. After you change source files, rebuild and recreate:

```bash
cd deployment
docker compose -f docker-compose-build.yml up -d --build
```

Use `docker compose -f docker-compose-build.yml build --no-cache` first if you suspect a stale layer. If you change **`backend/src/models/schema.sql`**, rebuild the **`postgres`** image (`docker compose -f docker-compose-build.yml build postgres`) so **`invoice-postgres`** includes the new DDL; an **empty** **`pgdata/`** directory runs init scripts on first start only—existing databases rely on **`ensureSchema()`** and SQL migrations. To wipe Postgres data (destructive), stop the stack and remove the host directory **`data/pgdata`** (or whatever **`DEPLOY_DATA_DIR/pgdata`** resolves to).

**Rebuilt but the UI still looks old?**

1. Rebuild **and recreate** containers (not just `restart`):  
   `cd deployment && docker compose -f docker-compose-build.yml build --no-cache && docker compose -f docker-compose-build.yml up -d --force-recreate`
2. **Hard refresh** the browser (Ctrl+Shift+R / Cmd+Shift+R) or open in a private window — browsers cache `index.html`; nginx is configured to send `no-cache` for it after you rebuild the image that includes the updated nginx templates.
3. Confirm you built from the repo that contains your edits: Compose must run from the **`deployment/`** directory so `context: ../frontend` and `../backend` point at your project (only applies to **`docker-compose-build.yml`**).
4. The frontend image bakes **`VITE_API_URL=/api`** at build time so the SPA talks to nginx’s `/api` proxy (same host). Building without this can leave API calls pointing at `localhost:3002` in the bundle.

**502 / “Host is unreachable” on `/api` after `docker compose -f docker-compose-build.yml up --build`:** nginx used to resolve the `backend` hostname once and keep a stale container IP after the API container was recreated. The frontend **`nginx-*.conf.template`** files use Docker’s DNS (`127.0.0.11`) and a `proxy_pass` **variable** so each request re-resolves `backend`. Rebuild the **frontend** image after pulling that change. Compose also waits for Postgres/Redis to be healthy before starting the API, and for the API health check before starting nginx—see [`docker-compose-build.yml`](docker-compose-build.yml) (or [`docker-compose-prod.yml`](docker-compose-prod.yml) for pre-built images).

**`http://localhost:3001/api/health` does not load (connection refused / timeout):** The API must listen on **`0.0.0.0`** inside the container so Docker’s port publish (`3001:3001`) works; `server.ts` uses `LISTEN_HOST` (default `0.0.0.0`). If the page still fails:

1. `docker compose -f docker-compose-build.yml ps` (or `-f docker-compose-prod.yml` if that is what you deployed) — the **backend** container should be **Up** (not **Restarting**).
2. `docker compose -f <same-as-above> logs backend --tail 100` — look for **`Server listening on http://0.0.0.0:3001`**. If you see **`Failed to ensure database schema`**, Postgres is unreachable or migrations failed (fix `DATABASE_URL`, ensure Postgres is healthy).
3. Rebuild the backend image after changing `server.ts` (build compose only): `docker compose -f docker-compose-build.yml build backend && docker compose -f docker-compose-build.yml up -d backend`.
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
| JWT_SECRET | strong random secret | JWT signing key (API and portal Bearer tokens) |
| JWT_EXPIRES_IN | 7d | Access token lifetime (e.g. **`7d`**, **`24h`**); see **`jsonwebtoken` / `ms`** formats |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM | optional | Required for **Send to company email** on invoices |
| ADMIN_EMAIL | `admin@invoicing.local` (typical) | Email for the **seed admin** user created on first startup if that user does not exist |
| ADMIN_PASSWORD | strong secret | Password for that seed admin; generate e.g. **`openssl rand -base64 24`**. See **[`.env.example`](.env.example)**. |

**Docker Compose:** With **`docker-compose-build.yml`** / **`docker-compose-prod.yml`**, put **`JWT_SECRET`**, **`JWT_EXPIRES_IN`**, **`ADMIN_EMAIL`**, **`ADMIN_PASSWORD`**, and other deploy values in **`.env`** in the **compose directory** (same folder as the compose file). Compose interpolates them into the **backend** service — see **[`.env.example`](.env.example)**.

#### Frontend (build-time)

| Variable | Description |
|----------|-------------|
| VITE_API_URL | Full API base including `/api`, e.g. `http://localhost:3001/api` (must match the backend URL the browser can reach) |

#### Frontend (runtime, Docker Compose)

| Variable | Typical value | Description |
|----------|---------------|-------------|
| NGINX_SERVER_NAME | `clients.opensitesolutions.com` | `server_name` for HTTP/HTTPS; override via env or `.env` next to the compose file you use (`docker-compose-build.yml` / `docker-compose-prod.yml`). |
| DEPLOY_DATA_DIR | `./data` (default via compose) | Compose uses **`${DEPLOY_DATA_DIR:-./data}`**: set in **`.env`** for a custom base, or omit for **`./data`** next to the compose file. Absolute paths allowed. Subdirs **`pgdata/`**, **`uploads/`**, **`acme_webroot/`**, **`ssl_certs/`** must exist under that base before first **`up`**. See **[`.env.example`](.env.example)** and **[tls.md](tls.md)** §2. |

### Production considerations

1. **JWT_SECRET** / **JWT_EXPIRES_IN** — Use a long, random secret in production (**`openssl rand -hex 32`**); set both in **`deployment/.env`** (Compose) or the process environment (manual **`node`**). Never commit real secrets.
2. **ADMIN_EMAIL** / **ADMIN_PASSWORD** — Define the initial admin login in **`.env`** next to compose (defaults and placeholders: **[`.env.example`](.env.example)**). Use a unique **`ADMIN_PASSWORD`** per environment (**`openssl rand -base64 24`**). Changing **`ADMIN_PASSWORD`** later does not alter an existing admin user (see [Troubleshooting](../docs/Troubleshooting.md)).
3. **Database backups** — PostgreSQL data lives under **`DEPLOY_DATA_DIR/pgdata`** on the host; schedule backups (e.g. **`pg_dump`** to object storage).
4. **TLS** — See [TLS (Let's Encrypt with acme.sh)](#tls-lets-encrypt-with-acmesh) below. The Compose frontend **bind-mounts** **`${DEPLOY_DATA_DIR}/ssl_certs`** and **`.../acme_webroot`** (default **`./data`** next to **`docker-compose-prod.yml`**); own those dirs as the user running **acme.sh** (see **[tls.md](tls.md)** — *compose directory*).
5. **Redis** — Default setup is suitable for rate limits and short-lived caches; data loss on restart is usually acceptable. **`docker-compose-prod.yml`** does **not** publish Redis on the host (internal network only). **`docker-compose-build.yml`** uses **`127.0.0.1:6379:6379`**. On public VMs, also use a **cloud firewall** so stray **`ports:`** mappings cannot expose services; see **[README — Published ports and Redis](README.md#published-ports-and-redis-public-cloud)**.

### TLS (Let's Encrypt with acme.sh)

HTTPS is handled by the **frontend** nginx container. Compose **bind-mounts** host directories under **`DEPLOY_DATA_DIR`**: **`acme_webroot/`** → `/var/www/acme-webroot` (HTTP-01) and **`ssl_certs/`** → `/etc/nginx/ssl` (PEMs). The entrypoint switches from the HTTP-only template to the TLS template when **`fullchain.pem`** and **`privkey.pem`** both exist — see [`frontend/docker-entrypoint.sh`](../frontend/docker-entrypoint.sh).

**Full walkthrough** (DNS, ports, `DEPLOY_DATA_DIR`, `acme.sh` install, issue, `install-cert`, `--reloadcmd`, first-time `frontend` recreate, renewal, troubleshooting): **[tls.md](tls.md)**.

**In short:** under **`D="${DEPLOY_DATA_DIR:-./data}"`**, create **`$D/pgdata`**, **`$D/uploads`**, **`$D/acme_webroot`**, **`$D/ssl_certs`** and **`chown`** (see **[`.env.example`](.env.example)**); set **`NGINX_SERVER_NAME`**; open **80** and **443**; run the stack; use **`realpath "$DEPLOY_DATA_DIR/acme_webroot"`** (after loading **`.env`**) as **`acme.sh -w`**; install PEMs into **`ssl_certs/`**; **`docker compose … exec frontend nginx -s reload`** on renew; **`up -d --force-recreate frontend`** once after the first PEM install so nginx loads the HTTPS config.

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

The production-oriented configs are `frontend/nginx-http.conf.template` (HTTP only, used until PEM files exist) and `frontend/nginx-https.conf.template` (port 80 redirect + TLS on 443). The image entrypoint picks one at container start. They:

- Serves the SPA from `/usr/share/nginx/html`
- Proxies `/api` to the backend upstream
- Use `try_files` so client-side routes fall back to `index.html`
- Expose `/.well-known/acme-challenge/` from `/var/www/acme-webroot` for Let’s Encrypt HTTP-01

Issuing certificates and enabling HTTPS: **[tls.md](tls.md)**.

## Local dev vs Docker ports

- **Docker Compose** maps the backend to **3001** on the host (`3001:3001`).
- **PM2** (`ecosystem.config.js`) uses **3002** for the API; **Vite** proxies `/api` to `localhost:3002` in `frontend/vite.config.ts`.
- **Frontend** `frontend/.env.example` uses `VITE_API_URL=http://localhost:3001/api` — align `PORT`, Vite proxy, and `VITE_API_URL` so they all point at the same API.
