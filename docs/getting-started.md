# Getting Started

See the [root README](../README.md) for clone, `npm install`, and a minimal local run. Below: database via Docker, then PM2 or manual dev servers, then full Docker Compose.

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for PostgreSQL and Redis in these flows)

## Quick Start

### 1. Start the database services

```bash
docker compose up -d postgres redis
```

This starts PostgreSQL on port 5432 and Redis on port 6379. The database schema is automatically applied on first run.

### 2. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` if you need to change ports or credentials. Default values work with the Docker setup.

### 3. Install dependencies (if needed)

From the repo root: `cd backend && npm install` and `cd ../frontend && npm install` (same as the [README quick start](../README.md#quick-start)).

### 4. Start the applications

**Option A: Using PM2 (recommended)**

```bash
# From the project root
npx pm2 start ecosystem.config.js
```

This starts both the API server (port **3002** per `ecosystem.config.js`) and the frontend dev server (port 5173). Align `backend/.env` `PORT` and `frontend/vite.config.ts` proxy with this port.

**Option B: Manual start**

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 5. Open the app

Navigate to [http://localhost:5173](http://localhost:5173) in your browser. Create an account to get started.

## PM2 Commands

| Command | Description |
|---------|-------------|
| `npx pm2 start ecosystem.config.js` | Start all apps |
| `npx pm2 list` | List running processes |
| `npx pm2 status` | Show process status |
| `npx pm2 logs` | Tail all logs |
| `npx pm2 logs invoicing-api` | Tail backend logs only |
| `npx pm2 restart all` | Restart all apps |
| `npx pm2 stop all` | Stop all apps |
| `npx pm2 delete all` | Remove all processes |

## Full Docker Setup

To run everything in containers (including backend and frontend):

```bash
docker compose up
```

Ports and environment variables: **[deployment/guide.md](../deployment/guide.md)**.

## Troubleshooting

### `column "sent_at" of relation "invoices" does not exist`

The app expects `invoices.sent_at` and `share_token` (see [schema](database/schema.md) and [Runtime schema upgrades](database/schema.md#runtime-schema-upgrades)). They are added automatically when the API starts (`ensureSchema()` in `backend/src/config/database.ts`). Backup import also runs `ensureSchema()` before applying data. If your database was created from an older `schema.sql` and the server has not been restarted since, **restart the backend** so `ensureSchema` runs.

To fix the database without a restart, apply the same changes manually:

```bash
psql "$DATABASE_URL" -f backend/migrations/005_invoice_late_sent_at.sql
psql "$DATABASE_URL" -f backend/migrations/007_share_token.sql
psql "$DATABASE_URL" -f backend/migrations/008_cancelled_status.sql
```

Or run the `ALTER` statements from those files by hand. After that, backup import and status updates that touch `sent_at` will work.
