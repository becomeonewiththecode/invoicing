# API Reference

**Base URL:** Use the host and port where your API listens, with the `/api` prefix. Examples:

- `http://localhost:3001/api` — matches Docker Compose (`backend` maps **3001**).
- `http://localhost:3002/api` — matches PM2 `ecosystem.config.js` and the default Vite dev proxy in `vite.config.ts`.

Paths below are relative to that base (e.g. `/auth/register` → `POST /api/auth/register`).

**Authentication:** All endpoints except `/auth/register`, `/auth/login`, `/invoices/share/:token`, and `/portal/auth/login` require a JWT in the `Authorization` header. `PUT /auth/account` requires JWT. Admin endpoints (`/admin/*`) additionally require `role = 'admin'`.

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
    "businessName": "My Business",
    "role": "user"
  },
  "token": "jwt-token"
}
```

**Errors (409):** `{ "error": "Email already registered" }` if the email exists; `{ "error": "Company name already in use" }` if **`businessName`** is non-empty and another account already has the same trimmed name (case-insensitive). The register form shows these next to the relevant fields.

### PUT /auth/account

Change the authenticated user's login email and/or password. Requires the current password for verification. Returns a fresh JWT (the old token remains valid until expiry but the new one reflects the updated email).

**Request body:**

```json
{
  "currentPassword": "existing-password",
  "newEmail": "newemail@example.com",
  "newPassword": "newsecurepassword"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| currentPassword | string | Yes | Must match the user's current password |
| newEmail | string | No | Omit or set to current email to skip |
| newPassword | string | No | Min 6 characters; omit to keep current |

At least one of `newEmail` or `newPassword` must differ from the current values.

**Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "newemail@example.com",
    "businessName": "My Business",
    "role": "user"
  },
  "token": "new-jwt-token"
}
```

**Errors:** **400** missing current password or no changes; **401** incorrect current password; **409** email already in use by another account.

### POST /auth/login

Authenticate and receive a JWT token. The response includes the user's `role` (`user` or `admin`).

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
    "businessName": "My Business",
    "role": "user"
  },
  "token": "jwt-token"
}
```

**401:** Invalid email or password. The SPA’s shared Axios client (`frontend/src/api/client.ts`) **does not** run the global “session expired” redirect for this route, so both **vendor** and **admin** login forms can show an error without leaving the page.

---

## Client portal (vendor customers)

Client portal auth uses **portal JWTs** (still sent as `Authorization: Bearer ...`). Only `POST /portal/auth/login` is public.

### Vendor portal settings
`PATCH /clients/:id/portal` (authenticated as vendor user)

Updates portal access for a specific client.

**Request body (JSON):**
```json
{
  "enabled": true,
  "password": "new portal password",
  "regenerateToken": true
}
```

### Client portal login
`POST /portal/auth/login` (public)

**Request body:**
```json
{
  "accessToken": "<clients.portal_token>",
  "email": "client@example.com",
  "password": "<client portal password>",
  "totpCode": "123456" 
}
```

Provide either `accessToken` or `email`.

**Responses:**
- **200 (success):** `{ token, client, vendor, portal: { twoFactorEnabled } }`
- **200 (2FA required):** `{ requiresTwoFactor: true, message: "..." }`

### Protected portal endpoints (requires portal JWT)
- `GET /portal/me`
- `GET /portal/invoices` (draft invoices are hidden; backend returns `status != 'draft'`)
- `GET /portal/projects`
- `GET /portal/projects/:projectId`
- `GET /portal/notifications` (recent activity; UI polls in v1)
- `GET /portal/account`
- `PUT /portal/account` (set login email and/or change password)

`GET /portal/account` returns:

```json
{
  "email": "client@example.com",
  "twoFactorEnabled": false,
  "canSetPasswordWithoutCurrent": true
}
```

`canSetPasswordWithoutCurrent` is true when the current portal session came from access-token login.

`PUT /portal/account` request body:

