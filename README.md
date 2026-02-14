# Paywritr

Hyper-minimalist single-author flat-file blog with per-post Lightning paygating.

Supports:
- **LNbits** (default)
- **Alby Hub** (`PAYMENTS_PROVIDER=alby_hub`)

- No accounts
- No database
- Posts are `.md` files
- Each paid post has its own Lightning invoice

## How it works (MVP)
- Content lives in `content/posts/*.md`.
- Add a `<!--more-->` marker to split teaser vs full.
- If a post has `price_sats > 0`, readers see the teaser until they pay.
- After the payments backend confirms the invoice is **paid**, the server sets an `HttpOnly` cookie `unlock_{slug}` that unlocks that post for `UNLOCK_DAYS` (default: 30).

## 1) Choose a payments provider

### Option A: LNbits (default)
Use any hosted LNbits instance you trust (no Lightning node required on your server).

In LNbits you’ll need two API keys:
- **Invoice key** (to create invoices)
- **Read key** (to check invoice status)

### Option B: Alby Hub
This uses an Alby Hub wallet connection string so your server does not need to run or trust an LNbits instance.

Important: Under the hood this uses NIP-47 (`nostr+walletconnect`), where `make_invoice.amount` is **millisatoshis (msats)**, not sats (1 sat = 1000 msats). Paywritr handles this conversion internally.

Set:
- `PAYMENTS_PROVIDER=alby_hub`
- `ALBY_HUB_URL=nostr+walletconnect://...`

Security note: `ALBY_HUB_URL` is a secret (it contains a key). Do not commit it.

## 2) Configure
Copy env example and set values:

```bash
cp .env.example .env
```

Set at minimum:
- `APP_SECRET` (long random string)

Then, depending on provider:
- **LNbits** (default): `LNBITS_URL`, `LNBITS_INVOICE_KEY`, `LNBITS_READ_KEY`
- **Alby Hub**: `PAYMENTS_PROVIDER=alby_hub` and `ALBY_HUB_URL`

## 3) Run locally

```bash
npm install

# LNbits (default)
APP_SECRET=dev-secret \
LNBITS_URL=https://your-lnbits-host \
LNBITS_INVOICE_KEY=... \
LNBITS_READ_KEY=... \
npm run dev

# Alby Hub
PAYMENTS_PROVIDER=alby_hub \
APP_SECRET=dev-secret \
ALBY_HUB_URL='nostr+walletconnect://...'
npm run dev
```

Open <http://localhost:3000>.

## 4) Run with Docker

```bash
# LNbits (default)
export APP_SECRET='your-long-random-secret'
export LNBITS_URL='https://your-lnbits-host'
export LNBITS_INVOICE_KEY='...'
export LNBITS_READ_KEY='...'

docker compose up --build

# Alby Hub
export PAYMENTS_PROVIDER='alby_hub'
export APP_SECRET='your-long-random-secret'
export ALBY_HUB_URL='nostr+walletconnect://...'

docker compose up --build
```

## Writing posts
Create `content/posts/my-post.md`:

```md
---
title: My post
date: 2026-02-13
price_sats: 123
description: Optional short description for the homepage.
---

This is the teaser.

<!--more-->

This is the full post.
```

`price_sats: 0` makes a post free.

## Deployment notes
- Put this behind HTTPS (Caddy/Nginx). Set `COOKIE_SECURE=true` so unlock cookies are `Secure`.
- This MVP is intentionally tiny: no admin UI, no DB, no persistent invoice tracking.

## License
MIT
