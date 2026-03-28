# App routes and client profile

SPA routes (see `frontend/src/App.tsx`). All paths below except `/share/:token`, `/login`, `/register`, and `/portal/*` use `AppLayout` (sidebar).

Vendor sidebar quick links include **Admin site** (`/admin`) and **Client site** (`/portal/login`), each opening in a new browser tab.

## Authenticated routes

| Path | Page | Notes |
|------|------|--------|
| `/` | Dashboard | Revenue stats, recent invoices |
| `/invoices` | Invoice list | Optional `?clientId=` filter; includes a **Filter by customer** button beside **Create invoice**. Row actions include **preview** ([Invoice preview](#invoice-preview-behavior)). Invoice numbers follow per-customer sequence (`INV-<CUSTOMER_NUMBER>-NNNN`). |
| `/invoices/new` | New invoice | Optional query: **`?clientId=`** (preselect client), **`?projectId=`** (preselect related project — use with `clientId`). See [New invoice and related projects](#new-invoice-and-related-projects) |
| `/invoices/:id` | Invoice detail | Actions: PDF, email, share link, status, cancel/delete |
| `/invoices/:id/edit` | Edit invoice | Draft only |
| `/clients` | Client list | Radio select, new client form, quick edit |
| `/clients/:clientId` | **Client profile** | See below |
| `/clients/:clientId/stats` | — | **Redirects** to `/clients/:clientId#invoice-status` |
| `/discounts` | Discount codes | No sidebar link; accessible via Settings → Discounts tab |
| `/settings` | Company settings | Tabbed layout: **General** (business info, logo), **Discounts** (link to manage codes), **Email** (SMTP config, test button, company email), **Backup** (export/import JSON), **Account** (change login email and password) |

## Client profile (`/clients/:clientId`)

Tabbed page for one client (see `ClientProfilePage.tsx`). Header shows client name, customer number, and action buttons (Full invoice list, Create invoice, Delete client). On small screens, these actions stack to full-width buttons for easier tapping.

### Details tab (`#details`, default)

Edit client fields (name, email, phone, company, address, discount code, notes) and save. Customer number is read-only.

### Invoices tab (`#invoices`, `#invoice-status`)

Two sections:

1. **Invoice status** — Total revenue and total tax collected summary cards, plus counts and dollar totals by status (draft / sent / paid / late) for this client only (`GET /api/invoices/stats/by-client/:clientId`).
2. **Invoice list** — Table of invoices showing per-invoice revenue, tax, and total columns with a totals footer row; links to each `/invoices/:id`; link to full filtered list (`/invoices?clientId=`).

### Projects tab (`#projects`)

Per-client project tracking (see `ClientProjectsTab.tsx`). List, create, edit, and delete projects scoped to this client. Fields include: **project name** (required), description, start/end dates, status, priority, **documents** (zero or more Google Docs / Microsoft 365 URLs, each with an optional label), team members (comma-separated), tags, budget, **hours** (optional, with a checkbox for whether that value is a **maximum** cap), dependencies, milestones (title + optional due date per row), and notes. Uses `GET/POST /api/clients/:clientId/projects` and `GET/PUT/DELETE /api/clients/:clientId/projects/:projectId` (see [API reference](../api/reference.md#client-projects)).

Each project card includes **View**, **Create**, **Download**, and **Edit**. **Create** links to `/invoices/new?clientId=<clientId>&projectId=<projectId>` so the new-invoice form opens with that client and project selected.

On small screens, the profile tab bar is horizontally scrollable so **Details / Invoices / Projects / Portal** remain usable without wrapping.

### Portal tab (`#portal`)

Client portal management has its own tab (separate from Details):

- Enable/disable client portal
- Set/update portal password
- Regenerate portal access token link
- Copy sign-in link (`/portal/login?token=...`)

**Deep links**

- `/clients?edit=<uuid>` → redirects to `/clients/<uuid>#details` (e.g. from invoice “View / edit client”).
- Old bookmark `/clients/:id/stats` → redirect to profile with `#invoice-status` (opens Invoices tab).
- Hash `#invoice-status` or `#invoices` → opens the Invoices tab; `#details` → opens the Details tab; **`#projects`** → opens the Projects tab; **`#portal`** → opens the Portal tab.

### New invoice and related projects (`NewInvoicePage.tsx`)

The form supports an optional **Related project** dropdown (projects for the selected client). **Query params:** `?clientId=` and `?projectId=` prefill client and project (e.g. from the client header **Create invoice** button or a project card **Create invoice**).

When you **change** the related project (including the first time it loads from the URL):

- **Description:** If the project has a non-empty **description**, the **first line item** description is set to that text (shown in a textarea on line 1). If the project description is empty, line 1 description is cleared so you can type your own. You can always edit the field.
- **Hours:** If the project has **hours** greater than zero, the **first line** hours field is set to that number. If the project marks hours as a **maximum** (`hours_is_maximum`), each line’s hours input uses that value as **`max`**, and **total** billed hours (lines with a description) cannot exceed it.

Draft **edit** mode does not overwrite saved line items on load; syncing applies when the user changes the related project selection.

#### One invoice per project (non-cancelled)

A **project** may be linked to **at most one** invoice that is **not** in **`cancelled`** status. **`cancelled`** invoices do not block linking the same project again.

When both **Client** and **Related project** are set, the page fetches **`GET /api/invoices`** for that client (**`limit=100`**, the API maximum for list pagination) and derives conflicts by matching **`project_id`** and excluding **`cancelled`**. If a client has more than 100 invoices, only the first page is scanned client-side; the server still returns **409** if a duplicate project link is attempted. (The API also exposes **`GET /api/invoices/for-project/:projectId`** for the same conflict rows; the form uses the list endpoint so conflict UI still works if older deployments lack the dedicated route.)

- **Loading:** Short “checking…” text; **Preview invoice** and **Create invoice** / **Save** are disabled until the request finishes.
- **Conflict (list loaded):** A bordered **amber** alert with heading *This project is already linked to another invoice* lists existing invoices (links to **`/invoices/:id`**). **Preview** and **Create/Save** stay disabled until you clear the conflict (different project, **None**, or cancel the other invoice).
- **Conflict check request failed:** If **`GET /api/invoices`** for the conflict check errors, a plain **amber** line appears: *Selected project already has an invoice, delete existing invoice before creating a new one.* **Preview** and **Create/Save** remain enabled; submitting may still succeed or fail with **409** depending on the real server state.
- **Submit / preview guards:** Handlers refuse to proceed while conflicts are **known from list data** or while the check is **still pending**—not when only the error line above is shown.
- **Server:** **`POST /api/invoices`** and **`PUT /api/invoices/:id`** (draft) return **409** with **`error`** and **`conflicts`** if the rule is violated; the UI shows that message in a toast. Other API errors that return a string **`error`** field are surfaced when possible instead of a generic failure toast.

See [API reference — Invoices](../api/reference.md#invoices).

## Invoice preview behavior

The invoice preview modal (`InvoicePreviewModal.tsx`) is used from **Invoices** (row preview), **Invoice detail**, and **New / edit invoice** (draft preview). It uses a **`max-h-[90vh]`** flex column so **Close** and **Download PDF** stay visible when the PDF is tall or when project **external links** exist.

Layout (top to bottom):

1. Title bar and hint text (if the invoice has project links, the hint points users to the HTML link list below the PDF for **new-tab** behavior).
2. **PDF** — `iframe` with a **flex-grown** height (`flex-1 min-h-0`), not `position: absolute`, so embedded PDF link hit areas stay aligned with the viewer.
3. **Document links** — when `project_external_links` exist, an **`ExternalLinksList`** block **below** the PDF (above the footer) with real `<a target="_blank" rel="noopener noreferrer">` links. Labels match the links under **NOTES** in the PDF.

**Why the HTML list exists:** PDF URI annotations inside an embedded viewer usually **navigate the iframe** (same tab context), not a new tab, and behavior varies by browser. The list under the preview is the supported way to open the same URLs in a **new tab** reliably.

## Public routes

| Path | Page |
|------|------|
| `/share/:token` | Shared invoice (no login); clients can mark as paid |
| `/login`, `/register` | Auth |
| `/portal/login` | Client portal login (access token **or** email + password, optional TOTP) |

## Client portal routes

The client portal uses a separate `PortalLayout` (no main app sidebar) and a `portalToken`-based auth gate. After login, the UI loads:
- `/api/portal/me`
- `/api/portal/notifications` (polled periodically to approximate real-time)
- `/api/portal/invoices` (draft invoices are hidden by the backend)
- `/api/portal/projects`
- `/api/portal/account`

| Path | Page | Notes |
|------|------|------|
| `/portal` | Dashboard | Account overview + recent activity |
| `/portal/invoices` | Invoices | Non-draft invoices only |
| `/portal/projects` | Projects | Project list/status |
| `/portal/projects/:projectId` | Project detail | Full project view for the client |
| `/portal/account` | Account | Set login email (username) + change password |
| `/portal/security` | Security | Portal 2FA setup/enable/disable |
| `/client-portal` | Redirect to `/portal` | —
| `/client-portal/login` | Redirect to `/portal/login` | —

## Admin routes

Admin routes use `AdminLayout` (separate sidebar + admin auth guard). Accessible via `/admin` with a dedicated admin login page — separate from the regular user login.

Both `AppLayout` and `AdminLayout` are responsive: desktop uses fixed sidebars, while mobile uses a slide-in navigation drawer (hamburger menu + backdrop + auto-close on navigation).

| Path | Page | Notes |
|------|------|--------|
| `/admin` | Admin dashboard | Stats, user growth chart, system health, service status, system logs |
| `/admin/users` | User management | Paginated list, search, role management |
| `/admin/users/:id` | User detail | Profile, invoice/client counts, revenue, role update |
| `/admin/moderation` | Content moderation | Flag queue, review (approve/reject), bulk actions |
| `/admin/tickets` | Support tickets | All user tickets, status/priority filters |
| `/admin/tickets/:id` | Ticket detail | Message thread, admin reply, status update |
| `/admin/backups` | Backup management | Snapshots (trigger, restore, verify, delete), policies |
| `/admin/rate-limits` | Rate limit config | View/create/update rate limit rules, analytics |

**Access control:** The `AdminLayout` checks `useAuthStore().isAdmin()` (i.e. `user.role === 'admin'`). Non-admin users or unauthenticated visitors see the admin login page instead of being redirected.

**Default admin:** Docker Compose sets `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars; the backend seeds this admin user on startup if it doesn't already exist. Default credentials: `admin@invoicing.local` / see `docker-compose.yml`.

## Related

- [Frontend overview](overview.md) — architecture diagram
- [API reference](../api/reference.md) — `stats/by-client`, [client projects](../api/reference.md#client-projects)
