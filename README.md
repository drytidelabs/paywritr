# Paywritr

Hyper-minimalist single-author flat-file blog with per-post Lightning paygating.

- No accounts
- No database
- Posts are `.md` files in `content/posts/*.md`

Payments providers:
- **Alby Hub** (default / recommended) — `PAYMENTS_PROVIDER=alby_hub`, `ALBY_HUB_URL=nostr+walletconnect://...`
- **LNbits** (optional / legacy) — `PAYMENTS_PROVIDER=lnbits`, `LNBITS_URL`, `LNBITS_INVOICE_KEY`, `LNBITS_READ_KEY`

For provider details (including msats vs sats): see **[`docs/PAYMENTS.md`](docs/PAYMENTS.md)**.

## How it works (MVP)

- Add a `<!--more-->` marker to split teaser vs full.
- If a post has `price_sats > 0`, readers see the teaser until they pay.
- After the payments backend confirms the invoice is **paid**, the server sets an `HttpOnly` cookie `unlock_{slug}` that unlocks that post for `UNLOCK_DAYS` (default: 30).

## Configure

Copy env example and set values:

```bash
cp .env.example .env
```

Set at minimum:
- `APP_SECRET` (long random string)

Then pick a provider:
- **Alby Hub (default):** `PAYMENTS_PROVIDER=alby_hub` + `ALBY_HUB_URL`
- **LNbits (optional):** `PAYMENTS_PROVIDER=lnbits` + `LNBITS_URL`, `LNBITS_INVOICE_KEY`, `LNBITS_READ_KEY`

## Run locally

```bash
npm install

# Alby Hub (default / recommended)
PAYMENTS_PROVIDER=alby_hub \
APP_SECRET=dev-secret \
ALBY_HUB_URL='nostr+walletconnect://...' \
npm run dev

# LNbits (optional)
PAYMENTS_PROVIDER=lnbits \
APP_SECRET=dev-secret \
LNBITS_URL=https://your-lnbits-host \
LNBITS_INVOICE_KEY=... \
LNBITS_READ_KEY=... \
npm run dev
```

Open <http://localhost:3000>.

## Run with Docker

```bash
# Alby Hub (default / recommended)
export PAYMENTS_PROVIDER='alby_hub'
export APP_SECRET='your-long-random-secret'
export ALBY_HUB_URL='nostr+walletconnect://...'

docker compose up --build

# LNbits (optional)
export PAYMENTS_PROVIDER='lnbits'
export APP_SECRET='your-long-random-secret'
export LNBITS_URL='https://your-lnbits-host'
export LNBITS_INVOICE_KEY='...'
export LNBITS_READ_KEY='...'

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
