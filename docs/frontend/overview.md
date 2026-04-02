# Frontend overview

React 18 SPA built with Vite (`frontend/`). TypeScript throughout; Tailwind for styling.

## Structure

| Area | Role |
|------|------|
| `src/App.tsx` | `BrowserRouter`, route table, public vs protected vs admin layout |
| `src/components/layout/AppLayout.tsx` | Responsive vendor layout: desktop sidebar + mobile drawer, header, outlet; includes quick links to admin and client portals |
| `src/components/layout/AdminLayout.tsx` | Responsive admin layout: desktop sidebar + mobile drawer; shows admin login if not authenticated as admin |
| `src/components/layout/AdminSidebar.tsx` | Admin navigation links (desktop and mobile drawer) |
| `src/api/` | Axios instance (`client.ts`) + resource modules (`clients`, `projects`, `settings`, `data`, `admin`, `tickets`, …); base URL from `VITE_API_URL` |
| `src/stores/` | Zustand **auth** store (persisted); `isAdmin()` helper for role check; **`themeStore.ts`** — selected palette + `localStorage` + `document.documentElement.dataset.theme` |
| `src/components/ThemePickerPanel.tsx` | Shared **Appearance** UI (four themes); used by Settings, portal Account, admin Settings |
| `src/index.css` | Theme tokens: `--color-bg`, `--color-surface`, `--color-primary`, `--color-sidebar-*`, etc., per `[data-theme="…"]`; `html` / `body` / `#root` use `--color-bg` for full-viewport canvas |
| `tailwind.config.js` | Maps semantic colors to CSS variables (`bg-bg`, `text-text`, `border-border`, `bg-sidebar-bg`, …) |
| `src/pages/` | Page components (dashboard, invoices, clients, settings, …) |
| `src/pages/portal/` | **Client portal** pages (login, dashboard, invoices, projects, project detail, account, security); `PortalLayout` (no main sidebar) |
| `src/components/portal/` | `PortalLayout.tsx` and shared portal chrome |
| `src/components/client/` | Client profile subviews (e.g. `ClientProjectsTab.tsx`) |
| `src/pages/admin/` | Admin panel pages (dashboard, users, moderation, tickets, backups, rate limits, login) |
| `src/utils/pdf.ts` | jsPDF invoice generation |

## Routing

Public: `/login`, `/register`, `/share/:token`, **`/portal/login`** (client portal). Authenticated routes are nested under `AppLayout`: `/`, `/invoices`, `/invoices/new`, `/invoices/:id`, `/invoices/:id/edit`, `/clients`, **`/clients/:clientId`** (client profile: **Details**, **Invoices**, **Projects**, **Portal** tabs), `/clients/:clientId/stats` (redirects to profile `#invoice-status`), `/discounts`, `/settings` (tabbed: General, Discounts, Email, Backup, Account), `/support`. **`/portal/*`** (after client login) uses **`PortalLayout`** instead of `AppLayout`. Admin routes are nested under `AdminLayout` with a separate login: `/admin` (dashboard + health), `/admin/users`, `/admin/moderation`, `/admin/tickets`, `/admin/backups`, `/admin/rate-limits`. Unknown paths redirect to `/`.

Vendor and admin shells are mobile-friendly: below desktop breakpoints, sidebars collapse into a slide-in drawer, and page padding/header controls scale down for smaller screens.

See **[routes.md](routes.md)** for the full table, hashes (`#details`, `#invoice-status`, `#invoices`, `#projects`, `#portal`), client portal paths, and deep links. **[Client portal docs](../client-portal/overview.md)** cover login, 2FA, and API usage.

## Frontend diagrams

### Component architecture

