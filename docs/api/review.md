# API review

## Base path and versioning

- **Prefix:** Every JSON endpoint lives under **`/api`** (e.g. `GET /api/health`).
- **Format:** JSON request bodies and responses unless noted (CSV export, file upload).
- **Versioning:** None; breaking changes would be coordinated with the SPA.

## Authentication

- **Register / login:** `POST /api/auth/register`, `POST /api/auth/login` — return a JWT.
- **Protected routes:** Send `Authorization: Bearer <token>` on all other routes except:
  - Public share: `GET /api/invoices/share/:token` (read-only invoice payload).

## Route mounting order (Express)

Order matters for Express:

1. **`/api/data`** — authenticated export/import; mounted with `express.json({ limit: '15mb' })` so large backups can be posted (see [reference](reference.md#data-backup-authenticated)).
2. `/api/auth` — no JWT.
3. `/api/clients`, then **`/api/invoices/share`** (public) **before** `/api/invoices` so `share` is not parsed as an invoice id.
4. `/api/invoices` — CRUD, stats, CSV, share-token minting, email helpers.
5. `/api/discounts`, `/api/settings`.
6. Static uploads: `/api/uploads`.
7. `GET /api/health` — health check.

**Note:** In `app.ts`, the `/api/data` router is registered **before** the global `express.json()` so import requests use the larger body limit; other routes use the default JSON parser.

## Conventions

- **PostgreSQL upgrades:** `ensureSchema()` in `config/database.ts` runs before the server listens and again before **`POST /api/data/import`**, applying idempotent `ALTER`s for older databases. See [Runtime schema upgrades](../database/schema.md#runtime-schema-upgrades).
- **Pagination:** List endpoints accept `page` and `limit` query params where implemented.
- **Validation:** Invalid input returns **400** with Zod-style `details` when applicable.
- **Rate limits:** Auth routes and sensitive actions use Redis-backed limits (fail-open if Redis is down).
- **Caching:** `GET /api/invoices/stats/revenue` caches per user in Redis (~5 minutes); mutations invalidate as implemented in route handlers. `GET /api/invoices/stats/by-client/:clientId` is not cached. Successful **`POST /api/data/import`** invalidates the revenue cache for the user.

## Domain concepts

- **Invoice status:** `draft` → `sent` → `paid`; **`late`** for unpaid invoices past the late rule (see backend jobs). Do not use `overdue` in new code (DB migrated away).
- **Share links:** Optional `share_token` on an invoice; public GET by token without JWT.

## Full reference

Endpoint-level documentation: [reference.md](reference.md).
