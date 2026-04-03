# Deployment diagram

Compose uses **named volumes** only (no repository bind mounts). **Prod** (`docker-compose-prod.yml`) pulls **`maxwayne/invoice-postgres:1.0`**, **`maxwayne/invoice-backend:1.0`**, **`maxwayne/invoice-frontend:1.0`** from Docker Hub; **build** (`docker-compose-build.yml`) tags **`invoice-*:1.0`** locally.

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

    ACME[("acme_webroot\n→ /var/www/acme-webroot")]
    TLS[("ssl_certs\n→ /etc/nginx/ssl")]
    FE --- ACME
    FE --- TLS

    subgraph BE["backend"]
      API[Express :3001]
      UP[("uploads_data\n→ /app/uploads")]
      API --> UP
    end

    subgraph Data["Data services"]
      subgraph PGsvc["postgres (invoice-postgres · schema in image)"]
        PG[(PostgreSQL :5432)]
        PGVOL[("pgdata")]
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

- **Postgres:** **`maxwayne/invoice-postgres:1.0`** (prod) bakes `schema.sql`; empty **`pgdata`** runs init scripts on first container start. Persistent data lives in the **`pgdata`** volume only.
- **TLS:** **`ssl_certs`** holds PEMs read by nginx; **`acme_webroot`** serves HTTP-01 challenges. Neither path is under the git repo—see [guide.md](guide.md#tls-lets-encrypt-with-acmesh).
- The browser uses nginx for the SPA; nginx forwards `/api` to the **`backend`** service on the Docker network.
- **Uploads:** company logos and similar files use the **`uploads_data`** volume at **`/app/uploads`** in the backend container.
- The backend runs **`ensureSchema()`** on startup against PostgreSQL (idempotent column/enum upgrades). See [Runtime schema upgrades](../docs/database/schema.md#runtime-schema-upgrades).
