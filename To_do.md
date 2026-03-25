# To do

- [ ] **Configure SMTP for “Email to company”** — Set `SMTP_HOST` (and typically `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optionally `SMTP_FROM`) on the backend server or Docker `backend` service, then restart. Required for invoice emails to the company address.
- [ ] **Verify SendGrid Sender Identity** — The SMTP “From” address must match a verified Sender Identity in SendGrid. Go to SendGrid → Settings → Sender Authentication to verify a single sender or authenticate the domain. Until verified, sending emails will fail with a 550 error.
