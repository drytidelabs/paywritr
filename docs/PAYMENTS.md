# Payments providers

Paywritr supports two payments backends:

- **LNbits** (default)
- **Alby Nostr Wallet Connect (NWC)** (`PAYMENTS_PROVIDER=alby_nwc`)

## Units: sats vs msats (important)

LNbits invoice creation uses **satoshis** (sats). Nostr Wallet Connect (NIP-47) `make_invoice.amount` uses **millisatoshis** (msats), so the server must send `amount_msats = amount_sats * 1000`.
