# Deployment diagram

```mermaid
flowchart TB
  subgraph Internet["User / client"]
    U[Browser]
  end

  subgraph Host["Docker host"]
    subgraph FE["frontend container (nginx)"]
      NG[nginx :80]
      SPA[Static SPA bundle]
      NG --> SPA
    end

    subgraph BE["backend container"]
      API[Express API :3001]
      UP["/app/uploads volume"]
      API --> UP
    end

    subgraph Data["Data services"]
      PG[(PostgreSQL :5432)]
      RD[(Redis :6379)]
    end

    PGVOL[("pgdata volume")]
    PG --- PGVOL
  end

  U -->|HTTP / HTTPS| NG
  NG -->|"/api proxy"| API
  U -.->|optional direct API| API
  API --> PG
  API --> RD
```

**Notes**

- In production, TLS often terminates in front of nginx (not shown).
- The browser only talks to nginx for the SPA; nginx forwards `/api` to the backend service name on the Docker network.
- Uploaded logos are stored under `backend/uploads` and mounted into the backend container.
- The backend runs **`ensureSchema()`** on startup against PostgreSQL (idempotent column/enum upgrades). See [Runtime schema upgrades](../docs/database/schema.md#runtime-schema-upgrades).
