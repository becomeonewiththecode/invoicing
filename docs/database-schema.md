# Database Schema

PostgreSQL database with 6 tables. Schema is defined in `backend/src/models/schema.sql` and auto-applied when using Docker Compose.

## Entity Relationship Diagram

```
users
  ├── clients (1:many)
  │     └── invoices (1:many, ON DELETE RESTRICT)
  │           ├── invoice_items (1:many, ON DELETE CASCADE)
  │           └── payment_reminders (1:many, ON DELETE CASCADE)
  └── discount_codes (1:many)
```

## Tables

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, auto-generated |
| email | VARCHAR(255) | UNIQUE, NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| business_name | VARCHAR(255) | |
| business_address | TEXT | |
| business_phone | VARCHAR(50) | |
| business_email | VARCHAR(255) | |
| tax_id | VARCHAR(100) | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### clients

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| name | VARCHAR(255) | NOT NULL |
| email | VARCHAR(255) | NOT NULL |
| phone | VARCHAR(50) | |
| company | VARCHAR(255) | |
| address | TEXT | |
| notes | TEXT | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

Indexes: `idx_clients_user_id`

### invoices

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| client_id | UUID | FK → clients, ON DELETE RESTRICT |
| invoice_number | VARCHAR(50) | NOT NULL, UNIQUE per user |
| status | invoice_status | DEFAULT 'draft' |
| issue_date | DATE | NOT NULL, DEFAULT CURRENT_DATE |
| due_date | DATE | NOT NULL |
| subtotal | DECIMAL(12,2) | DEFAULT 0 |
| tax_rate | DECIMAL(5,2) | DEFAULT 0 |
| tax_amount | DECIMAL(12,2) | DEFAULT 0 |
| discount_code | VARCHAR(50) | |
| discount_amount | DECIMAL(12,2) | DEFAULT 0 |
| total | DECIMAL(12,2) | NOT NULL, DEFAULT 0 |
| notes | TEXT | |
| is_recurring | BOOLEAN | DEFAULT FALSE |
| recurrence_interval | VARCHAR(20) | weekly, monthly, quarterly, yearly |
| next_recurrence_date | DATE | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**invoice_status enum:** `draft`, `sent`, `paid`, `overdue`

Indexes: `idx_invoices_user_id`, `idx_invoices_client_id`, `idx_invoices_status`, `idx_invoices_due_date`

### invoice_items

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| invoice_id | UUID | FK → invoices, ON DELETE CASCADE |
| description | VARCHAR(500) | NOT NULL |
| quantity | DECIMAL(10,2) | NOT NULL, DEFAULT 1 |
| unit_price | DECIMAL(12,2) | NOT NULL |
| amount | DECIMAL(12,2) | NOT NULL |
| sort_order | INTEGER | DEFAULT 0 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

Indexes: `idx_invoice_items_invoice_id`

### discount_codes

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users, ON DELETE CASCADE |
| code | VARCHAR(50) | NOT NULL, UNIQUE per user |
| description | VARCHAR(255) | |
| type | VARCHAR(10) | CHECK: 'percent' or 'fixed' |
| value | DECIMAL(12,2) | NOT NULL |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

### payment_reminders

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| invoice_id | UUID | FK → invoices, ON DELETE CASCADE |
| sent_at | TIMESTAMPTZ | DEFAULT NOW() |
| reminder_type | VARCHAR(20) | DEFAULT 'overdue' |

## Manual Schema Setup

If not using Docker Compose init scripts:

```bash
cd backend
npm run db:init
```

Requires `DATABASE_URL` environment variable to be set.
