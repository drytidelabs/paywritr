# Payments providers

Paywritr supports two payments backends:

- **Alby Hub** (default) — `PAYMENTS_PROVIDER=alby_hub`, `ALBY_HUB_URL=nostr+walletconnect://...`
- **LNbits** (optional) — `PAYMENTS_PROVIDER=lnbits`, plus LNbits keys

## Units: sats vs msats (important)

LNbits invoice creation uses **satoshis** (sats). Alby Hub invoice creation (via NIP-47 / `nostr+walletconnect`) uses **millisatoshis** (msats), so the server must send `amount_msats = amount_sats * 1000`.
