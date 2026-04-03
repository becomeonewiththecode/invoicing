# TLS / HTTPS (Docker Compose, nginx)

This guide covers **HTTPS for the frontend container**: how the nginx image chooses HTTP vs TLS, where certificates live in Docker volumes, and how to issue and renew **Let’s Encrypt** certificates with **HTTP-01** using **[acme.sh](https://github.com/acmesh-official/acme.sh)**. This application’s deployment path is written around **acme.sh** on the Docker host; follow this document end-to-end for that setup.

**Related files in this repo**

| Item | Role |
|------|------|
| [`docker-compose-prod.yml`](docker-compose-prod.yml) / [`docker-compose-build.yml`](docker-compose-build.yml) | Named volumes **`acme_webroot`** and **`ssl_certs`** mounted into the **frontend** service |
| [`frontend/docker-entrypoint.sh`](../frontend/docker-entrypoint.sh) | If **`/etc/nginx/ssl/fullchain.pem`** and **`privkey.pem`** both exist, uses the HTTPS template; otherwise HTTP only |
| [`frontend/nginx-http.conf.template`](../frontend/nginx-http.conf.template) | Port 80, SPA, `/api` proxy, `/.well-known/acme-challenge/` → `/var/www/acme-webroot` |
| [`frontend/nginx-https.conf.template`](../frontend/nginx-https.conf.template) | HTTP → HTTPS redirect, TLS on 443, same SPA and ACME location |

**You should already have:** the stack running from `deployment/` with Compose (build or prod file), and a **public DNS name** pointing at this server.

---

## 1. Prerequisites

1. **DNS** — An **A** (or **AAAA**) record for your hostname (e.g. `clients.example.com`) points to the **machine that runs Docker Compose** for this app.
2. **Ports** — Inbound **TCP 80** (Let’s Encrypt HTTP-01) and **TCP 443** (HTTPS). Nothing else on the host should steal port **80** from this stack.
3. **Server name** — Set **`NGINX_SERVER_NAME`** to that hostname (Compose env or `.env` next to your compose file). It must match the name on the certificate.
4. **Volumes** — Challenges are written under the **`acme_webroot`** volume (mounted at **`/var/www/acme-webroot`** in the container). PEM files must end up in the **`ssl_certs`** volume (mounted read-only at **`/etc/nginx/ssl`**).

---

## 2. How the project name maps to volume names

Docker names volumes **`{compose_project}_{volume_key}`**. The project name defaults to the **directory name** of the compose file’s folder when you run `docker compose` from **`deployment/`** — often **`deployment`**.

To use a fixed prefix (recommended on servers):

```bash
export COMPOSE_PROJECT_NAME=invoicing
```

Then volumes are typically **`invoicing_acme_webroot`** and **`invoicing_ssl_certs`**.

List what you actually have:

```bash
docker volume ls | grep -E 'acme_webroot|ssl_certs'
```

In the commands below, **`PROJECT`** must match that prefix (without `_acme_webroot`).

---

## 3. Install acme.sh on the host

Run on the **Docker host** (not inside the frontend container), as a user that can run `docker compose` and write to volume mountpoints:

```bash
curl https://get.acme.sh | sh -s email=you@example.com
# open a new shell or: source ~/.bashrc   # so `acme.sh` is on PATH
```

Use a real contact email for Let’s Encrypt account notices. See the [acme.sh wiki](https://wiki.acme.sh/) for package installs and **DNS-01** if you cannot use HTTP-01 (e.g. Docker Desktop VM paths).

---

## 4. Start the stack (HTTP first)

From **`deployment/`**, bring the stack up so nginx serves **port 80** and the **`acme_webroot`** volume is attached:

```bash
cd /path/to/invoicing/deployment
docker compose -f docker-compose-prod.yml up -d
```

Use **`-f docker-compose-build.yml`** instead if that is how you run the stack. Use the **same `-f`** for every `compose` / `exec` command below.

---

## 5. Issue a certificate (HTTP-01, Linux + Docker Engine)

Set variables in your **shell** on the Docker host (these are not keys in the app’s repo—they exist only for the commands you run in that terminal):

```bash
DOMAIN="clients.example.com"
PROJECT="${COMPOSE_PROJECT_NAME:-deployment}"
WEBROOT=$(docker volume inspect "${PROJECT}_acme_webroot" --format '{{ .Mountpoint }}')
```

**Where each value is defined**

| Variable | Where it comes from |
|----------|---------------------|
| **`DOMAIN`** | You set it in the shell (e.g. `DOMAIN="clients.example.com"`). It **must match** the hostname nginx uses: **`NGINX_SERVER_NAME`**. That is passed into the frontend container from Compose: [`docker-compose-prod.yml`](docker-compose-prod.yml) and [`docker-compose-build.yml`](docker-compose-build.yml) both have `NGINX_SERVER_NAME: ${NGINX_SERVER_NAME:-clients.opensitesolutions.com}`. Override the default by creating **`deployment/.env`** (same directory as the compose file) with `NGINX_SERVER_NAME=your.hostname.com`, or `export NGINX_SERVER_NAME=...` before `docker compose up`. |
| **`PROJECT`** | Taken from the shell environment variable **`COMPOSE_PROJECT_NAME`** if you exported it before **`docker compose up`** (see [section 2](#2-how-the-project-name-maps-to-volume-names)). If unset, the snippet uses the literal fallback **`deployment`**—that only matches Docker’s volume prefix when your project name actually is `deployment` (common when the project directory is named `deployment`). If your volumes are named like `invoicing_acme_webroot`, run `export COMPOSE_PROJECT_NAME=invoicing` **before** the first `up`, or set **`PROJECT`** manually to that prefix when running these commands. |
| **`WEBROOT`** | Not configured in a file. It is the **host path** Docker reports for the volume **`${PROJECT}_acme_webroot`**, from `docker volume inspect`. |

Issue:

```bash
acme.sh --issue -d "$DOMAIN" -w "$WEBROOT"
```

acme.sh writes challenge files under **`$WEBROOT/.well-known/acme-challenge/`**. nginx must serve them as **plain text**, not the SPA HTML — see [Troubleshooting](#9-troubleshooting).

---

## 6. Install PEMs into the `ssl_certs` volume

nginx expects exactly these filenames (see templates):

- **`fullchain.pem`**
- **`privkey.pem`**

```bash
SSLDIR=$(docker volume inspect "${PROJECT}_ssl_certs" --format '{{ .Mountpoint }}')
COMPOSE_FILE_ABS="/path/to/invoicing/deployment/docker-compose-prod.yml"

acme.sh --install-cert -d "$DOMAIN" \
  --fullchain-file "$SSLDIR/fullchain.pem" \
  --key-file "$SSLDIR/privkey.pem" \
  --reloadcmd "docker compose -f $COMPOSE_FILE_ABS exec -T frontend nginx -s reload"
```

If you issued an **EC** certificate, add **`--ecc`** to the **`--install-cert`** command (for example after the **`-d`** line), matching the key type you used for **`--issue`**.

Notes:

- **`--reloadcmd`** must use the **same** compose file path and project you used for **`up`** (so `exec` hits the right containers).
- Escape or quote **`$COMPOSE_FILE_ABS`** if the path contains spaces.

---

## 7. Enable HTTPS in nginx (first time)

After PEMs exist, the **entrypoint** must regenerate **`default.conf`** to pick the HTTPS template. **Recreate** the frontend container once:

```bash
cd /path/to/invoicing/deployment
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

Volume **host paths** may point inside the Docker VM; **`acme.sh -w`** on the Mac filesystem might not match where the container writes. Prefer **Linux production hosts**, run acme.sh in a helper container that shares **`acme_webroot`**, or use **DNS-01**.

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
