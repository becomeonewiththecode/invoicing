# App routes and client profile

SPA routes (see `frontend/src/App.tsx`). All paths below except `/share/:token`, `/login`, and `/register` use `AppLayout` (sidebar).

## Authenticated routes

| Path | Page | Notes |
|------|------|--------|
| `/` | Dashboard | Revenue stats, recent invoices |
| `/invoices` | Invoice list | Optional `?clientId=` filter |
| `/invoices/new` | New invoice | |
| `/invoices/:id` | Invoice detail | Actions: PDF, email, share link, status, cancel/delete |
| `/invoices/:id/edit` | Edit invoice | Draft only |
| `/clients` | Client list | Radio select, new client form, quick edit |
| `/clients/:clientId` | **Client profile** | See below |
| `/clients/:clientId/stats` | — | **Redirects** to `/clients/:clientId#invoice-status` |
| `/discounts` | Discount codes | No sidebar link; accessible via Settings → Discounts tab |
| `/settings` | Company settings | Tabbed layout: **General** (business info, logo), **Discounts** (link to manage codes), **Email** (SMTP config, test button, company email), **Backup** (export/import JSON), **Account** (change login email and password) |

## Client profile (`/clients/:clientId`)

Single page for one client (see `ClientProfilePage.tsx`):

1. **Client details** — Edit fields and save; delete client. Hash: `#details`.
2. **Invoice status** — Total revenue and total tax collected summary cards, plus counts and dollar totals by status (draft / sent / paid / late) for this client only (`GET /api/invoices/stats/by-client/:clientId`). Hash: `#invoice-status`.
3. **Invoices** — Table of invoices showing per-invoice revenue, tax, and total columns with a totals footer row; links to each `/invoices/:id`; button to full filtered list (`/invoices?clientId=`). Hash: `#invoices`.

**Deep links**

- `/clients?edit=<uuid>` → redirects to `/clients/<uuid>#details` (e.g. from invoice “View / edit client”).
- Old bookmark `/clients/:id/stats` → redirect to profile with `#invoice-status`.

## Public routes

| Path | Page |
|------|------|
| `/share/:token` | Shared invoice (no login); clients can mark as paid |
| `/login`, `/register` | Auth |

## Admin routes

Admin routes use `AdminLayout` (separate sidebar + admin auth guard). Accessible via `/admin` with a dedicated admin login page — separate from the regular user login.

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
- [API reference](../api/reference.md) — `stats/by-client` endpoint
