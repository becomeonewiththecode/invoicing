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

1. `/api/auth` — no JWT.
2. `/api/clients`, then **`/api/invoices/share`** (public) **before** `/api/invoices` so `share` is not parsed as an invoice id.
3. `/api/invoices` — CRUD, stats, CSV, share-token minting, email helpers.
4. `/api/discounts`, `/api/settings`.
5. Static uploads: `/api/uploads`.
6. `GET /api/health` — health check.

## Conventions

- **Pagination:** List endpoints accept `page` and `limit` query params where implemented.
- **Validation:** Invalid input returns **400** with Zod-style `details` when applicable.
- **Rate limits:** Auth routes and sensitive actions use Redis-backed limits (fail-open if Redis is down).
- **Caching:** `GET /api/invoices/stats/revenue` caches per user in Redis (~5 minutes); mutations invalidate as implemented in route handlers.

## Domain concepts

- **Invoice status:** `draft` → `sent` → `paid`; **`late`** for unpaid invoices past the late rule (see backend jobs). Do not use `overdue` in new code (DB migrated away).
- **Share links:** Optional `share_token` on an invoice; public GET by token without JWT.

## Full reference

Endpoint-level documentation: [reference.md](reference.md).
