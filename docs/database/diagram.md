# Database diagram

```mermaid
erDiagram
  users ||--o{ clients : owns
  users ||--o{ discount_codes : owns
  clients ||--o{ invoices : has
  invoices ||--o{ invoice_items : contains
  invoices ||--o{ payment_reminders : logs

  users {
    uuid id PK
    string email UK
    string password_hash
    string business_name
    string business_email
    decimal default_tax_rate
    decimal default_hourly_rate
    string logo_url
    int client_counter
    string smtp_host
    int smtp_port
    string smtp_user
    string smtp_pass
    string smtp_from
  }

  clients {
    uuid id PK
    uuid user_id FK
    string customer_number
    string name
    string email
    string discount_code
  }

  invoices {
    uuid id PK
    uuid user_id FK
    uuid client_id FK
    string invoice_number
    invoice_status status "draft sent paid late cancelled"
    date issue_date
    date due_date
    decimal subtotal
    decimal tax_rate
    decimal tax_amount
    string discount_code
    decimal discount_amount
    decimal total
    timestamptz sent_at
    string share_token UK
  }

  invoice_items {
    uuid id PK
    uuid invoice_id FK
    string description
    decimal quantity
    decimal unit_price
    decimal amount
    int sort_order
  }

  discount_codes {
    uuid id PK
    uuid user_id FK
    string code
    string description
    string type "percent or fixed"
    decimal value
    boolean is_active
  }

  payment_reminders {
    uuid id PK
    uuid invoice_id FK
    timestamptz sent_at
    string reminder_type
  }
```

Mermaid `erDiagram` is supported on GitHub and many Markdown viewers; for strict PostgreSQL types, see [schema.md](schema.md).
