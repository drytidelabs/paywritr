# Payments providers

Paywritr supports two payments backends:

- **LNbits** (default)
- **Alby Hub** (`PAYMENTS_PROVIDER=alby_hub`)

## Units: sats vs msats (important)

LNbits invoice creation uses **satoshis** (sats). Alby Hub invoice creation (via NIP-47 / `nostr+walletconnect`) uses **millisatoshis** (msats), so the server must send `amount_msats = amount_sats * 1000`.
