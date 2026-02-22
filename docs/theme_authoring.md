# Theme authoring guide

This guide explains how to create a new Paywritr theme **without reading server code**.

A theme is a folder under `themes/<name>/` containing:
- Mustache templates (`templates/*.mustache`)
- Optional partial templates (`partials/*.mustache`)
- A token-only CSS file (`theme.css`)
- Optional theme metadata (`theme.yml`)

The reference implementation is `themes/classic/`.

---

## 1) Theme folder layout

Create a new directory:

```
themes/
  <name>/
    theme.css
    theme.yml              # optional
    templates/
      layout.mustache      # REQUIRED to enable theme rendering
      home.mustache        # optional
      post.mustache        # optional
      page.mustache        # optional
      content.mustache     # optional but recommended
      notfound.mustache    # optional
      error.mustache       # optional
    partials/
      header.mustache      # optional
      footer.mustache      # optional
      ...                  # optional
```

Notes:
- The **theme identifier is the folder name** (`themes/<name>/`).
- `theme.css` is served at `/themes/<name>/theme.css`.
- Theme templates are only used if `templates/layout.mustache` exists. Without it, the app falls back to the built-in HTML renderer.

---

## 2) Template engine syntax (Mustache)

Paywritr uses a safe Mustache-style renderer (via `mustache`).

### Variables

- Escaped (default): `{{var}}`
  - HTML is escaped.
- Raw HTML: `{{{var}}}`
  - **Not escaped**. Use only for trusted, server-generated HTML like rendered Markdown.

Examples:

```mustache
<h1>{{site.title}}</h1>
<section class="content">{{{content_html}}}</section>
```

### Sections (lists / truthy values)

- Regular section: `{{#items}} ... {{/items}}`
  - If `items` is an array, iterates; inside the block you can reference item properties directly.
  - If `items` is truthy (non-empty), renders once.

```mustache
{{#home.posts}}
  <a href="/p/{{slug}}/">{{title}}</a>
{{/home.posts}}
```

### Inverted sections (empty / falsy)

- Inverted section: `{{^items}} ... {{/items}}`

```mustache
{{^home.posts}}
  <p class="muted">No posts yet.</p>
{{/home.posts}}
```

### Partials

- Include a partial by name: `{{> header}}`
- Partials are loaded from `themes/<name>/partials/*.mustache`
  - The partial name is the filename without `.mustache`.

```mustache
<body>
  {{> header}}
  <main>{{{page.body_html}}}</main>
  {{> footer}}
</body>
```

### Escaping rules (important)

- `{{var}}` is HTML-escaped.
- `{{{var}}}` is not escaped.
- Markdown is rendered server-side with raw HTML **disabled**. The resulting HTML is provided to templates via `content_html`.

---

## 3) Theme selection

Select the active theme with the `THEME` environment variable:

```bash
THEME=mytheme
```

Fallback behavior:
- If `THEME` is unset, Paywritr uses `classic`.
- For CSS, Paywritr tries `/themes/$THEME/theme.css` and falls back to `/themes/classic/theme.css` if missing.

---

## 4) Template naming + fallback rules

Templates live in `themes/<name>/templates/` and are selected by a **kind**.

### Kinds Paywritr currently uses

- `layout.mustache` (required to enable theme rendering)
- `home.mustache`
- `post.mustache`
- `page.mustache`
- `content.mustache` (generic fallback)
- `notfound.mustache`
- `error.mustache`

### Resolution rules

When rendering a page of kind `home|post|page|content|notfound|error|...`:

1. Try `<kind>.mustache`
2. If missing and `kind != content`, fall back to `content.mustache`
3. If still missing, fall back to a built-in safe template body (minimal HTML)

If `layout.mustache` is missing, **none of the theme templates are used** (legacy server HTML rendering is used instead).

---

## 5) Render context / available variables

Templates receive a single **view object**. The most important top-level keys are:

- `site.*`
- `theme.*`
- `global.*`
- `nav.*`
- `home.*`
- `content.*`
- `page.*`
- `year`
- `content_html`
- `paywall_html`

### `site.*` (from `site.yml`)

- `site.title`
- `site.tagline`
- `site.description`
- `site.timezone` (IANA timezone name; e.g. `America/New_York`)

### `theme.*`

Theme metadata is loaded from `themes/<name>/theme.yml` (optional):

- `theme.label` (optional)
- `theme.version` (optional)

The server also injects:

- `theme.css_href` — resolved CSS URL (e.g. `/themes/classic/theme.css`). May be empty if no theme CSS exists.

### `global.*` (HTML snippets)

These are pre-rendered HTML snippets intended to be used with triple-stash `{{{...}}}`:

- `global.scheme_head_script` — an early `<script>` that sets `data-color-scheme` before paint
- `global.scheme_toggle_html` — the `<button id="schemeToggle">…</button>` markup
- `global.extra_body` — extra scripts injected near the end of `<body>` (e.g. paywall scripts)

Conventions:
- Use `{{{global.scheme_head_script}}}` inside `<head>`.
- Use `{{{global.scheme_toggle_html}}}` somewhere visible (usually header).
- Include `{{{global.extra_body}}}` at the bottom of `<body>`.

### `nav.pages[]` (auto-generated from page content)

`nav.pages` is a list of published pages, sorted by title:

