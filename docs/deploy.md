# Deploy (v0.1)

Paywritr is a small Node server. You can run it directly with `npm start` or via Docker Compose.

## Before you start

1) Decide your payments provider
- **Alby Hub (default/recommended)** via NWC (`ALBY_HUB_URL`)
- **LNbits** (`LNBITS_URL`, `LNBITS_INVOICE_KEY`, `LNBITS_READ_KEY`)

2) Prepare your config files
- `site.yml` (non-secret site metadata; keep local)
- `.env` (secrets/runtime; keep local)

See `docs/configuration.md` and `docs/PAYMENTS.md`.

## Option A: Deploy with Node (no Docker)

### 1) Install prerequisites

- Node.js 22+
- git

### 2) Clone and install

```bash
git clone https://github.com/drytidelabs/paywritr.git
cd paywritr
npm ci
```

### 3) Configure

```bash
cp site.yml.example site.yml
cp .env.example .env
```

Edit:
- `site.yml` (title/tagline/description/timezone/theme)
- `.env` (APP_SECRET + payment provider vars)

### 4) Run

```bash
npm start
```

## Option B: Deploy with Docker Compose

### 1) Clone

```bash
git clone https://github.com/drytidelabs/paywritr.git
cd paywritr
```

### 2) Configure

```bash
cp site.yml.example site.yml
cp .env.example .env
```

### 3) Start

```bash
docker compose up -d
```

### 4) Update

```bash
# pull latest image
docker compose pull

# restart container
docker compose up -d
```

## Volume mounts

The provided `docker-compose.yml` mounts:
- `./content` → `/app/content:ro` (edit posts without rebuilding)

`site.yml` is read from the container working directory at runtime. Keep it local alongside the repo.

## Reverse proxy / HTTPS

You should run Paywritr behind HTTPS.

### Caddy (recommended)

```caddyfile
yourdomain.com {
  reverse_proxy 127.0.0.1:3000
}
```

### Nginx

```nginx
server {
  listen 80;
  server_name yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Production checklist

- [ ] Set a strong `APP_SECRET` (long random string)
- [ ] Set `BASE_URL` to your public URL (e.g. `https://yourdomain.com`)
- [ ] Set `COOKIE_SECURE=true` when behind HTTPS
- [ ] Set `PORT` appropriately (default 3000)
- [ ] Ensure `site.yml` exists and `theme:` is valid
- [ ] Do **not** commit `.env` or `site.yml`
- [ ] Consider restricting access to your LNbits instance / Alby Hub secret
