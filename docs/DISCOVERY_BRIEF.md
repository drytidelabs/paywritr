# PayBlog — Discovery Brief (v0.1 → v0.2)

**Context / constraints:** PayBlog is a self-hosted, single-author, flat-file Markdown blog with per-post Lightning paygating via **LNbits**. No user accounts, no DB.

---

## 1) Product definition + target user hypotheses

**Product definition (1 paragraph):**
PayBlog is a minimal, self-hosted publishing tool for individual creators who want to monetize specific posts with **one-time Lightning payments**—without subscriptions, accounts, or a database. Posts live as Markdown files on disk; each post can be free or paygated, and readers unlock individual posts by paying a Lightning invoice (LNbits), receiving a time-limited unlock cookie. The product’s promise is *frictionless, pay-per-article monetization* with a simple deployment footprint.

**Target user hypotheses (3–5 archetypes):**
1. **Bitcoin/Lightning-native writer** — already has a Lightning wallet, wants to sell essays/tutorials to a LN audience, dislikes platform fees/censorship risk.
2. **Indie builder / OSS maintainer** — wants to monetize “deep-dive” posts (postmortems, architecture notes) while keeping most writing free.
3. **Analyst / researcher** — publishes frequent short notes free, but charges for “premium reports” without starting a subscription.
4. **Educator / cohort teacher (solo)** — sells lesson posts individually (pay-per-lesson) and links from socials/newsletter.
5. **Niche community organizer** — runs a small site where a few posts are paid “supporter content” but doesn’t want member management.

---

## 2) Problem hypotheses (top 5) + why PayBlog is uniquely suited

**Top problem hypotheses (what blocks adoption/value):**
1. **Monetization mismatch:** subscriptions feel heavy; creators want *pay-per-piece* pricing (especially for sporadic premium content).
2. **High setup/ops friction:** most paywalls require accounts, payment processors, databases, or complex CMS plugins.
3. **Reader friction & trust:** readers hesitate to create accounts or enter cards for a single article; they want quick, private checkout.
4. **Linkability & distribution:** creators need paygated links that work well on X/Telegram/newsletters while still teasing value.
5. **Post-purchase experience:** creators need simple “what was bought / what’s unlocked” behavior without user profiles.

**Why PayBlog is uniquely suited (Lightning pay-per-post):**
- **Lightning enables true micropayments** (tens to thousands of sats) where credit cards/subscription rails are inefficient.
- **No accounts** aligns with Lightning’s “pay once, access once” model; we can use signed unlock cookies per-post.
- **Flat-file Markdown** keeps creator workflow fast (git-backed writing, simple backups, portable content).
- **LNbits API** provides minimal integration overhead (invoice create + status check) without operating a node.

---

## 3) Competitive / adjacent landscape (high-level) + differentiation

**Adjacent categories (not exhaustive):**
- **Traditional blogging/CMS:** Ghost, WordPress, Hugo/Jekyll (monetization via memberships/plugins/Stripe; more setup).
- **Newsletter platforms:** Substack/Beehiiv (subscription-first; platform lock-in; limited pay-per-article).
- **Creator monetization:** Patreon/Ko-fi/Gumroad (often account-centric; not per-post native; fees; less “blog-native”).
- **Bitcoin/Lightning publishing:** niche paywall tools, tip jars, LNURL-pay gated content (varies; often lacks “blog as code” simplicity).

**PayBlog differentiation (hypothesis):**
- **Pay-per-post first** (not a membership system bolted on).
- **Extremely low operational complexity** (no DB, no accounts, simple Node/Express deploy).
- **Portable content + ownership** (Markdown on disk, easy git workflow).
- **Lightning-native UX** (Bolt11 QR/clipboard, fast unlock, sats-denominated pricing).
- **Composable + hackable** for builders (simple templates, minimal stack, easy theming).

---

## 4) Research plan (next 7 days)

### Objectives (7-day)
- Validate who feels the pain *now* (creator segments).
- Quantify willingness to use Lightning pay-per-post (price points, expected conversion).
- Identify the smallest “trust-building + distribution” features that unlock real usage.

### Outreach targets (practical, high-signal)
- **Lightning creators:** writers posting on X/Nostr about Lightning, LNbits, BTC dev.
- **Indie hackers:** builders with personal blogs + paid products; those who dislike subscriptions.
- **Open-source maintainers:** maintainers who publish technical deep dives.
- **Newsletter writers** who occasionally sell one-off reports.
- **LNbits operators / integrators** (they see many use cases and failure modes).

### 10 customer interview questions (semi-structured)
1. Walk me through your current publishing workflow (tools, hosting, how you write, how you deploy).
2. What content do you *wish* you could charge for, and why is that hard today?
3. Have you tried subscriptions/memberships? What didn’t fit?
4. What’s your audience’s payment readiness (Lightning vs cards)? Any data points?
5. If a reader pays once, what do they expect next (time-limited access, permanent, downloadable, receipt)?
6. What pricing feels natural per article (ranges in sats) for your “premium” posts?
7. What’s your biggest fear with paywalls (support burden, refunds, chargebacks, piracy, UX complaints)?
8. How do you distribute posts today (X/Telegram/newsletter/SEO)? Where does paywall friction show up?
9. What would make you trust a self-hosted Lightning paywall (security, reliability, LNbits dependency, custody concerns)?
10. If you could wave a wand: what 1–2 features would make you ship with this in a week?