```mermaid
flowchart TB
  subgraph Browser["Browser"]
    subgraph Router["React Router"]
      direction TB
      subgraph Public["Public routes"]
        LOGIN["/login\nLoginPage"]
        REG["/register\nRegisterPage"]
        SHARE["/share/:token\nSharedInvoicePage"]
      end
      subgraph Protected["Protected routes (AppLayout)"]
        DASH["/ DashboardPage\nrevenue stats · chart · recent invoices"]
        INV_LIST["/invoices\nInvoicesPage\npaginated · customer filter button · CSV export"]
        INV_NEW["/invoices/new\nNewInvoicePage\ncreate · line items · preview\noptional project · conflict check\nURL ?clientId & ?projectId"]
        INV_EDIT["/invoices/:id/edit\nNewInvoicePage (edit mode)"]
        INV_DET["/invoices/:id\nInvoiceDetailPage\nPDF · share · email · status"]
        CL_LIST["/clients\nClientsPage\npaginated · quick edit"]
        CL_PROF["/clients/:clientId\nClientProfilePage\nDetails · Invoices · Projects"]
        DISC["/discounts\nDiscountsPage"]
        SETT["/settings\nSettingsPage\nGeneral · Appearance · Discounts · Email · Backup · Account"]
        SUPPORT["/support\nSupportPage\nuser ticket submission"]
      end
      subgraph Admin["Admin routes (AdminLayout)"]
        ADM_LOGIN["/admin\nAdminLoginPage\n(if not admin)"]
        ADM_DASH["/admin\nAdminDashboardPage\nstats · health · logs"]
        ADM_USERS["/admin/users\nAdminUsersPage"]
        ADM_MOD["/admin/moderation\nAdminModerationPage"]
        ADM_TIX["/admin/tickets\nAdminTicketsPage"]
        ADM_BACK["/admin/backups\nAdminBackupsPage"]
        ADM_RL["/admin/rate-limits\nAdminRateLimitsPage"]
        ADM_SET["/admin/settings\nAdminSettingsPage\npassword · Appearance"]
      end
    end

    subgraph Layout["Layout components"]
      APPL["AppLayout\ndesktop sidebar + mobile drawer\nheader + auth guard"]
      SIDE["Sidebar\nnav links · user info"]
      ADML["AdminLayout\ndesktop sidebar + mobile drawer\nadmin auth guard"]
      ADMSIDE["AdminSidebar\nadmin nav links"]
    end

    subgraph UI["UI components"]
      BADGE["StatusBadge\ncolor-coded invoice status"]
      PREVIEW["InvoicePreviewModal\nmax-h flex layout · PDF iframe\nlinks below PDF (new tab) · download"]
    end

    subgraph State["State management"]
      RQ["TanStack React Query\nserver state · 30s stale time\nauto cache invalidation"]
      ZS["Zustand AuthStore\nuser · token · localStorage"]
      ZTHEME["Zustand ThemeStore\ntheme key · localStorage\ndata-theme on <html>"]
    end

    subgraph API["API modules (Axios)"]
      direction LR
      AUTH_API["auth.ts\nlogin · register · updateAccount"]
      INV_API["invoices.ts\nCRUD · stats · CSV\nfor-project · share · email"]
      CL_API["clients.ts\nCRUD · pagination"]
      PRJ_API["projects.ts\nper-client projects"]
      DISC_API["discounts.ts\nCRUD · generate"]
      SET_API["settings.ts\nprofile · logo · SMTP"]
      DATA_API["data.ts\nexport · import"]
      ADM_API["admin.ts\ndashboard · users · moderation\ntickets · health · backups · rate limits"]
      TIX_API["tickets.ts\nuser support tickets"]
    end

    subgraph Utils["Utilities"]
      PDF["pdf.ts\njsPDF invoice generation\nlogo · multi-page · CAD"]
      PREV_U["invoicePreview.ts\nbuild preview from form\ntax · discount calc"]
      CLDISP["clientDisplay.ts\nlabel formatting"]
      RESOLVE["resolveApiUrl.ts\nasset URL resolution"]
    end
  end

  BACKEND["Backend /api\nnginx proxy or direct"]

  %% Layout
  Protected --> APPL
  APPL --> SIDE
  Admin --> ADML
  ADML --> ADMSIDE

  %% State flow
  Protected --> RQ
  Protected --> ZS
  Protected --> ZTHEME
  Admin --> RQ
  Admin --> ZS
  Admin --> ZTHEME
  SHARE --> RQ
  LOGIN --> ZS
  REG --> ZS
  RQ --> API

  %% API → Backend
  API --> BACKEND

  %% Page → Component usage
  INV_DET --> BADGE
  INV_LIST --> BADGE
  INV_LIST --> PREVIEW
  INV_NEW --> PREVIEW
  INV_DET --> PREVIEW
  INV_DET --> PDF
  CL_PROF --> BADGE
```

### Page → API module mapping

```mermaid
flowchart LR
  subgraph Pages
    DASH["DashboardPage"]
    INV["InvoicesPage"]
    INVD["InvoiceDetailPage"]
    INVN["NewInvoicePage"]
    CL["ClientsPage"]
    CLP["ClientProfilePage"]
    DISC["DiscountsPage"]
    SETT["SettingsPage"]
    SHARE["SharedInvoicePage"]
    LOGIN["LoginPage"]
    SUP["SupportPage"]
  end

  subgraph AdminPages["Admin Pages"]
    ADASH["AdminDashboardPage"]
    AUSERS["AdminUsersPage"]
    AMOD["AdminModerationPage"]
    ATIX["AdminTicketsPage"]
    ABACK["AdminBackupsPage"]
    ARL["AdminRateLimitsPage"]
    ALOGIN["AdminLoginPage"]
  end

  subgraph APIs["API modules"]
    A_AUTH["auth.ts"]
    A_INV["invoices.ts"]
    A_CL["clients.ts"]
    A_PRJ["projects.ts"]
    A_DISC["discounts.ts"]
    A_SET["settings.ts"]
    A_DATA["data.ts"]
    A_ADM["admin.ts"]
    A_TIX["tickets.ts"]
  end

  LOGIN --> A_AUTH
  ALOGIN --> A_AUTH
  DASH --> A_INV
  INV --> A_INV
  INV --> A_CL
  INVD --> A_INV
  INVD --> A_SET
  INVN --> A_INV
  INVN --> A_CL
  INVN --> A_DISC
  INVN --> A_SET
  CL --> A_CL
  CLP --> A_CL
  CLP --> A_PRJ
  CLP --> A_INV
  DISC --> A_DISC
  SETT --> A_SET
  SETT --> A_DISC
  SETT --> A_DATA
  SETT --> A_AUTH
  SHARE --> A_INV
  SUP --> A_TIX
  ADASH --> A_ADM
  AUSERS --> A_ADM
  AMOD --> A_ADM
  ATIX --> A_ADM
  ABACK --> A_ADM
  ARL --> A_ADM
```

