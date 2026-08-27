# CSS / SCSS / Sass

Prefer modern CSS; no deprecated properties or hand-written vendor prefixes.
Prefer `oklch` for new tokens on greenfield. Plain CSS applies in `.css`,
`.scss`, and `.sass`; Sass-only features belong only in `.scss` / `.sass`.

## Match the repo

Follow the project’s existing class naming, file layout, and whether styles live
in `.css`, `.scss`, or `.sass`. Don’t invent a second naming or folder scheme
mid-feature. Don’t mix `.scss` and `.sass` in the same codebase unless the repo
already does.

```css
/* ❌ Incorrect: new one-off file beside the repo’s partials / modules */
/* feature-card-overrides.css */

.page-card-title-blue {
  color: #164650;
}

/* ✅ Correct: extend the existing partial / module the repo already uses */
/* components/_card.css  — or card.module.css, if that’s the repo shape */

.card-title {
  color: var(--color-text);
}
```

## Entry and tooling

Plain CSS applies in `.css`, `.scss`, and `.sass`. Sass-only features (`@use`,
`$variables`, `%placeholders`, `sass:color`) need a Sass compile and belong
only in `.scss` / `.sass` — they do not run in a plain `.css` file.

```css
/* ❌ Incorrect: Sass-only @use in a plain .css file */
@use 'tokens';

.card-title {
  color: tokens.$color-text;
}

/* ✅ Correct: plain CSS custom properties in .css */
.card-title {
  color: var(--color-text);
}
```

## Tokens

Map primitives to semantic custom properties. Use `var(--token)` at the call
site — never bare `--token` as a value. Prefer `oklch` primitives on greenfield.

```css
/* ❌ Incorrect: magic values; bare custom property as a value */
.card {
  color: #164650;
  padding: 13px;
  background: --color-surface;
}

/* ✅ Correct: semantic tokens via var(); oklch primitives on greenfield */
:root {
  --color-blue-900: oklch(35% 0.05 210);
  --color-text: var(--color-blue-900);
  --space-medium: 1rem;
}

.card {
  color: var(--color-text);
  padding: var(--space-medium);
}
```

## Layout

Prefer intrinsic flex/grid first, then container queries for components, then
mobile-first viewport media queries for page chrome. Use `em` breakpoints when
media queries are needed.

```css
/* ❌ Incorrect: desktop-first layout that crams for mobile */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

/* ✅ Correct: intrinsic grid, then container, then viewport when needed */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20ch, 1fr));
  gap: var(--space-medium);
}

.card-wrapper {
  container-type: inline-size;
}

@container (min-width: 40ch) {
  .card {
    display: grid;
    grid-template-columns: auto 1fr;
  }
}

@media (width >= 48em) {
  .site-nav {
    display: flex;
  }
}
```

## Motion

Intentional hierarchy, not noise. Gate decorative animation with
`prefers-reduced-motion: no-preference` (or the repo’s motion helper).

```css
/* ❌ Incorrect: decorative motion always on */
.hero-mark {
  animation: float 4s ease-in-out infinite;
}

/* ✅ Correct: decorative motion only when motion is preferred */
@media (prefers-reduced-motion: no-preference) {
  .hero-mark {
    animation: float 4s ease-in-out infinite;
  }
}
```

## Cascade and layers

Declare cascade layers explicitly. Prefer `:where()` for zero-specificity
defaults. No global `*` resets. Prefer classes over `#id` / `!important`.

```css
/* ❌ Incorrect: global reset and specificity arms race */
* {
  margin: 0;
  box-sizing: border-box;
}

#card .title {
  color: #333 !important;
}

/* ✅ Correct: layered cascade and low-spec defaults */
@layer reset, base, theme, components, utilities;

@layer base {
  :where(img, video, picture) {
    display: block;
    max-width: 100%;
  }
}

@layer components {
  .card-title {
    color: var(--color-text);
  }
}
```

