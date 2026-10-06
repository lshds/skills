# Page Semantics

Prefer native labels, headings, and landmarks over ARIA. Every control, image,
and region needs a name AT can find. Pointer targets stay large enough to hit,
and a focused control is never hidden behind the page’s own sticky chrome
(WCAG 2.2 AA).

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
  <div class="nav">
    <a href="/orders">Orders</a>
    <a href="/settings">Settings</a>
  </div>
  <div class="content">
    <h1>Orders</h1>
  </div>
</div>

<!-- ✅ Correct: skip link + landmarks -->
<a href="#main">Skip to content</a>
<header>
  <a href="/">Acme Store</a>
</header>
<nav aria-label="Primary">
  <a href="/orders">Orders</a>
  <a href="/settings">Settings</a>
</nav>
<main id="main">
  <h1>Orders</h1>
</main>
```

- Name a second `nav` (or complementary region) with `aria-label` so landmarks
  stay distinct.

## Images

Informative images need `alt` that states the purpose. Decorative images use
empty `alt` (or `aria-hidden` on inline SVG) so they leave the a11y tree.

```html
<!-- ❌ Incorrect: missing alt; decorative SVG announced -->
<img src="avatar.jpg" />
<button type="button">
  Save
  <svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" /></svg>
</button>

<!-- ✅ Correct: purpose in alt; hide decorative graphics -->
<img src="avatar.jpg" alt="Ada Lovelace" />
<button type="button">
  Save
  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7" /></svg>
</button>
```

- Don’t stuff `alt` with “image of …”; say what the image is for.
- Icon-only controls are named on the control (`aria-label` or visible text).

## Targets are at least 24 by 24 pixels

Small, tightly packed targets get mis-hit by people with tremor and on touch
screens (WCAG 2.5.8). Give each pointer target at least 24 × 24 CSS px with
`min-inline-size` / `min-block-size`, or space targets so a 24px circle
centered on each one doesn’t overlap a neighbor or its circle. The icon inside
can stay smaller than the hit area.

```css
/* ❌ Incorrect: 16px icon buttons 2px apart — a tap easily lands on the neighbor */
.toolbar {
  display: flex;
  gap: 2px;
}

.toolbar-button {
  inline-size: 16px;
  block-size: 16px;
  padding: 0;
}

/* ✅ Correct: the hit area is at least 24 × 24 CSS px; the 16px icon is centered inside */
.toolbar {
  display: flex;
  gap: 0.5rem;
}

.toolbar-button {
  display: inline-grid;
  place-items: center;
  min-inline-size: 24px;
  min-block-size: 24px;
}
```

```html
<!-- ✅ Correct: links inside a sentence are exempt; standalone controls still need 24 × 24 -->
<p>Read the <a href="/terms">terms of service</a> before you continue.</p>
<div class="toolbar">
  <button type="button" class="toolbar-button" aria-label="Bold">
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M4 2h5a3 3 0 0 1 0 6H4zM4 8h6a3 3 0 0 1 0 6H4z" /></svg>
  </button>
</div>
```

- Exceptions: inline links in running text, a target with an equivalent control
  elsewhere on the page that meets the size, user-agent default controls the
  author hasn’t restyled, and presentations where the size is essential.

## Sticky chrome never hides focus

When a sticky header or footer overlaps the viewport, the browser scrolls a
newly focused control just into view — underneath that header — and keyboard
users lose track of where they are (WCAG 2.4.11). Reserve scroll padding that
matches the sticky chrome so focused controls land in the visible area.

```css
/* ❌ Incorrect: sticky header with no scroll padding — Tab parks focused fields underneath it */
.site-header {
  position: sticky;
  inset-block-start: 0;
  block-size: 4rem;
}

/* ✅ Correct: scroll padding matches the sticky header and footer heights */
:root {
  --site-header-height: 4rem;
  --sticky-footer-height: 3rem;
  scroll-padding-block-start: var(--site-header-height);
  scroll-padding-block-end: var(--sticky-footer-height);
}

.site-header {
  position: sticky;
  inset-block-start: 0;
  block-size: var(--site-header-height);
}
```

- Cookie banners and sticky footers must not cover the focused control: reserve
  their height with `scroll-padding-block-end`, or keep the banner in the page
  flow until it is dismissed.
