# Backend overview

Express (TypeScript) application in `backend/src/`. Entry: `server.ts` loads `app.ts`, connects to PostgreSQL and Redis, and starts scheduled jobs.

## Request pipeline

Global middleware on `app.ts`: `helmet` → `cors` → `morgan` → **`/api/data`** with `express.json({ limit: '15mb' })` → `express.json()` for all other routes. Static files for uploads at `/api/uploads`.

Per-route: **rateLimit** (Redis) → **validate** (Zod) → **authenticate** (JWT) as required.

## Main modules

| Path | Responsibility |
|------|------------------|
| `routes/auth.ts` | Register, login |
| `routes/clients.ts` | Client CRUD, customer numbers |
| `routes/invoices.ts` | Invoices, `GET /stats/revenue`, `GET /stats/by-client/:clientId`, CSV, share tokens, send-to-company email |
| `routes/share.ts` | Public invoice by token: read-only view + mark as paid |
| `routes/discounts.ts` | Discount codes |
| `routes/settings.ts` | Company profile, defaults, logo upload/delete, SMTP config (GET/PUT), SMTP test email |
| `routes/dataPort.ts` | `GET /export`, `POST /import` — authenticated JSON backup / restore; numeric fields use `z.coerce.number()` to accept both numbers and DB string decimals; validation failures logged to console |
| `services/dataPort.ts` | Builds export payload (batched queries); calls `ensureSchema()` then transactional replace on import with strict Zod validation, referential integrity, duplicate-ID checks, and cross-account ID collision removal |
| `services/mail.ts` | Nodemailer SMTP transport; resolves config from per-user DB settings then env vars as fallback; used by send-to-company and SMTP test |
| `services/invoiceEmailHtml.ts` | HTML + plain-text email templates for invoice summaries |
| `middleware/auth.ts` | JWT verification |
| `middleware/validate.ts` | Zod validation |
| `middleware/rateLimit.ts` | Redis sliding windows / counters |
| `jobs/reminders.ts` | Cron: late invoices, reminders, recurring drafts |
| `config/database.ts` | `pg` pool; **`ensureSchema()`** — idempotent `ALTER`s on startup (and before backup import) so older databases match expected columns/enums; see [schema doc](../database/schema.md#runtime-schema-upgrades) |

## Backend diagrams

### Component architecture

```mermaid
flowchart TB
  subgraph Server["server.ts — entry point"]
    direction TB
    BOOT["1. ensureSchema()\n2. app.listen()\n3. start cron jobs"]
  end

  subgraph App["app.ts — Express factory"]
    direction TB
    subgraph MW["Global middleware (in order)"]
      H["helmet()"]
      C["cors()"]
      M["morgan('dev')"]
      J15["/api/data: json 15MB limit"]
      J1M["json() standard"]
      STATIC["/api/uploads static files"]
    end

    subgraph Routes["Route handlers"]
      AUTH["/api/auth\nregister · login\n(public)"]
      CL["/api/clients\nCRUD · customer numbers\n(protected)"]
      SH["/api/invoices/share/:token\nview · mark paid\n(public)"]
      INV["/api/invoices\nCRUD · stats · CSV\nshare · email\n(protected)"]
      DISC["/api/discounts\nCRUD · generate code\n(protected)"]
      SET["/api/settings\nprofile · logo · SMTP\n(protected)"]
      DATA["/api/data\nexport · import\n(protected)"]
      HL["/api/health"]
    end
  end

  subgraph Middleware["Per-route middleware"]
    JWT["auth.ts\nJWT verification\nattaches userId"]
    RL["rateLimit.ts\nRedis sliding window\nper IP per path"]
    ZOD["validate.ts\nZod schema parsing\nbody or query"]
  end

  subgraph Services["Services"]
    MAIL["mail.ts\nnodemailer SMTP\nper-user config → env fallback"]
    TMPL["invoiceEmailHtml.ts\nHTML + plain text\nemail templates"]
    DP["dataPort.ts\nexport: batched queries\nimport: transactional replace\ncross-account collision fix"]
  end

  subgraph Jobs["Scheduled jobs (node-cron)"]
    REM["reminders.ts — 9 AM daily\n· sent → late (30+ days)\n· log payment_reminder"]
    REC["reminders.ts — midnight daily\n· clone recurring invoices\n· advance next_recurrence_date"]
  end

  subgraph Validation["models/validation.ts"]
    SCHEMAS["Zod schemas\nregister · login · client\ninvoice · discount · settings\npagination"]
  end

  subgraph Config["Configuration"]
    DB["database.ts\npg Pool\nensureSchema()"]
    RDS["redis.ts\nioredis client"]
  end

  PG[(PostgreSQL)]
  RD[(Redis)]
  SMTP_EXT["External SMTP\n(optional)"]

  %% Startup
  BOOT --> App
  BOOT --> Jobs

  %% Middleware wiring
  Routes -. "protected routes" .-> JWT
  Routes -. "rate-limited routes" .-> RL
  Routes -. "validated routes" .-> ZOD
  ZOD --> SCHEMAS

  %% Route → Service
  INV --> MAIL
  SET --> MAIL
  DATA --> DP
  MAIL --> TMPL

  %% Config → External
  DB --> PG
  RDS --> RD

  %% Route → Data stores
  AUTH --> PG
  CL --> PG
  SH --> PG
  INV --> PG
  INV --> RD
  DISC --> PG
  SET --> PG
  DATA --> PG
  DATA --> RD
  SH --> RD

  %% Jobs → Data stores
  REM --> PG
  REC --> PG

  %% External
  MAIL --> SMTP_EXT
```

### Request pipeline

```mermaid
flowchart LR
  REQ["Incoming request"]
  HELM["helmet"]
  CORS["cors"]
  LOG["morgan"]
  JSON["json parser\n(15MB for /api/data)"]

  subgraph PerRoute["Per-route (as needed)"]
    RL["rateLimit\n(Redis)"]
    VAL["validate\n(Zod)"]
    AUTH["authenticate\n(JWT)"]
  end

  HANDLER["Route handler"]
  DB[(PostgreSQL)]
  CACHE[(Redis cache)]
  RES["Response"]

  REQ --> HELM --> CORS --> LOG --> JSON --> PerRoute --> HANDLER
  HANDLER --> DB
  HANDLER --> CACHE
  HANDLER --> RES
```

### Rate limits

```mermaid
flowchart LR
  subgraph Limits["Rate limits by endpoint"]
    R1["POST /auth/register\n5 req/min/IP"]
    R2["POST /auth/login\n10 req/min/IP"]
    R3["POST /invoices/:id/send-to-company\n5 req/min/IP"]
    R4["POST /data/import\n3 req/min/IP"]
  end

  RD[(Redis\nsliding window\ncounters)]
  R1 --> RD
  R2 --> RD
  R3 --> RD
  R4 --> RD
```

### Caching strategy

```mermaid
flowchart TB
  subgraph Writers["Cache writers"]
    INV_CREATE["POST /invoices"]
    INV_UPDATE["PUT /invoices/:id"]
    INV_STATUS["PATCH /invoices/:id/status"]
    INV_DELETE["DELETE /invoices/:id"]
    CL_DELETE["DELETE /clients/:id?force"]
    IMPORT["POST /data/import"]
    SHARE_PAID["PATCH /share/:token/status"]
  end

  CACHE[("Redis\nrevenue:{userId}:summary\n5-min TTL")]

  subgraph Reader["Cache reader"]
    STATS["GET /invoices/stats/revenue"]
  end

  PG[(PostgreSQL)]

  Writers -- "invalidate\n(delete key)" --> CACHE
  STATS -- "check cache" --> CACHE
  CACHE -- "miss → query" --> PG
  CACHE -- "hit → return" --> STATS
```

### Scheduled jobs

```mermaid
sequenceDiagram
  participant CRON as node-cron
  participant PG as PostgreSQL

  Note over CRON,PG: Daily at 9 AM — late detection + reminders
  CRON->>PG: Find sent invoices 30+ days past sent_at
  PG-->>CRON: Stale invoices
  CRON->>PG: UPDATE status = 'late'
  CRON->>PG: Find late invoices without reminder in 3 days
  PG-->>CRON: Unremindered invoices
  CRON->>PG: INSERT payment_reminder for each

  Note over CRON,PG: Daily at midnight — recurring invoices
  CRON->>PG: Find recurring invoices where next_recurrence_date <= today
  PG-->>CRON: Due recurring invoices
  loop Each recurring invoice
    CRON->>PG: BEGIN
    CRON->>PG: INSERT new draft invoice + items (new number)
    CRON->>PG: UPDATE original next_recurrence_date
    CRON->>PG: COMMIT
  end
```

On process start, **`ensureSchema()`** runs in `server.ts` before the HTTP server listens; **`POST /api/data/import`** also invokes it before the import transaction. Both hit PostgreSQL via the shared pool. See [Runtime schema upgrades](../database/schema.md#runtime-schema-upgrades).

## Related docs

- [API review](../api/review.md) / [reference](../api/reference.md)
- [Database schema](../database/schema.md)
- [Deployment](../../deployment/guide.md)
