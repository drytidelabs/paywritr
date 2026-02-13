# PayBlog — PRD (MVP)

## Goal
A self-hosted, single-author, flat-file blog with **per-post Bitcoin Lightning paygating**. Readers can unlock individual posts by paying a one-time Lightning invoice.

## Non-goals
- No user accounts/login/registration
- No database
- No comments, likes, bookmarks, recommendations
- No analytics/admin UI (content is managed by files)

## Content model
- Posts are Markdown files in `content/posts/*.md`
- Frontmatter fields:
  - `title` (string)
  - `date` (ISO string)
  - `price_sats` (number; `0` means free)
  - `description` (string; optional)
- Teaser vs full content split by `<!--more-->` marker

## Payment provider (no node, minimal)
**LNbits** (hosted/custodial instance) using HTTP API:
- Create invoice: `POST /api/v1/payments`
- Check invoice status: `GET /api/v1/payments/{payment_hash}`

Rationale: simple API, widely supported, can be used with hosted LNbits; no Lightning node required for the blog.

## UX flow
1. Visitor opens a post.
2. If `price_sats=0` → show full content.
3. Otherwise show teaser + paywall card.
4. Click “Unlock for X sats” → server creates invoice via LNbits.
5. UI shows Bolt11 invoice and QR.
6. Client polls status endpoint every ~2s.
7. When paid, server sets a signed cookie unlocking that specific post for a period (default: 30 days).

## Unlock mechanism (no DB)
- After payment is confirmed with LNbits, server sets `HttpOnly` cookie:
  - Name: `unlock_{slug}`
  - Value: signed token (HMAC) with `{slug, exp}`
  - TTL: 30 days
- No server-side storage required.
- Invoice check uses LNbits as source of truth.

## Security / trust boundaries
- Server signs unlock tokens with `APP_SECRET`.
- Invoice “state” is also signed so a client can’t swap invoices between posts.
- Always verify invoice is **paid** via LNbits before issuing unlock cookie.

## Minimal stack
- Node.js + Express
- Flat files on disk
- `marked` for Markdown
- `gray-matter` for frontmatter
- Minimal CSS

## Deliverables
- Running server + Dockerfile + docker-compose
- Example posts
- README with setup
