# TLS / HTTPS (Docker Compose, nginx)

This guide covers **HTTPS for the frontend container**: how the nginx image chooses HTTP vs TLS, where certificates live on the **host** (bind mounts), and how to issue and renew **Let’s Encrypt** certificates with **HTTP-01** using **[acme.sh](https://github.com/acmesh-official/acme.sh)**. This application’s deployment path is written around **acme.sh** on the Docker host; follow this document end-to-end for that setup.

**Related files in this repo**

| Item | Role |
|------|------|
| [`docker-compose-prod.yml`](docker-compose-prod.yml) / [`docker-compose-build.yml`](docker-compose-build.yml) | **Bind mounts** under **`DEPLOY_DATA_DIR`** (`acme_webroot/`, `ssl_certs/`) into the **frontend** service (so a normal user can run **acme.sh** without writing under `/var/lib/docker/volumes/`) |
| [`frontend/docker-entrypoint.sh`](../frontend/docker-entrypoint.sh) | If **`/etc/nginx/ssl/fullchain.pem`** and **`privkey.pem`** both exist, uses the HTTPS template; otherwise HTTP only |
| [`frontend/nginx-http.conf.template`](../frontend/nginx-http.conf.template) | Port 80, SPA, `/api` proxy, `/.well-known/acme-challenge/` → `/var/www/acme-webroot` |
| [`frontend/nginx-https.conf.template`](../frontend/nginx-https.conf.template) | HTTP → HTTPS redirect, TLS on 443, same SPA and ACME location |

**Compose directory** — The folder on the server that contains **`docker-compose-prod.yml`** and **`.env`**, and where you run **`docker compose`**. Many deployments **only copy that compose file** (and **`.env`**) into a user-owned path such as **`~/invoice`** or **`/home/app_user/invoice`** — not the full git repo. All relative paths (**`./data`**, **`.env`**) are resolved from **that** directory.

**You should already have:** the stack running (from your compose directory), and a **public DNS name** pointing at this server.

---

## 1. Prerequisites

1. **DNS** — An **A** (or **AAAA**) record for your hostname (e.g. `clients.example.com`) points to the **machine that runs Docker Compose** for this app.
2. **Ports** — Inbound **TCP 80** (Let’s Encrypt HTTP-01) and **TCP 443** (HTTPS). Nothing else on the host should steal port **80** from this stack.
3. **Server name** — Set **`NGINX_SERVER_NAME`** in **`.env`** in the compose directory (see [Configure hostname and project name](#configure-hostname-and-project-name)) so **`docker compose`** and **acme.sh** use the same hostname.
4. **Host directories** — Under **`DEPLOY_DATA_DIR`** (default **`./data`** next to the compose file), create **`acme_webroot/`** and **`ssl_certs/`** owned by the user that runs **acme.sh** (see [section 2](#2-host-bind-mount-paths-deploy_data_dir)). Run **`mkdir`** from the **compose directory** so **`./data/...`** is under that user’s deploy folder. Challenges appear on the host under **`acme_webroot/`** (mounted at **`/var/www/acme-webroot`** in the container). PEMs go in **`ssl_certs/`** (mounted read-only at **`/etc/nginx/ssl`**).

---

## 2. Host bind mount paths (`DEPLOY_DATA_DIR`)

The frontend service uses **bind mounts** for TLS (not Docker named volumes), so **acme.sh** can write to normal directories you own instead of **`/var/lib/docker/volumes/...`** (which is root-owned and causes *Permission denied* for unprivileged users).

| Host path (default) | In container | Purpose |
|---------------------|--------------|---------|
| **`${DEPLOY_DATA_DIR}/acme_webroot`** | `/var/www/acme-webroot` | HTTP-01 challenge files |
| **`${DEPLOY_DATA_DIR}/ssl_certs`** | `/etc/nginx/ssl` | **`fullchain.pem`**, **`privkey.pem`** |

**`DEPLOY_DATA_DIR`** defaults to **`./data`** — resolved **relative to the compose file’s directory** (the folder you **`cd`** into to run **`docker compose`**). For a path outside that folder, set e.g. **`DEPLOY_DATA_DIR=/home/app_user/invoice-data`** (absolute) in **`.env`**.

**Before the first `docker compose up`**, from your **compose directory**, create the directories and own them as the user that will run **acme.sh**:

```bash
cd /path/to/your-compose-directory   # e.g. ~/invoice — same dir as docker-compose-prod.yml
mkdir -p data/acme_webroot data/ssl_certs
chown -R "$(id -u):$(id -g)" data
```

If **`data/`** was already created by Docker as **root**, fix ownership: **`sudo chown -R youruser:yourgroup data`**.

**nginx inside the container** runs as user **`nginx`** and must be able to **read** challenges and PEMs. After **acme.sh** creates files, you may need **`chmod 755`** on directories and **`chmod 644`** on **`fullchain.pem`** / **`privkey.pem`** (see [Troubleshooting](#9-troubleshooting)).

### `COMPOSE_PROJECT_NAME` (named volumes only)

**`COMPOSE_PROJECT_NAME`** affects **named** volumes only (**`pgdata`**, **`uploads_data`**), e.g. **`invoicing_pgdata`**. It does **not** change **`DEPLOY_DATA_DIR`** paths. List them with:

```bash
docker volume ls | grep -E 'pgdata|uploads'
```

---

## 3. Install acme.sh on the host

Run on the **Docker host** (not inside the frontend container), as a user that can run **`docker compose`** and **write to `${DEPLOY_DATA_DIR}/acme_webroot`** and **`.../ssl_certs`** (see [section 2](#2-host-bind-mount-paths-deploy_data_dir)):

```bash
curl https://get.acme.sh | sh -s email=you@example.com
# open a new shell or: source ~/.bashrc   # so `acme.sh` is on PATH
```

Use a real contact email for Let’s Encrypt account notices. See the [acme.sh wiki](https://wiki.acme.sh/) for package installs and **DNS-01** if you cannot use HTTP-01 (e.g. Docker Desktop VM paths).

---

## 4. Start the stack (HTTP first)

From your **compose directory**, ensure **`DEPLOY_DATA_DIR/acme_webroot`** and **`.../ssl_certs`** exist and are writable by your user ([section 2](#2-host-bind-mount-paths-deploy_data_dir)). Then bring the stack up so nginx serves **port 80** with the webroot mounted:

```bash
cd /path/to/your-compose-directory
docker compose -f docker-compose-prod.yml up -d
```

Use **`-f docker-compose-build.yml`** instead if that is how you run the stack. Use the **same `-f`** for every `compose` / `exec` command below.

---

### Configure hostname and project name

**`NGINX_SERVER_NAME`** (hostname nginx serves), **`DEPLOY_DATA_DIR`** (TLS bind mounts on the host), and **`COMPOSE_PROJECT_NAME`** (prefix for **`pgdata`** / **`uploads_data`** named volumes) should be set in one place for **`docker compose`** and for your **acme.sh** shell.

| Approach | When to use |
|----------|-------------|
| **`.env` in the compose directory** | **Preferred** for production and **CI/CD**: copy from the repo’s **[`.env.example`](.env.example)** or generate on the server next to **`docker-compose-prod.yml`**. Compose loads **`.env`** from the directory you run **`docker compose`** in (use the same directory as the compose file). |
| **Shell `export`** | Quick manual runs, or when you already export vars in the job environment (e.g. GitLab `variables:`, GitHub Actions `env:`). |

**Option A — `.env` next to the compose file (recommended)**

Create or update **`.env`** in the same directory as [`docker-compose-prod.yml`](docker-compose-prod.yml) (production). If you build from the git repo, that directory is often **`deployment/`** and you may use [`docker-compose-build.yml`](docker-compose-build.yml) there instead.

```env
# Public hostname — must match the name on the certificate
NGINX_SERVER_NAME=clients.example.com

# Compose project prefix for named volumes only (pgdata, uploads_data)
COMPOSE_PROJECT_NAME=invoicing

# Host directory for acme_webroot/ and ssl_certs/ bind mounts (see tls.md §2)
DEPLOY_DATA_DIR=./data
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

Issue:

```bash
acme.sh --issue -d "$DOMAIN" -w "$WEBROOT"
```

acme.sh writes challenge files under **`$WEBROOT/.well-known/acme-challenge/`**. nginx must serve them as **plain text**, not the SPA HTML — see [Troubleshooting](#9-troubleshooting).

---

## 6. Install PEMs into `ssl_certs` on the host

Reuse the same shell as [section 5](#5-issue-a-certificate-http-01-linux--docker-engine), or **`cd`** to your **compose directory** and run the same **`set -a` / `. ./.env` / `set +a`** block, then:

```bash
DEPLOY_DATA_DIR="${DEPLOY_DATA_DIR:-./data}"
SSLDIR="$(realpath "$DEPLOY_DATA_DIR/ssl_certs")"
```

nginx expects exactly these filenames under **`SSLDIR`** (see templates):

- **`fullchain.pem`**
- **`privkey.pem`**

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

---

## 8. Renewal

acme.sh usually installs a **cron** (or systemd timer) entry. On renew it rewrites the PEM files and runs **`--reloadcmd`**, which reloads nginx inside the container.

Sanity check (see acme.sh docs for your OS; avoid duplicate cron jobs):

```bash
acme.sh --cron
```

---

## 9. Troubleshooting

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
- [README.md](README.md) — deployment index and volume summary
