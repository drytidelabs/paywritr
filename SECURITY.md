# Security

Paywritr is intentionally small and read-only for authorship (posts are flat files). The main security risk is **untrusted content** (Markdown posts) and **secret handling** (payments keys + APP_SECRET).

## Threat model (v0)

### What we defend against
- **XSS via Markdown** (raw HTML, inline JS handlers, dangerous link protocols)
- **Secret leakage** (committing `.env`, keys, or baking secrets into Docker images)
- **Cookie tampering** (for paywalled unlock cookies)

### What we do NOT defend against (yet)
- Multi-user/admin auth (there is no admin UI in MVP)
- Account-level authorization or “log in on any device” behavior
- Advanced abuse/rate-limiting protections

## Markdown safety guarantees

- **Raw HTML is stripped** during rendering.
- Links/images are restricted to safe protocols:
  - `javascript:` and `data:` are treated as invalid and removed.

Implementation lives in `server.js` (marked renderer hardening + URL protocol checks).

## Unlock cookie design

Unlocks are stored client-side as an **HttpOnly cookie** per post (`unlock_<slug>`).

Properties:
- The cookie value is a **signed JSON token** (HMAC-SHA256) using `APP_SECRET`.
- The token includes an **expiration timestamp** (`exp`), and is rejected when expired.
- There is **no server-side storage** of unlock state (no DB; unlock is verified purely by signature + exp).

Operational notes:
- Unlock is effectively **per browser/device** (because it’s a cookie). It is not an account system.

## Secrets & configuration

Never commit secrets. Keep secrets in `.env` (local only) or your deployment secret manager.

Particularly sensitive values:
- `APP_SECRET`
- LNbits keys (`LNBITS_INVOICE_KEY`, `LNBITS_READ_KEY`)
- Alby Hub URL (contains a secret query param)

Repo hygiene expectations:
- `.env` and common variants are ignored.
- Docker builds must not include `.env` files (see `.dockerignore`).