### Data flow

```mermaid
sequenceDiagram
  participant U as User
  participant P as Page component
  participant RQ as React Query
  participant AX as Axios client
  participant LS as localStorage
  participant API as Backend /api

  Note over U,API: Authentication flow
  U->>P: Submit login form
  P->>AX: POST /auth/login
  AX->>API: { email, password }
  API-->>AX: { user, token }
  AX-->>P: Response
  P->>LS: Store token + user (Zustand persist)

  Note over U,API: Authenticated data flow
  U->>P: Navigate to /invoices
  P->>RQ: useQuery(['invoices', page])
  RQ->>AX: GET /invoices?page=1
  AX->>AX: Inject Bearer token from localStorage
  AX->>API: Authenticated request
  API-->>AX: { data, pagination }
  AX-->>RQ: Cache response (30s stale)
  RQ-->>P: Render data

  Note over U,API: Mutation with cache invalidation
  U->>P: Delete invoice
  P->>RQ: useMutation(deleteInvoice)
  RQ->>AX: DELETE /invoices/:id
  AX->>API: Authenticated request
  API-->>AX: 204
  RQ->>RQ: Invalidate ['invoices'] + ['revenue-stats']
  RQ->>AX: Re-fetch stale queries
  AX->>API: GET /invoices + GET /stats/revenue
  API-->>RQ: Fresh data
  RQ-->>P: Re-render
```

**Dev server:** Vite serves on port **5173** and can proxy `/api` to the backend (see `vite.config.ts`).

## UI themes

Four palettes — **Starter** (blue-violet), **Forest** (green), **Twilight** (grey/black), **Ember** (warm coral) — are defined as CSS custom properties in `src/index.css` under `:root` / `[data-theme="…"]`. Tailwind’s `extend.colors` maps utility classes such as `bg-bg` (page canvas), `bg-surface` (cards), `text-text`, `border-border`, and `bg-sidebar-bg` to those variables so vendor app, admin, and portal screens stay consistent when the user switches themes.

Persistence: `src/stores/themeStore.ts` (Zustand) writes the selected key to `localStorage`, sets `document.documentElement.dataset.theme`, and is loaded from `main.tsx` on startup. Users can change the theme from **Settings → General → Appearance**, **Client portal → Account**, or **Admin → Settings** (shared `ThemePickerPanel` component).

### Theming data flow

```mermaid
flowchart LR
  subgraph UI["Picker UI"]
    A["ThemePickerPanel"]
  end
  subgraph Store["Client state"]
    Z["themeStore\nZustand"]
    LS[("localStorage")]
  end
  subgraph DOM["Document"]
    H["html[data-theme]"]
    CSS["CSS variables\n--color-bg …"]
  end
  A -->|"setTheme()"| Z
  Z --> LS
  Z --> H
  H --> CSS
  subgraph Boot["Startup"]
    M["main.tsx imports\nthemeStore side effect"]
  end
  M --> H
```

## New invoice and projects

`NewInvoicePage` loads client projects when a client is selected and offers an optional **Related project**. Choosing a project (or opening `/invoices/new` with `clientId` and `projectId` query params) can prefill the **first line** description from the project’s description and the **first line** hours from the project’s hours when those values are set; if the project marks hours as a maximum, line hours are capped accordingly. When a project is selected, the page loads the client’s invoices to detect **one-invoice-per-project** conflicts: a bordered amber alert with links if matches exist, or—if that fetch fails—a plain amber line (*Selected project already has an invoice, delete existing invoice before creating a new one.*). The **Projects** tab on the client profile (`ClientProjectsTab.tsx`) includes a per-project **Create** link next to **View** and **Download** that deep-links to the new-invoice page with both IDs.

See **[routes.md — New invoice and related projects](routes.md#new-invoice-and-related-projects)** for full behavior and deep links.

## Related docs

- [App routes and client profile](routes.md)
- [Tech stack](../tech-stack.md)
- [API reference](../api/reference.md)
