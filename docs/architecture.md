# Architecture

## Overview

The application follows a standard client-server architecture with a React SPA frontend and an Express.js REST API backend.

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│                                                     │
│   React SPA (Vite dev server / nginx in prod)       │
│   ├── React Router (client-side routing)            │
│   ├── React Query (server state + caching)          │
│   ├── Zustand (auth state + localStorage)           │
│   └── Axios (API calls with JWT interceptors)       │
└───────────────┬─────────────────────────────────────┘
                │ HTTP / JSON
                ▼
┌─────────────────────────────────────────────────────┐
│              Express.js API (port 3002)             │
│                                                     │
│   Middleware Pipeline:                              │
│   helmet → cors → morgan → json parser             │
│                                                     │
│   Route-level middleware:                           │
│   rateLimit → validate (Zod) → authenticate (JWT)  │
│                                                     │
│   Routes:                                           │
│   /api/auth      → register, login                  │
│   /api/clients   → CRUD                             │
│   /api/invoices  → CRUD, status, stats, CSV export  │
│   /api/discounts → CRUD                             │
│                                                     │
│   Background Jobs (node-cron):                      │
│   └── Daily: mark overdue, send reminders,          │
│              generate recurring invoices             │
└──────┬──────────────────────────────┬───────────────┘
       │                              │
       ▼                              ▼
┌──────────────┐            ┌──────────────┐
│  PostgreSQL  │            │    Redis     │
│  (port 5432) │            │  (port 6379) │
│              │            │              │
│  6 tables    │            │  Rate limits │
│  Data store  │            │  Revenue     │
│              │            │  cache (5m)  │
└──────────────┘            └──────────────┘
```

## Frontend Architecture

### Routing

React Router handles all client-side navigation. The `AppLayout` component wraps authenticated routes with a sidebar and redirects unauthenticated users to `/login`.

```
/login            → LoginPage
/register         → RegisterPage
/                 → DashboardPage (protected)
/invoices         → InvoicesPage (protected)
/invoices/new     → NewInvoicePage (protected)
/invoices/:id     → InvoiceDetailPage (protected)
/clients          → ClientsPage (protected)
/discounts        → DiscountsPage (protected)
```

### State Management

- **Server state:** React Query handles fetching, caching (30s stale time), and cache invalidation across pages.
- **Auth state:** Zustand store with localStorage persistence. The Axios client reads the token from localStorage on each request.

### API Layer

Each resource has its own module in `src/api/` that wraps Axios calls. The base Axios client (`src/api/client.ts`) handles:
- Adding JWT tokens to request headers
- Redirecting to `/login` on 401 responses

### PDF Generation

Invoice PDFs are generated entirely client-side using jsPDF in `src/utils/pdf.ts`. No server round-trip required.

## Backend Architecture

### Middleware Stack

Requests flow through middleware in this order:

1. **helmet** — Security headers
2. **cors** — Cross-origin configuration
3. **morgan** — Request logging
4. **express.json()** — Body parsing
5. **rateLimit** (per-route) — Redis-backed request throttling
6. **validate** (per-route) — Zod schema validation
7. **authenticate** (per-route) — JWT verification

### Rate Limiting

Redis-backed with per-IP, per-path counters. If Redis is unavailable, requests are allowed through (fail-open).

### Background Jobs

Two cron jobs run via `node-cron`:

- **Overdue check** (daily 9am): Marks `sent` invoices past due date as `overdue`, logs reminders for invoices not reminded in 3+ days.
- **Recurring invoices** (daily midnight): Creates new invoices from recurring templates, copies line items, updates next recurrence date.

### Caching

Revenue statistics (`GET /invoices/stats/revenue`) are cached in Redis for 5 minutes. The cache is invalidated when invoices are created, deleted, or their status changes.

## Deployment Architecture

Docker Compose orchestrates all services:

- **postgres** — Data persistence with volume mount
- **redis** — Ephemeral cache and rate limit store
- **backend** — Multi-stage build (compile TS → run JS)
- **frontend** — Multi-stage build (compile → serve via nginx)

In production, nginx serves the frontend SPA and proxies `/api` requests to the backend container.
