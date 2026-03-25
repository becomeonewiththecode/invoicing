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
    string business_address
    string business_phone
    string business_email
    string tax_id
    decimal default_tax_rate
    decimal default_hourly_rate
    string business_website
    string business_fax
    string logo_url
    int client_counter
    string smtp_host
    int smtp_port
    string smtp_user
    string smtp_pass
    string smtp_from
    text payable_text
    timestamptz created_at
    timestamptz updated_at
  }

  clients {
    uuid id PK
    uuid user_id FK
    string customer_number
    string name
    string email
    string phone
    string company
    string address
    text notes
    string discount_code
    timestamptz created_at
    timestamptz updated_at
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
    text notes
    boolean is_recurring
    string recurrence_interval
    date next_recurrence_date
    timestamptz sent_at "sent late logic"
    string share_token "nullable unique public link"
    timestamptz created_at
    timestamptz updated_at
  }

  invoice_items {
    uuid id PK
    uuid invoice_id FK
    string description
    decimal quantity
    decimal unit_price
    decimal amount
    int sort_order
    timestamptz created_at
  }

  discount_codes {
    uuid id PK
    uuid user_id FK
    string code
    string description
    string type "percent or fixed"
    decimal value
    boolean is_active
    timestamptz created_at
  }

  payment_reminders {
    uuid id PK
    uuid invoice_id FK
    timestamptz sent_at "reminder log time"
    string reminder_type
  }
```

Mermaid `erDiagram` is supported on GitHub and many Markdown viewers; for strict PostgreSQL types, column defaults, and indexes, see [schema.md](schema.md).

**Note:** `payment_reminders.sent_at` is the time a reminder was logged, not the same field as `invoices.sent_at` (when the invoice was marked sent).
