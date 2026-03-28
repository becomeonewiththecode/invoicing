# Architecture diagram

## Docker Compose stack

```mermaid
flowchart TB
    Browser["Browser\n(user)"]

    subgraph Docker["Docker Compose network"]
        subgraph FE["frontend  :80"]
            NGINX["nginx\n· serves React SPA\n· proxies /api → backend:3001\n· Docker DNS re-resolution"]
        end

        subgraph BE["backend  :3001"]
            direction TB
            EXPRESS["Express API\nhelmet · cors · morgan · JSON parser"]

            subgraph Routes["Routes"]
                AUTH_R["/api/auth\nregister · login\nchange email/password"]
                CLIENT_R["/api/clients\nCRUD · projects per client"]
                INV_R["/api/invoices\nCRUD · stats · CSV\nshare · send email"]
                SHARE_R["/api/invoices/share/:token\npublic view · mark paid"]
                DISC_R["/api/discounts\nCRUD"]
                SET_R["/api/settings\nprofile · logo · SMTP"]
                DATA_R["/api/data\nexport · import"]
                TICKET_R["/api/tickets\nuser support tickets"]
                HEALTH_R["/api/health"]
            end

            subgraph AdminRoutes["Admin Routes (/api/admin)"]
                ADM_DASH["/dashboard\nstats · user growth"]
                ADM_USERS["/users\nlist · detail · role"]
                ADM_MOD["/moderation\nflags · review · bulk"]
                ADM_TIX["/tickets\nall tickets · reply · status"]
                ADM_HEALTH["/health\nservice checks · logs"]
                ADM_BACK["/backups\nsnapshots · policies"]
                ADM_RL["/rate-limits\nconfigs · analytics"]
            end

            subgraph MW["Middleware"]
                JWT["JWT auth"]
                ADMIN["Admin auth\n(role check)"]
                RL["Rate limit\n(Redis)"]
                ZOD["Zod validation"]
                REQLOG["Request logger\n(system_logs)"]
            end

            subgraph SVC["Services"]
                MAIL["mail.ts\nnodemailer"]
                TMPL["invoiceEmailHtml.ts\nemail templates"]
                DP["dataPort.ts\nbackup export/import"]
                ADM_SVC["adminDashboard.ts\nadminHealth.ts\nadminModeration.ts\nadminTickets.ts\nadminBackup.ts"]
            end

            subgraph JOBS["Scheduled jobs (node-cron)"]
                J1["Daily: mark late\n+ send reminders"]
                J2["Daily: create\nrecurring invoices"]
                J3["Daily: automated\nbackup snapshots"]
            end

            SCHEMA["ensureSchema()\nidempotent ALTERs\non startup + import"]
        end

        subgraph PG["postgres  :5432"]
            PGDB[("PostgreSQL 16\ninvoicing DB\npgdata volume")]
        end

        subgraph RD["redis  :6379"]
            REDIS[("Redis 7\nrate limits · cache")]
        end
    end

    SMTP_EXT["External SMTP\n(optional)"]

    %% Browser → Frontend
    Browser -- "HTTP :80\nSPA assets + /api proxy" --> NGINX

    %% Frontend → Backend
    NGINX -- "/api/*\nreverse proxy" --> EXPRESS

    %% Express → Routes
    EXPRESS --> Routes

    %% Routes → Middleware
    Routes -. "per-route" .-> MW
    AdminRoutes -. "JWT + admin role" .-> ADMIN
    AdminRoutes -. "per-route" .-> ZOD

    %% Routes → Services
    INV_R --> MAIL
    SET_R --> MAIL
    DATA_R --> DP
    MAIL --> TMPL
    AdminRoutes --> ADM_SVC

    %% Backend → PostgreSQL
    Routes -- "pg pool" --> PGDB
    AdminRoutes -- "pg pool" --> PGDB
    JOBS -- "pg pool" --> PGDB
    DP -- "transactional\nimport/export" --> PGDB
    SCHEMA -- "ALTER TABLE\nADD COLUMN" --> PGDB

    %% Backend → Redis
    RL -- "sliding window\ncounters" --> REDIS
    INV_R -- "revenue cache\n(5 min TTL)" --> REDIS
    DP -- "invalidate\nrevenue cache" --> REDIS

    %% Backend → External SMTP
    MAIL -- "nodemailer\nSMTP transport" --> SMTP_EXT
```

