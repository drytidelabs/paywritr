# Paywritr — MVP v0.2 Spec (Product)

## Summary

This document defines what a *real MVP* for Paywritr should include **beyond** the current PoC.

- **PoC v0.1** (what exists now): flat-file Markdown posts (`content/posts/*.md`), per-post Lightning paywall, unlock via signed `HttpOnly` cookie, Alby Hub provider, Docker/self-hostable.
- **MVP v0.2** (this spec): make paid posts *trustworthy in real-world use* for one publisher and real readers.

## MVP v0.2 — “Shippable Paid Posts”

**Goal:** Turn the current PoC into a reliable, real-world usable product for one publisher and real readers.

**Definition of done:** A single-author blog can be deployed with sane defaults; authors can publish/price posts predictably; readers can pay, confirm unlock, and regain access later; payments are recorded and traceable; basic security/ops hygiene is in place; errors are actionable.

---

## Prioritized requirements (grouped)

### Reliability (P0 unless noted)
1. **(P0) Payment state persistence (server-side entitlements)**
   - Add a minimal server-side record of invoice/payment → post entitlement.
   - Cookie becomes a convenience, not the sole source of truth.

2. **(P0) Webhook/idempotency handling for payment confirmation**
   - Safe retries; no double-unlocks; no stuck “paid but locked.”

3. **(P0) Structured logging + request correlation for pay/unlock flow**
   - Minimal logs around invoice create, payment confirm, entitlement issue, and content serve.

4. **(P0) Robust upstream failure handling**
   - Gracefully handle provider downtime/timeouts with clear user messaging + safe retry paths.

5. **(P1) Diagnostics endpoints**
   - Keep `/healthz` and optionally add `/readyz` if needed for deployments.

### Admin / authoring
1. **(P0) Canonical post metadata schema**
   - Standardize frontmatter fields (e.g., title/date/price_sats/description, plus any MVP-needed additions like excerpt/cover).

2. **(P0) Author workflow that doesn’t require touching code**
   - Templates are fine; avoid multi-file hand edits; keep it predictable.

3. **(P0) Single source of truth config**
   - One configuration surface for site name/base URL/provider connection/env flags.

4. **(P1) Draft vs published**
   - Support drafts that are not publicly visible.

5. **(P1) Minimal sales/entitlements view (publisher confidence)**
   - A simple page or CLI output listing paid invoices/unlocks by post + timestamp.

### Reader UX
1. **(P0) Paywall landing state**
   - Clear excerpt/value + price + what happens after paying.

2. **(P0) Payment flow UI**
   - Create invoice → QR + copy invoice → auto/poll confirmation.

3. **(P0) Post-unlock confirmation**
   - After payment confirmation, reader gets immediate access without guesswork.

4. **(P0) Restore access (returning readers)**
   - If cookies cleared/new device, provide a minimal “restore access” mechanism.

5. **(P1) Accessibility + responsive paywall components**
   - Keyboard navigation + decent mobile layout.

### Security / ops
1. **(P0) Signed entitlement token hardening**
   - Cookie remains signed + scoped + expiring.

2. **(P0) Abuse protections on invoice creation**
   - Rate limiting / basic anti-bot to avoid being a public invoice generator.

3. **(P0) Secrets management + environment separation**
   - Clear dev vs prod behavior; never log secrets.

4. **(P0) Content protection**
   - Ensure paid content is not shipped to locked clients (no “view source” bypass).

5. **(P1) Basic security headers**
   - CSP, frame-ancestors, referrer-policy, etc. (minimal, pragmatic).

### Payments
1. **(P0) Payment provider interface (even if only one impl)**
   - Design so additional providers can be added without rewriting product logic.

2. **(P0) Invoice mapping + reconciliation**
   - Store: invoice id/hash, post slug, amount, status, created_at, settled_at.

3. **(P0) Confirmation method**
   - Webhook-first with polling fallback.

4. **(P0) Receipt / restore token**
   - Provide user-visible receipt/code/link to restore access on another device.

5. **(P1) Pricing rules + validation**
   - Min/max sats, prevent invalid pricing, handle free posts cleanly.

---

## Out of scope (explicitly NOT MVP v0.2)

- Reader accounts/logins, subscriptions
- Multi-author roles/permissions
- Multiple payment providers beyond the interface scaffolding
- Full CMS/admin UI (WYSIWYG)
- Analytics dashboards
- Comments, likes
- Advanced theming/plugin ecosystem

---

## Validation metrics

Pick 1–2 to track:

1. **Successful unlock rate:** ≥ 95% of initiated payment flows result in an unlocked post within 60 seconds.
2. **Restore success rate:** ≥ 80% of users who attempt restore access succeed without support within 2 minutes.

---

## Dependencies / decisions

- **LNbits:** deferred; MVP v0.2 should include a provider interface so LNbits can be added later without reworking entitlements/unlock.
- **Alby Hub:** remains required for MVP v0.2.
- **Storage:** minimal persistence (SQLite/KV) is fine; avoid heavy infra unless needed.