```json
{
  "email": "client@example.com",
  "currentPassword": "optional-in-token-session",
  "newPassword": "new-secure-password"
}
```

Rules:
- at least one of `email` or `newPassword` is required
- `currentPassword` is required for password changes in normal email-login sessions
- in access-token sessions, password can be set without `currentPassword`

### Portal 2FA
- `POST /portal/2fa/setup` → returns `{ qrDataUrl, otpauthUrl, secret }`
- `POST /portal/2fa/enable` → body `{ code }`
- `POST /portal/2fa/disable` → body `{ password }`

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

## Client projects

Nested under each client. **Authentication:** Bearer JWT required. All routes verify that `:clientId` belongs to the current user.

**Mounting:** In `app.ts`, `routes/projects.ts` is registered on `/api/clients` **before** `routes/clients.ts` so paths like `GET /api/clients/:clientId/projects` are handled by the projects router (see [API review](review.md#route-mounting-order-express)).

### GET /clients/:clientId/projects

List all projects for the client. Response is a JSON array of project objects, each including **`external_links`** (rows from `project_external_links`). Document links are share URLs only (Google Docs/Drive or Microsoft 365); the app does not store project files on the server.

### POST /clients/:clientId/projects

Create a project. **Request body (JSON, camelCase):**

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| name | string | Yes | Max 255 characters |
| description | string \| null | No | |
| startDate | string \| null | No | `YYYY-MM-DD` |
| endDate | string \| null | No | `YYYY-MM-DD` |
| status | string | No | Default `not_started`; values: `not_started`, `planning`, `in_progress`, `on_hold`, `completed`, `cancelled` |
| priority | string | No | Default `medium`; values: `low`, `medium`, `high`, `urgent` |
| externalLinks | array | No | Up to 20 entries: `{ url, description? }`. Each **url** must be a **Google Docs/Drive** or **Microsoft 365** share link (see validation in `backend/src/models/validation.ts`). Stored in `project_external_links`; on create/update, sending this field **replaces** all existing link rows for the project. |
| budget | number \| null | No | Non-negative |
| hours | number \| null | No | Non-negative; use with `hoursIsMaximum` |
| hoursIsMaximum | boolean | No | Default `false`. If `true`, `hours` is a **maximum** (cap); if `false`, treat as estimate / planned / non-cap |
| dependencies | string \| null | No | Free text |
| milestones | array | No | `{ title, dueDate }` entries; `dueDate` optional `YYYY-MM-DD` |
| teamMembers | string[] | No | Stored as PostgreSQL `text[]` |
| tags | string[] | No | Stored as PostgreSQL `text[]` |
| notes | string \| null | No | |

**Response (201):** Created project including `external_links`.

### GET /clients/:clientId/projects/:projectId

Get one project (must belong to `:clientId`). **Response (200):** Project object with `external_links`.

### PUT /clients/:clientId/projects/:projectId

Partial update. Same fields as POST, all optional. If **`externalLinks`** is present, existing **`project_external_links`** rows are **replaced** with the new list.

**Response (200):** Updated project with `external_links`.

### DELETE /clients/:clientId/projects/:projectId

Delete the project (cascades **`project_external_links`**). **Response (204):** No body.

---

## Invoices

**Route order:** In `routes/invoices.ts`, static paths such as **`/stats/*`**, **`/export/csv`**, **`/for-project/:projectId`**, and **`/share`** (when mounted) are registered **before** **`GET /:id`** so segment names are not mistaken for UUIDs. See [API review — route mounting](review.md).

### GET /invoices

List invoices with pagination. Joins client display fields (`client_name`, `client_email`, etc.). Each row includes invoice columns from **`i.*`**, including **`project_id`** when set.

**Query parameters:**

| Param | Type | Default | Notes |
|-------|------|---------|--------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max per pagination schema) |
| clientId | string (uuid) | — | If set, only invoices for that client (must belong to the user). **404** if the client is not found for this user. |

**Response (200):** `{ data: InvoiceRow[], pagination: { page, limit, total } }` — same general shape as other list endpoints.

**SPA usage:** The new/edit invoice screen calls this with **`clientId`** and **`limit=100`** (the schema maximum) to detect whether the selected **related project** already appears on another non-**`cancelled`** invoice before submit. If the request fails, the UI still shows a fixed amber message; **POST/PUT** invoices enforce uniqueness regardless.

### GET /invoices/for-project/:projectId

Returns **non-`cancelled`** invoices that already use this project (for UX and integrations). The project must exist and belong to the authenticated user.

**Query parameters:**

| Param | Type | Notes |
|-------|------|--------|
| excludeInvoiceId | string (uuid) | Optional. When editing a draft, omit the current invoice from the conflict list. |

**Response (200):**

```json
{
  "data": [
    { "id": "uuid", "invoice_number": "INV-C-00001-0002", "status": "draft" }
  ]
}
```

**Errors:** **400** invalid `projectId` or `excludeInvoiceId`; **404** project not found for this user.

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

Create a new invoice. Invoice number is auto-generated per customer sequence.

Format: `INV-<CUSTOMER_NUMBER>-NNNN` (example: `INV-C-00001-0003`).

The numeric suffix increments independently for each customer, so every customer's invoice numbering stays consistent.

**Request body:**

```json
{
  "clientId": "client-uuid",
  "issueDate": "2026-03-01",
  "dueDate": "2026-03-31",
  "taxRate": 10,
  "discountCode": "SAVE10",
  "notes": "Thank you for your business",
  "projectId": "optional-project-uuid",
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
| projectId | string (uuid) \| null | No | Optional project for this client; must belong to the same `clientId` and user |
| isRecurring | boolean | No | Default false |
| recurrenceInterval | string | No | weekly, monthly, quarterly, yearly |
| items | array | Yes | At least 1 item required |

**Project uniqueness:** If `projectId` is set, the server rejects the create when **any other** invoice for this user already references that project with a status other than **`cancelled`**.

**Response (409)** — project already linked:

```json
{
  "error": "This project is already linked to another invoice",
  "conflicts": [
    { "id": "uuid", "invoice_number": "INV-C-00001-0002", "status": "sent" }
  ]
}
```

### PUT /invoices/:id

Update an existing **draft** invoice only. Same JSON body shape and validation as **`POST /invoices`** (camelCase fields). **404** if the invoice is missing, not owned by the user, or not in **`draft`** status.

**Project conflict:** If `projectId` is set, the same uniqueness rule applies as on create, but the invoice being edited is excluded from the conflict check (via `excludeInvoiceId` semantics in the handler).

**Response (409):** Same shape as **`POST /invoices`** when another non-cancelled invoice already uses the project.

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

Returns company profile and defaults: `businessName`, `defaultTaxRate`, `businessPhone`, `businessWebsite`, `businessAddress`, `taxId`, `defaultHourlyRate`, `businessFax`, `businessEmail`, `logoUrl`, `payableText`.

### PUT /settings

Update company fields. Body fields match the GET response shape (camelCase); optional fields can be omitted or set to empty string to clear.

### POST /settings/logo

`multipart/form-data` with field name **`logo`** (JPEG, PNG, WebP, or GIF; max 2MB). Returns updated settings JSON including `logoUrl`.

### DELETE /settings/logo

Removes the stored logo file and clears `logoUrl`.

### GET /settings/smtp

Returns the user's SMTP configuration: `smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`, `smtpFrom`. Credentials are returned as-is (not masked).

### PUT /settings/smtp

Update SMTP configuration.

**Request body:**

```json
{
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 587,
  "smtpUser": "user@gmail.com",
  "smtpPass": "app-password",
  "smtpFrom": "noreply@yourdomain.com"
}
```

All fields are optional — empty or missing values clear the field (`smtpPort` defaults to 587). `smtpFrom` sets the sender address; if blank, the user's login email is used.

### POST /settings/smtp/test

Send a test email to the authenticated user's login email address using their saved SMTP configuration. Returns `{ "message": "Test email sent to user@example.com" }` on success or a **400** with `{ "error": "..." }` containing the SMTP error message on failure.

---

## Data backup (authenticated)

Full account export and destructive restore. Implemented in `backend/src/services/dataPort.ts`; JSON body limit for import is **15MB** (see `app.ts`).

### GET /data/export

Download a JSON backup of the authenticated user’s data.

**Response (200):** `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment` with a dated filename (e.g. `invoicing-backup-2026-03-21.json`).

**Payload shape:**

- **`version`: `1`** — `exportedAt`, `profile`, `clients`, `discount_codes`, `invoices` (each invoice includes nested `items` and `payment_reminders`). Projects are **not** included; restored invoices get `project_id = NULL`.
- **`version`: `2`** (current export) — Same entities plus **`projects`**, **`project_external_links`**, and invoice rows retain **`project_id`** when present. Document links are only in `project_external_links` (no separate attachment list).

Login credentials are **not** included in any version.

### POST /data/import

Replace **all** of the user’s clients, discount codes, and invoices (including line items and payment reminders) with the contents of a valid export file, update the user row from `profile` in the file, and for **`version` 2** also replace **projects** and **project external links**. For **`version` 1**, existing projects for that user are removed indirectly when clients are replaced (cascade) and invoice `project_id` is not restored.

**Rate limit:** 3 requests per minute per IP.

**Request body:**

```json
{
  "data": {
    "version": 2,
    "exportedAt": "...",
    "profile": {},
    "clients": [],
    "discount_codes": [],
    "projects": [],
    "project_external_links": [],
    "invoices": []
  },
  "confirmReplace": true
}
```

Use **`version`: `1`** with the older shape (no `projects` / `project_external_links`) for legacy files; the server still accepts them.

`confirmReplace` must be the literal boolean **`true`** (safety guard for clients and scripts).

**Response (200):**

```json
{
  "ok": true,
  "message": "Data imported successfully"
}
```

**Errors:** **400** if the body fails validation. Validation includes:

- Schema check: each client, discount code, invoice, line item, and payment reminder is validated for required fields, correct types, and valid UUIDs. For **`version` 2**, `projects` and `project_external_links` are validated too (each link’s `project_id` must exist in the backup’s `projects`; each invoice `project_id`, if set, must reference a project in the backup). Numeric fields (amounts, rates, quantities) accept both numbers and numeric strings to handle PostgreSQL `DECIMAL` column serialisation.
- Referential integrity: every invoice's `client_id` must reference a client present in the backup's `clients` array.
- Duplicate detection: no two records of the same entity type may share an `id`.
- `version` must be **`1`** or **`2`**; `confirmReplace` must be `true`.
- **Legacy v2 files** may still include an optional **`project_attachments`** array (older exports). On import, rows whose `file_path` is an `http(s)` URL are merged into **`project_external_links`**; the app no longer persists document metadata in `project_attachments`.

**500** on database or server errors (the import runs inside a transaction and rolls back on failure). All validation failures are logged to the server console with a `Data import validation error:` prefix.

**Notes:**

- Before the import transaction, the server runs **`ensureSchema()`** (same as on API startup) so missing `invoices` columns such as `sent_at` and `share_token` are added when possible. See [database schema — Runtime schema upgrades](../database/schema.md#runtime-schema-upgrades).
- The import handles **cross-account ID collisions**: if the backup's UUIDs already exist in the database (e.g. restoring a backup exported from a different account), those rows are deleted by ID before inserting the backup data.
- Import does not upload logo files; only `logo_url` (or equivalent profile field) is restored if present. Revenue cache in Redis is invalidated after a successful import.
- **`version` 2** restores portal-related columns on **`clients`** when present in the backup.

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

## Support Tickets (authenticated)

### POST /tickets

Create a support ticket.

**Request body:**

```json
{
  "subject": "Issue with invoice PDF",
  "body": "The PDF won't generate for invoice INV-0005...",
  "priority": "normal"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| subject | string | Yes | 1-255 characters |
| body | string | Yes | 1-10000 characters |
| priority | string | No | `low`, `normal` (default), `high`, `urgent` |

### GET /tickets

List the authenticated user's support tickets with pagination.

### GET /tickets/:id

Get a single ticket with messages.

### POST /tickets/:id/reply

Add a message to a ticket.

---

## Admin Panel (admin role required)

All `/admin/*` endpoints require JWT authentication **and** `role = 'admin'`. Non-admin users receive **403**.

### GET /admin/dashboard/stats

Platform-wide statistics: total users, active users (30d), open tickets, pending moderation flags, total invoices, platform revenue.

### GET /admin/dashboard/user-growth

User registration counts by day. Query: `?days=30` (max 365).

### GET /admin/users

Paginated user list with invoice counts. Query: `?page=1&limit=20&search=`.

### GET /admin/users/:id

User detail: profile, client/invoice counts, total revenue.

### PUT /admin/users/:id/role

Update a user's role. Body: `{ "role": "admin" }` or `{ "role": "user" }`.

### DELETE /admin/users/:id

Permanently delete a user and all associated data (clients, invoices, line items, discount codes, tickets, content flags, backups). Runs in a transaction. Admins cannot delete their own account.

**Response (200):**

```json
{
  "message": "User user@example.com and all associated data deleted"
}
```

**Errors:** **400** if attempting self-deletion; **404** if user not found.

### GET /admin/moderation

Content flag queue. Query: `?status=pending&page=1&limit=20`.

### PUT /admin/moderation/:id

Review a flag. Body: `{ "decision": "approved" }` or `{ "decision": "rejected" }`.

### POST /admin/moderation/bulk

Bulk review flags. Body: `{ "flagIds": ["uuid", ...], "decision": "approved" }`.

### GET /admin/tickets

All support tickets (across all users). Query: `?page=1&limit=20&status=open&priority=normal&search=`.

### GET /admin/tickets/:id

Ticket detail with full message thread.

### POST /admin/tickets/:id/reply

Admin reply to a ticket. Body: `{ "body": "..." }`.

### PUT /admin/tickets/:id/status

Update ticket status. Body: `{ "status": "open" }` — values: `open`, `in_progress`, `closed`.

### GET /admin/health

System health checks: database, Redis, frontend, backend service status with response times. Also returns error rate, avg response time, and requests in the last hour.

### GET /admin/health/logs

Paginated system logs. Query: `?page=1&limit=20&level=error&source=`.

### GET /admin/backups

Paginated backup snapshots. Query: `?page=1&limit=20&userId=`.

### POST /admin/backups/:userId

Trigger a manual backup for a user.

### POST /admin/backups/:snapshotId/restore

Restore a backup snapshot.

### POST /admin/backups/:snapshotId/verify

Verify a backup snapshot integrity.

### DELETE /admin/backups/:snapshotId

Delete a backup snapshot.

### GET /admin/backups/policies

List backup policies.

### PUT /admin/backups/policies/:id

Update a backup policy. Body fields: `retention_days`, `max_snapshots`, `is_enabled`, `cron_expression`.

### GET /admin/rate-limits

List all rate limit configurations.

### POST /admin/rate-limits

Create a rate limit config. Body: `{ "route_pattern": "/api/auth/login", "window_ms": 60000, "max_requests": 10, "is_enabled": true }`.

### PUT /admin/rate-limits/:id

Update a rate limit config.

### GET /admin/rate-limits/analytics

Rate limit analytics. Query: `?hours=24` (max 720).

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

**Forbidden (403):**

```json
{
  "error": "Admin access required"
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

Invoice **create/update** with a duplicate **`projectId`** (see [POST /invoices](#post-invoices) / [PUT /invoices/:id](#put-invoicesid)) returns **409** with `error` and an optional **`conflicts`** array of `{ id, invoice_number, status }`.

**Rate limit (429):**

```json
{
  "error": "Too many requests, please try again later"
}
```
