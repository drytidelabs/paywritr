# Changelog (high-signal)

## 2026-02-23 (v0.1 release hardening)
- Added `site.yml.example` and treated `site.yml` as local config (gitignored) (#144).
- Theme selection is now canonical in `site.yml:theme` (fallback to `classic`); `THEME` env var is deprecated/temporary (#136).
- Starter content cleanup; tests updated to treat demo slugs as fixtures, not backward-compat guarantees (#143).
- Payments docs updated to clarify provider selection and common errors (#145).

## 2026-02-14
- Added Alby Hub (NIP-47 / `nostr+walletconnect`) payments provider (**now the default**).
- Consolidated payments docs; Alby Hub is the canonical/default path in README and Docker.
- Fixed Alby Hub relay compatibility issues (subscription filter shape; relay rejects broad REQs).
- Fixed invoice amounts: **NIP-47 uses millisats** (`sats * 1000`).
- Repo renamed: **PayBlog → Paywritr** (codebase + GitHub repo).
- Added regression test + docs note for msats vs sats.
