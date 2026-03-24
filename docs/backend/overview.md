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
| `services/dataPort.ts` | Builds export payload (batched queries); transactional replace on import with strict Zod validation, referential integrity, and duplicate-ID checks |
| `services/mail.ts` | Nodemailer SMTP transport; resolves config from per-user DB settings then env vars as fallback; used by send-to-company and SMTP test |
| `services/invoiceEmailHtml.ts` | HTML + plain-text email templates for invoice summaries |
| `middleware/auth.ts` | JWT verification |
| `middleware/validate.ts` | Zod validation |
| `middleware/rateLimit.ts` | Redis sliding windows / counters |
| `jobs/reminders.ts` | Cron: late invoices, reminders, recurring drafts |
| `config/database.ts` | `pg` pool, optional schema ensure |

## Backend diagram

```mermaid
flowchart LR
  subgraph HTTP["Express app"]
    MW["helmet · cors · morgan\n+json (+15mb on /api/data)"]
    AUTH["/api/auth"]
    CL["/api/clients"]
    SH["/api/invoices/share\n(public: view + mark paid)"]
    INV["/api/invoices"]
    DISC["/api/discounts"]
    SET["/api/settings\n+ SMTP config & test"]
    DATA["/api/data\nexport · import"]
    ST["/api/uploads static"]
    HL["/api/health"]
  end

  subgraph Services["Services"]
    MAIL["mail.ts\nnodemailer SMTP"]
    TMPL["invoiceEmailHtml.ts"]
  end

  subgraph Jobs["node-cron"]
    J1["Daily: late + reminders"]
    J2["Daily: recurring invoices"]
  end

  PG[(PostgreSQL)]
  RD[(Redis)]
  SMTP["SMTP server\n(optional)"]

  MW --> AUTH
  MW --> CL
  MW --> SH
  MW --> INV
  MW --> DISC
  MW --> SET
  MW --> DATA
  MW --> ST
  MW --> HL

  AUTH --> PG
  CL --> PG
  SH --> PG
  SH --> RD
  INV --> PG
  INV --> RD
  INV --> MAIL
  MAIL --> TMPL
  MAIL --> SMTP
  DISC --> PG
  SET --> PG
  SET --> MAIL
  DATA --> PG
  DATA --> RD
  J1 --> PG
  J2 --> PG
```

## Related docs

- [API review](../api/review.md) / [reference](../api/reference.md)
- [Database schema](../database/schema.md)
- [Deployment](../../deployment/guide.md)
