# Tailwind

Prefer CSS-first Tailwind v4 (`@import`, `@theme`, automatic content detection)
over legacy `@tailwind` directives and JS theme config so tokens and utilities
live in one stylesheet.

## Match the repo

Use one Tailwind entry and theme for the app. Mixing `@tailwind` directives or
a JS config with `@import 'tailwindcss'` creates two sources of truth.

```css
/* ❌ Incorrect: legacy directives beside a v4 entry */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import 'tailwindcss';

/* ✅ Correct: single v4 entry */
@import 'tailwindcss';
```

## Entry and tooling

Configure in CSS. Use `@tailwindcss/vite` or `@tailwindcss/postcss` alone — not
the legacy `tailwindcss` PostCSS plugin with `postcss-import` / `autoprefixer`.
CLI builds use `@tailwindcss/cli`. No `tailwind.config.*` and no `@config` on
greenfield. Need `important`? Use `@import 'tailwindcss' important;` — not a JS
flag. Content is auto-detected; add `@source` in CSS only for missed paths.

```css
/* ❌ Incorrect: legacy directives */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ✅ Correct: single v4 entry */
@import 'tailwindcss';
```

```js
// ❌ Incorrect: JS theme/content config and old PostCSS stack
module.exports = {
  content: ['./src/**/*.{js,ts,tsx}'],
  theme: { extend: { colors: { brand: '#3b82f6' } } },
}

// ✅ Correct: v4 Vite plugin — content is auto-detected
import tailwindcss from '@tailwindcss/vite'

export default {
  plugins: [tailwindcss()],
}
```

```js
// ❌ Incorrect: JS content globs in tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,ts,tsx}',
    './node_modules/@my-company/ui-lib/**/*.js',
  ],
}

// ✅ Correct: no content key — auto-detect; missed paths use @source in CSS
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

```css
/* ❌ Incorrect: expect a node_modules UI package to be scanned with no @source */
@import 'tailwindcss';

/* ✅ Correct: @source for a package Tailwind missed */
@import 'tailwindcss';
@source '../node_modules/@my-company/ui-lib';
```

## Tokens

Use `@theme` for design tokens that should become utilities (`bg-brand`,
`font-display`). Use `:root` only for CSS variables that must not generate
utilities. Prefer semantic token names and `oklch` on greenfield. When a theme
value references another CSS variable, use `@theme inline`.

```css
/* ❌ Incorrect: bare :root vars expected to become utilities; magic hex in features */
:root {
  --brand: #3B82F6;
}

/* ✅ Correct: @theme semantic tokens */
@import 'tailwindcss';

@theme {
  --color-brand: oklch(55% 0.2 275);
  --color-surface: oklch(98% 0.01 280);
  --color-foreground: oklch(25% 0.02 280);
  --font-display: 'Satoshi', system-ui, sans-serif;
  --radius-lg: 0.5rem;
  --spacing-18: 4.5rem;
}
```

```css
/* ❌ Incorrect: nested var reference without inline (may not resolve as expected) */
@theme {
  --font-sans: var(--font-inter);
}

/* ✅ Correct: inline when referencing other vars */
@theme inline {
  --font-sans: var(--font-inter);
}
```

## Layout

Mobile-first utilities. Use `@container` + `@md:` for component layout; viewport
`md:` for page chrome so reusable cards adapt to their parent, not the window.

```tsx
// ❌ Incorrect: only viewport breakpoints for a reusable card
<div className="flex flex-col md:flex-row gap-4">
  <img src="/card.png" alt="" />
  <p>Card body</p>
</div>

// ✅ Correct: container queries for component-level layout
<div className="@container">
  <div className="flex flex-col @md:flex-row gap-4">
    <img src="/card.png" alt="" />
    <p>Card body</p>
  </div>
</div>
```

## Motion

Gate decorative `animate-*` / `transition-*` with `motion-safe:` (or the repo’s
motion helper) so reduced-motion preferences are respected.

```tsx
// ❌ Incorrect: decorative motion always on
<div className="animate-pulse transition-transform hover:scale-105" />

