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
- **Auth:** Zustand stores persisted to `localStorage`: **`authStore`** (`token`, `user`) for the vendor app; **`adminAuthStore`** (`admin_token`, `admin_user`) for `/admin` only; portal uses **`portalAuthStore`**. Axios (`client.ts`) sends **`admin_token`** for requests whose URL starts with **`/admin`**, otherwise the vendor **`token`**.
- **HTTP 401 (SPA):** A response interceptor clears the matching session and redirects only when **401** is not a “wrong password” on a public auth call. **`POST /auth/login`** and **`POST /auth/register`** return **401** for invalid credentials; the interceptor **does not** redirect (so **Admin login** and **vendor login** can show errors in place). Other **401**s: **`/admin/*`** → clear admin session, go to **`/admin`**; else → clear vendor session, go to **`/login`**.
- **Theming:** Four named palettes (**Starter**, **Forest**, **Twilight**, **Ember**) on `html[data-theme]` via CSS variables and Tailwind. **`themeStore`** + key **`theme`** cover the vendor app and client portal; **`adminThemeStore`** + **`admin_theme`** cover the admin panel only. **`ThemeRouteSync`** applies the correct palette by route; **`ThemePickerPanel`** uses **`scope="admin"`** on **Admin → Settings** and default app scope elsewhere (`ThemePickerPanel.tsx`, `themeBootstrap.ts`).
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
| Docker Compose | 3001 | `deployment/docker-compose-build.yml` / `docker-compose-prod.yml` map `3001:3001` |
| `backend/.env.example` | 3001 | Default for local `npm run dev` |
| PM2 `ecosystem.config.js` | 3002 | Matches `frontend/vite.config.ts` proxy target |

Set `PORT`, Vite’s `/api` proxy, and `VITE_API_URL` so they agree.
