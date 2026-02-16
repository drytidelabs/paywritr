# Authoring (v0.1)

Paywritr is a flat-file Markdown blog.

- Posts live in: `content/posts/*.md`
- The **slug is the filename** (without `.md`). Example: `content/posts/hello.md` → `/post/hello`
- A post is **paywalled** when `price_sats > 0`.
- **Unlocks are per device/browser** (stored as a signed `HttpOnly` cookie per post slug).

## Frontmatter schema (v0.1)

Supported keys:

- `title` (string, recommended)
- `date` (string, optional; displayed as-is)
- `price_sats` (number, optional; `0` or missing means free)
- `description` (string, optional; shown on homepage)

Example (free post):

```md
---
title: Hello, Paywritr
date: 2026-02-16
price_sats: 0
description: A free post.
---

This is a free post.
```

Example (paywalled post):

```md
---
title: My Premium Note
date: 2026-02-16
price_sats: 500
description: A paywalled post.
---

This paragraph is the teaser.

<!--more-->

## Paid section

This content is only shown after payment + unlock.
```

## Teaser / preview rules

Paywritr uses a preview split marker:

- **Teaser** = content *before* `<!--more-->`
- **Full content** = the entire Markdown body

Important behavior (anti-leak):
- If `price_sats > 0` and the author forgets `<!--more-->`, Paywritr **does not** show the full post.
- Instead, it shows a conservative fallback teaser (first ~800 characters).

## Slug & unlock cookie behavior

- Unlock cookie name is derived from the slug: `unlock_<slug>`.
- Changing the filename (slug) creates a **new** unlock scope. Readers who unlocked the old slug will not be unlocked for the new one.

## Common gotchas

- **Price units are sats** (`price_sats`).
- Use `<!--more-->` in paywalled posts to control the teaser.
- If a reader pays but still sees the paywall after reload, it’s usually because their browser is **blocking cookies** for the site.
