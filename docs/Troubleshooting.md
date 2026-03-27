# Troubleshooting

## Change admin password (Docker CLI)

Run these commands from the repository root.

1) Set your new password:

```bash
NEW_PASS='YourNewStrongPassword123!'
```

2) Generate a bcrypt hash using the backend container:

```bash
HASH=$(docker compose -f deployment/docker-compose.yml exec -T backend \
  node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1],10).then(h=>console.log(h))" "$NEW_PASS")
```

3) Update the admin user password in PostgreSQL:

```bash
docker compose -f deployment/docker-compose.yml exec -T postgres \
  psql -U postgres -d invoicing \
  -c "UPDATE users SET password_hash='${HASH}' WHERE email='admin@invoicing.local';"
```

4) Verify the admin account exists:

```bash
docker compose -f deployment/docker-compose.yml exec -T postgres \
  psql -U postgres -d invoicing \
  -c "SELECT email, role FROM users WHERE email='admin@invoicing.local';"
```

## Note

Changing `ADMIN_PASSWORD` in `deployment/docker-compose.yml` (or `.env`) does not reset an existing admin user password. It only affects initial admin seeding when the admin user does not already exist.
