# Documentation

Project docs for developers. **Deployment** (Docker, nginx, production env) lives in the top-level [`deployment/`](../deployment/README.md) folder.

## Contents

| Topic | Document |
|--------|----------|
| **Index** | You are here |
| **Getting started** | [getting-started.md](getting-started.md) — databases via Docker, PM2, full Compose, [troubleshooting](getting-started.md#troubleshooting) |
| **Tech stack** | [tech-stack.md](tech-stack.md) |
| **Database** | [database/schema.md](database/schema.md) · [database/diagram.md](database/diagram.md) |
| **API** | [api/review.md](api/review.md) · [api/reference.md](api/reference.md) |
| **Architecture** | [architecture.md](architecture.md) — Docker Compose stack, startup sequence, request flow, backup import |
| **Backend** | [backend/overview.md](backend/overview.md) |
| **Frontend** | [frontend/overview.md](frontend/overview.md) · [frontend/routes.md](frontend/routes.md) (routes, client profile, Projects tab, [new invoice + projects](frontend/routes.md#new-invoice-and-related-projects)) |
| **Central portal** | [frontend/overview.md](frontend/overview.md) · [frontend/routes.md](frontend/routes.md) (main vendor/user app routes) |
| **Client portal** | [client-portal/overview.md](client-portal/overview.md) · [client-portal/login-and-usage.md](client-portal/login-and-usage.md) |
| **Admin portal** | [admin/overview.md](admin/overview.md) · [admin/pages.md](admin/pages.md) (per-page reference) |

## Deployment (separate folder)

| Document | Description |
|----------|-------------|
| [deployment/guide.md](../deployment/guide.md) | Docker Compose, env vars, nginx, manual deploy |

## Root README

[README.md](../README.md) — repository overview, quick start, and links into this tree.
