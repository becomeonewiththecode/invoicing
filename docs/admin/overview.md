# Admin panel overview

Standalone management interface at `/admin`. Separate layout, sidebar, and login from the main user-facing app. All backend routes sit under `/api/admin` and require both JWT authentication and `role = 'admin'`.

## Access control

1. Browser navigates to any `/admin/*` route.
2. `AdminLayout` checks the Zustand auth store for a valid token **and** `user.role === 'admin'`.
3. If either check fails the `AdminLoginPage` is shown in-place (no redirect).
4. On the backend every `/api/admin` route passes through two middleware layers:
   - **`authenticate`** — verifies the JWT and attaches `userId`.
   - **`requireAdmin`** — looks up the user's role (cached in Redis for 5 minutes, falls back to PostgreSQL). Returns **403** if not admin.
5. The default admin account is seeded on startup from the `ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables (see `docker-compose.yml`).

## Layout

| Component | File | Role |
|-----------|------|------|
| `AdminLayout` | `frontend/src/components/layout/AdminLayout.tsx` | Auth guard, responsive header ("Admin Panel" + sign-out), desktop sidebar + mobile drawer, `<Outlet />` |
| `AdminSidebar` | `frontend/src/components/layout/AdminSidebar.tsx` | Dark nav sidebar used in desktop mode and the mobile slide-in drawer |

**Sidebar links:** Dashboard, Users, Moderation, Tickets, Backups, Rate Limits, Settings.

## Architecture diagrams

### Admin request flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as nginx / Vite proxy
    participant E as Express
    participant MW as Middleware
    participant PG as PostgreSQL
    participant RD as Redis

    B->>N: GET /api/admin/* (Bearer token)
    N->>E: proxy_pass
    E->>MW: authenticate (JWT verify)
    MW->>MW: requireAdmin
    MW->>RD: Check role cache
    alt Cache hit
        RD-->>MW: role = admin
    else Cache miss
        MW->>PG: SELECT role FROM users
        PG-->>MW: role
        MW->>RD: SET cache (5 min TTL)
    end
    MW-->>E: next()
    E->>PG: Query
    PG-->>E: Result
    E-->>B: JSON response
```

### Admin component architecture

```mermaid
flowchart TB
    subgraph AdminLayout["AdminLayout (auth guard)"]
        direction TB
        SIDEBAR["AdminSidebar\nDesktop fixed sidebar\nMobile slide-in drawer"]
        HEADER["Responsive header\nMenu toggle · Admin Panel · Sign Out"]
    end

    subgraph Pages["Admin pages"]
        DASH["AdminDashboardPage\nstats · growth chart · health · logs"]
        USERS["AdminUsersPage\nsearch · list · pagination"]
        UDET["AdminUserDetailPage\ninfo · role · content flags"]
        MOD["AdminModerationPage\npending/approved/rejected · bulk"]
        TIX["AdminTicketsPage\nfilter · search · list"]
        TDET["AdminTicketDetailPage\nthread · reply · status"]
        BACK["AdminBackupsPage\nsnapshots · policies"]
        RL["AdminRateLimitsPage\nconfig · analytics"]
        SETT["AdminSettingsPage\npassword change"]
        LOGIN["AdminLoginPage\nemail/password form"]
    end

    subgraph API["api/admin.ts"]
        A_DASH["dashboard: stats, userGrowth"]
        A_USERS["users: list, detail, role, flag"]
        A_MOD["moderation: queue, review, bulk"]
        A_TIX["tickets: list, detail, reply, status"]
        A_HEALTH["health: status, logs"]
        A_BACK["backups: snapshots, trigger, restore, verify, delete, policies"]
        A_RL["rateLimits: configs, create, update, analytics"]
        A_ACCT["account: passwordReset"]
    end

    AdminLayout --> Pages
    DASH --> A_DASH
    DASH --> A_HEALTH
    USERS --> A_USERS
    UDET --> A_USERS
    MOD --> A_MOD
    TIX --> A_TIX
    TDET --> A_TIX
    BACK --> A_BACK
    RL --> A_RL
    SETT --> A_ACCT
```

## Backend modules

| Path | Responsibility |
|------|----------------|
| `routes/admin/index.ts` | Mounts all sub-routers; applies `authenticate` + `requireAdmin` globally |
| `routes/admin/dashboard.ts` | `/dashboard/stats`, `/dashboard/user-growth` |
| `routes/admin/users.ts` | `/users` list, `/:id` detail, `/:id/role`, `/:id/flag` |
| `routes/admin/moderation.ts` | `/moderation` queue, `/:id` review, `/bulk` |
| `routes/admin/tickets.ts` | `/tickets` list, `/:id` detail + reply + status |
| `routes/admin/health.ts` | `/health` checks, `/health/logs` |
| `routes/admin/backups.ts` | `/backups` snapshots, trigger, restore, verify, delete, `/backups/policies` |
| `routes/admin/rateLimit.ts` | `/rate-limits` config CRUD, `/rate-limits/analytics` |
| `routes/admin/account.ts` | `/account/password` — admin password reset |
| `middleware/adminAuth.ts` | `requireAdmin()` — role check with Redis cache |
| `services/adminDashboard.ts` | Stats aggregation, user growth, user list/detail, role updates |
| `services/adminHealth.ts` | DB / Redis / frontend / backend health checks; system metrics; log queries |
| `services/adminModeration.ts` | Content flag CRUD, queue, review (single + bulk), user content scan |
| `services/adminTickets.ts` | Ticket list/detail, reply, status, per-user queries |
| `services/adminBackup.ts` | Snapshot create/restore/verify/delete, policies, automated runs, retention enforcement |
| `models/adminValidation.ts` | Zod schemas for all admin request bodies and query strings |

## Related docs

- [Admin pages reference](pages.md) — per-page details, UI, actions, API calls
- [API reference — Admin endpoints](../api/reference.md#admin-panel-admin-role-required)
- [Frontend routes](../frontend/routes.md#admin-routes)
- [Database schema](../database/schema.md)
