# Deployment

Production and container deployment documentation for the invoicing app.

| Document | Description |
|----------|-------------|
| [guide.md](guide.md) | Docker Compose, environment variables, manual builds, nginx |
| [diagram.md](diagram.md) | Mermaid diagram of services and traffic |

The stack is: **PostgreSQL** (data), **Redis** (rate limits + cached stats), **Express** API, **nginx** (static SPA + `/api` proxy).
