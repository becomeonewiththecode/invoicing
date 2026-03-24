# API Reference

**Base URL:** Use the host and port where your API listens, with the `/api` prefix. Examples:

- `http://localhost:3001/api` — matches Docker Compose (`backend` maps **3001**).
- `http://localhost:3002/api` — matches PM2 `ecosystem.config.js` and the default Vite dev proxy in `vite.config.ts`.

Paths below are relative to that base (e.g. `/auth/register` → `POST /api/auth/register`).

**Authentication:** All endpoints except `/auth/*` and `/invoices/share/:token` require a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

---

## Authentication

### POST /auth/register

Create a new user account.

**Rate limit:** 5 requests per minute per IP.

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "businessName": "My Business"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | Yes | Valid email address |
| password | string | Yes | 8-128 characters |
| businessName | string | No | Max 255 characters |

**Response (201):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "businessName": "My Business"
  },
  "token": "jwt-token"
}
```

### POST /auth/login

Authenticate and receive a JWT token.

**Rate limit:** 10 requests per minute per IP.

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "businessName": "My Business"
  },
  "token": "jwt-token"
}
```

---

## Clients

### GET /clients

List clients with pagination.

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "email": "billing@acme.com",
      "phone": "555-0100",
      "company": "Acme Corporation",
      "address": "123 Main St",
      "notes": "Net 30 terms",
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### GET /clients/:id

Get a single client by ID.

### POST /clients

Create a new client.

**Request body:**

```json
{
  "name": "Acme Corp",
  "email": "billing@acme.com",
  "phone": "555-0100",
  "company": "Acme Corporation",
  "address": "123 Main St",
  "notes": "Net 30 terms"
}
```

| Field | Type | Required |
|-------|------|----------|
| name | string | Yes |
| email | string | Yes |
| phone | string | No |
| company | string | No |
| address | string | No |
| notes | string | No |

### PUT /clients/:id

Update an existing client. All fields are optional (partial update).

### DELETE /clients/:id

Delete a client. Fails if the client has existing invoices.

---

## Invoices

### GET /invoices

List invoices with pagination. Returns client name and email joined.

**Query parameters:** Same as clients (page, limit).

### GET /invoices/:id

Get a single invoice with all line items and client details.

**Response (200):**

```json
{
  "id": "uuid",
  "invoice_number": "INV-0001",
  "status": "draft",
  "issue_date": "2026-03-01",
  "due_date": "2026-03-31",
  "subtotal": 1500.00,
  "tax_rate": 10.00,
  "tax_amount": 150.00,
  "discount_code": "SAVE10",
  "discount_amount": 150.00,
  "total": 1500.00,
  "notes": "Thank you for your business",
  "is_recurring": false,
  "client_name": "Acme Corp",
  "client_email": "billing@acme.com",
  "client_company": "Acme Corporation",
  "client_address": "123 Main St",
  "items": [
    {
      "id": "uuid",
      "description": "Web Development",
      "quantity": 10,
      "unit_price": 150.00,
      "amount": 1500.00,
      "sort_order": 0
    }
  ]
}
```

### POST /invoices

Create a new invoice. Invoice number is auto-generated (INV-0001, INV-0002, etc.).

**Request body:**

