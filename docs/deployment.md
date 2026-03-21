# Deployment

## Docker Compose (Recommended)

### Full stack deployment

```bash
docker compose up -d
```

This starts all services:

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache |
| backend | 3002 | Express.js API |
| frontend | 80 | nginx serving React SPA |

### Environment Variables

#### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3002 | API server port |
| NODE_ENV | development | Environment name |
| DATABASE_URL | postgresql://postgres:postgres@localhost:5432/invoicing | PostgreSQL connection string |
| REDIS_URL | redis://localhost:6379 | Redis connection string |
| JWT_SECRET | dev-secret-change-in-production | JWT signing secret |
| JWT_EXPIRES_IN | 7d | Token expiration |

#### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| VITE_API_URL | http://localhost:3002/api | Backend API URL |

### Production Considerations

1. **Change JWT_SECRET** — Use a strong, random secret in production
2. **Database backups** — The pgdata volume persists data; set up regular backups to S3 or similar
3. **SSL/TLS** — Add SSL termination in the nginx config or use a reverse proxy like Traefik
4. **Redis persistence** — Redis is configured as ephemeral; data loss on restart only affects rate limit counters and cached stats

## Manual Deployment

### Build the backend

```bash
cd backend
npm ci
npm run build
NODE_ENV=production node dist/server.js
```

### Build the frontend

```bash
cd frontend
npm ci
npm run build
```

The built files are in `frontend/dist/` — serve with any static file server (nginx, Caddy, etc.).

### nginx Configuration

A production nginx config is provided in `frontend/nginx.conf`. It:
- Serves the SPA from `/usr/share/nginx/html`
- Proxies `/api` requests to the backend service
- Handles client-side routing with `try_files` fallback to `index.html`
