# Architecture diagram

## Docker Compose stack

Compose bind mounts for Postgres, backend uploads, and TLS use **`${DEPLOY_DATA_DIR:-./data}`** on the host (see **`deployment/.env.example`** and **`deployment/tls.md`** §2). Below, **`DEPLOY_DATA_DIR/...`** means that resolved base path.

```mermaid
flowchart TB
    Browser["Browser\n(user)"]

    subgraph Docker["Docker Compose network"]
        subgraph FE["frontend :80 / :443"]
            NGINX["nginx\n- serves React SPA\n- proxies /api to backend port 3001\n- Docker DNS re-resolution\n- TLS + ACME via DEPLOY_DATA_DIR bind mounts (default base ./data)"]
        end

        subgraph BE["backend  :3001"]
            direction TB
            EXPRESS["Express API\nhelmet · cors · morgan · JSON parser"]

            subgraph Routes["Routes"]
                AUTH_R["/api/auth\nregister · login\nchange email/password"]
                CLIENT_R["/api/clients\nCRUD · projects per client"]
                INV_R["/api/invoices\nCRUD · stats · CSV\nfor-project · share · send email"]
                SHARE_R["/api/invoices/share/{token}\npublic view · mark paid"]
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

        subgraph PG["postgres :5432, invoice-postgres image"]
            PGDB[("PostgreSQL 16, invoicing DB\nschema in image, data on host\nDEPLOY_DATA_DIR/pgdata")]
        end

        subgraph RD["redis  :6379"]
            REDIS[("Redis 7\nrate limits · cache")]
        end
    end

    SMTP_EXT["External SMTP\n(optional)"]

    %% Browser → Frontend
    Browser -- "HTTP port 80\nSPA assets + /api proxy" --> NGINX

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
    participant BE as "Backend (Express)"
    participant FE as "Frontend (nginx)"

    DC->>PG: Start container
    DC->>RD: Start container
    PG-->>DC: Healthcheck passes (pg_isready)
    RD-->>DC: Healthcheck passes (redis-cli ping)
    DC->>BE: Start container (depends_on postgres and redis healthy)
    BE->>PG: ensureSchema() idempotent ALTERs + admin tables
    BE->>PG: Seed admin if ADMIN_EMAIL / ADMIN_PASSWORD and user missing (see deployment/.env.example)
    BE->>BE: Start node-cron jobs (reminders, recurrence, backups)
    BE->>BE: Listen on 0.0.0.0 port 3001
    BE-->>DC: Healthcheck passes (GET /api/health)
    DC->>FE: Start container (depends_on backend healthy)
    FE->>FE: nginx listens on port 80
    Note over FE,BE: Browser to nginx port 80, /api proxy to backend port 3001
```

## Request flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as "nginx port 80"
    participant E as "Express port 3001"
    participant PG as PostgreSQL
    participant RD as Redis

    B->>N: GET / (SPA)
    N-->>B: index.html + JS/CSS bundles

    B->>N: POST /api/auth/login
    N->>E: proxy_pass to backend port 3001
    E->>PG: Verify credentials
    PG-->>E: User row
    E-->>N: JWT token
    N-->>B: 200 JSON with token

    B->>N: GET /api/invoices (Bearer token)
    N->>E: proxy_pass
    E->>E: JWT verify + rate limit
    E->>PG: SELECT invoices
    PG-->>E: Rows
    E-->>N: 200 JSON data and pagination
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
    E-->>N: 200 JSON stats
    N-->>B: JSON response
```

## Data flow: backup import

```mermaid
sequenceDiagram
    participant B as Browser
    participant E as Express
    participant PG as PostgreSQL
    participant RD as Redis

    B->>E: POST /api/data/import with confirmReplace true
    E->>E: Zod schema validation
    E->>E: Referential integrity + duplicate ID checks
    E->>PG: ensureSchema()
    E->>PG: BEGIN transaction
    E->>PG: DELETE user's invoices, clients, discount_codes
    E->>PG: DELETE colliding IDs (cross-account)
    E->>PG: UPDATE user profile
    E->>PG: INSERT clients then v2 projects and project_external_links if needed
    E->>PG: INSERT discount_codes invoices items reminders
    E->>PG: COMMIT
    E->>RD: Invalidate revenue cache
    E-->>B: 200 ok true
```

## New invoice: project conflict (SPA + API)

At most **one non-`cancelled`** invoice may reference a given **`project_id`** per user. The **new/edit invoice** page loads **`GET /api/invoices?page=1&limit=100&clientId=...`** when both client and project are selected ( **`limit`** is capped at **100** by the list endpoint), then filters rows client-side for matching **`project_id`** and **non-`cancelled`** status.

- **Conflicts found in list data:** Bordered **amber** alert with invoice numbers (links to **`/invoices/:id`**). **Preview** and **Create/Save** are disabled while the request is in flight or when this list is non-empty.
- **List request fails:** Plain **amber** line: *Selected project already has an invoice, delete existing invoice before creating a new one.* **Preview** and **Create/Save** stay enabled; the server still enforces the rule on submit (**409** if duplicate).

**`POST /api/invoices`** and **`PUT /api/invoices/:id`** always enforce the rule and return **409** with **`conflicts`** when the UI is bypassed or the client-side list did not reflect the true state.

```mermaid
sequenceDiagram
    participant U as User
    participant SPA as NewInvoicePage
    participant API as "Express /api/invoices"
    participant PG as PostgreSQL

    U->>SPA: Select client + related project
    SPA->>API: GET /invoices paged list for client
    alt List request fails
        API-->>SPA: 4xx or 5xx or network error
        SPA-->>U: Amber text, delete existing invoice (submit still allowed)
    else List succeeds
        API->>PG: List invoices for client
        PG-->>API: Rows incl project_id and status
        API-->>SPA: JSON data and pagination
        SPA->>SPA: Filter same project_id status not cancelled
        alt Conflicts in data
            SPA-->>U: Amber alert and links, disable Preview and Save
        else No conflict
            SPA-->>U: Normal submit or preview
        end
    end
    U->>SPA: Create (optional path)
    SPA->>API: POST /invoices with projectId in body
    API->>PG: Transaction and conflict check
    alt Duplicate project
        API-->>SPA: 409 error and conflicts
    else OK
        API-->>SPA: 201 created invoice
    end
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

  subgraph IPModal["InvoicePreviewModal"]
    H["Header + hint"]
    I["PDF iframe\nflex-1 min-h-0"]
    L["ExternalLinksList\nbelow PDF · new tab"]
    F["Close · Download PDF"]
  end

  subgraph Client["Browser"]
    JSPDF["pdf.ts to blob URL"]
  end

  P1 --> IPModal
  P2 --> IPModal
  P3 --> IPModal
  H --> I
  I --> L
  L --> F
  IPModal --> JSPDF
```

## SPA UI themes (browser)

The static SPA bundle does not change per theme server-side: **themes are client-only**. `index.html` loads JS that applies `data-theme` on `<html>` and CSS variables for the canvas, sidebar, and accents. See **[Frontend overview — UI themes](frontend/overview.md#ui-themes)** for stores, pickers, and the Mermaid flow diagram.
