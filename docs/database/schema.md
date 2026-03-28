# Database schema

PostgreSQL. The canonical DDL for new databases is `backend/src/models/schema.sql` (Docker Compose mounts it for init). **Existing** databases may need SQL in `backend/migrations/` applied in order (`002`–`010`, etc.).

## Runtime schema upgrades

`backend/src/config/database.ts` exports **`ensureSchema()`**, which applies idempotent `ALTER`s so older databases gain columns and enum values that the app expects:

- `clients.discount_code`, `invoices.sent_at`, `invoices.share_token`, `users.business_email`, `users.payable_text`, enum value `invoice_status.cancelled`, and `users.role` (see source for the exact statements).
- `clients.portal_enabled`, `clients.portal_login_email`, `clients.portal_token`, `clients.portal_password_hash`, `clients.portal_totp_secret`, `clients.portal_totp_enabled` (see source for the exact statements).
- Admin tables: `support_tickets`, `ticket_messages`, `content_flags`, `backup_snapshots`, `backup_policies`, `system_logs`, `rate_limit_configs`, `rate_limit_events` — all created with `CREATE TABLE IF NOT EXISTS`.
- Client **projects** tables: `projects`, `project_external_links`, and legacy empty **`project_attachments`** (table still created for older DBs). On **`ensureSchema()`**, any **`project_attachments`** rows whose `file_path` is an `http(s)` URL are copied into **`project_external_links`** (deduplicated), then **`project_attachments`** is cleared. The app stores document references only as external share links, not as uploaded files.
- Default admin user seed: if `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars are set and no user with that email exists, an admin account is created automatically.

It runs in two places:

1. **API startup** — `server.ts` awaits `ensureSchema()` before `listen`; failure exits the process.
2. **Backup import** — `services/dataPort.ts` calls `await ensureSchema()` immediately before `POST /api/data/import` begins its transaction, so imports succeed even if the process had not applied upgrades yet (e.g. long-lived worker).

Fresh installs from current `schema.sql` already include these definitions; `ensureSchema()` is a no-op when columns, enum values, and tables exist.

## Entity relationships (text)

```
users
  ├── clients (1:many)
  │     ├── projects (1:many, ON DELETE CASCADE)
  │     │     └── project_external_links (1:many, ON DELETE CASCADE)
  │     └── invoices (1:many, ON DELETE RESTRICT)
  │           ├── invoice_items (1:many, ON DELETE CASCADE)
  │           └── payment_reminders (1:many, ON DELETE CASCADE)
  ├── discount_codes (1:many)
  ├── support_tickets (1:many)
  │     └── ticket_messages (1:many, ON DELETE CASCADE)
  ├── content_flags (1:many)
  ├── backup_snapshots (1:many)
  └── backup_policies (1:many)
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
| smtp_host | VARCHAR(255) | SMTP server hostname (per-user, optional) |
| smtp_port | INTEGER | Default 587 |
| smtp_user | VARCHAR(255) | SMTP username |
| smtp_pass | VARCHAR(255) | SMTP password / app password |
| smtp_from | VARCHAR(255) | Sender address for outgoing emails; defaults to user login email if blank |
| client_counter | INTEGER | NOT NULL, default 0 — used for `customer_number` sequencing |
| payable_text | TEXT | Footer text shown on invoices (PDF, shared view, email) |
| role | VARCHAR(20) | NOT NULL, default `'user'`; `'admin'` grants admin panel access |
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
| portal_enabled | BOOLEAN | Whether this client has an active portal account |
| portal_login_email | VARCHAR(255) | Optional login email (username) for the client portal; must be unique across clients |
| portal_token | VARCHAR(64) | Unique per client; vendor-generated access token used to authenticate to the portal login page |
| portal_password_hash | VARCHAR(255) | Bcrypt hash of the portal password; required when `portal_enabled = true` |
| portal_totp_secret | VARCHAR(64) | Raw TOTP secret (set during 2FA setup; cleared on disable) |
| portal_totp_enabled | BOOLEAN | Whether TOTP is required at portal login |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Index: `idx_clients_user_id`; unique `(user_id, customer_number)`. `portal_token` and `portal_login_email` are also `UNIQUE` (nullable).

### `projects`

Per-client work items (also scoped by `user_id` for querying). Canonical DDL: `backend/src/models/schema.sql`.

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| client_id | UUID | FK → clients, ON DELETE CASCADE |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| name | VARCHAR(255) | NOT NULL |
| description | TEXT | |
| start_date | DATE | |
| end_date | DATE | |
| status | VARCHAR(30) | NOT NULL, default `not_started` |
| priority | VARCHAR(20) | NOT NULL, default `medium` |
| external_link | TEXT | Legacy single link (optional migration source); prefer **`project_external_links`** |
| external_link_description | TEXT | Legacy label for `external_link` |
| budget | DECIMAL(12,2) | |
| hours | DECIMAL(12,2) | Optional hours (estimate, planned, or cap — see `hours_is_maximum`) |
| hours_is_maximum | BOOLEAN | NOT NULL, default `false` — if `true`, `hours` is a maximum cap |
| dependencies | TEXT | |
| milestones | JSONB | Default `[]`; entries typically `{ title, due_date }` |
| team_members | TEXT[] | Default `{}` |
| tags | TEXT[] | Default `{}` |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Indexes: `idx_projects_client_id`, `idx_projects_user_id`.

