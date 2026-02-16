# Deploy (v0.1)

Paywritr is a small Node server. You can run it directly with `npm start` or via Docker.

## Production requirements

- **HTTPS** is strongly recommended.
  - Set `COOKIE_SECURE=true` so unlock cookies are marked `Secure`.

## Environment variables

See `docs/configuration.md`.

At minimum, set:
- `APP_SECRET` (required)
- `PAYMENTS_PROVIDER=alby_hub`
- `ALBY_HUB_URL` (secret)
- `BASE_URL` (should be your public URL)
- `COOKIE_SECURE=true` (when behind HTTPS)

## Docker

`docker-compose.yml` is provided for local or server deployments.

- Keep `.env` local (not committed).
- Content is mounted read-only from `./content`.
