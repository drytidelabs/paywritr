# Configuration (v0.1)

Paywritr is configured via:

- `site.yml` (non-secret site metadata)
- environment variables (secrets + runtime)

## Required

- `APP_SECRET`
  - Long random string.
  - Used to sign unlock cookies and short-lived invoice polling state tokens.

## site.yml (non-secrets)

Create a `site.yml` (do not commit it; see `site.yml.example`). Keys:

- `title` (string)
- `tagline` (string)
- `description` (string)
- `timezone` (IANA TZ string, e.g. `America/New_York`)
- `theme` (string, optional)
  - If missing, defaults to `classic` (with a warning)
  - If present but invalid, Paywritr fails fast and prints available themes

Example:

```yml
title: "Paywritr"
tagline: "Minimal writing. Pay per post with Lightning."
description: "Hyper-minimal Markdown blog with per-post Lightning paygating."
timezone: "UTC"
theme: "classic"
```

## Server

- `PORT` (default: `3000`)
- `BASE_URL` (default: `http://localhost:<PORT>`)
- `UNLOCK_DAYS` (default: `30`)
- `COOKIE_SECURE` (default: `false`)
  - Set `true` in production behind HTTPS so cookies are marked `Secure`.

Legacy (not recommended):
- `SITE_TITLE` — moved to `site.yml:title`

## Payments provider

Paywritr supports **Alby Hub (NWC)** and **LNbits**.

- **Alby Hub** is the default/recommended path.
- **LNbits** is supported but should be treated as **beta/advanced**.

See `docs/payments.md` for full details.

## Theme selection

Themes live in the `themes/` folder.

Canonical source:
- `site.yml: theme`

Temporary fallback:
- `THEME` env var (deprecated; allowed temporarily; do not document as supported)

## Example .env

Use `.env.example` as your starting point.

Minimum for local dev:

```bash
PORT=3000
BASE_URL=http://localhost:3000
APP_SECRET=change-me-to-a-long-random-string
PAYMENTS_PROVIDER=alby_hub
ALBY_HUB_URL='nostr+walletconnect://...'
```

Also create `site.yml` from `site.yml.example`.