## Startup sequence

```mermaid
sequenceDiagram
    participant DC as Docker Compose
    participant PG as PostgreSQL
    participant RD as Redis
    participant BE as Backend (Express)
    participant FE as Frontend (nginx)

    DC->>PG: Start container
    DC->>RD: Start container
    PG-->>DC: Healthcheck passes (pg_isready)
    RD-->>DC: Healthcheck passes (redis-cli ping)
    DC->>BE: Start container (depends_on: postgres, redis healthy)
    BE->>PG: ensureSchema() — idempotent ALTERs + admin tables
    BE->>PG: Seed admin user (if ADMIN_EMAIL set and not exists)
    BE->>BE: Start node-cron jobs (reminders, recurrence, backups)
    BE->>BE: Listen on 0.0.0.0:3001
    BE-->>DC: Healthcheck passes (GET /api/health)
    DC->>FE: Start container (depends_on: backend healthy)
    FE->>FE: nginx listens on :80
    Note over FE,BE: Browser → nginx :80 → /api proxy → backend:3001
```

## Request flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as nginx (:80)
    participant E as Express (:3001)
    participant PG as PostgreSQL
    participant RD as Redis

    B->>N: GET / (SPA)
    N-->>B: index.html + JS/CSS bundles

    B->>N: POST /api/auth/login
    N->>E: proxy_pass → backend:3001
    E->>PG: Verify credentials
    PG-->>E: User row
    E-->>N: JWT token
    N-->>B: 200 { token }

    B->>N: GET /api/invoices (Authorization: Bearer ...)
    N->>E: proxy_pass
    E->>E: JWT verify + rate limit
    E->>PG: SELECT invoices
    PG-->>E: Rows
    E-->>N: 200 { data, pagination }
    N-->>B: JSON response

    B->>N: GET /api/invoices/stats/revenue
    N->>E: proxy_pass
    E->>RD: Check cache
    alt Cache hit
        RD-->>E: Cached stats
    else Cache miss
        E->>PG: Aggregate query
        PG-->>E: Stats
        E->>RD: SET cache (5 min TTL)
    end
    E-->>N: 200 { stats }
    N-->>B: JSON response
```

## Data flow: backup import

```mermaid
sequenceDiagram
    participant B as Browser
    participant E as Express
    participant PG as PostgreSQL
    participant RD as Redis

    B->>E: POST /api/data/import { data, confirmReplace: true }
    E->>E: Zod schema validation
    E->>E: Referential integrity + duplicate ID checks
    E->>PG: ensureSchema()
    E->>PG: BEGIN transaction
    E->>PG: DELETE user's invoices, clients, discount_codes
    E->>PG: DELETE colliding IDs (cross-account)
    E->>PG: UPDATE user profile
    E->>PG: INSERT clients; if v2: projects, project_external_links
    E->>PG: INSERT discount_codes, invoices (with project_id if v2), items, reminders
    E->>PG: COMMIT
    E->>RD: Invalidate revenue cache
    E-->>B: 200 { ok: true }
```

## Invoice preview modal (SPA)

Client-only: **`InvoicePreviewModal`** builds a PDF with **jsPDF** (`pdf.ts`), shows it in an **`iframe`**, and lists **`project_external_links`** as HTML **below** the PDF so **`target="_blank"`** works reliably (embedded PDF URI links typically navigate the iframe, not a new tab).

```mermaid
flowchart TB
  subgraph Pages["Pages using modal"]
    P1["InvoicesPage"]
    P2["InvoiceDetailPage"]
    P3["NewInvoicePage / edit"]
  end

  subgraph Modal["InvoicePreviewModal"]
    H["Header + hint"]
    I["PDF iframe\nflex-1 min-h-0"]
    L["ExternalLinksList\nbelow PDF · new tab"]
    F["Close · Download PDF"]
  end

  subgraph Client["Browser"]
    JSPDF["pdf.ts → blob URL"]
  end

  P1 --> Modal
  P2 --> Modal
  P3 --> Modal
  H --> I
  I --> L
  L --> F
  Modal --> JSPDF
```
