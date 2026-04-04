# Deployment diagram

**Postgres data** and **backend uploads** use **host bind mounts** under **`DEPLOY_DATA_DIR`**. In compose, volume paths use **`${DEPLOY_DATA_DIR:-./data}`** (default **`./data`** next to the compose file if unset — see **[`.env.example`](.env.example)**). Subdirs: **`pgdata/`** → PostgreSQL data dir, **`uploads/`** → **`/app/uploads`**. **TLS** uses the same base: **`acme_webroot/`** and **`ssl_certs/`**. **Redis** has no persistent volume in the default Compose files. **Prod** pulls **`maxwayne/invoice-*:1.0`** from Docker Hub; **build** tags **`invoice-*:1.0`** locally.

```mermaid
flowchart TB
  subgraph Internet["User / client"]
    U[Browser]
  end

  subgraph Host["Docker host — Compose network"]
    subgraph FE["frontend (nginx)"]
      NG[":80 · :443"]
      SPA[Static SPA]
      NG --> SPA
    end

    ACME[("DEPLOY_DATA_DIR/acme_webroot\n→ /var/www/acme-webroot")]
    TLS[("DEPLOY_DATA_DIR/ssl_certs\n→ /etc/nginx/ssl")]
    FE --- ACME
    FE --- TLS

    subgraph BE["backend"]
      API[Express :3001]
      UP[("DEPLOY_DATA_DIR/uploads\n→ /app/uploads")]
      API --> UP
    end

    subgraph Data["Data services"]
      subgraph PGsvc["postgres (invoice-postgres · schema in image)"]
        PG[(PostgreSQL :5432)]
        PGVOL[("DEPLOY_DATA_DIR/pgdata\n→ PG data dir")]
        PG --- PGVOL
      end
      RD[(Redis :6379)]
    end
  end

  U -->|HTTP / HTTPS| NG
  NG -->|"/api proxy"| API
  U -.->|optional direct API| API
  API --> PG
  API --> RD
```

**Notes**

- **Postgres:** **`maxwayne/invoice-postgres:1.0`** (prod) bakes `schema.sql`; an **empty** **`DEPLOY_DATA_DIR/pgdata`** runs init scripts on first container start. Persistent data lives only on the host under that directory.
- **TLS:** Host dirs **`acme_webroot/`** and **`ssl_certs/`** under **`DEPLOY_DATA_DIR`** (bind-mounted); own them as the user running **acme.sh**—see **[tls.md](tls.md)**.
- The browser uses nginx for the SPA; nginx forwards `/api` to the **`backend`** service on the Docker network.
- **Uploads:** company logos and similar files live under **`DEPLOY_DATA_DIR/uploads`** on the host, mounted at **`/app/uploads`** in the backend container.
- The backend runs **`ensureSchema()`** on startup against PostgreSQL (idempotent column/enum upgrades). See [Runtime schema upgrades](../docs/database/schema.md#runtime-schema-upgrades).
