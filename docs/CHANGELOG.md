# Changelog (high-signal)

## 2026-02-14
- Added Alby Nostr Wallet Connect (NIP-47) payments provider (keep LNbits default).
- Fixed NWC relay compatibility issues (subscription filter shape; relay rejects broad REQs).
- Fixed NWC invoice amounts: **NIP-47 uses millisats** (`sats * 1000`).
- Repo renamed: **PayBlog → Paywritr** (codebase + GitHub repo).
- Added regression test + docs note for msats vs sats.
