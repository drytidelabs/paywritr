# Design tokens (v0.2)

Paywritr uses **CSS variables (design tokens)** as a stable styling contract.

Principles:
- **Semantic tokens** (meaning-based) over raw values.
- Base/component CSS must reference **tokens only** (no hard-coded colors in rules).
- Themes override tokens to change the look without rewriting component CSS.

This file defines the canonical token set.

## Color tokens
These are the minimum semantic colors used across the UI.

- `--color-bg` — page background
- `--color-surface` — elevated surface background (cards, panels)
- `--color-surface-2` — secondary surface background (subtle panels)
- `--color-text` — primary text
- `--color-muted` — muted/secondary text
- `--color-border` — separators/borders
- `--color-accent` — links / primary accent
- `--color-accent-contrast` — text on accent background

Optional (add only when needed):
- `--color-success`, `--color-warning`, `--color-danger`

## Typography tokens
- `--font-body` — body font stack
- `--font-mono` — monospace font stack
- `--font-size-base` — base font size (e.g. `16px`)
- `--line-height-base` — base line-height (e.g. `1.7`)

## Spacing + shape tokens
Small consistent scale is preferred.

- `--space-1` … `--space-8` — spacing scale
- `--radius-1` … `--radius-4` — radius scale

## Layout tokens
- `--content-max-width` — max width of `.container`

## Light/Dark mode convention
Tokens MUST support both schemes:
- Light values at `:root`
- Dark overrides under `[data-color-scheme="dark"]`

The toggle/persistence mechanism is tracked separately (#70 chain).

## Usage rules
- Component CSS should use tokens, e.g.:
  - `color: var(--color-text);`
  - `background: var(--color-bg);`
  - `border-color: var(--color-border);`
- Avoid hard-coded hex values in rules; if a new color is required, introduce a token.
