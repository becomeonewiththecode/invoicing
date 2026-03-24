# Database schema

PostgreSQL. The canonical DDL for new databases is `backend/src/models/schema.sql` (Docker Compose mounts it for init). **Existing** databases may need SQL in `backend/migrations/` applied in order (`002`–`008`, etc.).

## Runtime schema upgrades

`backend/src/config/database.ts` exports **`ensureSchema()`**, which applies idempotent `ALTER`s so older databases gain columns and enum values that the app expects:

- `clients.discount_code`, `invoices.sent_at`, `invoices.share_token`, `users.business_email`, and enum value `invoice_status.cancelled` (see source for the exact statements).

It runs in two places:

1. **API startup** — `server.ts` awaits `ensureSchema()` before `listen`; failure exits the process.
2. **Backup import** — `services/dataPort.ts` calls `await ensureSchema()` immediately before `POST /api/data/import` begins its transaction, so imports succeed even if the process had not applied upgrades yet (e.g. long-lived worker).

Fresh installs from current `schema.sql` already include these definitions; `ensureSchema()` is a no-op when columns and enum values exist.

## Entity relationships (text)

```
users
  ├── clients (1:many)
  │     └── invoices (1:many, ON DELETE RESTRICT)
  │           ├── invoice_items (1:many, ON DELETE CASCADE)
  │           └── payment_reminders (1:many, ON DELETE CASCADE)
  └── discount_codes (1:many)
```

See [diagram.md](diagram.md) for a Mermaid ER diagram.

## Enums

### `invoice_status`

`draft`, `sent`, `paid`, `late`, `cancelled`

`late` is used for unpaid invoices that meet the **late** business rule (see app jobs). Legacy `overdue` values were migrated to `late` in migration `005`. `cancelled` is a soft-delete status for sent/late invoices (migration `008`); draft invoices are hard-deleted instead.

## Tables

### `users`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| business_name | VARCHAR(255) | |
| business_address | TEXT | |
| business_phone | VARCHAR(50) | |
| business_email | VARCHAR(255) | Company / billing email (optional) |
| tax_id | VARCHAR(100) | |
| default_hourly_rate | DECIMAL(12,2) | |
| default_tax_rate | DECIMAL(5,2) | NOT NULL, default 0 |
| business_website | VARCHAR(500) | |
| business_fax | VARCHAR(50) | |
| logo_url | TEXT | Public URL path under `/api/uploads/logos/…` when uploaded |
| client_counter | INTEGER | NOT NULL, default 0 — used for `customer_number` sequencing |
| smtp_host | VARCHAR(255) | SMTP server hostname (per-user, optional) |
| smtp_port | INTEGER | Default 587 |
| smtp_user | VARCHAR(255) | SMTP username |
| smtp_pass | VARCHAR(255) | SMTP password / app password |
| smtp_from | VARCHAR(255) | Sender address for outgoing emails; defaults to user login email if blank |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `clients`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| customer_number | VARCHAR(20) | NOT NULL, UNIQUE per user (`C-00001`, …) |
| name | VARCHAR(255) | NOT NULL |
| email | VARCHAR(255) | NOT NULL |
| phone | VARCHAR(50) | |
| company | VARCHAR(255) | |
| address | TEXT | |
| notes | TEXT | |
| discount_code | VARCHAR(50) | Optional default discount code |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Index: `idx_clients_user_id`; unique `(user_id, customer_number)`.

### `invoices`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| client_id | UUID | FK → clients, ON DELETE RESTRICT |
| invoice_number | VARCHAR(50) | NOT NULL, UNIQUE per user |
| status | invoice_status | Default `draft` |
| issue_date | DATE | |
| due_date | DATE | |
| subtotal | DECIMAL(12,2) | |
| tax_rate | DECIMAL(5,2) | |
| tax_amount | DECIMAL(12,2) | |
| discount_code | VARCHAR(50) | |
| discount_amount | DECIMAL(12,2) | |
| total | DECIMAL(12,2) | |
| notes | TEXT | |
| is_recurring | BOOLEAN | |
| recurrence_interval | VARCHAR(20) | |
| next_recurrence_date | DATE | |
| sent_at | TIMESTAMPTZ | Set when relevant for **sent** / **late** logic (migration `005`) |
| share_token | VARCHAR(64) | UNIQUE, optional public link token (migration `007`) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Indexes include `idx_invoices_user_id`, `idx_invoices_client_id`, `idx_invoices_status`, `idx_invoices_due_date`.

### `invoice_items`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| invoice_id | UUID | FK → invoices, ON DELETE CASCADE |
| description | VARCHAR(500) | NOT NULL |
| quantity | DECIMAL(10,2) | NOT NULL, default 1 |
| unit_price | DECIMAL(12,2) | NOT NULL |
| amount | DECIMAL(12,2) | NOT NULL |
| sort_order | INTEGER | Default 0 |
| created_at | TIMESTAMPTZ | |

### `discount_codes`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| code | VARCHAR(50) | NOT NULL, UNIQUE per user |
| description | VARCHAR(255) | |
| type | VARCHAR(10) | `percent` or `fixed` |
| value | DECIMAL(12,2) | NOT NULL |
| is_active | BOOLEAN | Default TRUE |
| created_at | TIMESTAMPTZ | |

### `payment_reminders`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| invoice_id | UUID | FK → invoices, ON DELETE CASCADE |
| sent_at | TIMESTAMPTZ | |
| reminder_type | VARCHAR(20) | Default `overdue` (label; status uses `late`) |

## Manual init

```bash
cd backend
npm run db:init
```

Requires `DATABASE_URL`. Alternatively: `psql "$DATABASE_URL" -f backend/src/models/schema.sql`.

`schema.sql` includes `invoices.sent_at`, `share_token`, and the `cancelled` status value (aligned with migrations `005`–`008`). Older databases may still need those migrations or a backend restart so `ensureSchema()` can apply `ALTER`s.
