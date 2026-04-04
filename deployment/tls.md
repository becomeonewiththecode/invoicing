# TLS / HTTPS (Docker Compose, nginx)

This guide covers **HTTPS for the frontend container**: how the nginx image chooses HTTP vs TLS, where certificates live on the **host** (bind mounts), and how to issue and renew **Let’s Encrypt** certificates with **HTTP-01** using **[acme.sh](https://github.com/acmesh-official/acme.sh)**. This application’s deployment path is written around **acme.sh** on the Docker host; follow this document end-to-end for that setup.

**Related files in this repo**

| Item | Role |
|------|------|
| [`docker-compose-prod.yml`](docker-compose-prod.yml) / [`docker-compose-build.yml`](docker-compose-build.yml) | **Bind mounts** under **`DEPLOY_DATA_DIR`**: **`pgdata/`**, **`uploads/`** (postgres, backend), plus **`acme_webroot/`**, **`ssl_certs/`** (frontend TLS) — normal host dirs so deploy users and **acme.sh** need not write under `/var/lib/docker/volumes/` |
| [`frontend/docker-entrypoint.sh`](../frontend/docker-entrypoint.sh) | If **`fullchain.pem`** and a private key (**`privkey.pem`** or **`key.pem`**) exist, uses the HTTPS template; otherwise HTTP only |
| [`frontend/nginx-http.conf.template`](../frontend/nginx-http.conf.template) | Port 80, SPA, `/api` proxy, `/.well-known/acme-challenge/` → `/var/www/acme-webroot` |
| [`frontend/nginx-https.conf.template`](../frontend/nginx-https.conf.template) | HTTP → HTTPS redirect, TLS on 443, same SPA and ACME location |

**Compose directory** — The folder on the server that contains **`docker-compose-prod.yml`** and **`.env`**, and where you run **`docker compose`**. Many deployments **only copy that compose file** (and **`.env`**) into a user-owned path such as **`~/invoice`** or **`/home/app_user/invoice`** — not the full git repo. All relative paths (**`./data`**, **`.env`**) are resolved from **that** directory.

**You should already have:** the stack running (from your compose directory), and a **public DNS name** pointing at this server.

---

## 1. Prerequisites

1. **DNS** — An **A** (or **AAAA**) record for your hostname (e.g. `clients.example.com`) points to the **machine that runs Docker Compose** for this app.
2. **Ports** — Inbound **TCP 80** (Let’s Encrypt HTTP-01) and **TCP 443** (HTTPS). Nothing else on the host should steal port **80** from this stack.
3. **Server name** — Set **`NGINX_SERVER_NAME`** in **`.env`** in the compose directory (see [Configure hostname and project name](#configure-hostname-and-project-name)) so **`docker compose`** and **acme.sh** use the same hostname.
4. **Host directories** — Under **`DEPLOY_DATA_DIR`** (default **`./data`** next to the compose file), create **`pgdata/`**, **`uploads/`**, **`acme_webroot/`**, and **`ssl_certs/`** owned by your deploy user (see [section 2](#2-host-bind-mount-paths-deploy_data_dir)). For TLS, challenges live under **`acme_webroot/`** (mounted at **`/var/www/acme-webroot`**) and PEMs in **`ssl_certs/`** (read-only at **`/etc/nginx/ssl`**).

---

## 2. Host bind mount paths (`DEPLOY_DATA_DIR`)

Compose uses **host bind mounts** under **`DEPLOY_DATA_DIR`** for database files, uploads, and TLS — not Docker named volumes for those paths — so **acme.sh** and backups can use normal directories you own instead of **`/var/lib/docker/volumes/...`** (root-owned; *Permission denied* for unprivileged users).

| Host path (default) | In container | Purpose |
|---------------------|--------------|---------|
| **`${DEPLOY_DATA_DIR}/pgdata`** | `/var/lib/postgresql/data` | PostgreSQL data |
| **`${DEPLOY_DATA_DIR}/uploads`** | `/app/uploads` | Backend user uploads (e.g. logos) |
| **`${DEPLOY_DATA_DIR}/acme_webroot`** | `/var/www/acme-webroot` | HTTP-01 challenge files |
| **`${DEPLOY_DATA_DIR}/ssl_certs`** | `/etc/nginx/ssl` | **`fullchain.pem`** plus **`privkey.pem`** (recommended) or **`key.pem`** (common **acme.sh** default) |

In **[`docker-compose-prod.yml`](docker-compose-prod.yml)** and **[`docker-compose-build.yml`](docker-compose-build.yml)**, paths use **[variable interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)** with a default:

**`${DEPLOY_DATA_DIR:-./data}`** — use **`DEPLOY_DATA_DIR`** from **`.env`** (or the shell) when set; otherwise **`./data`** (a directory named **`data`** next to the compose file). Full reference and examples: **[`.env.example`](.env.example)**.

**`DEPLOY_DATA_DIR`** is resolved **relative to the compose file’s directory** when it is a relative path (the folder you **`cd`** into to run **`docker compose`**). For a path outside that folder, set e.g. **`DEPLOY_DATA_DIR=/home/app_user/invoice-data`** (absolute) in **`.env`**.

**Before the first `docker compose up`**, from your **compose directory**, create the subdirectories under that base and own them (works for any **`DEPLOY_DATA_DIR`** if you export it or **`set -a; . ./.env; set +a`** first):

```bash
cd /path/to/your-compose-directory   # e.g. ~/invoice — same dir as docker-compose-prod.yml
D="${DEPLOY_DATA_DIR:-./data}"
mkdir -p "$D/pgdata" "$D/uploads" "$D/acme_webroot" "$D/ssl_certs"
chown -R "$(id -u):$(id -g)" "$D"
```

If **`$D`** was already created by Docker as **root**, fix ownership: **`sudo chown -R youruser:yourgroup "$D"`** (or the path you set in **`.env`**).

**nginx inside the container** runs as user **`nginx`** and must be able to **read** challenges and PEMs. After **acme.sh** creates files, you may need **`chmod 755`** on directories and **`chmod 644`** on **`fullchain.pem`** / **`privkey.pem`** (see [Troubleshooting](#9-troubleshooting)).

### `COMPOSE_PROJECT_NAME` (containers and networks)

**`COMPOSE_PROJECT_NAME`** prefixes **container names** and the default **Docker network** for the project. It does **not** change paths under **`DEPLOY_DATA_DIR`** (those are always the host directories you configure in **`.env`**).

---

## 3. Install acme.sh on the host

Run on the **Docker host** (not inside the frontend container), as a user that can run **`docker compose`** and **write to `${DEPLOY_DATA_DIR}/acme_webroot`** and **`.../ssl_certs`** (see [section 2](#2-host-bind-mount-paths-deploy_data_dir)):

```bash
curl https://get.acme.sh | sh -s email=you@example.com
# open a new shell or: source ~/.bashrc   # so `acme.sh` is on PATH
```

Use a real contact email for account notices. See the [acme.sh wiki](https://wiki.acme.sh/) for package installs and **DNS-01** if you cannot use HTTP-01 (e.g. Docker Desktop VM paths).

### Use **Let’s Encrypt** as the CA (not ZeroSSL)

Recent **acme.sh** versions often default to **ZeroSSL** (`acme.zerossl.com`). Logs that show **`Using CA: https://acme.zerossl.com/...`** or errors like **`retryafter=86400`** are from that CA. This deployment guide assumes **Let’s Encrypt**.

**Set Let’s Encrypt as the default** (once per Unix user that runs **acme.sh**):

```bash
acme.sh --set-default-ca --server letsencrypt
```

After that, **`--issue`** / **`--renew`** use Let’s Encrypt. You can confirm with **`acme.sh --issue ...`** — the log should show **`acme-v02.api.letsencrypt.org`**.

**Or** pass **`--server letsencrypt`** on each command (does not change the global default):

```bash
acme.sh --issue -d "$DOMAIN" -w "$WEBROOT" --server letsencrypt
```

If you started an order with ZeroSSL and switch CAs, remove or rename the domain folder under **`~/.acme.sh/`** for a clean re-issue, or use **`acme.sh --issue ... --force`** per [acme.sh debugging](https://github.com/acmesh-official/acme.sh/wiki/How-to-debug-acme.sh).

---

## 4. Start the stack (HTTP first)

From your **compose directory**, ensure **`DEPLOY_DATA_DIR`** contains **`pgdata/`**, **`uploads/`**, **`acme_webroot/`**, and **`ssl_certs/`** as in [section 2](#2-host-bind-mount-paths-deploy_data_dir). Then bring the stack up so nginx serves **port 80** with the webroot mounted:

```bash
cd /path/to/your-compose-directory
docker compose -f docker-compose-prod.yml up -d
```

Use **`-f docker-compose-build.yml`** instead if that is how you run the stack. Use the **same `-f`** for every `compose` / `exec` command below.

---

### Configure hostname and project name

**`NGINX_SERVER_NAME`** (hostname nginx serves), **`DEPLOY_DATA_DIR`** (all data/TLS bind mounts on the host), **`JWT_SECRET`** / **`JWT_EXPIRES_IN`** (backend JWT signing), **`ADMIN_EMAIL`** / **`ADMIN_PASSWORD`** (seed admin user), and **`COMPOSE_PROJECT_NAME`** should live in **`.env`** for **`docker compose`**. For **acme.sh**, only hostname and **`DEPLOY_DATA_DIR`** paths need to match (JWT and admin vars are not used by acme).

| Approach | When to use |
|----------|-------------|
| **`.env` in the compose directory** | **Preferred** for production and **CI/CD**: copy from the repo’s **[`.env.example`](.env.example)** or generate on the server next to **`docker-compose-prod.yml`**. Compose loads **`.env`** from the directory you run **`docker compose`** in (use the same directory as the compose file). |
| **Shell `export`** | Quick manual runs, or when you already export vars in the job environment (e.g. GitLab `variables:`, GitHub Actions `env:`). |

**Option A — `.env` next to the compose file (recommended)**

Create or update **`.env`** in the same directory as [`docker-compose-prod.yml`](docker-compose-prod.yml) (production). If you build from the git repo, that directory is often **`deployment/`** and you may use [`docker-compose-build.yml`](docker-compose-build.yml) there instead.

```env
# Public hostname — must match the name on the certificate
NGINX_SERVER_NAME=clients.example.com

# Compose project prefix (containers / network — not bind-mount paths)
COMPOSE_PROJECT_NAME=invoicing

# Bind mounts use ${DEPLOY_DATA_DIR:-./data} in compose — see .env.example for full notes
DEPLOY_DATA_DIR=./data

# JWT and seed admin (see .env.example for full examples)
# JWT_SECRET=...
# JWT_EXPIRES_IN=7d
# ADMIN_EMAIL=admin@invoicing.local
# ADMIN_PASSWORD=...
```

- **`docker compose`** reads **`.env`** from the **current working directory**; **`cd`** to the compose directory first so it finds the file next to **`docker-compose-prod.yml`**.
- Do **not** commit a real production `.env` with secrets. Start from the repo’s **[`.env.example`](.env.example)** on the server: `cp .env.example .env` and edit, or have CI write **`.env`** in the deploy folder before **`docker compose`** and acme steps.

**Option B — shell only**

```bash
export NGINX_SERVER_NAME=clients.example.com
export COMPOSE_PROJECT_NAME=invoicing
```

Run **`docker compose up`** in the same environment so containers get **`NGINX_SERVER_NAME`**.

---

## 5. Issue a certificate (HTTP-01, Linux + Docker Engine)

On the Docker host, **`cd`** to your **compose directory** (where **`docker-compose-prod.yml`** and **`.env`** live), load the same variables as Compose, and set **`WEBROOT`** to the **absolute host path** of **`acme_webroot`** (not **`docker volume inspect`** — TLS uses bind mounts).

**If you use `.env`** (recommended — works well in CI/CD scripts):

```bash
cd /path/to/your-compose-directory
set -a
[ -f .env ] && . ./.env
set +a

DEPLOY_DATA_DIR="${DEPLOY_DATA_DIR:-./data}"
WEBROOT="$(realpath "$DEPLOY_DATA_DIR/acme_webroot")"
DOMAIN="${NGINX_SERVER_NAME}"
```

**If you use shell-only configuration** (no `.env`):

```bash
cd /path/to/your-compose-directory
export NGINX_SERVER_NAME=clients.example.com
export DEPLOY_DATA_DIR=./data

WEBROOT="$(realpath "$DEPLOY_DATA_DIR/acme_webroot")"
DOMAIN="${NGINX_SERVER_NAME}"
```

**Where each value comes from**

| Variable | Source |
|----------|--------|
| **`DOMAIN`** | Use **`NGINX_SERVER_NAME`** so the cert matches nginx. Set in **`.env`** in the compose directory or **`export`**; Compose passes it to the frontend ([`docker-compose-prod.yml`](docker-compose-prod.yml) / [`docker-compose-build.yml`](docker-compose-build.yml)). |
| **`WEBROOT`** | **`realpath "$DEPLOY_DATA_DIR/acme_webroot"`** — the same directory bind-mounted into the container. **`DEPLOY_DATA_DIR`** is in **`.env`** or **`export`** (default **`./data`**). |
| **`DEPLOY_DATA_DIR`** | See [section 2](#2-host-bind-mount-paths-deploy_data_dir). Must be writable by the user running **acme.sh**. |

Issue (includes **`--server letsencrypt`** so this works even if the default CA is still ZeroSSL):

```bash
acme.sh --issue -d "$DOMAIN" -w "$WEBROOT" --server letsencrypt
```

If you already ran **`acme.sh --set-default-ca --server letsencrypt`** (see **Use Let’s Encrypt as the CA** in §3), you may omit **`--server letsencrypt`**.

acme.sh writes challenge files under **`$WEBROOT/.well-known/acme-challenge/`**. nginx must serve them as **plain text**, not the SPA HTML — see [Troubleshooting](#9-troubleshooting).

---

## 6. Install PEMs into `ssl_certs` on the host

Reuse the same shell as [section 5](#5-issue-a-certificate-http-01-linux--docker-engine), or **`cd`** to your **compose directory** and run the same **`set -a` / `. ./.env` / `set +a`** block, then:

```bash
DEPLOY_DATA_DIR="${DEPLOY_DATA_DIR:-./data}"
SSLDIR="$(realpath "$DEPLOY_DATA_DIR/ssl_certs")"
```

nginx expects **`fullchain.pem`** and a private key file:

- **`privkey.pem`** (matches **nginx** / Let’s Encrypt examples; use **`--key-file "$SSLDIR/privkey.pem"`** in **`--install-cert`**), **or**
- **`key.pem`** if **acme.sh** was configured to write that name — the frontend entrypoint supports either.

**`NGINX_SERVER_NAME`** in **`.env`** must match the certificate hostname (e.g. **`clients.millsresidence.com`**), not an old default like **`clients.opensitesolutions.com`**, or browsers may show certificate errors.

```bash
COMPOSE_FILE_ABS="/path/to/your-compose-directory/docker-compose-prod.yml"

acme.sh --install-cert -d "$DOMAIN" \
  --fullchain-file "$SSLDIR/fullchain.pem" \
  --key-file "$SSLDIR/privkey.pem" \
  --reloadcmd "docker compose -f $COMPOSE_FILE_ABS exec -T frontend nginx -s reload"
```

If you issued an **EC** certificate, add **`--ecc`** to the **`--install-cert`** command (for example after the **`-d`** line), matching the key type you used for **`--issue`**.

Notes:

- **`--reloadcmd`** must run **`docker compose`** in a context that finds the **same** project as **`up`** (same **`COMPOSE_PROJECT_NAME`** and compose file). Easiest: embed a **`cd`** into the compose directory, e.g.  
  `--reloadcmd "cd /path/to/your-compose-directory && docker compose -f docker-compose-prod.yml exec -T frontend nginx -s reload"`
- Escape or quote paths if they contain spaces.

---

## 7. Enable HTTPS in nginx (first time)

After PEMs exist, the **entrypoint** must regenerate **`default.conf`** to pick the HTTPS template. **Recreate** the frontend container once:

```bash
cd /path/to/your-compose-directory
docker compose -f docker-compose-prod.yml up -d --force-recreate frontend
```

A plain **`nginx -s reload`** is not enough the **first** time PEMs appear; afterward, renewals can rely on **`--reloadcmd`**.

### Verify TLS after recreate

From your **compose directory** (with **`.env`** loaded if you use **`$NGINX_SERVER_NAME`** in **`curl`**):

1. **Confirm nginx has a 443 block and cert paths** (expect **`listen 443 ssl`**, **`ssl_certificate`**, **`server_name`** matching your hostname):

   ```bash
   docker compose -f docker-compose-prod.yml exec frontend nginx -T | grep -E "listen|ssl_certificate|server_name"
   ```

2. **Confirm `server_name` matches the certificate** — set **`NGINX_SERVER_NAME`** in **`.env`** to that name, then **`docker compose -f docker-compose-prod.yml up -d --force-recreate frontend`** again if you changed it. Inspect the cert:

   ```bash
   openssl x509 -in data/ssl_certs/fullchain.pem -noout -subject -ext subjectAltName
   ```

3. **Quick check from the network** (replace the host with yours):

   ```bash
   curl -vI "https://clients.example.com/" 2>&1 | grep -E "subject|issuer|HTTP|SSL"
   ```

4. If nginx **fails to start** or TLS is **invalid**, see **`docker compose -f docker-compose-prod.yml logs frontend`** and confirm the private key matches the cert (hashes must be equal):

   ```bash
   openssl x509 -noout -pubkey -in data/ssl_certs/fullchain.pem | openssl sha256
   openssl pkey -pubout -in data/ssl_certs/privkey.pem 2>/dev/null | openssl sha256
   ```

   If you only have **`key.pem`**, use that file in the second command instead. **EC** keys often produce small PEM files (~200–300 bytes); that can be normal.

---

## 8. Renewal

acme.sh usually installs a **cron** (or systemd timer) entry. On renew it rewrites the PEM files and runs **`--reloadcmd`**, which reloads nginx inside the container.

Sanity check (see acme.sh docs for your OS; avoid duplicate cron jobs):

```bash
acme.sh --cron
```

---

## 9. Troubleshooting

### Browser shows **Not secure** but certs exist; **`nginx -T`** only shows **`listen 80`**

The frontend container only switches to the **HTTPS** template when **`fullchain.pem`** is present **and** a private key exists as **`privkey.pem`** or **`key.pem`**. If you only had **`key.pem`**, older images looked for **`privkey.pem`** only and stayed on **HTTP**.

**Workaround without rebuilding the image:** copy the key to the name the entrypoint expects, from your **compose directory**:

```bash
cp data/ssl_certs/key.pem data/ssl_certs/privkey.pem
docker compose -f docker-compose-prod.yml up -d --force-recreate frontend
```

The entrypoint runs **only when the container starts**; **`docker compose restart frontend`** is not enough if the running container was already started without **`privkey.pem`** — use **`--force-recreate`**.

**After HTTPS is enabled**, set **`NGINX_SERVER_NAME`** in **`.env`** to the exact hostname on the certificate (e.g. **`clients.millsresidence.com`**) and recreate the frontend again — otherwise **`server_name`** may not match the cert, and the browser will still warn. Check the cert with:

```bash
openssl x509 -in data/ssl_certs/fullchain.pem -noout -subject -ext subjectAltName
```

**Prefer long-term:** rebuild/pull the **frontend** image from this repo (entrypoint accepts **`key.pem`** or **`privkey.pem`**) so you do not need the **`cp key.pem privkey.pem`** step on older images.

### ZeroSSL / **`retryafter=86400`** / “CA is processing your order”

You are likely on **ZeroSSL**, not **Let’s Encrypt**. Run **`acme.sh --set-default-ca --server letsencrypt`** and re-run **`--issue`** with **`--server letsencrypt`**, or clear the partial order under **`~/.acme.sh/`** for that hostname if acme.sh keeps retrying the wrong CA (see **Use Let’s Encrypt as the CA** in §3).

### Let’s Encrypt sees HTML instead of the challenge token

Often **directory permissions**: acme.sh may create **`700`** dirs under the webroot; nginx workers run as user **`nginx`** and cannot traverse them. From the host, with **`WEBROOT`** set as in [section 5](#5-issue-a-certificate-http-01-linux--docker-engine):

```bash
find "$WEBROOT" -type d -exec chmod 755 {} \;
find "$WEBROOT" -type f -exec chmod 644 {} \;
```

### Pre-flight: prove port 80 serves the webroot

```bash
mkdir -p "$WEBROOT/.well-known/acme-challenge"
echo ok >"$WEBROOT/.well-known/acme-challenge/ping.txt"
chmod 755 "$WEBROOT" "$WEBROOT/.well-known" "$WEBROOT/.well-known/acme-challenge"
chmod 644 "$WEBROOT/.well-known/acme-challenge/ping.txt"
curl -sS "http://${DOMAIN}/.well-known/acme-challenge/ping.txt"
```

You should see **`ok`** only. If you see HTML, fix permissions, ensure **`NGINX_SERVER_NAME`** matches **`DOMAIN`**, and ensure no other service binds host port **80**.

### Confirm visibility inside the container (as `nginx`)

```bash
docker compose -f docker-compose-prod.yml exec -u nginx frontend \
  cat /var/www/acme-webroot/.well-known/acme-challenge/ping.txt
```

### Confirm nginx has the ACME `location`

```bash
docker compose -f docker-compose-prod.yml exec frontend \
  grep -A4 'well-known/acme-challenge' /etc/nginx/conf.d/default.conf
```

### Cloudflare or another proxy

HTTP-01 must reach **this** stack. If you use a CDN, either pause proxying (“grey cloud”) for issuance or use **DNS-01** with acme.sh instead of webroot.

### Docker Desktop (Mac / Windows)

Bind mounts still use host paths, but behaviour differs from Linux. Prefer **Linux production hosts** for HTTP-01, or use **DNS-01** with acme.sh.

---

## 10. Quick verification

```bash
curl -I "http://${DOMAIN}/.well-known/acme-challenge/"
```

Connection OK; **404** on an empty directory is fine.

```bash
curl -I "https://${DOMAIN}/"
```

Should return **200** (or redirect chain ending on your app) with a valid certificate after [section 7](#7-enable-https-in-nginx-first-time).

---

## See also

- [guide.md](guide.md) — full deployment guide (Compose, env vars, ports)
- [README.md](README.md) — deployment index and data / TLS path summary