```json
{
  "clientId": "client-uuid",
  "issueDate": "2026-03-01",
  "dueDate": "2026-03-31",
  "taxRate": 10,
  "discountCode": "SAVE10",
  "notes": "Thank you for your business",
  "isRecurring": false,
  "recurrenceInterval": "monthly",
  "items": [
    {
      "description": "Web Development",
      "quantity": 10,
      "unitPrice": 150.00
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| clientId | string (uuid) | Yes | Must belong to the user |
| issueDate | string | Yes | YYYY-MM-DD format |
| dueDate | string | Yes | YYYY-MM-DD format |
| taxRate | number | No | 0-100, default 0 |
| discountCode | string | No | Must match an active discount code |
| notes | string | No | |
| isRecurring | boolean | No | Default false |
| recurrenceInterval | string | No | weekly, monthly, quarterly, yearly |
| items | array | Yes | At least 1 item required |

### PATCH /invoices/:id/status

Update invoice status.

**Request body:**

```json
{
  "status": "sent"
}
```

Valid status values: `draft`, `sent`, `paid`, `late`, `cancelled`. Typical flow: `draft` → `sent` → `paid`; **`late`** is set by scheduled jobs when the invoice is unpaid past the late rule (see backend jobs). `cancelled` is set via the DELETE endpoint (see below).

### DELETE /invoices/:id

Delete or cancel an invoice.

- **Draft** invoices are hard-deleted (removed from the database). Returns **204**.
- **Sent** or **late** invoices are soft-deleted: status is set to `cancelled`, any share token is revoked. Returns **200** with `{ id, status: "cancelled" }`.
- **Paid** or already **cancelled** invoices cannot be deleted. Returns **400**.

### GET /invoices/stats/revenue

Get revenue summary statistics. Results are cached in Redis for 5 minutes.

**Response (200):**

```json
{
  "paid_count": "5",
  "total_revenue": "15000.00",
  "late_count": "2",
  "late_amount": "3000.00",
  "pending_count": "3",
  "pending_amount": "4500.00"
}
```

(`pending_*` counts invoices with status `sent`.)

### GET /invoices/stats/by-client/:clientId

Per-client invoice aggregates for the authenticated user. The client must belong to the user. **Not** Redis-cached (unlike `/stats/revenue`).

**Response (200):**

```json
{
  "draft_count": "1",
  "sent_count": "2",
  "paid_count": "5",
  "late_count": "0",
  "draft_total": "100.00",
  "sent_total": "500.00",
  "paid_total": "15000.00",
  "late_total": "0",
  "total_revenue": "15600.00",
  "total_tax": "2028.00"
}
```

**404** if the client id is not found for this user.

### GET /invoices/export/csv

Download all invoices as a CSV file.

**Response:** CSV file with headers: Invoice Number, Client, Status, Issue Date, Due Date, Subtotal, Tax, Discount, Total.

---

## Discount Codes

### GET /discounts

List all discount codes for the authenticated user.

### POST /discounts

Create a new discount code.

**Request body:**

```json
{
  "code": "SAVE20",
  "description": "20% off for returning clients",
  "type": "percent",
  "value": 20
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| code | string | Yes | Auto-uppercased, unique per user |
| description | string | No | |
| type | string | Yes | `percent` or `fixed` |
| value | number | Yes | Must be positive |

### DELETE /discounts/:id

Delete a discount code.

### GET /discounts/generate-code

Returns a suggested random discount code string for the authenticated user.

---

## Settings (authenticated)

### GET /settings

Returns company profile and defaults: `businessName`, `defaultTaxRate`, `businessPhone`, `businessWebsite`, `businessAddress`, `taxId`, `defaultHourlyRate`, `businessFax`, `businessEmail`, `logoUrl`.

### PUT /settings

Update company fields. Body fields match the GET response shape (camelCase); optional fields can be omitted or set to empty string to clear.

### POST /settings/logo

`multipart/form-data` with field name **`logo`** (JPEG, PNG, WebP, or GIF; max 2MB). Returns updated settings JSON including `logoUrl`.

### DELETE /settings/logo

Removes the stored logo file and clears `logoUrl`.

### GET /settings/smtp

Returns the user's SMTP configuration: `smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`. Credentials are returned as-is (not masked).

### PUT /settings/smtp

Update SMTP configuration.

**Request body:**

```json
{
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUser": "user@gmail.com",
  "smtpPass": "app-password"
}
```

All fields are optional — empty or missing values clear the field (`smtpPort` defaults to 587).

### POST /settings/smtp/test

Send a test email to the authenticated user's login email address using their saved SMTP configuration. Returns `{ "message": "Test email sent to user@example.com" }` on success or a **400** with `{ "error": "..." }` containing the SMTP error message on failure.

---

## Data backup (authenticated)

Full account export and destructive restore. Implemented in `backend/src/services/dataPort.ts`; JSON body limit for import is **15MB** (see `app.ts`).

### GET /data/export

Download a JSON backup of the authenticated user’s data.

**Response (200):** `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment` with a dated filename (e.g. `invoicing-backup-2026-03-21.json`).

**Payload shape (version 1):** `version` (number, currently `1`), `exportedAt` (ISO timestamp), `profile` (user settings columns as stored in the DB), `clients`, `discount_codes`, `invoices` (each invoice includes nested `items` and `payment_reminders`). Login credentials are **not** included.

### POST /data/import

Replace **all** of the user’s clients, discount codes, and invoices (including line items and payment reminders) with the contents of a valid export file, and update the user row from `profile` in the file.

**Rate limit:** 3 requests per minute per IP.

**Request body:**

```json
{
  "data": { "version": 1, "exportedAt": "...", "profile": {}, "clients": [], "discount_codes": [], "invoices": [] },
  "confirmReplace": true
}
```

`confirmReplace` must be the literal boolean **`true`** (safety guard for clients and scripts).

**Response (200):**

```json
{
  "ok": true,
  "message": "Data imported successfully"
}
```

**Errors:** **400** if the body fails validation. Validation includes:

- Schema check: each client, discount code, invoice, line item, and payment reminder is validated for required fields, correct types, and valid UUIDs. Numeric fields (amounts, rates, quantities) accept both numbers and numeric strings to handle PostgreSQL `DECIMAL` column serialisation.
- Referential integrity: every invoice's `client_id` must reference a client present in the backup's `clients` array.
- Duplicate detection: no two records of the same entity type may share an `id`.
- `version` must be `1`; `confirmReplace` must be `true`.

**500** on database or server errors (the import runs inside a transaction and rolls back on failure). All validation failures are logged to the server console with a `Data import validation error:` prefix.

**Notes:** Import does not upload logo files; only `logo_url` (or equivalent profile field) is restored if present. Revenue cache in Redis is invalidated after a successful import.

---

## Public invoice share (no JWT)

### GET /invoices/share/:token

**`token`** must be 64 characters. Returns invoice header fields, line items as `items`, and business/client display fields (including company name, address, phone, website, and logo URL for rendering the invoice). **404** if invalid or unknown.

### PATCH /invoices/share/:token/status

Allows a client to mark a shared invoice as paid without authentication.

**Request body:**

```json
{
  "status": "paid"
}
```

Only `"paid"` is accepted. The invoice must currently be in `sent` or `late` status. Returns the updated `invoice_number` and `status`. **400** if any other status is requested. **404** if the token is invalid or the invoice is not in a payable state.

---

## Invoice share & email (authenticated)

### POST /invoices/:id/share

Creates or returns a share token for the invoice (public link).

### DELETE /invoices/:id/share

Revokes the share token.

### POST /invoices/:id/send-to-company

Sends a copy of the invoice to the company email (requires SMTP configured on the server). Rate limited.

---

## Health Check

### GET /health

Returns server status.

```json
{
  "status": "ok",
  "timestamp": "2026-03-21T10:00:00.000Z"
}
```

---

## Error Responses

**Validation error (400):**

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "email", "message": "Invalid email" }
  ]
}
```

**Authentication error (401):**

```json
{
  "error": "Authentication required"
}
```

**Not found (404):**

```json
{
  "error": "Invoice not found"
}
```

**Conflict (409):**

```json
{
  "error": "Email already registered"
}
```

**Rate limit (429):**

```json
{
  "error": "Too many requests, please try again later"
}
```
