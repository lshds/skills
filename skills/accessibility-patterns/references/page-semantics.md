# Page Semantics

Prefer native labels, headings, and landmarks over ARIA. Every control, image,
and region needs a name AT can find.

## Labels

Associate a visible `<label>` with the control (`for` / `id` or wrap).
Placeholder is a hint, not the name.

```html
<!-- ❌ Incorrect: placeholder as the only name -->
<input type="email" placeholder="Email" />

<!-- ✅ Correct: visible label wired to the control -->
<label for="email">Email</label>
<input id="email" type="email" autocomplete="email" />
```

## Headings

One `h1` per page; nest `h2`–`h6` in order. Don’t skip levels to match a visual
size — change the style, not the rank.

```html
<!-- ❌ Incorrect: skipped rank used as a visual style -->
<h1>Settings</h1>
<h4>Notifications</h4>

<!-- ✅ Correct: next rank in the outline -->
<h1>Settings</h1>
<h2>Notifications</h2>
```

## Landmarks and skip link

Use one `header`, `nav`, `main`, and `footer` as they exist. Put a skip link
before the chrome so keyboard users can reach `main` without tabbing the nav.

```html
<!-- ❌ Incorrect: no main; skip target missing -->
<div class="app">
  <div class="nav">…</div>
  <div class="content">…</div>
</div>

<!-- ✅ Correct: skip link + landmarks -->
<a href="#main">Skip to content</a>
<header>…</header>
<nav aria-label="Primary">…</nav>
<main id="main">…</main>
```

- Name a second `nav` (or complementary region) with `aria-label` so landmarks
  stay distinct.

## Images

Informative images need `alt` that states the purpose. Decorative images use
empty `alt` (or `aria-hidden` on inline SVG) so they leave the a11y tree.

```html
<!-- ❌ Incorrect: missing alt; decorative SVG announced -->
<img src="avatar.jpg" />
<button type="button">Save <svg>…</svg></button>

<!-- ✅ Correct: purpose in alt; hide decorative graphics -->
<img src="avatar.jpg" alt="Ada Lovelace" />
<button type="button">Save <svg aria-hidden="true">…</svg></button>
```

- Don’t stuff `alt` with “image of …”; say what the image is for.
- Icon-only controls are named on the control (`aria-label` or visible text).
