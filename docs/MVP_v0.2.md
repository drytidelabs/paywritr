# Paywritr — MVP v0.2 Spec (Product)

## Summary

This document defines what a *real MVP* for Paywritr should include **beyond** the current PoC.

- **PoC v0.1** (what exists now): flat-file Markdown posts (`content/posts/*.md`), per-post Lightning paywall, unlock via signed `HttpOnly` cookie, Alby Hub provider, Docker/self-hostable.
- **MVP v0.2** (this spec): make paid posts *trustworthy in real-world use* for one publisher and real readers.

## MVP v0.2 — “Shippable Paid Posts”

**Goal:** Turn the current PoC into a reliable, real-world usable product for one publisher and real readers.

**Definition of done:** A single-author blog can be deployed with sane defaults; authors can publish/price posts predictably; readers can pay, confirm unlock, and regain access later; payments are recorded and traceable; basic security/ops hygiene is in place; errors are actionable.

---

## Prioritized requirements (trimmed for a flat/simple MVP)

This MVP intentionally avoids “systems work” (webhooks, persistence, restore tokens, provider abstraction). Anything that adds durable state or operational surface area is parked in `docs/PARKING_LOT.md`.

### Reliability
- **(P0) Structured payflow logs (lightweight)**
  - Timing logs around each `lookup_invoice` call (duration + timeout vs response) to distinguish upstream latency vs retry behavior.
- **(P0) Robust upstream failure handling**
  - Provider-agnostic user messaging + safe retry paths.

### Payments
- **(P1) Pricing rules + validation**
  - Guardrails around `price_sats` and invalid frontmatter.

(Everything else from the larger v0.2 list is parked to keep the project flat.)

---

## Out of scope (explicitly NOT MVP v0.2)

Flatness constraints (explicit):
- **No login system** (including *login-with-Lightning* / LNURL-auth) in MVP v0.2.
- **No cross-device access guarantee** in MVP v0.2 (cookie-based unlocks are per device/browser).

Other out-of-scope items:
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
