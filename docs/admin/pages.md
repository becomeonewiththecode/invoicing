# Admin pages reference

Detailed reference for each page in the admin panel. All pages live in `frontend/src/pages/admin/` and call endpoints through `frontend/src/api/admin.ts`.

---

## Login (`/admin`)

**File:** `AdminLoginPage.tsx`

Shown by `AdminLayout` when the visitor has no token or is not an admin. Dark-themed centered card with email and password fields. Calls `POST /api/auth/login` and checks that the returned `role` is `admin`; displays an error if the account exists but is not an admin.

---

## Dashboard (`/admin`)

**File:** `AdminDashboardPage.tsx`

Central overview with four sections:

### Key metrics (top)

Six cards in a 3-column grid:

| Card | Source |
|------|--------|
| Total Users | `GET /admin/dashboard/stats` |
| Active Users (30 d) | same |
| Open Tickets | same |
| Pending Moderation | same |
| Total Invoices | same |
| Platform Revenue | same |

### User growth chart

Bar chart (Recharts) showing daily registrations for the last 30 days. Source: `GET /admin/dashboard/user-growth?days=30`.

### System health

Four service cards (Database, Redis, Frontend, Backend) with status colour, label, and response time in ms. Three metric cards below: Error Rate, Avg Response Time, Requests (Last Hour). An **auto-refresh** toggle re-fetches every 30 seconds. Source: `GET /admin/health`.

### System logs

Paginated table (20 per page) with columns: Time, Level, Method, Path, Status, Time (ms), IP. Filterable by log level (info / warn / error). Source: `GET /admin/health/logs`.

---

## Users (`/admin/users`)

**File:** `AdminUsersPage.tsx`

Paginated user list (20 per page) with a text search field that filters by email or business name.

| Column | Notes |
|--------|-------|
| Email | Links to user detail |
| Business Name | |
| Role | `user` or `admin` badge |
| Invoices | Count |
| Joined | Date |

**API:** `GET /admin/users?page=&limit=20&search=`

---

## User detail (`/admin/users/:id`)

**File:** `AdminUserDetailPage.tsx`

Two-column layout:

**Info card** — business name, phone, website, client count, invoice count, total revenue, join date.

**Role management card** — current role badge, dropdown to change between `user` and `admin`, save button. Calls `PUT /admin/users/:id/role`.

**Content flagging** — collapsible form to flag a user's content for moderation review. Fields: content type (Business Name / Invoice Notes / Client Notes), content snippet, optional reason. Calls `POST /admin/users/:id/flag`.

**API:** `GET /admin/users/:id`, `PUT /admin/users/:id/role`, `POST /admin/users/:id/flag`.

---

## Moderation (`/admin/moderation`)

**File:** `AdminModerationPage.tsx`

Three-tab interface: **Pending**, **Approved**, **Rejected**. Switching tabs resets pagination and selection.

### Pending tab

| Column | Notes |
|--------|-------|
| (checkbox) | For bulk selection |
| User | Email |
| Type | Content type |
| Content | Flagged snippet |
| Reason | Optional |
| Date | Created at |
| Actions | Approve / Reject buttons |

**Bulk actions** — bar appears when items are selected; bulk approve or reject.

### Approved / Rejected tabs

Same columns minus checkbox and actions.

**API:** `GET /admin/moderation?status=&page=&limit=20`, `PUT /admin/moderation/:id` (single), `POST /admin/moderation/bulk` (bulk).

---

## Tickets (`/admin/tickets`)

**File:** `AdminTicketsPage.tsx`

Paginated list (20 per page) with three filter controls:

| Filter | Options |
|--------|---------|
| Search | Free text |
| Status | All, Open, In Progress, Closed |
| Priority | All, Low, Normal, High, Urgent |

| Column | Notes |
|--------|-------|
| Subject | Links to ticket detail |
| User | Email |
| Status | Colour badge: green (open), blue (in_progress), grey (closed) |
| Priority | Colour badge: grey (low), blue (normal), orange (high), red (urgent) |
| Updated | Timestamp |

