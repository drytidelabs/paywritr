# Paywritr

Hyper-minimalist single-author flat-file blog with per-post Lightning paygating.

- No accounts
- No database
- Posts are `.md` files in `content/posts/*.md`

Payments providers:
- **Alby Hub** (default / recommended) — `PAYMENTS_PROVIDER=alby_hub`, `ALBY_HUB_URL=nostr+walletconnect://...`
- **LNbits** (optional / legacy) — `PAYMENTS_PROVIDER=lnbits`, `LNBITS_URL`, `LNBITS_INVOICE_KEY`, `LNBITS_READ_KEY`

For provider details (including msats vs sats): see **[`docs/payments.md`](docs/payments.md)**.

## How it works (MVP)

- Add a `<!--more-->` marker to split teaser vs full.
- If a post has `price_sats > 0`, readers see the teaser until they pay.
- After the payments backend confirms the invoice is **paid**, the server sets an `HttpOnly` cookie `unlock_{slug}` that unlocks that post for `UNLOCK_DAYS` (default: 30).

## Configure

Paywritr is configured via:
- `site.yml` (non-secret site metadata)
- `.env` / environment variables (runtime + secrets)

1) Create `site.yml`:

```bash
cp site.yml.example site.yml
```

Keys in `site.yml`:
- `title`, `tagline`, `description`, `timezone`

2) Create `.env`:

```bash
cp .env.example .env
```

Set at minimum:
- `APP_SECRET` (long random string)

Then pick a provider:
- **Alby Hub (default):** `PAYMENTS_PROVIDER=alby_hub` + `ALBY_HUB_URL`
- **LNbits (optional):** `PAYMENTS_PROVIDER=lnbits` + `LNBITS_URL`, `LNBITS_INVOICE_KEY`, `LNBITS_READ_KEY`

See `docs/configuration.md` for the complete config reference.

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

## Deploy / Run with Docker Compose

Recommended for local deploys and servers.

1) Create a local `.env` (never commit it):

```bash
cp .env.example .env
```

2) Edit `.env` and set at minimum:
- `APP_SECRET`
- `PAYMENTS_PROVIDER=alby_hub`
- `ALBY_HUB_URL`

3) Run:

```bash
docker compose up --build
```

Open <http://localhost:3000>.

## Writing content

Content lives in `content/posts/*.md`.

### Templates

Copy a template:
- `templates/post.free.md`
- `templates/post.paywalled.md`
- `templates/page.md`

Filename can be anything; the canonical URL slug is in frontmatter.

### Frontmatter (v0.1)

Minimal canonical schema:
- `type` (`post` | `page`)
- `title`
- `slug`
- `published_date`
- `draft` (`true` = not published)
- `price_sats` (`type: page` must be `0`)
- `summary` (optional)
- `aliases` (optional)
- `topics` (optional)

More details + examples: **[`docs/authoring.md`](docs/authoring.md)**.

Example:

```md
---
type: post
title: My post
slug: my-post
published_date: "2026-02-13"
price_sats: 123
summary: Optional short description for the homepage.
---

This is the teaser.

<!--more-->

This is the full post.
```

`price_sats: 0` makes a post free.

More details: **[`docs/authoring.md`](docs/authoring.md)**.

## Docs

- Authoring: `docs/authoring.md`
- Configuration: `docs/configuration.md`
- Deploy: `docs/deploy.md`

## Deployment notes

- Put this behind HTTPS (Caddy/Nginx). Set `COOKIE_SECURE=true` so unlock cookies are `Secure`.
- This MVP is intentionally tiny: no admin UI, no DB, no persistent invoice tracking.

## License

MIT