**Lightweight artifacts to produce during the week:**
- Interview notes in a single table (persona, pains, quotes, current stack, must-have).
- A simple pricing/offer matrix (post types × sats price × expected conversion).
- A “top objections” list and the smallest fixes.

---

## 5) Prioritization — top 5 bets for MVP v0.2 (ICE scoring)

Scoring: **Impact (1–10)** × **Confidence (1–10)** × **Ease (1–10)**. Higher = better next bet.

| Bet (v0.2) | What it is | Impact | Confidence | Ease | ICE | Why now |
|---|---|---:|---:|---:|---:|---|
| 1) Better paywall conversion UX | Wallet-friendly invoice UI, QR + copy, “paid?” states, clearer value framing, retry, reduce polling jank | 9 | 6 | 7 | 378 | Without conversion, nothing else matters; biggest leverage per line of code |
| 2) Shareable teaser + preview controls | Strong teaser rendering, optional “first N paragraphs” preview, post-level CTA blocks | 8 | 6 | 7 | 336 | Distribution requires a compelling preview; reduces “why pay?” uncertainty |
| 3) Creator controls: pricing + bundles (simple) | Frontmatter helpers: suggested pricing, “series price”/bundle page (manual list of slugs) | 7 | 5 | 6 | 210 | Pay-per-post shines with bundles/series; keeps no-accounts constraint |
| 4) Purchase proof / receipt-lite | After payment, show a simple confirmation page + invoice details + “copy link” to unlocked post | 6 | 6 | 7 | 252 | Builds trust; reduces support (“I paid but…”) and makes sharing easier |
| 5) Minimal privacy-respecting metrics | Server-side counters (views, invoice created, paid) stored as append-only JSONL | 7 | 5 | 5 | 175 | Creators will ask “is this working?”; enables pricing experiments without heavy analytics |

**Deprioritized for v0.2 (likely later):** theming marketplace, full admin UI, comments, memberships, email capture (unless interviews strongly pull us there).

---

## 6) Metrics (no heavy analytics)

**North-star metric (NSM):**
- **Paid unlocks per week** (count of successful paid invoices that resulted in unlock cookies).

**Supporting metrics (3) + measurement approach:**
1. **Invoice conversion rate** = paid invoices / invoices created
   - Measure: log `invoice_created` and `invoice_paid` events server-side (JSONL on disk).
2. **Revenue (sats) per week**
   - Measure: sum `amount_sats` for `invoice_paid` events.
3. **Paid-post engagement proxy** = unlocked post views within 24h of unlock
   - Measure: when an unlock cookie exists for a slug, log `unlocked_view` events (no user identity; just event counts).

**Implementation note (fits constraints):**
- Append-only `data/events-YYYY-MM.jsonl` with timestamp, slug, event_type, sats, invoice_hash prefix.
- Optional: a simple `/admin/metrics` page behind a static token or IP allowlist (still no accounts/DB).

---

## 7) Risks / unknowns (top 8) + fast de-risking

1. **Lightning readiness of target readers**
   - De-risk: interviews + a live test post shared to LN-native channels; observe invoice→paid rate.
2. **LNbits reliability/custody concerns**
   - De-risk: document “recommended LNbits setups,” add clear failure states + retry; consider optional self-hosted LNbits guidance.
3. **Unlock UX edge cases (paid but not unlocked)**
   - De-risk: build a receipt/restore flow using invoice hash; improve status polling + server verification.
4. **Cookie-based unlock limitations (device switching, clearing cookies)**
   - De-risk: provide “re-open with invoice hash” restore link or printable receipt token (still no accounts).
5. **Pricing uncertainty (too high/low, inconsistent)**
   - De-risk: recommended pricing guidelines; enable post-level A/B via two similar posts or time-based experiments.
6. **Content leakage/piracy**
   - De-risk: accept as reality; focus on convenience and pricing; add soft deterrents (watermark/receipt ID) only if requested.
7. **Legal/tax expectations around selling content**
   - De-risk: add a lightweight disclaimer template; keep PayBlog as software; encourage creators to handle compliance.
8. **SEO + paywall discoverability**
   - De-risk: ensure teasers are indexable; add structured metadata; consider “free index, paid detail” pattern.

---

## Recommended next 3 engineering tasks (map to GitHub issues)

> No existing PayBlog GitHub issues were found in-repo; recommended to create issues with the titles below.

1. **Issue: Improve paywall conversion UX (QR/copy, states, retries)**
   - Scope: clearer CTA, invoice creation loading state, error handling, “payment detected” transition, better mobile layout.
2. **Issue: Add privacy-respecting event logging (JSONL) + basic metrics view**
   - Scope: `invoice_created`, `invoice_paid`, `post_view`, `unlocked_view` events; simple aggregation endpoint/page.
3. **Issue: Add teaser/preview controls (first-N paragraphs + CTA blocks)**
   - Scope: support `<!--more-->` plus optional `preview_paragraphs` frontmatter; ensure good rendering for sharing.
