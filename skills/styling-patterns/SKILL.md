---
name: styling-patterns
description: >-
  CSS and utility styling guidelines for web and mobile UI. This skill should
  be used when writing, reviewing, or refactoring styles, themes, or branded
  UI to ensure tokens, layout, and look stay modern — not deprecated stacks
  or generic AI defaults. Prefer native CSS and CSS-first Tailwind v4 on the
  web, and stable NativeWind v4 on a Tailwind v3 config on mobile, over legacy
  or pre-release setups. Triggers on CSS, SCSS, Sass, CSS modules, Tailwind,
  `@theme`, NativeWind, tokens, theme, dark mode, container queries,
  className, or motion.
---

# Styling Skills

Stack-aware styling for tokens, layout, cascade, motion, and visual direction
across CSS / SCSS / Sass, Tailwind, and NativeWind. Prefer current platform
defaults and the repo’s design tokens when they exist.

**Domain:** how UI is styled — tokens, cascade, layout, motion, and stack
choice — across CSS, Tailwind, and NativeWind.
**Owns:** one styling system per feature; design tokens and `@theme`; compact
design plan on a free visual axis; layout ladder; cascade and structure;
motion gating; syntax conventions.
**Does not own:** component structure and state; keyboard, ARIA, and focus-trap
depth; React Native layout primitives beyond `className`.

## When to activate

- Writing or reviewing stylesheets, CSS modules, or SCSS / Sass partials
- Adding Tailwind or NativeWind `className` utilities (detect NativeWind v4 vs v5)
- Defining or using design tokens, `@theme`, themes, or spacing scales
- Building responsive layout (intrinsic, container queries, breakpoints)
- Adding animation or transition with reduced-motion gating
- Greenfield, branded, or marketing UI when the visual look is not already locked
- Refactoring mixed styling systems toward one stack per feature

## Core Concepts

### Write vs review

- Pick one mode from the user ask — don’t mix output shapes
- **Write** (implement, fix, refactor): apply these defaults in styles; no review report unless asked
- **Review**: named scope only; report concrete misses in this skill’s domain
- Skip findings outside that domain

### Match the repo

Read installed versions from `package.json` and the lockfile (plus the CSS
entry file, `postcss.config.*`, and `tailwind.config.*`). Follow the patterns
already in the tree; greenfield defaults apply only where nothing contradicts
them. When code lags behind what the installed version supports, finish the
task in the existing style, then propose the migration once — old → new, why,
file count, risk — and wait for a yes. Never fold it into the current change.
In review, report the gap as a finding instead.

One styling system per feature; switching stacks is a separate, asked-for
change. Reuse the repo’s theme tokens when they exist. Tailwind signals below
apply to web apps — inside NativeWind v4, the v3 config is correct.

Version signals:

- `tailwind.config.js` + `@tailwind base; @tailwind components; @tailwind utilities;`
  in a web app → `@import 'tailwindcss';` + `@theme` (Tailwind v4)
- `shadow-sm` / `rounded` / `outline-none` / `bg-opacity-50` → `shadow-xs` /
  `rounded-sm` / `outline-hidden` / `bg-black/50` (Tailwind v4)
- `darkMode: 'class'` → `@custom-variant dark (&:where(.dark, .dark *));`
  (Tailwind v4)
- Sass `@import` + global `darken()` → `@use` / `@forward` + `color.adjust()`
  from `sass:color` (Dart Sass 1.80+)
- Duplicated `prefers-color-scheme` token blocks → `light-dark()` (Baseline 2024)

NativeWind v4 → v5 is not proposed while v5 is a release candidate.

### Stack defaults

Web: native CSS, or CSS-first Tailwind v4 (`@import 'tailwindcss'` + `@theme`).
React Native: NativeWind v4 on a Tailwind CSS v3 config — `tailwind.config.js`
with `nativewind/preset`, `@tailwind` directives in `global.css`,
`nativewind/babel`, and `withNativeWind(config, { input })` in Metro. Use
NativeWind v5 (release candidate) only when the repo already runs it or the
user accepts an RC, pinned to the exact RC pair. Tooling and examples →
Practice areas.

### Design plan (free visual axis)

When the look is not already locked (greenfield, new branded surface, marketing
page with no design system), write a **compact design plan before styling
code**. Cover four decisions only:

