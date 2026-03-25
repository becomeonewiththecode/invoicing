# Frontend overview

React 18 SPA built with Vite (`frontend/`). TypeScript throughout; Tailwind for styling.

## Structure

| Area | Role |
|------|------|
| `src/App.tsx` | `BrowserRouter`, route table, public vs protected layout |
| `src/layouts/AppLayout.tsx` | Sidebar + outlet for authenticated pages |
| `src/api/` | Axios instance (`client.ts`) + resource modules (`settings`, `data` backup helpers, …); base URL from `VITE_API_URL` |
| `src/store/` | Zustand auth store (persisted) |
| `src/pages/` | Page components (dashboard, invoices, clients, settings, …) |
| `src/utils/pdf.ts` | jsPDF invoice generation |

## Routing

Public: `/login`, `/register`, `/share/:token`. Authenticated routes are nested under `AppLayout`: `/`, `/invoices`, `/invoices/new`, `/invoices/:id`, `/invoices/:id/edit`, `/clients`, **`/clients/:clientId`** (client profile: details, invoice status, invoice links), `/clients/:clientId/stats` (redirects to profile `#invoice-status`), `/discounts`, `/settings` (tabbed: General, Discounts, Email, Backup). Unknown paths redirect to `/`.

See **[routes.md](routes.md)** for the full table, hashes (`#details`, `#invoice-status`, `#invoices`), and deep links.

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
        INV_LIST["/invoices\nInvoicesPage\npaginated · filter by client · CSV export"]
        INV_NEW["/invoices/new\nNewInvoicePage\ncreate · line items · preview"]
        INV_EDIT["/invoices/:id/edit\nNewInvoicePage (edit mode)"]
        INV_DET["/invoices/:id\nInvoiceDetailPage\nPDF · share · email · status"]
        CL_LIST["/clients\nClientsPage\npaginated · quick edit"]
        CL_PROF["/clients/:clientId\nClientProfilePage\n#details · #invoice-status · #invoices"]
        DISC["/discounts\nDiscountsPage"]
        SETT["/settings\nSettingsPage\nGeneral · Discounts · Email · Backup"]
      end
    end

    subgraph Layout["Layout components"]
      APPL["AppLayout\nsidebar + header + auth guard"]
      SIDE["Sidebar\nnav links · user info"]
    end

    subgraph UI["UI components"]
      BADGE["StatusBadge\ncolor-coded invoice status"]
      PREVIEW["InvoicePreviewModal\nPDF iframe + download"]
    end

    subgraph State["State management"]
      RQ["TanStack React Query\nserver state · 30s stale time\nauto cache invalidation"]
      ZS["Zustand AuthStore\nuser · token · localStorage"]
    end

    subgraph API["API modules (Axios)"]
      direction LR
      AUTH_API["auth.ts\nlogin · register"]
      INV_API["invoices.ts\nCRUD · stats · CSV\nshare · email"]
      CL_API["clients.ts\nCRUD · pagination"]
      DISC_API["discounts.ts\nCRUD · generate"]
      SET_API["settings.ts\nprofile · logo · SMTP"]
      DATA_API["data.ts\nexport · import"]
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

  %% State flow
  Protected --> RQ
  Protected --> ZS
  SHARE --> RQ
  LOGIN --> ZS
  REG --> ZS
  RQ --> API

  %% API → Backend
  API --> BACKEND

  %% Page → Component usage
  INV_DET --> BADGE
  INV_LIST --> BADGE
  INV_NEW --> PREVIEW
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
  end

  subgraph APIs["API modules"]
    A_AUTH["auth.ts"]
    A_INV["invoices.ts"]
    A_CL["clients.ts"]
    A_DISC["discounts.ts"]
    A_SET["settings.ts"]
    A_DATA["data.ts"]
  end

  LOGIN --> A_AUTH
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
  CLP --> A_INV
  DISC --> A_DISC
  SETT --> A_SET
  SETT --> A_DISC
  SETT --> A_DATA
  SHARE --> A_INV
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

## Related docs

- [App routes and client profile](routes.md)
- [Tech stack](../tech-stack.md)
- [API reference](../api/reference.md)
