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
| frontend | **80**, **443** | nginx serving the React SPA; TLS when certs are in `deployment/ssl/` (see [TLS](#tls-lets-encrypt-with-acmesh)) |

**Code changes and `docker compose restart`:** Restarting containers does **not** rebuild images. The frontend and backend Dockerfiles run `npm run build` at **image build** time; the running containers keep whatever was last baked in. After you change source files, rebuild and recreate:

```bash
cd deployment
docker compose up -d --build
```

Use `docker compose build --no-cache` first if you suspect a stale layer. To wipe Postgres data (destructive), remove the `pgdata` volume — see volume notes below.

**Rebuilt but the UI still looks old?**

1. Rebuild **and recreate** containers (not just `restart`):  
   `cd deployment && docker compose build --no-cache && docker compose up -d --force-recreate`
2. **Hard refresh** the browser (Ctrl+Shift+R / Cmd+Shift+R) or open in a private window — browsers cache `index.html`; nginx is configured to send `no-cache` for it after you rebuild the image that includes the updated nginx templates.
3. Confirm you built from the repo that contains your edits: `docker compose` must run from the **`deployment/`** directory so `context: ../frontend` and `../backend` point at your project.
4. The frontend image bakes **`VITE_API_URL=/api`** at build time so the SPA talks to nginx’s `/api` proxy (same host). Building without this can leave API calls pointing at `localhost:3002` in the bundle.

**502 / “Host is unreachable” on `/api` after `docker compose up --build`:** nginx used to resolve the `backend` hostname once and keep a stale container IP after the API container was recreated. The frontend **`nginx-*.conf.template`** files use Docker’s DNS (`127.0.0.11`) and a `proxy_pass` **variable** so each request re-resolves `backend`. Rebuild the **frontend** image after pulling that change. Compose also waits for Postgres/Redis to be healthy before starting the API, and for the API health check before starting nginx—see `deployment/docker-compose.yml`.

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

#### Frontend (runtime, Docker Compose)

| Variable | Typical value | Description |
|----------|---------------|-------------|
| NGINX_SERVER_NAME | `clients.opensitesolutions.com` | `server_name` for HTTP/HTTPS; override via env or `.env` next to `docker-compose.yml`. |

### Production considerations

1. **JWT_SECRET** — Use a long, random value; never commit real secrets.
2. **Database backups** — The `pgdata` volume holds data; schedule backups (e.g. `pg_dump` to object storage).
3. **TLS** — See [TLS (Let's Encrypt with acme.sh)](#tls-lets-encrypt-with-acmesh) below. The Compose frontend mounts `deployment/ssl/` (PEM files) and `deployment/acme-webroot/` (HTTP-01 challenges).
4. **Redis** — Default setup is suitable for rate limits and short-lived caches; data loss on restart is usually acceptable for those use cases.

### TLS (Let's Encrypt with acme.sh)

Use this when serving a public hostname (e.g. **`clients.opensitesolutions.com`**) from the Docker host. Your apex/`www` site can stay on GitHub Pages; only this subdomain needs a **DNS A (or AAAA) record** pointing to the **server that runs** `docker compose`, not GitHub’s IPs.

**Requirements:** Inbound **TCP 80** (validation) and **TCP 443** (HTTPS). Let’s Encrypt must reach `http://<your-hostname>/.well-known/acme-challenge/...` from the internet.

**Bootstrap (first certificate):**

1. From `deployment/`, start the stack so nginx serves port 80 and the ACME webroot is mounted (`./acme-webroot` → `/var/www/acme-webroot` in the container).
2. On the **host**, install [acme.sh](https://github.com/acmesh-official/acme.sh) (not in GitHub Actions for this app).
3. Issue using the **same webroot path** as on the host (the directory bind-mounted to the container), e.g.:

   ```bash
   acme.sh --issue -d clients.opensitesolutions.com -w /path/to/invoicing/deployment/acme-webroot
   ```

4. Install certificate files into **`deployment/ssl/`** (paths must match `fullchain.pem` and `privkey.pem` as referenced in `frontend/nginx-https.conf.template`):

   ```bash
   acme.sh --install-cert -d clients.opensitesolutions.com --ecc \
     --fullchain-file /path/to/invoicing/deployment/ssl/fullchain.pem \
     --key-file /path/to/invoicing/deployment/ssl/privkey.pem \
     --reloadcmd "docker compose -f /path/to/invoicing/deployment/docker-compose.yml exec -T frontend nginx -s reload"
   ```

   Use **`--ecc`** if you issued with acme.sh’s default EC key (folder name ends with `_ecc` under `~/.acme.sh/`).

5. **Restart the frontend container once** so the entrypoint regenerates nginx config and enables the `:443` server block (a plain `nginx -s reload` alone is not enough the first time, because the running container was started without PEM files):

   ```bash
   cd /path/to/invoicing/deployment && docker compose up -d --force-recreate frontend
   ```

**Renewal:** acme.sh typically installs a cron job. After renew, `--reloadcmd` reloads nginx; the HTTPS `server` block is already present, so reloading applies the new PEM files. Confirm renewal with `acme.sh --cron -d` or your system logs.

**Verification:**

- `curl -I http://clients.opensitesolutions.com/.well-known/acme-challenge/` — connection OK (404 on empty dir is fine).
- Browser: `https://clients.opensitesolutions.com` loads the SPA; `/api` remains same-origin behind nginx.

**HTTP-01 fails with 403 or Let’s Encrypt says the response is HTML (`<!doctype html>` …):**

The validator must receive **plain text** (the key authorization), not your SPA’s `index.html`.

1. **Directory modes from acme.sh (very common)** — acme.sh often creates `acme-webroot/.well-known` and `acme-challenge` as **`700` (drwx------)**. The container’s **nginx** worker runs as user **`nginx`**, not root, so it **cannot traverse** those directories: you get failures that show up as **wrong body** (e.g. your SPA HTML) and sometimes **403**. Fix on the host (run after each issue attempt if needed):

   ```bash
   find /path/to/invoicing/deployment/acme-webroot -type d -exec chmod 755 {} \;
   find /path/to/invoicing/deployment/acme-webroot -type f -exec chmod 644 {} \;
   ```

   (`chmod -R a+rX` is not always enough for **directories** if they were created with no “other” execute bit; **`755` on dirs** is reliable.)

2. **Pre-flight check** (before `acme.sh --issue`): prove HTTP serves the webroot, not the SPA:

   ```bash
   mkdir -p /path/to/invoicing/deployment/acme-webroot/.well-known/acme-challenge
   echo ok >/path/to/invoicing/deployment/acme-webroot/.well-known/acme-challenge/ping.txt
   chmod 755 /path/to/invoicing/deployment/acme-webroot /path/to/invoicing/deployment/acme-webroot/.well-known /path/to/invoicing/deployment/acme-webroot/.well-known/acme-challenge
   chmod 644 /path/to/invoicing/deployment/acme-webroot/.well-known/acme-challenge/ping.txt
   curl -sS "http://clients.opensitesolutions.com/.well-known/acme-challenge/ping.txt"
   ```

   You must see **`ok`** only. If you see HTML, fix permissions and **`docker compose build --no-cache frontend && docker compose up -d --force-recreate frontend`**, and ensure nothing else binds host port **80** ahead of this stack.

3. **Confirm the file is visible inside the container** as user **nginx**:

   ```bash
   cd /path/to/invoicing/deployment
   docker compose exec -u nginx frontend cat /var/www/acme-webroot/.well-known/acme-challenge/ping.txt
   ```

   If this fails, fix host permissions (step 1).

4. **Confirm nginx has the ACME `location`** (rebuild/recreate frontend after pulling):

   ```bash
   docker compose exec frontend grep -A4 'well-known/acme-challenge' /etc/nginx/conf.d/default.conf
   ```

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
