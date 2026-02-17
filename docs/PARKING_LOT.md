# Parking Lot (Spec Notes)

This document is a place to capture **possible future features** and design directions that we explicitly do **not** want to commit to as MVP requirements yet.

The goal is to keep Paywritr **flat** (simple, low operational overhead) while still recording ideas we might revisit after 1.0.

---

## Server-side entitlements (invoice/payment persistence)

**Related parked issues:** #44, #56

---

## Webhooks / webhook-first confirmation

**Idea:** Accept inbound webhooks/callbacks for payment confirmation to reduce polling and unlock latency.

**Why it’s attractive**
- Faster confirmation and reduced polling load.

**Why it’s parked**
- Adds operational complexity (public endpoint, auth/signatures, hosting constraints).
- Conflicts with the “flat” goal unless strictly optional.

**Related parked issues:** #36, #57

---

## Restore tokens / cross-device restore

**Idea:** Provide a receipt/token that can restore access after cookie loss or on a new device.

**Why it’s attractive**
- Better user experience for returning readers.

**Why it’s parked**
- Implies persistence/entitlements and increased support surface area.

**Related parked issues:** #48, #58

---

## Provider abstraction

**Idea:** Formal provider interface (beyond today’s minimal implementation) to support future providers cleanly.

**Why it’s parked**
- Overengineering while Alby Hub is the only supported provider.

**Related parked issues:** #55

---

## Abuse protection / rate limiting

**Idea:** Rate limit invoice creation endpoints.

**Why it’s parked**
- Operational complexity vs early-stage needs; can be added if abuse appears.

**Related parked issues:** #51

---

## Security headers & accessibility polish

**Idea:** Additional hardening headers (CSP, frame-ancestors) and deeper a11y work.

**Why it’s parked**
- Good hygiene, but optional for a very small, self-hosted PoC/MVP.

**Related parked issues:** #54, #49

---

## Drafts

**Idea:** Draft vs published support.

**Why it’s parked**
- Author can keep drafts out of `content/posts/` or in a separate branch/folder for now.

**Related parked issues:** #43

---

## Minimal sales view

**Idea:** UI/endpoint listing purchases.

**Why it’s parked**
- Requires persistence or more elaborate instrumentation.

**Related parked issues:** #44

---

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
