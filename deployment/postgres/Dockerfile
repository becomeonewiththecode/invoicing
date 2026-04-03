# Postgres with invoicing schema baked in (no repo bind mount at runtime).
# Repository root must be the build context (see docker-compose-build.yml).
# Build: docker compose -f deployment/docker-compose-build.yml build postgres
#    or: docker build -f deployment/postgres/Dockerfile -t invoice-postgres:1.0 .
FROM postgres:16-alpine
COPY backend/src/models/schema.sql /docker-entrypoint-initdb.d/01-schema.sql
