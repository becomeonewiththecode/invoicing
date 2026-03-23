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
| `routes/settings.ts` | Company profile, defaults, logo upload/delete |
| `routes/dataPort.ts` | `GET /export`, `POST /import` — authenticated JSON backup / restore |
| `services/dataPort.ts` | Builds export payload (batched queries); transactional replace on import with strict Zod validation, referential integrity, and duplicate-ID checks |
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
    SH["/api/invoices/share\n(public)"]
    INV["/api/invoices"]
    DISC["/api/discounts"]
    SET["/api/settings"]
    DATA["/api/data\nexport · import"]
    ST["/api/uploads static"]
    HL["/api/health"]
  end

  subgraph Jobs["node-cron"]
    J1["Daily: late + reminders"]
    J2["Daily: recurring invoices"]
  end

  PG[(PostgreSQL)]
  RD[(Redis)]

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
  INV --> PG
  INV --> RD
  DISC --> PG
  SET --> PG
  DATA --> PG
  DATA --> RD
  J1 --> PG
  J2 --> PG
```

## Related docs

- [API review](../api/review.md) / [reference](../api/reference.md)
- [Database schema](../database/schema.md)
- [Deployment](../../deployment/guide.md)
