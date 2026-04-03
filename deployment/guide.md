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
| postgres | 5432 | PostgreSQL (`schema.sql` is baked into the **`invoice-postgres`** image; data in `pgdata` volume) |
| redis | 6379 | Redis |
| backend | **3001** | Express API (`PORT=3001` in the container) |
| frontend | **80**, **443** | nginx serving the React SPA; TLS when PEMs exist in the **`ssl_certs`** volume (see [TLS](#tls-lets-encrypt-with-acmesh)) |

**Code changes and `docker compose restart`:** Restarting containers does **not** rebuild images. The frontend and backend Dockerfiles run `npm run build` at **image build** time; the running containers keep whatever was last baked in. After you change source files, rebuild and recreate:

```bash
cd deployment
docker compose -f docker-compose-build.yml up -d --build
```

Use `docker compose -f docker-compose-build.yml build --no-cache` first if you suspect a stale layer. If you change **`backend/src/models/schema.sql`**, rebuild the **`postgres`** image (`docker compose -f docker-compose-build.yml build postgres`) so **`invoice-postgres`** includes the new DDL; **empty** `pgdata` runs init scripts on first start only—existing databases rely on **`ensureSchema()`** and SQL migrations. To wipe Postgres data (destructive), remove the `pgdata` volume — see volume notes below.

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
| JWT_SECRET | strong random secret | JWT signing key |
| JWT_EXPIRES_IN | 7d | Token lifetime |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM | optional | Required for **Send to company email** on invoices |

#### Frontend (build-time)

| Variable | Description |
|----------|-------------|
| VITE_API_URL | Full API base including `/api`, e.g. `http://localhost:3001/api` (must match the backend URL the browser can reach) |

#### Frontend (runtime, Docker Compose)

| Variable | Typical value | Description |
|----------|---------------|-------------|
| NGINX_SERVER_NAME | `clients.opensitesolutions.com` | `server_name` for HTTP/HTTPS; override via env or `.env` next to the compose file you use (`docker-compose-build.yml` / `docker-compose-prod.yml`). |

### Production considerations

1. **JWT_SECRET** — Use a long, random value; never commit real secrets.
2. **Database backups** — The `pgdata` volume holds data; schedule backups (e.g. `pg_dump` to object storage).
3. **TLS** — See [TLS (Let's Encrypt with acme.sh)](#tls-lets-encrypt-with-acmesh) below. The Compose frontend uses named volumes **`ssl_certs`** (PEM files) and **`acme_webroot`** (HTTP-01 challenges)—no paths under the git repo.
4. **Redis** — Default setup is suitable for rate limits and short-lived caches; data loss on restart is usually acceptable for those use cases.

### TLS (Let's Encrypt with acme.sh)

Use this when serving a public hostname (e.g. **`clients.opensitesolutions.com`**) from the Docker host. Your apex/`www` site can stay on GitHub Pages; only this subdomain needs a **DNS A (or AAAA) record** pointing to the **server that runs** Compose (usually **`docker-compose-prod.yml`** in production), not GitHub’s IPs.

**Requirements:** Inbound **TCP 80** (validation) and **TCP 443** (HTTPS). Let’s Encrypt must reach `http://<your-hostname>/.well-known/acme-challenge/...` from the internet.

**Volumes and Compose project name:** Challenge files and TLS keys live in Docker **named volumes** (`acme_webroot`, `ssl_certs`). The volume names on disk are **`{project}_acme_webroot`** and **`{project}_ssl_certs`**, where **`{project}`** defaults to the name of the directory that contains the compose file (usually **`deployment`** when you run commands from inside `deployment/`). Set **`COMPOSE_PROJECT_NAME`** (e.g. `export COMPOSE_PROJECT_NAME=invoicing`) before `up` if you want stable, predictable volume names.

**Bootstrap (first certificate):**

1. From `deployment/`, start the stack so nginx serves port 80 and the **`acme_webroot`** volume is attached at `/var/www/acme-webroot` in the frontend container.
2. On the **host**, install [acme.sh](https://github.com/acmesh-official/acme.sh) (not in GitHub Actions for this app).
3. **Issue (HTTP-01):** On **Linux with Docker Engine**, get the host path for the webroot volume and pass it to `acme.sh -w` (example assumes project name `deployment`; adjust **`PROJECT`** to match `COMPOSE_PROJECT_NAME` or your actual project prefix — `docker volume ls` shows the full name):

   ```bash
   cd /path/to/invoicing/deployment
   docker compose -f docker-compose-prod.yml up -d
   PROJECT="${COMPOSE_PROJECT_NAME:-deployment}"
   WEBROOT=$(docker volume inspect "${PROJECT}_acme_webroot" --format '{{ .Mountpoint }}')
   acme.sh --issue -d clients.opensitesolutions.com -w "$WEBROOT"
   ```

   Use **`-f docker-compose-build.yml`** in the `up` line if that is what you use. On **Docker Desktop** (Mac/Windows), volume host paths are often inside the VM; run acme.sh inside a small container that shares the same volume, or use **DNS-01** instead of webroot—see acme.sh docs.

4. **Install cert files into the `ssl_certs` volume** (filenames must be **`fullchain.pem`** and **`privkey.pem`** as in `frontend/nginx-https.conf.template`). Use the same **`PROJECT`** prefix as in step 3:

   ```bash
   PROJECT="${COMPOSE_PROJECT_NAME:-deployment}"
   SSLDIR=$(docker volume inspect "${PROJECT}_ssl_certs" --format '{{ .Mountpoint }}')
   acme.sh --install-cert -d clients.opensitesolutions.com --ecc \
     --fullchain-file "$SSLDIR/fullchain.pem" \
     --key-file "$SSLDIR/privkey.pem" \
     --reloadcmd "docker compose -f /path/to/invoicing/deployment/docker-compose-prod.yml exec -T frontend nginx -s reload"
   ```

   If you started the stack with **`docker-compose-build.yml`**, use that filename instead of `docker-compose-prod.yml` in `--reloadcmd` so `exec` targets the same project.

   Use **`--ecc`** if you issued with acme.sh’s default EC key (folder name ends with `_ecc` under `~/.acme.sh/`).

5. **Restart the frontend container once** so the entrypoint regenerates nginx config and enables the `:443` server block (a plain `nginx -s reload` alone is not enough the first time, because the running container was started without PEM files):

   ```bash
   cd /path/to/invoicing/deployment && docker compose -f docker-compose-prod.yml up -d --force-recreate frontend
   ```

   Use **`-f docker-compose-build.yml`** instead if that is how you started the stack.

**Renewal:** acme.sh typically installs a cron job. After renew, `--reloadcmd` reloads nginx; the HTTPS `server` block is already present, so reloading applies the new PEM files. Confirm renewal with `acme.sh --cron -d` or your system logs.

**Verification:**

- `curl -I http://clients.opensitesolutions.com/.well-known/acme-challenge/` — connection OK (404 on empty dir is fine).
- Browser: `https://clients.opensitesolutions.com` loads the SPA; `/api` remains same-origin behind nginx.

**HTTP-01 fails with 403 or Let’s Encrypt says the response is HTML (`<!doctype html>` …):**

The validator must receive **plain text** (the key authorization), not your SPA’s `index.html`.

1. **Directory modes from acme.sh (very common)** — acme.sh often creates `.well-known` / `acme-challenge` under the webroot as **`700` (drwx------)**. The container’s **nginx** worker runs as user **`nginx`**, not root, so it **cannot traverse** those directories: you get failures that show up as **wrong body** (e.g. your SPA HTML) and sometimes **403**. Fix on the host using the **volume mountpoint** (same `WEBROOT` as in [Bootstrap](#tls-lets-encrypt-with-acmesh), step 3):

   ```bash
   find "$WEBROOT" -type d -exec chmod 755 {} \;
   find "$WEBROOT" -type f -exec chmod 644 {} \;
   ```

   (`chmod -R a+rX` is not always enough for **directories** if they were created with no “other” execute bit; **`755` on dirs** is reliable.)

2. **Pre-flight check** (before `acme.sh --issue`): prove HTTP serves the webroot, not the SPA (set **`WEBROOT`** from the `acme_webroot` volume as above):

   ```bash
   mkdir -p "$WEBROOT/.well-known/acme-challenge"
   echo ok >"$WEBROOT/.well-known/acme-challenge/ping.txt"
   chmod 755 "$WEBROOT" "$WEBROOT/.well-known" "$WEBROOT/.well-known/acme-challenge"
   chmod 644 "$WEBROOT/.well-known/acme-challenge/ping.txt"
   curl -sS "http://clients.opensitesolutions.com/.well-known/acme-challenge/ping.txt"
   ```

   You must see **`ok`** only. If you see HTML, fix permissions and **`docker compose -f docker-compose-build.yml build --no-cache frontend && docker compose -f docker-compose-build.yml up -d --force-recreate frontend`** (or the matching **`-f docker-compose-prod.yml`** if you only run pre-built images and pulled a new frontend image), and ensure nothing else binds host port **80** ahead of this stack.

3. **Confirm the file is visible inside the container** as user **nginx**:

   ```bash
   cd /path/to/invoicing/deployment
   docker compose -f docker-compose-prod.yml exec -u nginx frontend cat /var/www/acme-webroot/.well-known/acme-challenge/ping.txt
   ```

   Use the **same `-f`** as your deployment (`docker-compose-build.yml` or `docker-compose-prod.yml`).

   If this fails, fix host permissions (step 1).

4. **Confirm nginx has the ACME `location`** (rebuild/recreate frontend after pulling):

   ```bash
   docker compose -f docker-compose-prod.yml exec frontend grep -A4 'well-known/acme-challenge' /etc/nginx/conf.d/default.conf
   ```

   Use the **same `-f`** as your deployment.

5. **Nothing else on port 80** — another reverse proxy, CDN (e.g. Cloudflare “orange cloud”), or host nginx in front must forward `/.well-known/acme-challenge/` to this stack unchanged.

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

## Local dev vs Docker ports

- **Docker Compose** maps the backend to **3001** on the host (`3001:3001`).
- **PM2** (`ecosystem.config.js`) uses **3002** for the API; **Vite** proxies `/api` to `localhost:3002` in `frontend/vite.config.ts`.
- **Frontend** `frontend/.env.example` uses `VITE_API_URL=http://localhost:3001/api` — align `PORT`, Vite proxy, and `VITE_API_URL` so they all point at the same API.