**API:** `GET /admin/tickets?page=&limit=20&status=&priority=&search=`

---

## Ticket detail (`/admin/tickets/:id`)

**File:** `AdminTicketDetailPage.tsx`

Header with ticket subject, user email, creation date, and a **status dropdown** (Open / In Progress / Closed) that saves on change via `PUT /admin/tickets/:id/status`.

**Conversation thread** — messages displayed chronologically. User messages are left-aligned; admin replies are indented right with a distinct background.

**Reply form** — textarea + send button. Hidden when the ticket is closed. Calls `POST /admin/tickets/:id/reply`.

**API:** `GET /admin/tickets/:id`, `PUT /admin/tickets/:id/status`, `POST /admin/tickets/:id/reply`.

---

## Backups (`/admin/backups`)

**File:** `AdminBackupsPage.tsx`

Two-tab interface: **Snapshots** and **Policies**.

### Snapshots tab

**Manual trigger** — user dropdown (fetched from `GET /admin/users?page=1&limit=100`) + "Trigger Backup" button. Calls `POST /admin/backups/:userId`.

Paginated table (20 per page):

| Column | Notes |
|--------|-------|
| User | Email |
| Date | Created at |
| Size | In KB |
| Type | Auto / Manual |
| Verified | Yes / No |
| Actions | Restore, Verify, Delete |

**Restore** and **Delete** show a confirmation prompt before proceeding.

**API:** `GET /admin/backups?page=&limit=20`, `POST /admin/backups/:userId`, `POST /admin/backups/:snapshotId/restore`, `POST /admin/backups/:snapshotId/verify`, `DELETE /admin/backups/:snapshotId`.

### Policies tab

Table with inline-editable fields that save on blur:

| Column | Editable | Notes |
|--------|----------|-------|
| User | No | Email |
| Retention (days) | Yes | Number input |
| Max Snapshots | Yes | Number input |
| Schedule | Yes | Cron expression text input |
| Enabled | Yes | Checkbox toggle |

**API:** `GET /admin/backups/policies`, `PUT /admin/backups/policies/:id`.

---

## Rate Limits (`/admin/rate-limits`)

**File:** `AdminRateLimitsPage.tsx`

Two-tab interface: **Configuration** and **Analytics**.

### Configuration tab

**Add Config** button toggles an inline form with fields: Route Pattern, Window (ms), Max Requests. Calls `POST /admin/rate-limits`.

Existing configs shown in a table with inline-editable fields (save on blur):

| Column | Editable | Notes |
|--------|----------|-------|
| Route Pattern | Yes | Text input |
| Window (ms) | Yes | Number input |
| Max Requests | Yes | Number input |
| Enabled | Yes | Checkbox toggle |

**API:** `GET /admin/rate-limits`, `POST /admin/rate-limits`, `PUT /admin/rate-limits/:id`.

### Analytics tab (last 24 hours)

**Metric cards** (3-column grid): Total Requests, Blocked Requests, Block Rate (%).

**Area chart** (Recharts) with two series: total requests and blocked requests over time.

**Two tables** in a 2-column grid (10 rows each):
- **Top IPs** — IP, Requests, Blocked
- **Top Blocked Routes** — Route, Requests, Blocked

**API:** `GET /admin/rate-limits/analytics?hours=24`.

---

## Settings (`/admin/settings`)

**File:** `AdminSettingsPage.tsx`

Single card with a password change form. Displays the current admin email (read-only) with three fields:

| Field | Validation |
|-------|------------|
| Current Password | Required |
| New Password | Required, min 8 characters |
| Confirm New Password | Required, must match new password |

**API:** `PUT /admin/account/password`.

---

## Related docs

- [Admin overview](overview.md) — architecture, access control, backend modules
- [API reference — Admin endpoints](../api/reference.md#admin-panel-admin-role-required)
- [Frontend overview](../frontend/overview.md)
