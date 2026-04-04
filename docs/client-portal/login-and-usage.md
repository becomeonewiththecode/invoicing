# Client Portal Login + Usage

This document describes the **login process** (including optional TOTP 2FA) and the **post-login data loading** behavior.

## 1) Vendor setup (enable + token + password)

The vendor/admin enables the portal by updating the client’s portal settings.

```mermaid
sequenceDiagram
  participant V as Vendor/Admin UI
  participant N as nginx
  participant E as Express API
  participant PG as PostgreSQL

  V->>E: PATCH /api/clients/:id/portal\n{ enabled, password?, regenerateToken? }
  E->>PG: SELECT clients.portal_enabled, portal_token, portal_password_hash
  E->>PG: UPDATE clients\nportal_enabled / portal_token / portal_password_hash
  E-->>V: 200 Updated client (secrets removed)
```

### Important rules

- If the vendor enables the portal, the backend requires a portal password hash to exist (or the call provides `password`).
- Regenerating the token instantly invalidates old links because login uses `clients.portal_token`.

## 2) Client login flow (token or email + password, optional TOTP)

### Login options

Clients can sign in using either:
- **Access token + password** (default; vendor shares a portal link containing the token)
- **Email + password** (optional; client sets a login email under `/portal/account`)

Both flows share the same endpoint: `POST /api/portal/auth/login`.

Failed sign-in (**401** invalid credentials, **403** portal disabled / password not set, **401** bad TOTP, etc.) shows the API **`error`** text in an **inline alert** on **`PortalLoginPage`** (not only a toast).

### Login with username-less “access token”

The client portal login page uses a token (access link) created by the vendor.

```mermaid
flowchart TD
  A[/portal/login?token=<portal_token>] --> B[Client enters access token + password]
  B --> C[POST /api/portal/auth/login]
  C --> D{portal has TOTP enabled?}
  D -- No --> E[Backend verifies password hash]
  D -- Yes --> F{Client provided totpCode?}
  F -- No --> G[Backend returns requiresTwoFactor=true]
  F -- Yes --> H[Backend verifies TOTP code]
  E --> I[Backend returns portal JWT]
  H --> I[Backend returns portal JWT]
  I --> J[Redirect to /portal]
```

### Login with email + password

```mermaid
flowchart TD
  A[/portal/login] --> B[Client selects Email login\nenters email + password]
  B --> C[POST /api/portal/auth/login]
  C --> D{portal has TOTP enabled?}
  D -- No --> E[Backend verifies password hash]
  D -- Yes --> F{Client provided totpCode?}
  F -- No --> G[Backend returns requiresTwoFactor=true]
  F -- Yes --> H[Backend verifies TOTP code]
  E --> I[Backend returns portal JWT]
  H --> I[Backend returns portal JWT]
  I --> J[Redirect to /portal]
```

### 2FA step (TOTP)

When TOTP is enabled, the backend will respond with `requiresTwoFactor: true` if `totpCode` is missing.

## 3) Post-login usage (dashboard, invoices, projects, notifications)

After login, the portal loads data from `/api/portal/*` using the portal JWT (`Authorization: Bearer ...`).

```mermaid
sequenceDiagram
  participant B as Browser
  participant N as nginx
  participant E as Express API
  participant PG as PostgreSQL

  B->>N: GET /portal
  B->>N: GET /api/portal/me (Bearer portal JWT)
  N->>E: proxy_pass
  E->>PG: SELECT client + stats (counts)
  E-->>B: { client, vendor, stats }

  B->>N: GET /api/portal/notifications (Bearer portal JWT)
  E->>PG: SELECT recent invoice + project updates
  E-->>B: { data: [ ... ] }

  B->>N: GET /api/portal/invoices (Bearer portal JWT)
  E->>PG: SELECT invoices WHERE status != 'draft'
  E-->>B: { data: [ ... ] }

  B->>N: GET /api/portal/projects (Bearer portal JWT)
  E->>PG: SELECT projects for client
  E-->>B: { data: [ ... ] }

  Note over B,E: Project details
  B->>N: GET /api/portal/projects/:projectId (Bearer portal JWT)
  E->>PG: SELECT project + external_links
  E-->>B: Project object
```

The projects list includes a visible **View project** call-to-action on each card to open the detail route.

### “Real-time” behavior

In v1, “real-time notifications” are approximated with **polling**:

- the UI refreshes `/api/portal/notifications` about once per minute while the dashboard is open

## 4) Security page: TOTP setup/enable/disable

After signing in, the client can manage 2FA on `/portal/security`.

```mermaid
sequenceDiagram
  participant B as Browser
  participant E as Express API
  participant PG as PostgreSQL

  B->>E: POST /api/portal/2fa/setup (Bearer)
  E->>PG: UPDATE clients SET portal_totp_secret=..., portal_totp_enabled=false
  E-->>B: { qrDataUrl, otpauthUrl, secret }

  B->>E: POST /api/portal/2fa/enable { code } (Bearer)
  E->>PG: SELECT portal_totp_secret
  E-->>E: authenticator.verify(code, secret)
  E->>PG: UPDATE clients SET portal_totp_enabled=true
  E-->>B: { ok: true }

  Note over B,E: Disable requires the portal password
  B->>E: POST /api/portal/2fa/disable { password } (Bearer)
  E->>PG: SELECT portal_password_hash
  E-->>E: bcrypt.compare(password, hash)
  E->>PG: UPDATE clients SET portal_totp_secret=NULL, portal_totp_enabled=false
  E-->>B: { ok: true }
```

## 5) Client-facing data rules (what’s shown)

- **Invoices:** the backend returns only invoices with `status != 'draft'`.
- **Notifications:** includes recent invoice/project status updates for this client.

## 6) Account page: set portal login email + change password

The Account page is available at `/portal/account` (authenticated).

```mermaid
sequenceDiagram
  participant B as Browser
  participant E as Express API
  participant PG as PostgreSQL

  B->>E: GET /api/portal/account (Bearer)
  E->>PG: SELECT portal_login_email, portal_totp_enabled
  E-->>B: { email, twoFactorEnabled }

  B->>E: PUT /api/portal/account { email?, currentPassword?, newPassword? } (Bearer)
  E->>PG: SELECT portal_password_hash
  alt Session came from token login and currentPassword is blank
    E-->>E: Allow password update without current password
  else Standard path
    E-->>E: bcrypt.compare(currentPassword, hash)
  end
  E->>PG: UPDATE clients.portal_login_email and/or portal_password_hash
  E-->>B: { email, twoFactorEnabled, canSetPasswordWithoutCurrent }
```

The Account form shows inline success feedback after save (for example: **Password saved**), and the save button briefly changes to **Saved**.

