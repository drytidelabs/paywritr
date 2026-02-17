# Configuration (v0.1)

Paywritr is configured via environment variables.

## Required

- `APP_SECRET`
  - Long random string.
  - Used to sign unlock cookies and short-lived invoice polling state tokens.

## Server

- `PORT` (default: `3000`)
- `BASE_URL` (default: `http://localhost:<PORT>`)
- `SITE_TITLE` (default: `Paywritr`)
- `UNLOCK_DAYS` (default: `30`)
- `COOKIE_SECURE` (default: `false`)
  - Set `true` in production behind HTTPS so cookies are marked `Secure`.

## Payments provider (v0.2)

v0.2 currently ships with **Alby Hub only**.

- `PAYMENTS_PROVIDER=alby_hub`
- `ALBY_HUB_URL`
  - A `nostr+walletconnect://...` URI that includes a secret.
  - Treat it like a password: **do not commit it**.

> LNbits is intentionally deferred to a later build.

## Example .env

```bash
PORT=3000
BASE_URL=http://localhost:3000
SITE_TITLE=Paywritr

APP_SECRET=change-me-to-a-long-random-string
UNLOCK_DAYS=30
COOKIE_SECURE=false

PAYMENTS_PROVIDER=alby_hub
ALBY_HUB_URL='nostr+walletconnect://...'
```
