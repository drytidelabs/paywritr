# Payments providers

Paywritr supports multiple payments providers.

## Alby Hub (default / recommended)

Environment:
- `PAYMENTS_PROVIDER=alby_hub`
- `ALBY_HUB_URL=nostr+walletconnect://...`

`ALBY_HUB_URL` must be a NIP-47 wallet connect string (scheme: `nostr+walletconnect://`). Treat it like an API key: **do not commit it**.

### Units: sats vs msats (important)

Alby Hub invoice creation (via NIP-47 / `nostr+walletconnect`) uses **millisatoshis** (msats).

Paywritr posts are priced in **sats** (`price_sats` in frontmatter), and Paywritr handles the conversion internally:

`amount_msats = amount_sats * 1000`

## LNbits (optional / legacy)

LNbits is supported for folks who prefer a hosted LNbits instance.

Environment:
- `PAYMENTS_PROVIDER=lnbits`
- `LNBITS_URL`, `LNBITS_INVOICE_KEY`, `LNBITS_READ_KEY`

LNbits invoice creation uses **satoshis** (sats).
