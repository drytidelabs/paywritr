# Payments providers

Paywritr supports two payments providers.

## Provider selection

Set one of:
- `PAYMENTS_PROVIDER=alby_hub` (default)
- `PAYMENTS_PROVIDER=lnbits`

## Alby Hub (default / recommended)

Environment:
- `ALBY_HUB_URL=nostr+walletconnect://...`

`ALBY_HUB_URL` must be a NIP-47 wallet connect string (scheme: `nostr+walletconnect://`). Treat it like an API key: **do not commit it**.

### Units: sats vs msats (important)

Alby Hub invoice creation (via NIP-47 / `nostr+walletconnect`) uses **millisatoshis** (msats).

Paywritr posts are priced in **sats** (`price_sats` in frontmatter), and Paywritr handles the conversion internally:

`amount_msats = amount_sats * 1000`

## LNbits (beta / optional)

LNbits is supported for folks who prefer a hosted LNbits instance.

**Status:** beta / advanced configuration.
- Alby Hub remains the default/recommended provider.
- Expect more operational variance (host reliability, latency, rate limits).
- Monitor your LNbits instance (uptime + latency), since invoice create/status calls depend on it.

Environment:
- `LNBITS_URL`
- `LNBITS_INVOICE_KEY` (create invoices)
- `LNBITS_READ_KEY` (check invoice status)

### Timeout behavior

Paywritr applies a request timeout to LNbits calls so the server doesn’t hang indefinitely if LNbits becomes unresponsive.

## Troubleshooting

Common error categories you may see from `/api/invoice` or `/api/invoice/status`:
- **"Payment provider is not configured"**: missing env vars for the selected provider
- **"Payment service unavailable"**: relay/LNbits connectivity issue
- **"Payment service is slow" / timeouts**: provider is reachable but not responding fast enough