### `project_external_links`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| project_id | UUID | FK → projects, ON DELETE CASCADE |
| url | TEXT | NOT NULL — Google Docs/Drive or Microsoft 365 share URL |
| description | TEXT | Optional label shown in UI/PDF |
| sort_order | INTEGER | NOT NULL, default `0` — display order |
| created_at | TIMESTAMPTZ | |

Index: `idx_project_external_links_project_id`.

### `project_attachments` (legacy, unused)

The table may still exist from older installs. **`ensureSchema()`** migrates **`http(s)`** `file_path` values into **`project_external_links`** (deduplicated), then deletes all rows in **`project_attachments`**. The application does not read or write this table in normal operation.

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
| project_id | UUID | FK → projects, ON DELETE SET NULL — optional related project for this client |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Application rule:** At most one **non-`cancelled`** invoice per user may reference a given **`project_id`**; enforced on **POST/PUT** invoices in the API (**409**), not by a unique DB constraint.

Indexes include `idx_invoices_user_id`, `idx_invoices_client_id`, `idx_invoices_status`, `idx_invoices_due_date`, `idx_invoices_project_id`.

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

### `support_tickets`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| subject | VARCHAR(255) | NOT NULL |
| status | VARCHAR(20) | NOT NULL, default `'open'`; values: `open`, `in_progress`, `closed` |
| priority | VARCHAR(20) | NOT NULL, default `'normal'`; values: `low`, `normal`, `high`, `urgent` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `ticket_messages`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| ticket_id | UUID | FK → support_tickets, ON DELETE CASCADE |
| sender_id | UUID | FK → users, ON DELETE CASCADE |
| body | TEXT | NOT NULL |
| is_admin_reply | BOOLEAN | Default FALSE |
| created_at | TIMESTAMPTZ | |

### `content_flags`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| content_type | VARCHAR(50) | NOT NULL |
| content_snippet | TEXT | NOT NULL |
| reason | VARCHAR(255) | |
| status | VARCHAR(20) | NOT NULL, default `'pending'`; values: `pending`, `approved`, `rejected` |
| reviewed_by | UUID | FK → users |
| reviewed_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `backup_snapshots`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| file_path | TEXT | NOT NULL |
| file_size_bytes | BIGINT | NOT NULL, default 0 |
| is_automated | BOOLEAN | Default FALSE |
| verified | BOOLEAN | Default FALSE |
| verified_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

### `backup_policies`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| retention_days | INTEGER | NOT NULL, default 30 |
| max_snapshots | INTEGER | NOT NULL, default 10 |
| is_enabled | BOOLEAN | Default TRUE |
| cron_expression | VARCHAR(50) | Default `'0 2 * * *'` |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `system_logs`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| level | VARCHAR(10) | NOT NULL, default `'info'` |
| source | VARCHAR(100) | NOT NULL |
| method | VARCHAR(10) | HTTP method |
| path | TEXT | Request path |
| status_code | INTEGER | HTTP status |
| response_time_ms | INTEGER | |
| ip | VARCHAR(45) | Client IP |
| user_id | UUID | Optional |
| error_message | TEXT | |
| metadata | JSONB | |
| created_at | TIMESTAMPTZ | |

### `rate_limit_configs`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| route_pattern | VARCHAR(255) | NOT NULL, UNIQUE |
| window_ms | INTEGER | NOT NULL, default 60000 |
| max_requests | INTEGER | NOT NULL, default 100 |
| is_enabled | BOOLEAN | Default TRUE |
| updated_at | TIMESTAMPTZ | |

### `rate_limit_events`

| Column | Type | Notes |
|--------|------|--------|
| id | UUID | PK |
| ip | VARCHAR(45) | NOT NULL |
| path | TEXT | NOT NULL |
| was_blocked | BOOLEAN | Default FALSE |
| created_at | TIMESTAMPTZ | |

## Manual init

```bash
cd backend
npm run db:init
```

Requires `DATABASE_URL`. Alternatively: `psql "$DATABASE_URL" -f backend/src/models/schema.sql`.

`schema.sql` includes `invoices.sent_at`, `share_token`, `users.payable_text`, `users.role`, the `cancelled` status value, and all admin tables (support_tickets, ticket_messages, content_flags, backup_snapshots, backup_policies, system_logs, rate_limit_configs, rate_limit_events). Older databases may still need those migrations or a backend restart so `ensureSchema()` can apply `ALTER`s and create missing tables.
