# Deployment

Production and container deployment for the invoicing app.

**Stack:** PostgreSQL (data), Redis (rate limits + cached stats), Express API, nginx (static SPA + `/api` proxy).

## Documents

| File | Description |
|------|-------------|
| [guide.md](guide.md) | Docker Compose, environment variables, manual builds, nginx, port notes |
| [diagram.md](diagram.md) | Mermaid diagram of services and traffic |

## Project documentation

- [docs/README.md](../docs/README.md) — database, API, backend, frontend, tech stack  
- [README.md](../README.md) — repository overview and quick start
