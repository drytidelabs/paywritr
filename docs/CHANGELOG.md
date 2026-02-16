# Changelog (high-signal)

## 2026-02-14
- Added Alby Hub (NIP-47 / `nostr+walletconnect`) payments provider (**now the default**).
- Consolidated payments docs; Alby Hub is the canonical/default path in README and Docker.
- Fixed Alby Hub relay compatibility issues (subscription filter shape; relay rejects broad REQs).
- Fixed invoice amounts: **NIP-47 uses millisats** (`sats * 1000`).
- Repo renamed: **PayBlog → Paywritr** (codebase + GitHub repo).
- Added regression test + docs note for msats vs sats.