## Selectors and nesting

Use `:has()`, `:not()`, and `@scope` when they express intent. Avoid nesting when
it isn’t needed. Nest only pseudo-classes / pseudo-elements, component state,
and related media or container queries — not deep element trees.

```css
/* ❌ Incorrect: overmatch then override; deep nesting; unscoped leak */
.card img {
  border-radius: 0.5rem;
}

.list li {
  border-bottom: 1px solid #c0c0c0;
}

.list li:last-child {
  border-bottom: none;
}

.card {
  .header {
    .title {
      .icon {
        color: #f00;
      }
    }
  }
}

/* ✅ Correct: @scope / intent-first selectors; nest related state / queries */
@scope (.card) {
  img {
    border-radius: 0.5rem;
  }
}

.list li:not(:last-child) {
  border-bottom: 1px solid #c0c0c0;
}

label:has(:checked) {
  font-weight: 600;
}

.card {
  padding: var(--space-medium);

  &:hover {
    background-color: var(--color-surface-raised);
  }

  &::before {
    content: '';
  }

  @media (width >= 48em) {
    display: grid;
  }
}
```

- Use logical properties (`margin-inline-start`) when the value should flip in RTL.
- Don’t blindly replace every physical property.

## Syntax

Prefer kebab-case names, single-quoted strings and URLs, unitless zero lengths,
leading zeros on decimals, double-colon pseudo-elements, and unprefixed modern
properties. Prefer `oklch` for new tokens; then `oklab` / `hsl` when matching
an existing scale; then RGB / lowercase shortened hex only if the repo already
uses them. Avoid color keywords.

```css
/* ❌ Incorrect: camelCase, 0px, .5, prefix, double quotes, long hex */
.CardTitle {
  margin: 0px;
  opacity: .5;
  -webkit-box-shadow: 0 1px 2px #000000;
  color: #FF0000;
  font-family: "Inter";
  background-image: url(/images/card.png);
}

.card:before {
  content: "";
}

/* ✅ Correct: kebab-case, 0, 0.5, oklch, single quotes, :: */
.card-title {
  margin: 0;
  opacity: 0.5;
  box-shadow: 0 1px 2px oklch(0% 0 0 / 0.2);
  color: oklch(55% 0.19 25);
  font-family: 'Inter', system-ui, sans-serif;
  background-image: url('/images/card.png');
}

.card::before {
  content: '';
}
```

- Prefer modern color functions and one declaration per line.
- CSS identifiers used as values (`sans-serif`, `initial`) stay unquoted.
- Unitless `0` for lengths only; keep units on durations (e.g. `0s`).

## SCSS / Sass modules

Sass-only — `.scss` and `.sass` (same features; indented form for `.sass`). Not
for plain `.css`. Use `@use` / `@forward` and namespaced members. No legacy
`@import` for modules. Don’t add a ceremonial `@charset` — tooling already
treats sources as UTF-8. Load color helpers from `sass:color` — no global
`darken` / `lighten` / `mix`.

```scss
/* ❌ Incorrect: legacy @import, double quotes, appearance-only name */
@import "variables";

.blue {
  color: $blue;
}

/* ✅ Correct: @use, single-quoted path, role-based name */
@use 'tokens';

.card-title {
  color: tokens.$color-text;
  font-size: tokens.$font-size-large;
}
```

```scss
/* ❌ Incorrect: @extend on a concrete selector; global darken/lighten */
@use 'tokens';

.card {
  @extend .box;
  background: darken(tokens.$color-surface, 10%);
}

/* ✅ Correct: @extend a placeholder; sass:color */
@use 'sass:color';
@use 'tokens';

%box {
  padding: tokens.$space-medium;
}

.card {
  @extend %box;
  background: color.mix(#000, tokens.$color-surface, 10%);
}
```

- Quote Sass map keys with single quotes.
- Wrap top-level calculations in parentheses.
