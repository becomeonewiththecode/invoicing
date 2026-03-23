# Getting Started

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for PostgreSQL and Redis)

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

### 3. Install dependencies

```bash
# From the project root
cd backend && npm install
cd ../frontend && npm install
```

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

This starts all services:
- PostgreSQL on port 5432
- Redis on port 6379
- Backend API on port **3001** (see `docker-compose.yml`)
- Frontend (via nginx) on port 80