1. **Color** — one primary, one surface, one text/foreground; name them as
   semantic tokens, not raw hex at call sites
2. **Type** — one display face + one body face (or the repo’s pair); avoid
   default UI stacks when the brand needs character
3. **Layout** — how the first viewport and sections compose (one job per
   section; intrinsic flex/grid before breakpoint spam)
4. **Signature** — one memorable visual idea (motif, crop, texture, motion
   beat) that would still identify the product if the logo were removed

Then do a **second pass**: revise anything that still reads like a generic
template rather than this plan. Skip the two-pass when the task is token-locked
or a small style fix inside an existing system — just match what is there.

### Avoid generic AI aesthetics

Generic defaults erase brand. Prefer the design plan (or repo tokens) over
looks that cluster in unguided generation:

- Purple-on-white or purple→indigo gradient themes
- Warm cream canvas + high-contrast serif + terracotta accent as a default trio
- Broadsheet pastiche (hairline rules, zero radius, dense newspaper columns)
- Always-on dark mode, glow/neon, pill clusters, multi-layer shadows, emoji as
  decoration
- Flat single-color pages with no atmosphere when the surface is meant to feel
  placed (gradient, image, or subtle pattern — still tokenized)
- Card chrome everywhere, or floating badges/stickers on hero media

### Motion

Intentional hierarchy, not noise — gate decorative motion (reduced-motion /
`motion-safe:` / repo helper). Details in the stack ref under Practice areas.

### Design tokens

Primitive → semantic CSS custom properties (or the repo’s theme/`@theme` scale)
for color, space, and type. No magic hex/px in features. Prefer kebab-case token
names. On a free visual axis, derive tokens from the design plan so utilities
and CSS share one vocabulary.

### Layout ladder

Intrinsic flex/grid first (`auto-fill` / `minmax`, wrap + `gap`). Container
queries for reusable components. Viewport media queries for page chrome —
mobile-first when MQ is needed.

### Cascade and structure

Prefer `@layer` / scoped modules / `:where()` over specificity wars, IDs, or
`!important`. Naming matches the repo; greenfield class CSS uses kebab-case, not
`block__element--modifier` unless the repo already uses that convention.

### Syntax conventions

Prefer modern color functions (`oklch` first on greenfield), no hand vendor
prefixes, `0` without unit, `::` pseudo-elements, and kebab-case names. Avoid
deprecated CSS properties and at-rules. Full syntax rules → CSS practice area.

### Common mistakes

| ❌ Incorrect | ✅ Correct |
| --- | --- |
| Mix StyleSheet + NativeWind / CSS + Tailwind in one feature | One styling system per feature |
| Hand prefixes, `0px`, `:before`, camelCase classes | Unprefixed modern CSS; `0`, `::before`, kebab-case |
| Dynamic `className={\`text-${color}\`}`; `@tailwind` + JS theme config in a web Tailwind v4 app | Complete class names; CSS-first `@import` + `@theme` (NativeWind v4 keeps its v3 config) |
| Code first on a free visual axis; purple/cream-serif/glow defaults | Two-pass design plan (color, type, layout, signature), then tokenized styles |
| Always-on decorative motion | Gate with reduced-motion / `motion-safe:` / repo helper |

## Workflow

1. Detect the styling stack and whether a design system / theme already locks
   the look (Match the repo).
2. If the visual axis is free: write the compact design plan, then revise
   generic AI defaults (Design plan + Avoid generic AI aesthetics). If locked,
   skip to tokens already in the repo.
3. Open only the matching Practice areas ref — don’t load every file.
4. Implement or review against Core Concepts and Common mistakes; express color /
   type / space as tokens, not one-off magic values.

## Practice areas

Read the reference for the task — don’t load every file.

| Area | Reference |
| --- | --- |
| CSS / SCSS / Sass / tokens / `light-dark()` / `color-mix()` / `text-wrap` / `@starting-style` / `@layer` / `@use` | [css-scss-sass.md](references/css-scss-sass.md) |
| Tailwind v4 / `@theme` / `@custom-variant` dark mode / renamed utilities / `@utility` / `@source` | [tailwind.md](references/tailwind.md) |
| NativeWind v4 / Tailwind v3 config / Metro / Babel / reduce motion / `cssInterop` / v5 RC | [nativewind.md](references/nativewind.md) |
