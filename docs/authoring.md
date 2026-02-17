# Authoring (v0.1)

Paywritr is a flat-file Markdown blog.

- Posts live in: `content/posts/*.md`
- The **slug is the filename** (without `.md`). Example: `content/posts/hello.md` → `/post/hello`
- A post is **paywalled** when `price_sats > 0`.
- **Unlocks are per device/browser** (stored as a signed `HttpOnly` cookie per post slug).

## Frontmatter schema (v0.2)

Canonical keys:

- `type` (`post` | `page`)
- `title` (string)
- `slug` (string; **URL slug**, independent of filename)
- `published_date` (string; treated as publish date)
- `draft` (bool; `true` = not published)
- `price_sats` (int; for `type: page` must be `0`)
- `summary` (string; optional)
- `aliases` (list of old slugs; optional)
- `topics` (list; optional)

Example (free post):

```md
---
type: post
title: Hello, Paywritr
slug: hello-paywritr
published_date: 2026-02-16
draft: false
price_sats: 0
summary: A free post.
aliases: []
topics: []
---

This is a free post.
```

Example (paywalled post):

```md
---
type: post
title: My Premium Note
slug: my-premium-note
published_date: 2026-02-16
draft: false
price_sats: 500
summary: A paywalled post.
aliases: []
topics: []
---

This paragraph is the teaser.

<!--more-->

## Paid section

This content is only shown after payment + unlock.
```

Example (page):

```md
---
type: page
title: About
slug: about
published_date: 2026-02-16
draft: false
price_sats: 0
summary: Optional.
aliases: []
topics: []
---

This is an about page.
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
