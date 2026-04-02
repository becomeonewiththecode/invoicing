# Tech stack

## Overview

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Zustand, React Hook Form, Zod, jsPDF |
| **Backend** | Express 5, TypeScript, `pg`, `ioredis`, JWT (`jsonwebtoken`), Zod, `node-cron`, `nodemailer` (optional SMTP), `multer` (logo uploads) |
| **Data** | PostgreSQL 16, Redis 7 |
| **Containers** | Docker Compose; multi-stage Dockerfiles for API and SPA |

## Frontend

- **Build:** Vite with `@vitejs/plugin-react`.
- **Routing:** `react-router-dom` (protected layout + public `/login`, `/register`, `/share/:token`).
- **Server state:** TanStack Query for API data, caching, and invalidation.
- **Auth:** Zustand store persisted to `localStorage`; Axios attaches `Authorization: Bearer`.
- **Theming:** Four named palettes (**Starter**, **Forest**, **Twilight**, **Ember**) driven by CSS custom properties on `html` (`data-theme`) and mirrored in Tailwind (`tailwind.config.js` → `bg-bg`, `text-text`, `bg-sidebar-bg`, etc.). A small Zustand **theme store** persists the choice in `localStorage` and is imported from `main.tsx`. Pickers live in vendor **Settings → General**, **Client portal → Account**, and **Admin → Settings** (`ThemePickerPanel.tsx`).
- **PDF:** Client-side invoice PDFs via jsPDF (no server render).

## Backend

- **HTTP:** Express with `helmet`, `cors`, `morgan`, `express.json()`.
- **Auth:** JWT middleware on protected routes; rate limiting backed by Redis.
- **Validation:** Zod schemas via shared middleware.
- **Jobs:** `node-cron` for daily late-invoice handling, reminders, and recurring invoice drafts.
- **Files:** Logos stored under `uploads/logos`, served under `/api/uploads`.

## API surface

All JSON APIs are under **`/api`**. The SPA should use a base URL ending in **`/api`** (see `VITE_API_URL`).

## Port alignment (local)

| Context | API port | Notes |
|---------|----------|--------|
| Docker Compose | 3001 | `deployment/docker-compose.yml` maps `3001:3001` |
| `backend/.env.example` | 3001 | Default for local `npm run dev` |
| PM2 `ecosystem.config.js` | 3002 | Matches `frontend/vite.config.ts` proxy target |

Set `PORT`, Vite’s `/api` proxy, and `VITE_API_URL` so they agree.