Each item:
- `slug`
- `title`

Used by `themes/classic/partials/header.mustache` to generate links.

### `home.posts[]` (homepage)

The homepage provides `home.posts`:

Each item:
- `type` (currently `post`)
- `slug`
- `title`
- `published_date`
- `summary`
- `price_sats`
- `price_label` (e.g. `"free"` or `"123 sats"`)

### `content.*` (post/page metadata)

For content routes (like a post page), the server sets `content`:

- `content.type` (`post` or `page`)
- `content.slug`
- `content.title`
- `content.published_date`
- `content.summary`
- `content.price_sats`
- `content.price_label` (e.g. `free`, `100 sats`)

### `content_html`

The rendered Markdown HTML for the current page.

- For posts:
  - If unlocked (or free): full HTML
  - If paywalled and locked: teaser HTML
- For pages: always full HTML

Use with triple-stash:

```mustache
<section class="content">{{{content_html}}}</section>
```

### `paywall_html`

Pre-rendered HTML for the paywall UI.

- Empty string for free posts, unlocked posts, and all pages.
- Non-empty for locked paid posts.

Use with triple-stash where you want the paywall to appear:

```mustache
{{{paywall_html}}}
```

### `page.*` (layout wrapper)

`layout.mustache` is rendered with a wrapper `page` object:

- `page.title` — the document/page title
- `page.body_html` — the already-rendered body template output

In your layout template:

```mustache
<title>{{page.title}} — {{site.title}}</title>
<main class="container">{{{page.body_html}}}</main>
```

### `year`

- `year` — current UTC year (number)

---

## 6) CSS tokens (light/dark)

Paywritr’s base UI CSS lives in `static/style.css` and is designed to be themed via **CSS variables (design tokens)**.

Your theme’s `theme.css` should primarily set token values (colors, typography, layout widths), not rewrite component CSS.

### Token contract

See `docs/design_tokens.md` for the canonical token list.

A minimal `theme.css` typically defines light tokens in `:root` and dark overrides under `[data-color-scheme="dark"]`:

```css
:root{
  --color-bg:#f6f3ee;
  --color-text:#141414;
  --color-accent:#141414;
  --content-max-width:720px;
}

[data-color-scheme="dark"]{
  --color-bg:#0f0f10;
  --color-text:#f2f2f0;
  --color-accent:#f2f2f0;
}
```

### `--color-scheme-toggle`

The light/dark toggle button styles use:

- `--color-scheme-toggle` (defaults to `var(--color-text)` in `static/style.css`)

Override it in `theme.css` if you want the toggle icon/button to have a different color than normal text.

---

## 7) Global site metadata (`site.yml`)

`site.yml` lives at the project root and supplies global branding + SEO metadata.

Example:

```yml
title: "My Site"
tagline: "A short tagline"
description: "A longer description for SEO"
```

These values are available in templates under `site.title`, `site.tagline`, `site.description`.

---

## 8) Nav pages (auto-generated)

Pages are created as Markdown files in `content/posts/*.md` with frontmatter:

```yml
type: page
slug: about
price_sats: 0
```

All non-draft pages are collected into `nav.pages[]` and can be rendered in your header/nav partial.

---

## 9) Paywall integration (required IDs/attributes)

If you render `{{{paywall_html}}}` for paid posts, the server generates markup that the paywall JavaScript expects.

The paywall script (`/static/pay.js`) looks for:

- A container element:
  - `id="paywall"`
  - `data-slug="..."`
  - `data-price="..."`

Inside that container, it expects these elements by ID:

- `status`, `statusHelp`
- `getInvoiceBtn`, `newInvoiceBtn`
- `invoice`
- `bolt11`
- `copyInvoiceBtn`
- `refreshStatusBtn`, `reloadBtn`
- `qrcode`

Practical guidance:
- **Do not** re-template the paywall internals yet; treat `paywall_html` as an opaque, required blob.
- Place `{{{paywall_html}}}` after `{{{content_html}}}` (see `themes/classic/templates/post.mustache`).

---

## 10) Light/dark toggle

### Required convention

Include the toggle markup somewhere in your layout (usually header):

- `{{{global.scheme_toggle_html}}}`

The toggle script (`/static/scheme-toggle.js`) requires:

- `id="schemeToggle"` on the toggle button

### Preventing “flash” on load

To set the correct color scheme before paint, include:

- `{{{global.scheme_head_script}}}` inside `<head>`

### Persisting the scheme

The toggle script stores the chosen scheme in a cookie (`paywritr_color_scheme`) and sets the attribute:

- `<html data-color-scheme="light">` or `dark`

Your theme should implement scheme differences by overriding tokens under:

```css
[data-color-scheme="dark"]{ ... }
```

---

## Appendix: Start from the classic theme

The fastest way to make a new theme is to copy `themes/classic/` and iterate:

```bash
cp -R themes/classic themes/mytheme
# edit themes/mytheme/theme.css and templates
```

Key files to study:
- `themes/classic/templates/layout.mustache`
- `themes/classic/templates/home.mustache`
- `themes/classic/templates/post.mustache`
- `themes/classic/templates/page.mustache`
- `themes/classic/templates/content.mustache`
- `themes/classic/partials/header.mustache`
- `themes/classic/theme.css`
