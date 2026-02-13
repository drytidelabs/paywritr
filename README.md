# PayBlog

Hyper-minimalist single-author flat-file blog with per-post Lightning paygating (LNbits).

- No accounts
- No database
- Posts are `.md` files
- Each paid post has its own Lightning invoice

## How it works (MVP)
- Content lives in `content/posts/*.md`.
- Add a `<!--more-->` marker to split teaser vs full.
- If a post has `price_sats > 0`, readers see the teaser until they pay.
- After LNbits confirms the invoice is **paid**, the server sets an `HttpOnly` cookie `unlock_{slug}` that unlocks that post for `UNLOCK_DAYS` (default: 30).

## 1) Create an LNbits wallet (hosted)
Use any hosted LNbits instance you trust (no Lightning node required on your server).

In LNbits you’ll need two API keys:
- **Invoice key** (to create invoices)
- **Read key** (to check invoice status)

## 2) Configure
Copy env example and set values:

```bash
cp .env.example .env
```

Set at minimum:
- `APP_SECRET` (long random string)
- `LNBITS_URL`
- `LNBITS_INVOICE_KEY`
- `LNBITS_READ_KEY`

## 3) Run locally

```bash
npm install
APP_SECRET=dev-secret \
LNBITS_URL=https://your-lnbits-host \
LNBITS_INVOICE_KEY=... \
LNBITS_READ_KEY=... \
npm run dev
```

Open <http://localhost:3000>.

## 4) Run with Docker

```bash
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
- Put this behind HTTPS (Caddy/Nginx). Then set cookie `secure: true` in `server.js`.
- This MVP is intentionally tiny: no admin UI, no DB, no persistent invoice tracking.

## License
MIT
