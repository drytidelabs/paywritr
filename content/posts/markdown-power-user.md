---
title: "Markdown Power-User Tips You're Missing"
type: post
slug: markdown-power-user
price_sats: 50
published_date: "2026-02-08"
summary: "Level up your Markdown game with these lesser-known tricks."
---

You know headings, bold, and links. But Markdown has some tricks up its sleeve that most people never discover.

<!--more-->

## Footnotes

Most renderers support footnotes now:

```
Here's a claim[^1] that needs a source.

[^1]: Source: some credible place.
```

## Task lists

GitHub-flavored Markdown gives you checkboxes:

```
- [x] Write the post
- [ ] Edit the post
- [ ] Hit publish
```

## Collapsed sections

Using HTML `<details>` inside Markdown:

```html
<details>
<summary>Click to expand</summary>

Hidden content goes here. Full Markdown works inside.

</details>
```

## Linking to headings

Most renderers auto-generate IDs for headings. Link to them with:

```
[Jump to tips](#task-lists)
```

## Tables with alignment

```
| Left | Center | Right |
|:-----|:------:|------:|
| a    |   b    |     c |
```

The colons control column alignment. Most people never notice this.

## The meta tip

Write your Markdown in a plain text editor, not a WYSIWYG tool. You'll learn the syntax by muscle memory, and you'll never fight a formatting toolbar again.
