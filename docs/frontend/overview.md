# Frontend overview

React 18 SPA built with Vite (`frontend/`). TypeScript throughout; Tailwind for styling.

## Structure

| Area | Role |
|------|------|
| `src/App.tsx` | `BrowserRouter`, route table, public vs protected layout |
| `src/layouts/AppLayout.tsx` | Sidebar + outlet for authenticated pages |
| `src/api/` | Axios instance (`client.ts`) + resource modules; base URL from `VITE_API_URL` |
| `src/store/` | Zustand auth store (persisted) |
| `src/pages/` | Page components (dashboard, invoices, clients, settings, …) |
| `src/utils/pdf.ts` | jsPDF invoice generation |

## Routing

Public: `/login`, `/register`, `/share/:token`. Authenticated routes are nested under `AppLayout`: `/`, `/invoices`, `/invoices/new`, `/invoices/:id`, `/invoices/:id/edit`, `/clients`, `/discounts`, `/settings`. Unknown paths redirect to `/`.

## Frontend diagram

```mermaid
flowchart TB
  subgraph Browser
    subgraph Router["React Router"]
      PUB["/login · /register · /share/:token"]
      PROT["Protected: / invoices clients discounts settings"]
    end

    subgraph State["State"]
      RQ["TanStack Query\nAPI cache"]
      ZS["Zustand\nauth + storage"]
    end

    subgraph IO["I/O"]
      AX["Axios\nJWT header"]
      PDF["jsPDF\ninvoice PDF"]
    end

    Router --> RQ
    Router --> ZS
    RQ --> AX
    PROT --> PDF
  end

  API["Backend /api"]
  AX -->|HTTPS same-origin or CORS| API
```

**Dev server:** Vite serves on port **5173** and can proxy `/api` to the backend (see `vite.config.ts`).

## Related docs

- [Tech stack](../tech-stack.md)
- [API reference](../api/reference.md)