// ✅ Correct: decorative motion only when preferred
<div className="motion-safe:animate-pulse motion-safe:transition-transform motion-safe:hover:scale-105" />
```

## Dark mode

Dark mode only when the repo already themes dark. Match the existing dark
strategy (class, data attribute, or media) — don’t invent a second one beside
it. Override semantic token values on that selector rather than raw palette
pairs on every node.

```css
/* Given: the app already themes via .dark on html + semantic tokens */

/* ❌ Incorrect: invent a second strategy beside the repo’s .dark */
@custom-variant dark (&:where(.night, .night *));

@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #111;
    --color-foreground: #eee;
  }
}

/* ✅ Correct: only extend the existing .dark token overrides */
.dark {
  --color-surface: oklch(25% 0.02 280);
  --color-foreground: oklch(95% 0.01 280);
}
```

```tsx
// ❌ Incorrect: raw palette in every dark: pair when tokens exist
<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white" />

// ✅ Correct: semantic utilities from @theme
<div className="bg-surface text-foreground" />
```

## Utilities

Prefer current names and slash opacity. Put custom colors in `@theme`, not
arbitrary hex. Custom utilities use `@utility` — not `@layer utilities`. Prefer
`gap` on flex/grid over `space-*` / child margins. Prefer `size-*` for squares;
`grow` / `shrink` over `flex-grow` / `flex-shrink`; `bg-linear-to-*` /
`bg-radial` / `bg-conic` over `bg-gradient-to-*`. Prefer `not-*` and `starting:`
for state and entry transitions. Use `outline-hidden` for an invisible outline
that still works in forced-colors mode; reserve `outline-none` for true
`outline-style: none`.

```tsx
// ❌ Incorrect: removed or renamed utilities; arbitrary hex as default
<div className="bg-red-500 bg-opacity-50 text-opacity-75 bg-gradient-to-r from-blue-500 flex-shrink-0 shadow-sm outline-none" />
<div className="bg-[#3B82F6]" />

// ✅ Correct: slash opacity, bg-linear-to-*, shrink, shadow-xs, not-*, starting:
<div className="bg-red-500/50 text-blue-600/75 bg-linear-to-r from-blue-500 shrink-0 shadow-xs outline-hidden not-hover:opacity-75 hover:opacity-100 starting:opacity-0 opacity-100 transition-opacity" />
<div className="bg-brand" />
```

```css
/* ❌ Incorrect: @layer utilities for a new custom utility */
@layer utilities {
  .content-auto {
    content-visibility: auto;
  }
}

/* ✅ Correct: @utility for custom utilities */
@utility content-auto {
  content-visibility: auto;
}
```

- Read theme values in CSS via `var(--color-brand)` when needed.

## Composition

Utility-first. `@apply` only for true repetition. In CSS modules or Vue/Svelte
scoped CSS that need `@apply` / `@variant`, pull the theme in with `@reference`
— don’t duplicate the stylesheet. Never build class names from partial strings.
Use `cn` / clsx and the repo’s class-order formatter only if already present —
don’t invent `clsx` + `tailwind-merge` mid-feature. `cn` does not fix dynamic
interpolation.

```tsx
// ❌ Incorrect: dynamic class segments (also wrong inside cn)
<div className={`text-${color} p-${size}`} />
<div className={cn(`text-${color}`, className)} />

// ✅ Correct: complete class names; merge overrides with cn when the repo has it
<div className={color === 'brand' ? 'text-brand p-4' : 'text-foreground p-4'} />
<button className={cn('rounded-lg bg-brand px-4 py-2', className)} />
```

```css
/* ❌ Incorrect: duplicate full Tailwind import inside a CSS module */
@import 'tailwindcss';

.card {
  @apply rounded-lg bg-surface text-foreground;
}

/* ✅ Correct: @reference for @apply in modules / scoped styles */
@reference '../../app.css';

.card {
  @apply rounded-lg bg-surface text-foreground;
}
```
