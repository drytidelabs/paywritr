# Parking Lot (Spec Notes)

This document is a place to capture **possible future features** and design directions that we explicitly do **not** want to commit to as MVP requirements yet.

The goal is to keep Paywritr **flat** (simple, low operational overhead) while still recording ideas we might revisit after 1.0.

---

## Server-side entitlements (invoice/payment persistence)

**Idea:** Store a minimal server-side record mapping `invoice/payment → post entitlement` so that the unlock cookie becomes a convenience, not the source of truth.

**Why it’s attractive**
- Helps with “paid but locked” recovery.
- Enables cross-device restore (if we ever want it).
- Enables better publisher confidence (sales/entitlements view).

**Why it’s NOT in the flat MVP**
- Introduces durable server-side state (DB/KV) and migrations/backup concerns.
- Moves Paywritr toward account/identity-like behavior (even if we avoid usernames).
- Adds operational/debug surface area (webhooks, reconciliation, data retention).

**If we revisit later**
- Keep the author/reader UX provider-agnostic.
- Prefer minimal storage (SQLite/KV) and strong idempotency.
- Define explicit data retention + privacy expectations.
