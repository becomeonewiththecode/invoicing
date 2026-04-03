# Troubleshooting

## Change admin password (Docker CLI)

Run these commands from **`deployment/`** (or pass `-f` with paths relative to your current directory). Use the **same Compose file** you used to start the stack (`docker-compose-build.yml` or `docker-compose-prod.yml`). Examples below use **`docker-compose-prod.yml`**; substitute **`docker-compose-build.yml`** if that is what you deploy.

1) Set your new password:

```bash
NEW_PASS='YourNewStrongPassword123!'
```

2) Generate a bcrypt hash using the backend container:

```bash
cd deployment
HASH=$(docker compose -f docker-compose-prod.yml exec -T backend \
  node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1],10).then(h=>console.log(h))" "$NEW_PASS")
```

3) Update the admin user password in PostgreSQL:

```bash
docker compose -f docker-compose-prod.yml exec -T postgres \
  psql -U postgres -d invoicing \
  -c "UPDATE users SET password_hash='${HASH}' WHERE email='admin@invoicing.local';"
```

4) Verify the admin account exists:

```bash
docker compose -f docker-compose-prod.yml exec -T postgres \
  psql -U postgres -d invoicing \
  -c "SELECT email, role FROM users WHERE email='admin@invoicing.local';"
```

## Note

Changing `ADMIN_PASSWORD` in `deployment/docker-compose-build.yml`, `deployment/docker-compose-prod.yml`, or `.env` does not reset an existing admin user password. It only affects initial admin seeding when the admin user does not already exist.
