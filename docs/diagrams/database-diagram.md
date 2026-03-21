# Database Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        varchar email UK "NOT NULL, UNIQUE"
        varchar password_hash "NOT NULL"
        varchar business_name
        text business_address
        varchar business_phone
        varchar business_email
        varchar tax_id
        timestamptz created_at "DEFAULT NOW()"
        timestamptz updated_at "DEFAULT NOW()"
    }

    clients {
        uuid id PK
        uuid user_id FK "NOT NULL → users(id) CASCADE"
        varchar name "NOT NULL"
        varchar email "NOT NULL"
        varchar phone
        varchar company
        text address
        text notes
        timestamptz created_at "DEFAULT NOW()"
        timestamptz updated_at "DEFAULT NOW()"
    }

    invoices {
        uuid id PK
        uuid user_id FK "NOT NULL → users(id) CASCADE"
        uuid client_id FK "NOT NULL → clients(id) RESTRICT"
        varchar invoice_number "NOT NULL, UNIQUE per user"
        invoice_status status "DEFAULT draft"
        date issue_date "NOT NULL, DEFAULT CURRENT_DATE"
        date due_date "NOT NULL"
        decimal subtotal "12-2, DEFAULT 0"
        decimal tax_rate "5-2, DEFAULT 0"
        decimal tax_amount "12-2, DEFAULT 0"
        varchar discount_code
        decimal discount_amount "12-2, DEFAULT 0"
        decimal total "12-2, NOT NULL"
        text notes
        boolean is_recurring "DEFAULT FALSE"
        varchar recurrence_interval "weekly|monthly|quarterly|yearly"
        date next_recurrence_date
        timestamptz created_at "DEFAULT NOW()"
        timestamptz updated_at "DEFAULT NOW()"
    }

    invoice_items {
        uuid id PK
        uuid invoice_id FK "NOT NULL → invoices(id) CASCADE"
        varchar description "NOT NULL, max 500"
        decimal quantity "10-2, DEFAULT 1"
        decimal unit_price "12-2, NOT NULL"
        decimal amount "12-2, NOT NULL"
        integer sort_order "DEFAULT 0"
        timestamptz created_at "DEFAULT NOW()"
    }

    discount_codes {
        uuid id PK
        uuid user_id FK "NOT NULL → users(id) CASCADE"
        varchar code "NOT NULL, UNIQUE per user"
        varchar description
        varchar type "CHECK: percent | fixed"
        decimal value "12-2, NOT NULL"
        boolean is_active "DEFAULT TRUE"
        timestamptz created_at "DEFAULT NOW()"
    }

    payment_reminders {
        uuid id PK
        uuid invoice_id FK "NOT NULL → invoices(id) CASCADE"
        timestamptz sent_at "DEFAULT NOW()"
        varchar reminder_type "DEFAULT overdue"
    }

    users ||--o{ clients : "owns"
    users ||--o{ invoices : "creates"
    users ||--o{ discount_codes : "manages"
    clients ||--o{ invoices : "billed via"
    invoices ||--o{ invoice_items : "contains"
    invoices ||--o{ payment_reminders : "tracked by"
```

## Indexes

| Table | Index | Columns |
|-------|-------|---------|
| clients | idx_clients_user_id | user_id |
| invoices | idx_invoices_user_id | user_id |
| invoices | idx_invoices_client_id | client_id |
| invoices | idx_invoices_status | status |
| invoices | idx_invoices_due_date | due_date |
| invoice_items | idx_invoice_items_invoice_id | invoice_id |

## Cascade Rules

| Relationship | On Delete |
|-------------|-----------|
| users → clients | CASCADE (deleting a user deletes their clients) |
| users → invoices | CASCADE |
| users → discount_codes | CASCADE |
| clients → invoices | RESTRICT (cannot delete client with invoices) |
| invoices → invoice_items | CASCADE |
| invoices → payment_reminders | CASCADE |
